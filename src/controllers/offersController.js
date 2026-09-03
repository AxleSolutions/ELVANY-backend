import { supabase, isSupabaseReady } from '../config/supabase.js';

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
    'S (38)', 'M (40)', 'L (42)', 'XL (44)', 'XXL (46)'
  ];

  return {
    id: promo.id,
    code: promo.code,
    title: promo.title,
    badge: promo.badge_label || 'SPECIAL PRIVILEGE',
    productName: targetProduct?.title || promo.title,
    productId: targetProduct?.id || null,
    productImage: galleryImage,
    subtitle: targetProduct?.subtitle || targetProduct?.description || promo.badge_label || 'Exclusive Atelier privilege allocation.',
    category: targetProduct?.category || 'heavyweight-tees',
    originalPriceLKR: originalPrice,
    offerPriceLKR: offerPrice,
    discountTag: promo.discount_type === 'percentage' 
      ? `SAVE ${discountVal}%` 
      : `SAVE LKR ${discountVal.toLocaleString()}`,
    discountType: promo.discount_type || 'fixed_amount',
    discountValue: discountVal,
    minOrderAmount: parseFloat(promo.min_order_amount_lkr || 0),
    remainingUnits: promo.remaining_units !== undefined ? promo.remaining_units : null,
    totalAllocation: promo.total_allocation !== undefined ? promo.total_allocation : null,
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
      .neq('code', 'MAISON_RESTOCK_REGISTRY')
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
      expires_at
    } = req.body;

    const calculatedDiscount = discountValue !== undefined 
      ? parseFloat(discountValue) 
      : Math.max(0, (parseFloat(originalPriceLKR || 18500) - parseFloat(offerPriceLKR || 15500)));

    const appliedProducts = productId ? [productId] : [];
    const resolvedExpiry = endsAt || expiresAt || expires_at || null;

    const payload = {
      code: (code || `ELVANY-${Date.now().toString().slice(-4)}`).toUpperCase().trim(),
      title: title || productName || 'Privilege Allocation',
      badge_label: (badge || 'SPECIAL PRIVILEGE').slice(0, 80),
      discount_type: discountType === 'percentage' ? 'percentage' : 'fixed_amount',
      discount_value: calculatedDiscount,
      min_order_amount_lkr: parseFloat(minOrderAmount || 0),
      applied_product_ids: appliedProducts,
      is_active: isActive !== false,
      expires_at: resolvedExpiry
    };

    const { data, error } = await supabase
      .from('promotions')
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    // If linked to a product, also update is_offer_applied on that product
    if (productId) {
      await supabase
        .from('products')
        .update({ is_offer_applied: true })
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
      expires_at
    } = req.body;

    const resolvedExpiry = endsAt !== undefined ? endsAt : (expiresAt !== undefined ? expiresAt : expires_at);

    const payload = {};
    if (code !== undefined) payload.code = code.toUpperCase().trim();
    if (title !== undefined) payload.title = title;
    if (badge !== undefined) payload.badge_label = (badge || '').slice(0, 80);
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

    const { data, error } = await supabase
      .from('promotions')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

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

