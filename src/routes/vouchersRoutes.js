import express from 'express';
import { supabase, isSupabaseReady } from '../config/supabase.js';

const router = express.Router();

/**
 * GET /api/vouchers
 * Fetch all registered atelier vouchers from Supabase
 */
router.get('/', async (req, res) => {
  try {
    if (!isSupabaseReady || !supabase) {
      return res.status(200).json({ success: true, data: [] });
    }

    const { data: promoVouchers, error } = await supabase
      .from('promotions')
      .select('*')
      .or('title.ilike.%[ATELIER_VOUCHER]%,badge_label.ilike.VOUCH:%')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Backend GET vouchers error:', error);
      return res.status(200).json({ success: true, data: [] });
    }

    const vouchers = (promoVouchers || []).map(p => {
      let extra = {};
      try {
        const rawBadge = p.badge_label || '';
        const jsonStr = rawBadge.startsWith('VOUCH:') ? rawBadge.slice(6) : (rawBadge.startsWith('{') ? rawBadge : '{}');
        extra = JSON.parse(jsonStr);
      } catch {}

      const isPercentage = extra.discountType === 'percentage' || p.discount_type === 'percentage';
      const isUsed = Boolean(extra.isUsed || (extra.usedCount >= (extra.maxUses || 1)));

      return {
        id: p.id,
        code: String(p.code || '').toUpperCase().trim(),
        discountType: isPercentage ? 'percentage' : 'fixed',
        discountValue: parseFloat(p.discount_value || 0),
        minOrderAmount: parseFloat(p.min_order_amount_lkr || 0),
        maxUses: parseInt(extra.maxUses || 1, 10),
        usedCount: parseInt(extra.usedCount || (isUsed ? 1 : 0), 10),
        isUsed,
        isActive: p.is_active !== false,
        expiresAt: p.expires_at || null,
        recipientName: extra.recipientName || '',
        recipientEmail: extra.recipientEmail || '',
        notes: extra.notes || p.title?.replace('[ATELIER_VOUCHER]', '').trim() || '',
        usedByOrderId: extra.usedByOrderId || null,
        usedByEmail: extra.usedByEmail || null,
        usedAt: extra.usedAt || null,
        createdAt: p.created_at
      };
    });

    return res.status(200).json({ success: true, data: vouchers });
  } catch (err) {
    console.error('Vouchers GET fatal error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/vouchers
 * Upsert an atelier voucher into Supabase using service key
 */
router.post('/', async (req, res) => {
  try {
    const v = req.body || {};
    const code = String(v.code || '').toUpperCase().trim();
    if (!code) {
      return res.status(400).json({ success: false, message: 'Voucher code is required' });
    }

    const discountType = v.discountType === 'percentage' ? 'percentage' : 'fixed';
    const discountValue = Math.max(0, parseFloat(v.discountValue || 0));
    const minOrderAmount = Math.max(0, parseFloat(v.minOrderAmount || 0));
    const maxUses = Math.max(1, parseInt(v.maxUses || 1, 10));
    const isUsed = Boolean(v.isUsed);
    const usedCount = parseInt(v.usedCount || (isUsed ? 1 : 0), 10);
    const isActive = v.isActive !== false;
    const expiresAt = v.expiresAt || null;
    const recipientName = v.recipientName || '';
    const recipientEmail = v.recipientEmail || '';
    const notes = v.notes || '';
    const usedByOrderId = v.usedByOrderId || null;
    const usedByEmail = v.usedByEmail || null;
    const usedAt = v.usedAt || null;

    const extraPayload = {
      discountType,
      maxUses,
      usedCount,
      isUsed,
      recipientName,
      recipientEmail,
      notes,
      usedByOrderId,
      usedByEmail,
      usedAt
    };

    const promoPayload = {
      code,
      title: `[ATELIER_VOUCHER] ${notes || 'Private Credit'}`,
      badge_label: `VOUCH:${JSON.stringify(extraPayload)}`,
      discount_type: discountType === 'percentage' ? 'percentage' : 'fixed_amount',
      discount_value: discountValue,
      min_order_amount_lkr: minOrderAmount,
      applied_product_ids: [],
      is_active: isActive,
      expires_at: expiresAt
    };

    if (isSupabaseReady && supabase) {
      const { data: existing } = await supabase
        .from('promotions')
        .select('id')
        .eq('code', code)
        .maybeSingle();

      if (existing?.id) {
        await supabase
          .from('promotions')
          .update(promoPayload)
          .eq('id', existing.id);
      } else {
        await supabase
          .from('promotions')
          .insert(promoPayload);
      }
    }

    return res.status(200).json({ success: true, data: { ...v, code } });
  } catch (err) {
    console.error('Vouchers POST error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/vouchers/:code
 * Delete an atelier voucher from Supabase
 */
router.delete('/:code', async (req, res) => {
  try {
    const code = String(req.params.code || '').toUpperCase().trim();
    if (!code) {
      return res.status(400).json({ success: false, message: 'Voucher code is required' });
    }

    if (isSupabaseReady && supabase) {
      await supabase.from('promotions').delete().eq('code', code);
    }

    return res.status(200).json({ success: true, message: `Voucher ${code} deleted` });
  } catch (err) {
    console.error('Vouchers DELETE error:', err);
    return res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
