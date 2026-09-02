import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase, isSupabaseReady } from '../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const BESPOKE_FILE = path.join(DATA_DIR, 'bespoke_designs.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper to load bespoke designs from local JSON storage
function loadLocalBespokeDesigns() {
  try {
    if (fs.existsSync(BESPOKE_FILE)) {
      const data = fs.readFileSync(BESPOKE_FILE, 'utf8');
      const parsed = JSON.parse(data || '[]');
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.warn('Error reading bespoke designs file:', err);
  }
  return [];
}

// Helper to save bespoke designs to local JSON storage
function saveLocalBespokeDesigns(designs) {
  try {
    fs.writeFileSync(BESPOKE_FILE, JSON.stringify(designs, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving bespoke designs file:', err);
  }
}

// Helper to check if string is valid UUID
function isValidUUID(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// Generate an elegant bespoke atelier code e.g. "BL-89214"
function generateDesignCode() {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let randomStr = '';
  for (let i = 0; i < 5; i++) {
    randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `BL-${randomStr}`;
}

/**
 * Get all bespoke designs from Supabase or Local Storage
 */
async function getAllBespokeFromSources() {
  const localList = loadLocalBespokeDesigns();
  const map = new Map();

  // 1. Seed from local JSON storage
  localList.forEach(d => {
    const code = d.designCode || d.design_code || d.id;
    if (code) map.set(code, d);
  });

  if (isSupabaseReady && supabase) {
    // 2. Fetch from dedicated bespoke_designs table
    try {
      const { data: bespokeRows, error: bespokeErr } = await supabase
        .from('bespoke_designs')
        .select('*')
        .order('created_at', { ascending: false });

      if (!bespokeErr && Array.isArray(bespokeRows)) {
        bespokeRows.forEach(d => {
          const code = d.design_code || d.designCode || d.id;
          map.set(code, {
            id: d.id,
            designCode: code,
            orderId: d.order_id || d.orderId || null,
            fabricName: d.fabric_name || d.fabricName || 'Heavyweight Cotton (240 GSM)',
            fabricGsm: d.fabric_gsm || d.fabricGsm || '240 GSM',
            cutName: d.cut_name || d.cutName || 'Classic Regular Fit',
            cutId: d.cut_id || d.cutId || 'tailored',
            colorName: d.color_name || d.colorName || 'Pure Black',
            colorHex: d.color_hex || d.colorHex || '#0a0a0b',
            sleeveColorName: d.sleeve_color_name || d.sleeveColorName || null,
            sleeveColorHex: d.sleeve_color_hex || d.sleeveColorHex || null,
            size: d.size || 'L',
            quantity: Number(d.quantity) || 1,
            unitPrice: Number(d.unit_price || d.unitPrice || 18500),
            totalPrice: Number(d.total_price || d.totalPrice || 18500),
            artworks: d.artworks || {},
            notes: d.notes || '',
            tailorTuning: typeof d.tailor_tuning === 'boolean' ? d.tailor_tuning : (typeof d.tailorTuning === 'boolean' ? d.tailorTuning : true),
            customerName: d.customer_name || d.customerName || 'VIP Guest',
            customerEmail: d.customer_email || d.customerEmail || '',
            customerPhone: d.customer_phone || d.customerPhone || '',
            status: d.status || 'Saved / Ready to Order',
            views: d.views || { front: d.preview_thumbnail || d.previewThumbnail, back: null, left: null, right: null, collage: d.preview_thumbnail || d.previewThumbnail },
            blueprintImage: d.blueprint_image || d.blueprintImage || d.preview_thumbnail || d.previewThumbnail || null,
            previewThumbnail: d.preview_thumbnail || d.previewThumbnail || null,
            createdAt: d.created_at || d.createdAt || new Date().toISOString(),
            updatedAt: d.updated_at || d.updatedAt || new Date().toISOString()
          });
        });
      }
    } catch (sbErr) {
      console.warn('Supabase bespoke_designs fetch notice:', sbErr);
    }

    // 3. Scan orders table for any bespoke custom creations ordered by real clients
    try {
      const { data: ordersData, error: ordersErr } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .order('created_at', { ascending: false });

      if (!ordersErr && Array.isArray(ordersData)) {
        ordersData.forEach(order => {
          const storedItems = order.delivery_address?.orderedItems || [];
          const allItems = (order.order_items && order.order_items.length > 0) ? order.order_items : storedItems;

          allItems.forEach(item => {
            const title = item.product_title || item.title || item.name || '';
            const matchedStored = storedItems.find(si => si.id === item.product_id || (si.name || si.title) === title);
            const isBespoke = item.isBespokeCustom || matchedStored?.isBespokeCustom || title.toLowerCase().includes('custom') || title.toLowerCase().includes('bespoke') || Boolean(item.designCode || matchedStored?.designCode);

            if (isBespoke) {
              const code = item.designCode || matchedStored?.designCode || title.match(/BL-[A-Z0-9]{4,6}/)?.[0] || `BL-${(order.order_code || order.id).slice(-4)}`;
              
              if (!map.has(code)) {
                const viewsObj = matchedStored?.views || item.views || {
                  front: item.product_image_url || item.image || matchedStored?.image,
                  back: null,
                  left: null,
                  right: null,
                  collage: matchedStored?.blueprintImage || item.blueprintImage || item.product_image_url || item.image
                };

                map.set(code, {
                  id: `order-bespoke-${order.id}-${item.id || code}`,
                  designCode: code,
                  orderId: order.order_code || order.id,
                  fabricName: item.fabric || matchedStored?.fabric || 'Heavyweight Cotton (240 GSM)',
                  fabricGsm: '240 GSM',
                  cutName: item.cut || matchedStored?.cut || 'Classic Regular Fit',
                  cutId: 'tailored',
                  colorName: item.color || 'Pure Black',
                  colorHex: matchedStored?.colorHex || '#0a0a0b',
                  sleeveColorName: null,
                  sleeveColorHex: null,
                  size: item.size || item.selectedSize || 'L',
                  quantity: Number(item.quantity || item.qty) || 1,
                  unitPrice: Number(item.unit_price_lkr || item.priceLKR || 18500),
                  totalPrice: Number((item.unit_price_lkr || item.priceLKR || 18500) * (item.quantity || item.qty || 1)),
                  artworks: matchedStored?.artworks || {},
                  notes: matchedStored?.customNotes || order.delivery_address?.deliveryNotes || '',
                  tailorTuning: true,
                  customerName: order.customer_name || 'VIP Guest',
                  customerEmail: order.customer_email || '',
                  customerPhone: order.customer_phone || '',
                  status: order.status || 'Ordered / In Production',
                  views: viewsObj,
                  blueprintImage: matchedStored?.blueprintImage || item.blueprintImage || viewsObj?.collage || item.product_image_url || item.image || null,
                  previewThumbnail: matchedStored?.blueprintImage || item.blueprintImage || viewsObj?.collage || item.product_image_url || item.image || matchedStored?.image || null,
                  createdAt: order.created_at || new Date().toISOString(),
                  updatedAt: order.created_at || new Date().toISOString()
                });
              }
            }
          });
        });
      }
    } catch (orderScanErr) {
      console.warn('Supabase orders scan notice for bespoke creations:', orderScanErr);
    }
  }

  return Array.from(map.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * POST /api/bespoke - Create / Save a new Bespoke T-Shirt Design
 */
export async function createBespokeDesign(req, res, next) {
  try {
    const {
      designCode,
      orderId,
      fabricName,
      fabricGsm,
      cutName,
      cutId,
      colorName,
      colorHex,
      sleeveColorName,
      sleeveColorHex,
      size,
      quantity,
      unitPrice,
      totalPrice,
      artworks,
      notes,
      tailorTuning,
      customerName,
      customerEmail,
      customerPhone,
      previewThumbnail,
      blueprintImage,
      views,
      status
    } = req.body;

    const timestamp = new Date().toISOString();
    const finalDesignCode = designCode || generateDesignCode();
    const generatedId = `bl-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const normalizedDesign = {
      id: generatedId,
      designCode: finalDesignCode,
      orderId: orderId || null,
      fabricName: fabricName || '240 GSM Luxury Supima Cotton',
      fabricGsm: fabricGsm || '240 GSM',
      cutName: cutName || 'Classic Regular Fit',
      cutId: cutId || 'tailored',
      colorName: colorName || 'Pure Black',
      colorHex: colorHex || '#0a0a0b',
      sleeveColorName: sleeveColorName || null,
      sleeveColorHex: sleeveColorHex || null,
      size: size || 'L',
      quantity: Number(quantity) || 1,
      unitPrice: Number(unitPrice) || 14500,
      totalPrice: Number(totalPrice) || 14500,
      artworks: artworks || {},
      notes: (notes || '').trim(),
      tailorTuning: tailorTuning !== false,
      customerName: (customerName || 'VIP Guest').trim(),
      customerEmail: (customerEmail || '').trim(),
      customerPhone: (customerPhone || '').trim(),
      views: views || (previewThumbnail ? { front: previewThumbnail, back: null, left: null, right: null, collage: previewThumbnail } : null),
      blueprintImage: blueprintImage || previewThumbnail || null,
      previewThumbnail: previewThumbnail || null,
      status: status || 'Saved / Ready to Order',
      createdAt: timestamp,
      updatedAt: timestamp
    };

    // 1. Try persisting to Supabase if available
    if (isSupabaseReady && supabase) {
      try {
        const dbPayload = {
          design_code: normalizedDesign.designCode,
          order_id: isValidUUID(orderId) ? orderId : null,
          fabric_name: normalizedDesign.fabricName,
          fabric_gsm: normalizedDesign.fabricGsm,
          cut_name: normalizedDesign.cutName,
          cut_id: normalizedDesign.cutId,
          color_name: normalizedDesign.colorName,
          color_hex: normalizedDesign.colorHex,
          sleeve_color_name: normalizedDesign.sleeveColorName,
          sleeve_color_hex: normalizedDesign.sleeveColorHex,
          size: normalizedDesign.size,
          quantity: normalizedDesign.quantity,
          unit_price: normalizedDesign.unitPrice,
          total_price: normalizedDesign.totalPrice,
          artworks: normalizedDesign.artworks,
          notes: normalizedDesign.notes,
          tailor_tuning: normalizedDesign.tailorTuning,
          customer_name: normalizedDesign.customerName,
          customer_email: normalizedDesign.customerEmail,
          customer_phone: normalizedDesign.customerPhone,
          preview_thumbnail: normalizedDesign.previewThumbnail,
          status: normalizedDesign.status
        };

        const { data: sbData, error: sbError } = await supabase
          .from('bespoke_designs')
          .insert([dbPayload])
          .select()
          .single();

        if (!sbError && sbData) {
          normalizedDesign.id = sbData.id;
          normalizedDesign.designCode = sbData.design_code;
        }
      } catch (err) {
        console.warn('Supabase bespoke insert notice:', err.message);
      }
    }

    // 2. Persist locally to JSON file
    const currentList = loadLocalBespokeDesigns();
    const updatedList = [normalizedDesign, ...currentList.filter(d => d.id !== normalizedDesign.id)];
    saveLocalBespokeDesigns(updatedList);

    return res.status(201).json({
      success: true,
      message: 'Bespoke garment configuration registered with the Atelier.',
      data: normalizedDesign
    });

  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/bespoke - List all Bespoke Designs
 */
export async function getBespokeDesigns(req, res, next) {
  try {
    const designs = await getAllBespokeFromSources();

    return res.status(200).json({
      success: true,
      data: designs,
      stats: {
        totalDesigns: designs.length,
        inProduction: designs.filter(d => (d.status || '').includes('Production')).length,
        ordered: designs.filter(d => (d.status || '').includes('Ordered')).length,
        saved: designs.filter(d => (d.status || '').includes('Saved')).length
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/bespoke/:identifier - Get Single Design by ID or Code
 */
export async function getBespokeDesignById(req, res, next) {
  try {
    const { id } = req.params;
    const designs = await getAllBespokeFromSources();
    const design = designs.find(d => d.id === id || d.designCode === id);

    if (!design) {
      return res.status(404).json({
        success: false,
        message: `Bespoke design '${id}' not found.`
      });
    }

    return res.status(200).json({
      success: true,
      data: design
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/bespoke/:id - Update status / notes of a design
 */
export async function updateBespokeDesign(req, res, next) {
  try {
    const { id } = req.params;
    const updates = req.body;

    // 1. Supabase update
    if (isSupabaseReady && supabase) {
      try {
        const sbPayload = {};
        if (updates.status) sbPayload.status = updates.status;
        if (updates.previewThumbnail || updates.preview_thumbnail) sbPayload.preview_thumbnail = updates.previewThumbnail || updates.preview_thumbnail;
        if (updates.artworks) sbPayload.artworks = updates.artworks;
        if (updates.orderId || updates.order_id) sbPayload.order_id = isValidUUID(updates.orderId || updates.order_id) ? (updates.orderId || updates.order_id) : null;
        if (updates.customerName || updates.customer_name) sbPayload.customer_name = updates.customerName || updates.customer_name;
        if (updates.customerPhone || updates.customer_phone) sbPayload.customer_phone = updates.customerPhone || updates.customer_phone;
        if (updates.customerEmail || updates.customer_email) sbPayload.customer_email = updates.customerEmail || updates.customer_email;
        if (updates.notes) sbPayload.notes = updates.notes;

        if (isValidUUID(id)) {
          await supabase.from('bespoke_designs').update(sbPayload).eq('id', id);
        } else {
          await supabase.from('bespoke_designs').update(sbPayload).eq('design_code', id);
        }
      } catch (err) {
        console.warn('Supabase update warning:', err.message);
      }
    }

    // 2. Local update
    const currentList = loadLocalBespokeDesigns();
    const updatedList = currentList.map(d => {
      if (d.id === id || d.designCode === id) {
        return { ...d, ...updates, updatedAt: new Date().toISOString() };
      }
      return d;
    });
    saveLocalBespokeDesigns(updatedList);

    return res.status(200).json({
      success: true,
      message: 'Bespoke design updated successfully.'
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/bespoke/:id - Remove design
 */
export async function deleteBespokeDesign(req, res, next) {
  try {
    const { id } = req.params;

    if (isSupabaseReady && supabase && isValidUUID(id)) {
      try {
        await supabase
          .from('bespoke_designs')
          .delete()
          .eq('id', id);
      } catch (err) {
        console.warn('Supabase delete warning:', err.message);
      }
    }

    const currentList = loadLocalBespokeDesigns();
    const updatedList = currentList.filter(d => d.id !== id && d.designCode !== id);
    saveLocalBespokeDesigns(updatedList);

    return res.status(200).json({
      success: true,
      message: 'Bespoke design removed.'
    });
  } catch (err) {
    next(err);
  }
}
