import express from 'express';
import { supabase, isSupabaseReady } from '../config/supabase.js';

const router = express.Router();

/**
 * POST /api/auth/reset-password
 * Admin-level password reset synchronization for Supabase Auth
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email and new password are required.' });
    }

    if (isSupabaseReady && supabase?.auth?.admin) {
      try {
        const { data: userList, error: listError } = await supabase.auth.admin.listUsers();
        if (!listError && userList?.users) {
          const user = userList.users.find(u => u.email?.toLowerCase().trim() === email.toLowerCase().trim());
          if (user) {
            const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
              password: newPassword
            });
            if (!updateError) {
              return res.json({ success: true, message: 'Password updated successfully in Supabase Auth.' });
            }
          }
        }
      } catch (err) {
        console.warn('Backend Supabase admin password update notice:', err.message);
      }
    }

    return res.json({ success: true, message: 'Password reset processed.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
