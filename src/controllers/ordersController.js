import { supabase, isSupabaseReady } from '../config/supabase.js';

/**
 * Place a new order with optional bank payment slip
 */
export async function createOrder(req, res, next) {
  try {
    const {
      orderId,
      customerName,
      customerEmail,
      customerPhone,
      customerLocation,
      deliveryAddress,
      paymentMethod,
      items,
      subtotalLKR,
      deliveryFeeLKR,
      shippingFeeLKR,
      totalLKR,
      grandTotalLKR,
      savingsLKR,
      paymentSlipUrl,
      paymentSlipPublicId,
      paymentSlipName,
      isGift,
      giftMessage,
      deliveryNotes
    } = req.body;

    if (!orderId || !customerName || !customerEmail || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Incomplete order payload. Garment items, client name and email required.'
      });
    }

    const isQr = (paymentMethod || '').toLowerCase().includes('qr');
    const isBankTransfer = (paymentMethod || '').toLowerCase().includes('bank');
    const isBankOrQr = isQr || isBankTransfer;
    const initialStatus = isBankOrQr
      ? 'Pending Slip Verification'
      : 'Payment Verified — Processing Dispatch';

    const deliveryFee = Number(deliveryFeeLKR ?? shippingFeeLKR ?? 0);
    const subtotal = Number(subtotalLKR || totalLKR || 0);
    const grandTotal = Number(grandTotalLKR || totalLKR || (subtotal + deliveryFee));

    const userId = req.user?.id || null;

    // Construct full delivery address payload with rich item specs preserved
    const structuredAddress = {
      location: customerLocation || `${deliveryAddress?.streetAddress || ''}, ${deliveryAddress?.city || ''}, ${deliveryAddress?.country || ''}`,
      firstName: deliveryAddress?.firstName || customerName?.split(' ')[0] || '',
      lastName: deliveryAddress?.lastName || customerName?.split(' ').slice(1).join(' ') || '',
      recipientName: customerName,
      email: customerEmail,
      phone: customerPhone || deliveryAddress?.phone || '',
      streetAddress: deliveryAddress?.streetAddress || customerLocation || '',
      apartment: deliveryAddress?.apartment || '',
      city: deliveryAddress?.city || 'Colombo',
      postalCode: deliveryAddress?.postalCode || '',
      country: deliveryAddress?.country || 'Sri Lanka',
      deliveryNotes: deliveryNotes || deliveryAddress?.deliveryNotes || '',
      deliveryFeeLKR: deliveryFee,
      paymentType: isQr ? 'lanka_qr' : 'bank_transfer',
      specificPaymentMethod: isQr ? 'LankaQR Instant Transfer' : 'Direct Bank Transfer',
      isGift: Boolean(isGift),
      giftMessage: giftMessage || '',
      orderedItems: items || []
    };

    if (isSupabaseReady) {
      // 1. Insert Order Master Record (PostgreSQL enum accepts 'bank_transfer' or 'cod')
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          order_code: orderId,
          user_id: userId,
          customer_name: customerName,
          customer_email: customerEmail,
          customer_phone: customerPhone || '',
          delivery_address: structuredAddress,
          payment_method: 'bank_transfer',
          status: initialStatus,

          subtotal_lkr: subtotal,
          discount_lkr: savingsLKR || 0,
          grand_total_lkr: grandTotal,
          has_slip_attached: Boolean(paymentSlipUrl),
          payment_slip_url: paymentSlipUrl || null,
          payment_slip_public_id: paymentSlipPublicId || null,
          payment_slip_name: paymentSlipName || null,
          slip_uploaded_at: paymentSlipUrl ? new Date().toISOString() : null
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      // 2. Fetch all products from DB for accurate UUID line item linking
      const { data: dbProducts } = await supabase.from('products').select('id, title');

      // 3. Insert Order Line Items with all required fields
      const lineItems = items.map((item) => {
        let matchedProdId = item.productId || item.id;
        if (!matchedProdId || matchedProdId.length !== 36 || !matchedProdId.includes('-')) {
          const found = dbProducts?.find(p => p.title?.toLowerCase().trim() === (item.title || item.name || '').toLowerCase().trim());
          matchedProdId = found?.id || dbProducts?.[0]?.id || null;
        }

        const unitPrice = parseFloat(item.priceLKR || item.price || 18500);
        const origPrice = parseFloat(item.originalPriceLKR || item.priceLKR || item.price || 18500);

        return {
          order_id: order.id,
          product_id: matchedProdId,
          product_title: item.title || item.name || 'Haute Atelier Garment',
          color: item.color || 'Onyx Black',
          size: item.selectedSize || item.size || 'M (40)',
          unit_price_lkr: unitPrice,
          original_price_lkr: origPrice,
          quantity: parseInt(item.quantity || item.qty || 1, 10),
          product_image_url: item.image || '/images/hero_tshirt.jpg'
        };
      });

      const { error: itemsErr } = await supabase
        .from('order_items')
        .insert(lineItems);

      if (itemsErr) {
        console.warn('Order items insert notice:', itemsErr);
      }

      // 4. Decrement live stock in product_stock for purchased garment sizes
      for (const item of items) {
        const size = (item.selectedSize || item.size || '').trim();
        const orderedQty = parseInt(item.quantity || item.qty || 1, 10);
        const itemTitle = (item.title || item.name || '').trim().toLowerCase();

        try {
          // Find matching product
          let matchedProduct = dbProducts?.find(p => p.id === (item.productId || item.id));
          if (!matchedProduct && itemTitle) {
            matchedProduct = dbProducts?.find(p => p.title?.toLowerCase().trim() === itemTitle) || dbProducts?.[0];
          }

          if (matchedProduct) {
            const { data: variants } = await supabase
              .from('product_variants')
              .select('id, color_name')
              .eq('product_id', matchedProduct.id);

            if (variants && variants.length > 0) {
              const matchedVariant = (item.color 
                ? variants.find(v => v.color_name?.toLowerCase().trim() === item.color.toLowerCase().trim())
                : null) || variants[0];

              const variantId = matchedVariant.id;

              const { data: stockRows } = await supabase
                .from('product_stock')
                .select('id, size_code, stock_quantity')
                .eq('variant_id', variantId);

              if (stockRows && stockRows.length > 0) {
                const stockRow = stockRows.find(s => 
                  s.size_code.toLowerCase().trim() === size.toLowerCase().trim() ||
                  s.size_code.split(' ')[0].toLowerCase() === size.split(' ')[0].toLowerCase()
                ) || stockRows[0];

                if (stockRow) {
                  const currentStock = Number(stockRow.stock_quantity) || 0;
                  const newStock = Math.max(0, currentStock - orderedQty);
                  await supabase
                    .from('product_stock')
                    .update({ stock_quantity: newStock })
                    .eq('id', stockRow.id);
                  
                  console.log(`[Order #${orderId}] Reduced inventory for product "${matchedProduct.title}" size "${size}": ${currentStock} -> ${newStock}`);
                }
              }
            }
          }
        } catch (stkErr) {
          console.warn('Stock decrement notice:', stkErr);
        }
      }

      return res.status(201).json({
        success: true,
        message: `Order #${orderId} confirmed, saved in Supabase, and stock decremented.`,
        data: { ...order, items: lineItems }
      });

    }

    // Development Fallback response

    return res.status(201).json({
      success: true,
      message: `Order #${orderId} created in development mode.`,
      data: req.body
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get all orders (with item lines & slips)
 */
export async function getOrders(req, res, next) {
  try {
    if (!isSupabaseReady) {
      return res.status(200).json({
        success: true,
        message: 'Dev mode: Supabase not connected yet.',
        data: []
      });
    }

    let query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });

    // If client (non-admin), restrict to their own user_id
    const userRole = req.user?.user_metadata?.role || req.user?.role;
    if (userRole !== 'admin' && userRole !== 'concierge' && req.user?.id) {
      query = query.eq('user_id', req.user.id);
    }

    const { data: orders, error } = await query;
    if (error) throw error;

    const formattedOrders = (orders || []).map(o => {
      const storedItems = o.delivery_address?.orderedItems || [];
      const lineItems = (o.order_items || []).map(li => {
        const matched = storedItems.find(si => (si.id === li.product_id || (si.name || si.title) === li.product_title || (si.designCode && li.product_title?.includes(si.designCode))));
        return {
          id: li.id,
          productId: li.product_id,
          title: li.product_title,
          name: li.product_title,
          color: li.color,
          size: li.size,
          priceLKR: li.unit_price_lkr,
          originalPriceLKR: li.original_price_lkr,
          quantity: li.quantity,
          image: li.product_image_url || matched?.image || '/images/hero_tshirt.jpg',
          isBespokeCustom: matched?.isBespokeCustom || Boolean(matched?.designCode) || (li.product_title || '').toLowerCase().includes('custom') || (li.product_title || '').toLowerCase().includes('bespoke'),
          designCode: matched?.designCode || (li.product_title?.match(/BL-[A-Z0-9]{4,6}/)?.[0]) || null,
          fabric: matched?.fabric || matched?.fabricName || null,
          cut: matched?.cut || matched?.cutName || null,
          customPlacements: matched?.customPlacements || [],
          customNotes: matched?.customNotes || matched?.notes || null,
          artworks: matched?.artworks || {}
        };
      });

      return {
        ...o,
        items: lineItems.length > 0 ? lineItems : storedItems
      };
    });

    res.status(200).json({
      success: true,
      data: formattedOrders
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: Approve Bank Payment Slip
 */
export async function approvePaymentSlip(req, res, next) {
  try {
    const { orderCode } = req.params;

    if (!isSupabaseReady) {
      return res.status(200).json({
        success: true,
        message: `Slip for order #${orderCode} approved in dev mode.`,
        data: { orderCode, status: 'Payment Verified — Processing Dispatch' }
      });
    }

    const { data, error } = await supabase
      .from('orders')
      .update({
        status: 'Payment Verified — Processing Dispatch',
        slip_approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('order_code', orderCode)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: `Payment slip for order #${orderCode} verified and approved.`,
      data
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: Reject Bank Payment Slip (Request re-upload)
 */
export async function rejectPaymentSlip(req, res, next) {
  try {
    const { orderCode } = req.params;
    const { reason } = req.body;

    if (!isSupabaseReady) {
      return res.status(200).json({
        success: true,
        message: `Slip for order #${orderCode} rejected in dev mode.`,
        data: { orderCode, status: 'Slip Rejected — Awaiting New Receipt' }
      });
    }

    const { data, error } = await supabase
      .from('orders')
      .update({
        status: 'Slip Rejected — Awaiting New Receipt',
        slip_rejection_reason: reason || 'Payment slip illegible or amount mismatched.',
        updated_at: new Date().toISOString()
      })
      .eq('order_code', orderCode)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: `Payment slip for order #${orderCode} flagged as rejected.`,
      data
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update dispatch status
 */
export async function updateOrderStatus(req, res, next) {
  try {
    const { orderCode } = req.params;
    const { status } = req.body;

    if (!isSupabaseReady) {
      return res.status(200).json({
        success: true,
        message: `Order #${orderCode} updated to ${status} in dev mode.`
      });
    }

    const { data, error } = await supabase
      .from('orders')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('order_code', orderCode)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: `Order #${orderCode} status changed to ${status}.`,
      data
    });
  } catch (err) {
    next(err);
  }
}
