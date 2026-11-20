import { supabase, isSupabaseReady } from '../config/supabase.js';

export function parseBadgeAllocation(rawBadge) {
  if (!rawBadge || typeof rawBadge !== 'string') {
    return { cleanBadge: 'SPECIAL PRIVILEGE', soldUnits: null, remainingUnits: null, totalAllocation: null };
  }
  const match = rawBadge.match(/\s*\[ALLOC:(\d+)\/(\d+)\/(\d+)\]\s*$/i);
  if (match) {
    const sold = parseInt(match[1], 10);
    const remain = parseInt(match[2], 10);
    const total = parseInt(match[3], 10);
    const cleanBadge = rawBadge.replace(/\s*\[ALLOC:\d+\/\d+\/\d+\]\s*$/i, '').trim() || 'SPECIAL PRIVILEGE';
    return {
      cleanBadge,
      soldUnits: isNaN(sold) ? null : sold,
      remainingUnits: isNaN(remain) ? null : remain,
      totalAllocation: isNaN(total) ? null : total
    };
  }
  return { cleanBadge: rawBadge.trim(), soldUnits: null, remainingUnits: null, totalAllocation: null };
}

export function formatBadgeWithAllocation(cleanBadge, soldUnits, remainingUnits, totalAllocation) {
  const base = (cleanBadge || 'SPECIAL PRIVILEGE').replace(/\s*\[ALLOC:\d+\/\d+\/\d+\]\s*$/i, '').trim();
  const sold = Math.max(0, parseInt(soldUnits, 10) || 0);
  const remain = Math.max(0, parseInt(remainingUnits, 10) || 0);
  const total = Math.max(sold + remain, parseInt(totalAllocation, 10) || (sold + remain) || 25);
  const tag = ` [ALLOC:${sold}/${remain}/${total}]`;
  if ((base.length + tag.length) > 80) {
    const truncatedBase = base.slice(0, 80 - tag.length);
    return `${truncatedBase}${tag}`;
  }
  return `${base}${tag}`;
}

function formatOffer(promo, productsMap = {}) {
  const productId = Array.isArray(promo.applied_product_ids) && promo.applied_product_ids.length > 0
    ? promo.applied_product_ids[0]
    : null;

  const linkedProduct = productId ? productsMap[productId] : null;
  const fallbackProduct = Object.values(productsMap)[0] || null;
  const targetProduct = linkedProduct || fallbackProduct;

  const originalPrice = targetProduct 
    ? parseFloat(targetProduct.original_price_lkr || targetProduct.base_price_lkr || 18500)
    : 18500;
  
  const discountVal = parseFloat(promo.discount_value || 3000);
  const offerPrice = promo.discount_type === 'percentage'
    ? Math.round(originalPrice * (1 - discountVal / 100))
    : Math.max(0, originalPrice - discountVal);

  const defaultVariant = targetProduct?.product_variants?.find(v => v.is_default) || targetProduct?.product_variants?.[0];
  const galleryImage = defaultVariant?.gallery_images?.[0] || '/images/hero_tshirt.webp';

  const sizes = defaultVariant?.product_stock?.map(s => s.size_code) || [
    'XS', 'S', 'M', 'L', 'XL', '2XL'
  ];

  const alloc = parseBadgeAllocation(promo.badge_label);
  const remainingUnits = typeof promo.remaining_units === 'number'
    ? promo.remaining_units
    : (alloc.remainingUnits !== null ? alloc.remainingUnits : 12);
  const soldUnits = typeof promo.sold_units === 'number'
    ? promo.sold_units
    : (alloc.soldUnits !== null ? alloc.soldUnits : Math.max(0, (alloc.totalAllocation || 25) - remainingUnits));
  const totalAllocation = typeof promo.total_allocation === 'number'
    ? promo.total_allocation
    : (alloc.totalAllocation !== null ? alloc.totalAllocation : (soldUnits + remainingUnits));

  return {
    id: promo.id,
    code: promo.code,
    title: promo.title,
    badge: alloc.cleanBadge || 'SPECIAL PRIVILEGE',
    productName: targetProduct?.title || promo.title,
    productId: targetProduct?.id || null,
    productImage: galleryImage,
    subtitle: targetProduct?.subtitle || targetProduct?.description || alloc.cleanBadge || 'Exclusive Atelier privilege allocation.',
    category: targetProduct?.category || 'heavyweight-tees',
    originalPriceLKR: originalPrice,
    offerPriceLKR: offerPrice,
    discountTag: promo.discount_type === 'percentage' 
      ? `SAVE ${discountVal}%` 
      : `SAVE LKR ${discountVal.toLocaleString()}`,
    discountType: promo.discount_type || 'fixed_amount',
    discountValue: discountVal,
    minOrderAmount: parseFloat(promo.min_order_amount_lkr || 0),
    remainingUnits,
    totalAllocation,
    soldUnits,
    availableSizes: sizes,
    isActive: promo.is_active !== false,
    endsAt: promo.expires_at || promo.ends_at || null,
    expiresAt: promo.expires_at || promo.ends_at || null,
    createdAt: promo.created_at
  };
}

