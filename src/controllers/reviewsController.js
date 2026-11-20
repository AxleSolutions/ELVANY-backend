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
      fitRating,
      imageUrl,
      images
    } = req.body;

    const resolvedComment = comment || content;
    const resolvedName = clientName || author || 'Verified Client';
    const resolvedLocation = clientLocation || location || 'Sri Lanka';
    const resolvedImageUrl = imageUrl || (Array.isArray(images) && images[0]) || null;
    const resolvedImages = Array.isArray(images) && images.length > 0 ? images : (resolvedImageUrl ? [resolvedImageUrl] : []);

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

      // Check for duplicate review for this order and garment (Only one review permitted per purchased garment)
      if (resolvedOrderId || orderId) {
        try {
          const { data: existingList } = await supabase
            .from('reviews')
            .select('id, comment, order_id, product_id');

          if (Array.isArray(existingList) && existingList.length > 0) {
            const cleanOrd = (orderId || '').toUpperCase().trim();
            const cleanProd = (productId || '').toLowerCase().trim();
            const hasDuplicate = existingList.some((r) => {
              const orderMatches = (resolvedOrderId && r.order_id === resolvedOrderId) ||
                                  (cleanOrd && r.comment && r.comment.toUpperCase().includes(`[ORDER: ${cleanOrd}]`));
              const prodMatches = (resolvedProductId && r.product_id === resolvedProductId) ||
                                 (cleanProd && r.comment && r.comment.toLowerCase().includes(`[item: ${cleanProd}]`));
              return orderMatches && (prodMatches || !cleanProd);
            });

            if (hasDuplicate) {
              return res.status(409).json({
                success: false,
                message: `An authenticated evaluation for Order #${orderId} and this garment has already been recorded.`
              });
            }
          }
        } catch (dupErr) {
          console.warn('Duplicate review check notice:', dupErr);
        }
      }

      // Tag order and item identifiers in comment so they persist regardless of foreign key schema
      let taggedComment = resolvedComment;
      if (orderId && !taggedComment.includes(`[Order: ${orderId}]`)) {
        taggedComment = `${taggedComment}\n\n[Order: ${orderId}]`;
      }
      if (productId && !taggedComment.includes(`[Item: ${productId}]`)) {
        taggedComment = `${taggedComment} [Item: ${productId}]`;
      }

      // First attempt: insert with image_url and images columns
      let review = null;
      let insertError = null;

      try {
        const insertRes = await supabase
          .from('reviews')
          .insert({
            product_id: resolvedProductId,
            order_id: resolvedOrderId,
            user_id: req.user?.id || null,
            client_name: resolvedName,
            client_location: resolvedLocation,
            rating: Number(rating) || 5,
            title: title || 'Verified Atelier Review',
            comment: taggedComment,
            image_url: resolvedImageUrl,
            images: resolvedImages,
            is_verified_buyer: true,
            status: 'published'
          })
          .select()
          .single();

        review = insertRes.data;
        insertError = insertRes.error;
      } catch (colErr) {
        insertError = colErr;
      }

      // If column image_url/images does not exist yet in table, fallback to tagging comment
      if (insertError) {
        console.info('Retrying review insert with comment photo tag fallback:', insertError.message);
        const taggedComment = resolvedImageUrl ? `${resolvedComment}\n\n[Client Photo: ${resolvedImageUrl}]` : resolvedComment;
        const retryRes = await supabase
          .from('reviews')
          .insert({
            product_id: resolvedProductId,
            order_id: resolvedOrderId,
            user_id: req.user?.id || null,
            client_name: resolvedName,
            client_location: resolvedLocation,
            rating: Number(rating) || 5,
            title: title || 'Verified Atelier Review',
            comment: taggedComment,
            is_verified_buyer: true,
            status: 'published'
          })
          .select()
          .single();

        if (retryRes.error) throw retryRes.error;
        review = retryRes.data;
      }

      return res.status(201).json({
        success: true,
        message: 'Review published successfully to database.',
        data: {
          ...review,
          imageUrl: resolvedImageUrl,
          images: resolvedImages
        }
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

    const formatted = (reviews || []).map(r => {
      let imgUrl = r.image_url || r.imageUrl || null;
      let imgs = Array.isArray(r.images) && r.images.length > 0 ? r.images : (imgUrl ? [imgUrl] : []);
      let cleanComment = r.comment || '';

      const photoMatch = cleanComment.match(/\[Client Photo:\s*([^\]]+)\]/i);
      if (photoMatch) {
        if (!imgUrl) imgUrl = photoMatch[1].trim();
        if (imgs.length === 0) imgs = [photoMatch[1].trim()];
        cleanComment = cleanComment.replace(/\[Client Photo:\s*[^\]]+\]/i, '').trim();
      }

      const orderTagMatch = cleanComment.match(/\[Order:\s*([^\]]+)\]/i);
      const parsedOrderId = orderTagMatch ? orderTagMatch[1].trim() : null;
      const itemTagMatch = cleanComment.match(/\[Item:\s*([^\]]+)\]/i);
      const parsedProductId = itemTagMatch ? itemTagMatch[1].trim() : null;

      if (orderTagMatch) {
        cleanComment = cleanComment.replace(/\[Order:\s*[^\]]+\]/i, '').trim();
      }
      if (itemTagMatch) {
        cleanComment = cleanComment.replace(/\[Item:\s*[^\]]+\]/i, '').trim();
      }

      const resolvedOrderId = parsedOrderId || r.order_id;
      const resolvedProdId = parsedProductId || r.product_id;

      return {
        id: r.id,
        productId: resolvedProdId,
        product_id: resolvedProdId,
        orderId: resolvedOrderId,
        order_id: resolvedOrderId,
        orderCode: resolvedOrderId,
        customerName: r.client_name || r.customer_name || 'VIP Client',
        author: r.client_name || r.customer_name || 'VIP Client',
        customerEmail: r.customer_email || 'client@elvany.com',
        title: r.title || 'Exceptional Quality',
        productTitle: r.products?.title || r.product_title || r.title || 'Heavyweight Atelier Tee',
        rating: Number(r.rating) || 5,
        fitRating: r.fit_rating || 'True to Atelier Boxy Spec',
        comment: cleanComment,
        content: cleanComment,
        imageUrl: imgUrl,
        image_url: imgUrl,
        images: imgs,
        location: r.client_location || 'Sri Lanka',
        date: new Date(r.created_at || Date.now()).toLocaleDateString(),
        status: r.status === 'published' ? 'Approved' : (r.status || 'Approved'),
        isFeatured: r.is_featured || false,
        helpfulCount: r.helpful_votes || 0
      };
    });

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


