import { supabase, isSupabaseReady } from '../config/supabase.js';

export async function getProducts(req, res, next) {
  try {
    if (!isSupabaseReady) {
      return res.status(200).json({ success: true, data: [] });
    }

    const { data: products, error } = await supabase
      .from('products')
      .select('*, product_variants(*, product_stock(*))')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Attach active promotion offers directly to matching products
    const { data: promotions } = await supabase
      .from('promotions')
      .select('*')
      .eq('is_active', true);

    const now = new Date();
    const activePromos = (promotions || []).filter(pr => {
      if (pr.expires_at && new Date(pr.expires_at) < now) return false;
      return true;
    });

    const enrichedProducts = (products || []).map(p => {
      const origPrice = parseFloat(p.original_price_lkr || p.base_price_lkr || 18500);
      const basePrice = parseFloat(p.base_price_lkr || origPrice);

      const matchedPromo = activePromos.find(pr => 
        (Array.isArray(pr.applied_product_ids) && pr.applied_product_ids.includes(p.id)) ||
        (p.is_offer_applied && activePromos.length === 1)
      );

      if (matchedPromo) {
        const discVal = parseFloat(matchedPromo.discount_value || 0);
        let offPrice = basePrice;
        if (matchedPromo.discount_type === 'percentage') {
          offPrice = Math.round(basePrice * (1 - discVal / 100));
        } else {
          offPrice = Math.max(0, basePrice - discVal);
        }

        return {
          ...p,
          is_offer_applied: true,
          offer_price_lkr: offPrice,
          offerPriceLKR: offPrice,
          original_price_lkr: basePrice > offPrice ? basePrice : origPrice,
          originalPriceLKR: basePrice > offPrice ? basePrice : origPrice,
          discount_value: discVal,
          discount_type: matchedPromo.discount_type || 'fixed_amount',
          discount_tag: matchedPromo.discount_type === 'percentage' 
            ? `SAVE ${discVal}%` 
            : `SAVE LKR ${discVal.toLocaleString()}`,
          offer_code: matchedPromo.code
        };
      }

      return p;
    });

    res.status(200).json({ success: true, data: enrichedProducts });
  } catch (err) {
    next(err);
  }
}

export async function getProductBySlug(req, res, next) {
  try {
    const { slug } = req.params;

    if (!isSupabaseReady) {
      return res.status(200).json({ success: true, data: null });
    }

    const { data: product, error } = await supabase
      .from('products')
      .select('*, product_variants(*, product_stock(*))')
      .eq('slug', slug)
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data: product });
  } catch (err) {
    next(err);
  }
}

export async function createProduct(req, res, next) {
  try {
    if (!isSupabaseReady) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }

    const productData = req.body;
    const slug = (productData.title || 'garment')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '-' + Date.now().toString().slice(-4);

    const price = parseFloat(productData.price || productData.priceLKR || 18500);
    const sku = productData.sku || `ELV-${Date.now().toString().slice(-4)}`;

    // 1. Insert product record
    const { data: insertedProduct, error: prodErr } = await supabase
      .from('products')
      .insert({
        sku,
        slug,
        title: productData.title,
        subtitle: productData.subtitle || productData.silhouette || 'Noble Cotton Atelier Edition',
        category: productData.category || 'heavyweight',
        silhouette: productData.silhouette || 'Boxy Drop-Shoulder',
        base_price_lkr: price,
        original_price_lkr: parseFloat(productData.originalPriceLKR || price),
        is_active: productData.status !== 'Draft',
        is_offer_applied: Boolean(productData.isOfferApplied),
        fabric_composition: productData.composition || productData.fabric || '100% Noble Long-Staple Cotton',
        fabric_weight: productData.gsm ? `${productData.gsm} GSM` : (productData.weight || '280 GSM'),
        description: productData.description || 'Crafted in Florence and finished with minimalist atelier precision.'
      })
      .select()
      .single();

    if (prodErr) throw prodErr;

    // 2. Insert variant records with ordered Cloudinary images & colors
    const images = Array.isArray(productData.images) && productData.images.length > 0
      ? productData.images
      : [productData.image || '/images/hero_tshirt.webp'];

    const colorsList = Array.isArray(productData.colors) && productData.colors.length > 0
      ? productData.colors
      : [{ name: productData.color || 'Onyx Black', hex: productData.colorHex || '#121316', isDefault: true }];

    let primaryVariantId = null;

    for (let i = 0; i < colorsList.length; i++) {
      const col = colorsList[i];
      const isDefault = Boolean(col.isDefault) || i === 0;

      const { data: variant, error: varErr } = await supabase
        .from('product_variants')
        .insert({
          product_id: insertedProduct.id,
          color_name: col.name || 'Onyx Black',
          color_hex: col.hex || '#121316',
          is_default: isDefault,
          gallery_images: images
        })
        .select()
        .single();

      if (varErr) {
        console.warn('Variant insertion warning:', varErr);
      } else if (variant) {
        if (isDefault || !primaryVariantId) primaryVariantId = variant.id;

        // Insert stock rows for this variant
        if (productData.inventory && typeof productData.inventory === 'object') {
          const stockRows = Object.entries(productData.inventory).map(([sizeCode, qty]) => ({
            variant_id: variant.id,
            size_code: sizeCode,
            stock_quantity: Math.max(0, parseInt(qty, 10) || 0)
          }));

          if (stockRows.length > 0) {
            await supabase.from('product_stock').insert(stockRows);
          }
        }
      }
    }

    // 4. Fetch full product with relations
    const { data: fullProduct } = await supabase
      .from('products')
      .select('*, product_variants(*, product_stock(*))')
      .eq('id', insertedProduct.id)
      .single();

    res.status(201).json({
      success: true,
      message: 'Luxury garment successfully created in atelier database.',
      data: fullProduct || insertedProduct
    });
  } catch (err) {
    next(err);
  }
}

