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

    res.status(200).json({ success: true, data: products });
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

    // 2. Insert variant record with Cloudinary images
    const primaryImg = productData.image || (Array.isArray(productData.images) ? productData.images[0] : null) || '/images/hero_tshirt.jpg';
    const otherImgs = (Array.isArray(productData.images) ? productData.images : []).filter(img => img && img !== primaryImg);
    const images = [primaryImg, ...otherImgs];

    const { data: variant, error: varErr } = await supabase
      .from('product_variants')
      .insert({
        product_id: insertedProduct.id,
        color_name: productData.color || 'Onyx Black',
        color_hex: productData.colorHex || '#141518',
        is_default: true,
        gallery_images: images
      })
      .select()
      .single();

    if (varErr) throw varErr;


    // 3. Insert stock rows for each size
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

    // 2. Update variant images & stock
    const primaryImg = productData.image || (Array.isArray(productData.images) ? productData.images[0] : null) || '/images/hero_tshirt.jpg';
    const otherImgs = (Array.isArray(productData.images) ? productData.images : []).filter(img => img && img !== primaryImg);
    const images = [primaryImg, ...otherImgs];

    let { data: variant } = await supabase
      .from('product_variants')
      .select('id')
      .eq('product_id', id)
      .limit(1)
      .maybeSingle();

    if (variant) {
      await supabase
        .from('product_variants')
        .update({ gallery_images: images })
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