export async function getOffers(req, res, next) {
  try {
    if (!isSupabaseReady) {
      return res.status(200).json({ success: true, data: [] });
    }

    let query = supabase
      .from('promotions')
      .select('*')
      .not('code', 'ilike', '%RESTOCK_REGISTRY%')
      .order('created_at', { ascending: false });

    if (req.query.activeOnly === 'true') {
      query = query.eq('is_active', true);
    }

    const { data: promotions, error: promoError } = await query;
    if (promoError) throw promoError;

    // Fetch products to hydrate offer relations
    const { data: products } = await supabase
      .from('products')
      .select('*, product_variants(*, product_stock(*))');

    const productsMap = {};
    (products || []).forEach(p => {
      productsMap[p.id] = p;
    });

    const formattedOffers = (promotions || []).map(p => formatOffer(p, productsMap));

    res.status(200).json({ success: true, data: formattedOffers });
  } catch (err) {
    next(err);
  }
}

export async function createOffer(req, res, next) {
  try {
    if (!isSupabaseReady) {
      return res.status(503).json({ success: false, message: 'Database service not available' });
    }

    const {
      code,
      title,
      badge,
      productName,
      productId,
      originalPriceLKR,
      offerPriceLKR,
      discountType = 'fixed_amount',
      discountValue,
      minOrderAmount = 0,
      isActive = true,
      endsAt,
      expiresAt,
      expires_at,
      remainingUnits,
      remaining_units,
      totalAllocation,
      total_allocation
    } = req.body;

    const calculatedDiscount = discountValue !== undefined 
      ? parseFloat(discountValue) 
      : Math.max(0, (parseFloat(originalPriceLKR || 18500) - parseFloat(offerPriceLKR || 15500)));

    const appliedProducts = productId ? [productId] : [];
    const resolvedExpiry = endsAt || expiresAt || expires_at || null;
    const finalRemain = remainingUnits !== undefined ? parseInt(remainingUnits, 10) : (remaining_units !== undefined ? parseInt(remaining_units, 10) : 12);
    const finalSold = req.body.soldUnits !== undefined ? parseInt(req.body.soldUnits, 10) : 13;
    const finalTotal = totalAllocation !== undefined ? parseInt(totalAllocation, 10) : (total_allocation !== undefined ? parseInt(total_allocation, 10) : (finalSold + finalRemain));

    const isExpired = resolvedExpiry ? (new Date(resolvedExpiry).getTime() <= Date.now()) : false;
    const isOutOfStock = finalRemain !== undefined && finalRemain <= 0;
    const shouldApplyToProduct = isActive !== false && !isExpired && !isOutOfStock;

    const encodedBadge = formatBadgeWithAllocation(badge || 'SPECIAL PRIVILEGE', finalSold, finalRemain, finalTotal);

    const payload = {
      code: (code || `ELVANY-${Date.now().toString().slice(-4)}`).toUpperCase().trim(),
      title: title || productName || 'Privilege Allocation',
      badge_label: encodedBadge,
      discount_type: discountType === 'percentage' ? 'percentage' : 'fixed_amount',
      discount_value: calculatedDiscount,
      min_order_amount_lkr: parseFloat(minOrderAmount || 0),
      applied_product_ids: appliedProducts,
      is_active: isActive !== false,
      expires_at: resolvedExpiry
    };

    let data;
    try {
      const resInsert = await supabase
        .from('promotions')
        .insert({ ...payload, remaining_units: finalRemain, total_allocation: finalTotal })
        .select()
        .single();
      if (resInsert.error) throw resInsert.error;
      data = resInsert.data;
    } catch (insertErr) {
      const resInsert2 = await supabase
        .from('promotions')
        .insert(payload)
        .select()
        .single();
      if (resInsert2.error) throw resInsert2.error;
      data = resInsert2.data;
    }

    // If linked to a product, also update is_offer_applied on that product
    if (productId) {
      await supabase
        .from('products')
        .update({ is_offer_applied: shouldApplyToProduct })
        .eq('id', productId);
    }

    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function updateOffer(req, res, next) {
  try {
    if (!isSupabaseReady) {
      return res.status(503).json({ success: false, message: 'Database service not available' });
    }

    const { id } = req.params;
    const {
      code,
      title,
      badge,
      productName,
      productId,
      originalPriceLKR,
      offerPriceLKR,
      discountType = 'fixed_amount',
      discountValue,
      minOrderAmount = 0,
      isActive,
      endsAt,
      expiresAt,
      expires_at,
      remainingUnits,
      remaining_units,
      totalAllocation,
      total_allocation
    } = req.body;

    const resolvedExpiry = endsAt !== undefined ? endsAt : (expiresAt !== undefined ? expiresAt : expires_at);
    const finalRemain = remainingUnits !== undefined ? parseInt(remainingUnits, 10) : (remaining_units !== undefined ? parseInt(remaining_units, 10) : undefined);
    const finalSold = req.body.soldUnits !== undefined ? parseInt(req.body.soldUnits, 10) : undefined;
    const finalTotal = totalAllocation !== undefined ? parseInt(totalAllocation, 10) : (total_allocation !== undefined ? parseInt(total_allocation, 10) : undefined);

    const isExpired = resolvedExpiry ? (new Date(resolvedExpiry).getTime() <= Date.now()) : false;
    const isOutOfStock = finalRemain !== undefined && finalRemain <= 0;
    const shouldApplyToProduct = isActive !== false && !isExpired && !isOutOfStock;

    const payload = {};
    if (code !== undefined) payload.code = code.toUpperCase().trim();
    if (title !== undefined) payload.title = title;
    if (badge !== undefined || finalRemain !== undefined || finalSold !== undefined || finalTotal !== undefined) {
      const currentSold = finalSold !== undefined ? finalSold : 13;
      const currentRemain = finalRemain !== undefined ? finalRemain : 12;
      const currentTotal = finalTotal !== undefined ? finalTotal : (currentSold + currentRemain);
      payload.badge_label = formatBadgeWithAllocation(badge || 'SPECIAL PRIVILEGE', currentSold, currentRemain, currentTotal);
    }
    if (discountType !== undefined) payload.discount_type = discountType;
    if (discountValue !== undefined) {
      payload.discount_value = parseFloat(discountValue);
    } else if (originalPriceLKR !== undefined && offerPriceLKR !== undefined) {
      payload.discount_value = Math.max(0, parseFloat(originalPriceLKR) - parseFloat(offerPriceLKR));
    }
    if (minOrderAmount !== undefined) payload.min_order_amount_lkr = parseFloat(minOrderAmount);
    if (productId !== undefined) {
      payload.applied_product_ids = productId ? [productId] : [];
    }
    if (resolvedExpiry !== undefined) {
      payload.expires_at = resolvedExpiry;
    }
    if (isActive !== undefined) {
      payload.is_active = isActive;
    }

    let data;
    try {
      const extraPayload = { ...payload };
      if (finalRemain !== undefined) extraPayload.remaining_units = finalRemain;
      if (finalTotal !== undefined) extraPayload.total_allocation = finalTotal;
      const resUpdate = await supabase
        .from('promotions')
        .update(extraPayload)
        .eq('id', id)
        .select()
        .single();
      if (resUpdate.error) throw resUpdate.error;
      data = resUpdate.data;
    } catch (updateErr) {
      const resUpdate2 = await supabase
        .from('promotions')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (resUpdate2.error) throw resUpdate2.error;
      data = resUpdate2.data;
    }

    if (productId) {
      await supabase
        .from('products')
        .update({ is_offer_applied: shouldApplyToProduct })
        .eq('id', productId);
    }

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}


export async function toggleOfferStatus(req, res, next) {
  try {
    if (!isSupabaseReady) {
      return res.status(503).json({ success: false, message: 'Database service not available' });
    }

    const { id } = req.params;
    const { isActive } = req.body;

    const { data, error } = await supabase
      .from('promotions')
      .update({ is_active: isActive })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // If turned off, deactivate offer on linked product
    if (isActive === false && Array.isArray(data?.applied_product_ids) && data.applied_product_ids.length > 0) {
      await supabase
        .from('products')
        .update({ is_offer_applied: false })
        .in('id', data.applied_product_ids);
    }

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteOffer(req, res, next) {
  try {
    if (!isSupabaseReady) {
      return res.status(503).json({ success: false, message: 'Database service not available' });
    }

    const { id } = req.params;

    // Get offer first to find linked products
    const { data: promo } = await supabase
      .from('promotions')
      .select('applied_product_ids')
      .eq('id', id)
      .single();

    if (Array.isArray(promo?.applied_product_ids) && promo.applied_product_ids.length > 0) {
      await supabase
        .from('products')
        .update({ is_offer_applied: false })
        .in('id', promo.applied_product_ids);
    }

    const { error } = await supabase
      .from('promotions')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({ success: true, message: 'Promotion offer deleted successfully' });
  } catch (err) {
    next(err);
  }
}

