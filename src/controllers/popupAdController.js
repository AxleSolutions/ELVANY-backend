import { supabase, isSupabaseReady } from '../config/supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../../data/popup_ad.json');

const DEFAULT_POPUP_AD = {
  enabled: true,
  imageUrl: '/images/editorial_brutalist.jpg',
  targetUrl: '/collection',
  altText: 'ELVANY Haute Couture Capsule Release',
  showOncePerSession: true,
  updatedAt: new Date().toISOString()
};

function readLocalPopupAd() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.log('Local popup ad read note:', err);
  }
  return DEFAULT_POPUP_AD;
}

function writeLocalPopupAd(data) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.log('Local popup ad write note:', err);
  }
}

/**
 * GET /api/popup-ad
 */
export async function getPopupAd(req, res, next) {
  try {
    // 1. Try Supabase promotions table with code 'POPUP_AD_CAMPAIGN'
    if (isSupabaseReady && supabase) {
      try {
        const { data, error } = await supabase
          .from('promotions')
          .select('*')
          .eq('code', 'POPUP_AD_CAMPAIGN')
          .maybeSingle();

        if (!error && data) {
          const targetUrl = Array.isArray(data.applied_product_ids) && data.applied_product_ids.length > 0
            ? data.applied_product_ids[0]
            : '/collection';

          const dbSettings = {
            enabled: data.is_active !== false,
            imageUrl: data.badge_label || '/images/editorial_brutalist.jpg',
            targetUrl: targetUrl || '/collection',
            altText: data.title || 'ELVANY Seasonal Advertisement',
            showOncePerSession: true,
            updatedAt: data.created_at || new Date().toISOString()
          };

          // Cache locally
          writeLocalPopupAd(dbSettings);
          return res.status(200).json({ success: true, data: dbSettings });
        }
      } catch (sbErr) {
        console.log('Supabase popup ad query note:', sbErr?.message || sbErr);
      }
    }

    // 2. Fallback to local persisted file
    const localAd = readLocalPopupAd();
    return res.status(200).json({ success: true, data: localAd });
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/popup-ad or POST /api/popup-ad
 */
export async function updatePopupAd(req, res, next) {
  try {
    const { enabled, imageUrl, targetUrl, altText, showOncePerSession } = req.body;

    const updatedData = {
      enabled: enabled !== false,
      imageUrl: imageUrl || '/images/editorial_brutalist.jpg',
      targetUrl: targetUrl || '/collection',
      altText: altText || 'ELVANY Seasonal Advertisement',
      showOncePerSession: showOncePerSession !== false,
      updatedAt: new Date().toISOString()
    };

    // 1. Save locally to file
    writeLocalPopupAd(updatedData);

    // 2. Save to Supabase promotions table
    if (isSupabaseReady && supabase) {
      try {
        // Check if existing record exists
        const { data: existing } = await supabase
          .from('promotions')
          .select('id')
          .eq('code', 'POPUP_AD_CAMPAIGN')
          .maybeSingle();

        if (existing?.id) {
          await supabase
            .from('promotions')
            .update({
              title: updatedData.altText,
              badge_label: updatedData.imageUrl,
              discount_type: 'popup_ad',
              applied_product_ids: [updatedData.targetUrl || '/collection'],
              is_active: updatedData.enabled,
              created_at: new Date().toISOString()
            })
            .eq('id', existing.id);
        } else {
          await supabase
            .from('promotions')
            .insert({
              code: 'POPUP_AD_CAMPAIGN',
              title: updatedData.altText,
              badge_label: updatedData.imageUrl,
              discount_type: 'popup_ad',
              discount_value: 0,
              min_order_amount_lkr: 0,
              applied_product_ids: [updatedData.targetUrl || '/collection'],
              is_active: updatedData.enabled,
              starts_at: new Date().toISOString()
            });
        }
      } catch (sbErr) {
        console.log('Supabase popup ad upsert note:', sbErr?.message || sbErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Popup advertisement successfully updated.',
      data: updatedData
    });
  } catch (err) {
    next(err);
  }
}

