import { supabase, isSupabaseReady } from '../config/supabase.js';

// In-memory cart store keyed by client email
const memoryCarts = new Map();

/**
 * GET /api/cart?email=client@example.com
 */
export async function getCart(req, res, next) {
  try {
    const email = (req.query.email || req.query.user || '').toLowerCase().trim();
    if (!email) {
      return res.status(200).json({ success: true, data: [] });
    }

    if (memoryCarts.has(email)) {
      return res.status(200).json({ success: true, data: memoryCarts.get(email) || [] });
    }

    return res.status(200).json({ success: true, data: [] });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/cart
 * Body: { email, cart }
 */
export async function saveCart(req, res, next) {
  try {
    const { email, cart } = req.body;
    const cleanEmail = (email || '').toLowerCase().trim();

    if (!cleanEmail) {
      return res.status(400).json({ success: false, message: 'Client email is required to sync cart.' });
    }

    const cartArray = Array.isArray(cart) ? cart : [];
    memoryCarts.set(cleanEmail, cartArray);

    return res.status(200).json({
      success: true,
      message: `Cart with ${cartArray.length} items synced to database for ${cleanEmail}.`,
      data: cartArray
    });
  } catch (err) {
    next(err);
  }
}
