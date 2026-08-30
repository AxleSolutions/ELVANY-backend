import { supabase, isSupabaseReady } from '../config/supabase.js';

export async function createReview(req, res, next) {
  try {
    const { 
      productId, 
      orderId, 
      rating = 5, 
      title = 'Exceptional Craftsmanship', 
      comment, 
      content,
      clientName, 
      author,
      clientLocation,
      location,
      fitRating
    } = req.body;

    const resolvedComment = comment || content;
    const resolvedName = clientName || author || 'Verified Client';
    const resolvedLocation = clientLocation || location || 'Sri Lanka';

    if (!resolvedComment) {
      return res.status(400).json({
        success: false,
        message: 'Review comment is required.'
      });
    }

    if (isSupabaseReady) {
      let resolvedProductId = productId;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId || '');
      
      if (!isUuid && productId) {
        try {
          const { data: prod } = await supabase
            .from('products')
            .select('id')
            .or(`slug.eq.${productId},title.ilike.%${productId}%`)
            .limit(1)
            .maybeSingle();
          if (prod?.id) {
            resolvedProductId = prod.id;
          } else {
            const { data: firstProd } = await supabase.from('products').select('id').limit(1).maybeSingle();
            if (firstProd?.id) resolvedProductId = firstProd.id;
          }
        } catch (e) {
          console.warn('Product ID resolution notice:', e);
        }
      }

      let resolvedOrderId = null;
      if (orderId) {
        const isOrderUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
        if (isOrderUuid) {
          resolvedOrderId = orderId;
        } else {
          try {
            const { data: ord } = await supabase
              .from('orders')
              .select('id')
              .eq('order_code', orderId)
              .limit(1)
              .maybeSingle();
            if (ord?.id) {
              resolvedOrderId = ord.id;
            }
          } catch (e) {
            console.warn('Order ID resolution notice:', e);
          }
        }
      }

      const { data: review, error } = await supabase
        .from('reviews')
        .insert({
          product_id: resolvedProductId,
          order_id: resolvedOrderId,
          user_id: req.user?.id || null,
          client_name: resolvedName,
          client_location: resolvedLocation,
          rating: Number(rating) || 5,
          title: title || 'Verified Atelier Review',
          comment: resolvedComment,
          is_verified_buyer: true,
          status: 'published'
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({
        success: true,
        message: 'Review published successfully to database.',
        data: review
      });
    }


    return res.status(201).json({
      success: true,
      message: 'Review registered in local mode.',
      data: req.body
    });
  } catch (err) {
    next(err);
  }
}


export async function getAllReviews(req, res, next) {
  try {
    if (!isSupabaseReady) {
      return res.status(200).json({ success: true, data: [] });
    }

    const { data: reviews, error } = await supabase
      .from('reviews')
      .select('*, products(title)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formatted = (reviews || []).map(r => ({
      id: r.id,
      productId: r.product_id,
      product_id: r.product_id,
      orderId: r.order_id,
      order_id: r.order_id,
      customerName: r.client_name || r.customer_name || 'VIP Client',
      author: r.client_name || r.customer_name || 'VIP Client',
      customerEmail: r.customer_email || 'client@elvany.com',
      title: r.title || 'Exceptional Quality',
      productTitle: r.products?.title || r.product_title || r.title || 'Heavyweight Atelier Tee',
      rating: Number(r.rating) || 5,
      fitRating: r.fit_rating || 'True to Atelier Boxy Spec',
      comment: r.comment || '',
      content: r.comment || '',
      location: r.client_location || 'Colombo, Sri Lanka',
      date: new Date(r.created_at || Date.now()).toLocaleDateString(),
      status: r.status === 'published' ? 'Approved' : (r.status || 'Approved'),
      isFeatured: r.is_featured || false,
      helpfulCount: r.helpful_votes || 0
    }));

    res.status(200).json({ success: true, data: formatted });

  } catch (err) {
    next(err);
  }
}

export async function updateReviewStatus(req, res, next) {
  try {
    if (!isSupabaseReady) {
      return res.status(503).json({ success: false, message: 'Database not available' });
    }

    const { id } = req.params;
    const { status, isFeatured } = req.body;

    const updates = {};
    if (status !== undefined) updates.status = status;
    if (isFeatured !== undefined) updates.is_featured = isFeatured;

    const { data, error } = await supabase
      .from('reviews')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

export async function deleteReview(req, res, next) {
  try {
    const { id } = req.params;

    if (isSupabaseReady) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      if (isUUID) {
        const { error } = await supabase
          .from('reviews')
          .delete()
          .eq('id', id);

        if (error) {
          console.warn('Supabase review delete error:', error);
          throw error;
        }
      }
    }

    res.status(200).json({ success: true, message: 'Review deleted successfully' });
  } catch (err) {
    next(err);
  }
}


