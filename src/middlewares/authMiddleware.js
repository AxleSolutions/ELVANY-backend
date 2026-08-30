import { supabase, isSupabaseReady } from '../config/supabase.js';

/**
 * Verify JWT authorization token from Supabase Auth
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token required.'
    });
  }

  const token = authHeader.split(' ')[1];

  if (!isSupabaseReady) {
    // Development fallback mock user
    req.user = { id: 'mock-user-id', email: 'julian.sterling@clientele.elvany.com', role: 'client' };
    return next();
  }

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired session. Please log in again.'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Authentication failed.',
      error: err.message
    });
  }
}

/**
 * Require Administrator or Concierge privilege
 */
export async function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  const role = req.user.user_metadata?.role || req.user.role || 'client';
  if (role !== 'admin' && role !== 'concierge') {
    return res.status(403).json({
      success: false,
      message: 'Access denied: Atelier administrator authorization required.'
    });
  }

  next();
}