export async function updateProduct(req, res, next) {
  try {
    if (!isSupabaseReady) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }

    const { id } = req.params;
    const productData = req.body;

    const price = parseFloat(productData.price || productData.priceLKR || 18500);

    // 1. Update product table
    const { data: updatedProduct, error: updateErr } = await supabase
      .from('products')
      .update({
        title: productData.title,
        subtitle: productData.subtitle || productData.silhouette,
        category: productData.category,
        silhouette: productData.silhouette,
        base_price_lkr: price,
        original_price_lkr: parseFloat(productData.originalPriceLKR || price),
        is_active: productData.status !== 'Draft',
        is_offer_applied: Boolean(productData.isOfferApplied),
        fabric_composition: productData.composition || productData.fabric,
        fabric_weight: productData.gsm ? `${productData.gsm} GSM` : productData.weight,
        description: productData.description
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) throw updateErr;

    // 2. Update variant images across all product variants so deleted images do not persist
    const images = Array.isArray(productData.images)
      ? productData.images
      : (productData.image ? [productData.image] : ['/images/hero_tshirt.webp']);

    const defaultColorName = productData.color || (productData.colors?.[0]?.name) || 'Onyx Black';
    const defaultColorHex = productData.colorHex || (productData.colors?.[0]?.hex) || '#121316';

    // Update gallery_images for ALL variants belonging to this product
    await supabase
      .from('product_variants')
      .update({ gallery_images: images })
      .eq('product_id', id);

    let { data: variant } = await supabase
      .from('product_variants')
      .select('id')
      .eq('product_id', id)
      .limit(1)
      .maybeSingle();

    if (variant) {
      await supabase
        .from('product_variants')
        .update({ 
          color_name: defaultColorName,
          color_hex: defaultColorHex
        })
        .eq('id', variant.id);

      if (productData.inventory && typeof productData.inventory === 'object') {
        for (const [sizeCode, qty] of Object.entries(productData.inventory)) {
          await supabase
            .from('product_stock')
            .upsert({
              variant_id: variant.id,
              size_code: sizeCode,
              stock_quantity: Math.max(0, parseInt(qty, 10) || 0)
            }, { onConflict: 'variant_id,size_code' });
        }
      }
    } else {
      // Create primary variant if not existing
      const { data: newVar } = await supabase
        .from('product_variants')
        .insert({
          product_id: id,
          color_name: defaultColorName,
          color_hex: defaultColorHex,
          is_default: true,
          gallery_images: images
        })
        .select()
        .single();

      if (newVar && productData.inventory && typeof productData.inventory === 'object') {
        const stockRows = Object.entries(productData.inventory).map(([sizeCode, qty]) => ({
          variant_id: newVar.id,
          size_code: sizeCode,
          stock_quantity: Math.max(0, parseInt(qty, 10) || 0)
        }));
        if (stockRows.length > 0) {
          await supabase.from('product_stock').insert(stockRows);
        }
      }
    }

    // 3. Fetch hydrated product
    const { data: fullProduct } = await supabase
      .from('products')
      .select('*, product_variants(*, product_stock(*))')
      .eq('id', id)
      .single();

    res.status(200).json({
      success: true,
      message: 'Garment successfully updated in database.',
      data: fullProduct || updatedProduct
    });
  } catch (err) {
    next(err);
  }
}

export async function toggleProductStatus(req, res, next) {
  try {
    if (!isSupabaseReady) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }

    const { id } = req.params;
    const { isActive } = req.body;

    const { data: updated, error } = await supabase
      .from('products')
      .update({ is_active: Boolean(isActive), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: `Garment status updated to ${isActive ? 'Active' : 'Deactivated'}.`,
      data: updated
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteProduct(req, res, next) {
  try {
    if (!isSupabaseReady) {
      return res.status(503).json({ success: false, message: 'Database not connected' });
    }

    const { id } = req.params;

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.status(200).json({
      success: true,
      message: 'Garment removed from catalog.',
      data: { id }
    });
  } catch (err) {
    next(err);
  }
}
