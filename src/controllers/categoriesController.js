import { supabase, isSupabaseReady } from '../config/supabase.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../../data/categories.json');

export const INITIAL_CATEGORIES = [
  { id: 'classic-crewneck', key: 'classic-crewneck', label: 'Classic Crewneck', isCustom: false },
  { id: 'relaxed-fit', key: 'relaxed-fit', label: 'Relaxed Fit', isCustom: false },
  { id: 'oversized', key: 'oversized', label: 'Oversized', isCustom: false }
];

function readLocalCategories() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Local categories read note:', err?.message || err);
  }
  return INITIAL_CATEGORIES;
}

function writeLocalCategories(data) {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('Local categories write note:', err?.message || err);
  }
}

/**
 * GET /api/categories
 */
export async function getCategories(req, res, next) {
  try {
    // 1. Try Supabase promotions table with code 'STORE_CATEGORIES_CONFIG'
    if (isSupabaseReady && supabase) {
      try {
        const { data, error } = await supabase
          .from('promotions')
          .select('*')
          .eq('code', 'STORE_CATEGORIES_CONFIG')
          .maybeSingle();

        if (!error && data && data.description) {
          const parsed = JSON.parse(data.description);
          if (Array.isArray(parsed) && parsed.length > 0) {
            writeLocalCategories(parsed);
            return res.status(200).json({ success: true, data: parsed });
          }
        }
      } catch (sbErr) {
        console.warn('Supabase categories query note:', sbErr?.message || sbErr);
      }
    }

    // 2. Fallback to local file
    const local = readLocalCategories();
    return res.status(200).json({ success: true, data: local });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/categories or PUT /api/categories
 */
export async function saveCategories(req, res, next) {
  try {
    const categories = Array.isArray(req.body) ? req.body : (req.body?.categories || []);
    if (!Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid categories payload' });
    }

    // Write to local disk cache
    writeLocalCategories(categories);

    // Save to Supabase promotions table for cloud persistence
    if (isSupabaseReady && supabase) {
      try {
        const payload = {
          code: 'STORE_CATEGORIES_CONFIG',
          title: 'Store Product Categories Configuration',
          description: JSON.stringify(categories),
          discount_type: 'system_config',
          discount_value: 0,
          is_active: true
        };

        const { data: existing } = await supabase
          .from('promotions')
          .select('id')
          .eq('code', 'STORE_CATEGORIES_CONFIG')
          .maybeSingle();

        if (existing) {
          await supabase
            .from('promotions')
            .update(payload)
            .eq('id', existing.id);
        } else {
          await supabase
            .from('promotions')
            .insert(payload);
        }
      } catch (sbErr) {
        console.warn('Supabase categories save note:', sbErr?.message || sbErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Categories updated successfully',
      data: categories
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/categories/:id
 */
export async function deleteCategory(req, res, next) {
  try {
    const { id } = req.params;
    const current = readLocalCategories();
    const updated = current.filter(c => c.id !== id && c.key !== id);
    writeLocalCategories(updated);

    if (isSupabaseReady && supabase) {
      try {
        await supabase
          .from('promotions')
          .update({ description: JSON.stringify(updated) })
          .eq('code', 'STORE_CATEGORIES_CONFIG');
      } catch (sbErr) {
        console.warn('Supabase categories delete note:', sbErr?.message || sbErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Category removed successfully',
      data: updated
    });
  } catch (err) {
    next(err);
  }
}
