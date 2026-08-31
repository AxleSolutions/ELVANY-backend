import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase, isSupabaseReady } from '../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const RESTOCK_FILE = path.join(DATA_DIR, 'restock_requests.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Helper to load restock requests from local JSON storage
function loadLocalRestockRequests() {
  try {
    if (fs.existsSync(RESTOCK_FILE)) {
      const data = fs.readFileSync(RESTOCK_FILE, 'utf8');
      const parsed = JSON.parse(data || '[]');
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (err) {
    console.warn('Error reading restock requests file:', err);
  }
  return [];
}

// Helper to save restock requests to local JSON storage
function saveLocalRestockRequests(requests) {
  try {
    fs.writeFileSync(RESTOCK_FILE, JSON.stringify(requests, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving restock requests file:', err);
  }
}

// Helper to check if string is valid UUID
function isValidUUID(str) {
  if (!str || typeof str !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Helper to get all restock requests (Supabase + Local persistent storage)
 */
async function getAllRequestsFromSources() {
  const localList = loadLocalRestockRequests();
  
  if (isSupabaseReady && supabase) {
    try {
      const { data, error } = await supabase
        .from('restock_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        // Merge Supabase records with any local records not present in Supabase
        const map = new Map();
        data.forEach(r => {
          map.set(r.id, {
            id: r.id,
            productId: r.product_id || r.productId || null,
            productTitle: r.product_title || r.productTitle || 'Haute Atelier Garment',
            productImage: r.product_image || r.productImage || '/images/hero_tshirt.jpg',
            variantColor: r.variant_color || r.variantColor || 'Onyx Black',
            sizeCode: r.size_code || r.sizeCode || 'M (40)',
            customerName: r.customer_name || r.customerName || 'VIP Client',
            customerEmail: r.customer_email || r.customerEmail || '',
            customerPhone: r.customer_phone || r.customerPhone || '',
            notes: r.notes || '',
            status: r.status || 'Pending Atelier Review',
            createdAt: r.created_at || r.createdAt || new Date().toISOString()
          });
        });

        localList.forEach(r => {
          if (!map.has(r.id)) {
            map.set(r.id, r);
          }
        });

        return Array.from(map.values()).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
    } catch (sbErr) {
      console.warn('Supabase restock fetch warning:', sbErr);
    }
  }

  return localList.map(r => ({
    id: r.id,
    productId: r.productId || r.product_id || null,
    productTitle: r.productTitle || r.product_title || 'Haute Atelier Garment',
    productImage: r.productImage || r.product_image || '/images/hero_tshirt.jpg',
    variantColor: r.variantColor || r.variant_color || 'Onyx Black',
    sizeCode: r.sizeCode || r.size_code || 'M (40)',
    customerName: r.customerName || r.customer_name || 'VIP Client',
    customerEmail: r.customerEmail || r.customer_email || '',
    customerPhone: r.customerPhone || r.customer_phone || '',
    notes: r.notes || '',
    status: r.status || 'Pending Atelier Review',
    createdAt: r.createdAt || r.created_at || new Date().toISOString()
  }));
}

/**
 * Create a new restock / re-issue request
 */
export async function createRestockRequest(req, res, next) {
  try {
    const {
      productId,
      productTitle,
      productImage,
      variantColor,
      sizeCode,
      customerName,
      customerEmail,
      customerPhone,
      notes
    } = req.body;

    if (!customerEmail && !customerPhone) {
      return res.status(400).json({
        success: false,
        message: 'Client contact email or phone number is required.'
      });
    }

    const timestamp = new Date().toISOString();
    const generatedId = `req-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const normalizedRequest = {
      id: generatedId,
      productId: productId || null,
      productTitle: (productTitle || 'Haute Atelier Garment').trim(),
      productImage: productImage || '/images/hero_tshirt.jpg',
      variantColor: (variantColor || 'Onyx Black').trim(),
      sizeCode: (sizeCode || 'M (40)').trim(),
      customerName: (customerName || 'VIP Client').trim(),
      customerEmail: (customerEmail || '').trim(),
      customerPhone: (customerPhone || '').trim(),
      notes: (notes || '').trim(),
      status: 'Pending Atelier Review',
      createdAt: timestamp
    };

    // 1. Try persisting to dedicated Supabase table if available
    if (isSupabaseReady && supabase) {
      try {
        const dbPayload = {
          product_id: isValidUUID(productId) ? productId : null,
          product_title: normalizedRequest.productTitle,
          product_image: normalizedRequest.productImage,
          variant_color: normalizedRequest.variantColor,
          size_code: normalizedRequest.sizeCode,
          customer_name: normalizedRequest.customerName,
          customer_email: normalizedRequest.customerEmail,
          customer_phone: normalizedRequest.customerPhone,
          notes: normalizedRequest.notes,
          status: normalizedRequest.status
        };

        const { data: sbData, error: sbError } = await supabase
          .from('restock_requests')
          .insert([dbPayload])
          .select()
          .single();

        if (!sbError && sbData) {
          normalizedRequest.id = sbData.id;
        }
      } catch (err) {
        console.warn('Supabase restock insert notice:', err.message);
      }
    }

    // 2. Persist locally to JSON file
    const currentList = loadLocalRestockRequests();
    const updatedList = [normalizedRequest, ...currentList.filter(r => r.id !== normalizedRequest.id)];
    saveLocalRestockRequests(updatedList);

    return res.status(201).json({
      success: true,
      message: 'Your garment re-issue request has been registered with the Atelier.',
      data: normalizedRequest
    });

  } catch (err) {
    next(err);
  }
}

/**
 * Get all restock requests with demand heatmap and metrics
 */
export async function getRestockRequests(req, res, next) {
  try {
    const requests = await getAllRequestsFromSources();

    // Aggregated demand per product, colorway and size
    const demandMap = {};
    requests.forEach(r => {
      const key = `${r.productTitle} — ${r.variantColor} (${r.sizeCode})`;
      if (!demandMap[key]) {
        demandMap[key] = {
          productTitle: r.productTitle,
          productImage: r.productImage,
          variantColor: r.variantColor,
          sizeCode: r.sizeCode,
          count: 0
        };
      }
      demandMap[key].count += 1;
    });

    const topDemands = Object.values(demandMap).sort((a, b) => b.count - a.count);

    return res.status(200).json({
      success: true,
      data: requests,
      stats: {
        totalRequests: requests.length,
        pendingCount: requests.filter(r => (r.status || '').includes('Pending')).length,
        inProductionCount: requests.filter(r => (r.status || '').includes('Production')).length,
        fulfilledCount: requests.filter(r => (r.status || '').includes('Restocked') || (r.status || '').includes('Fulfilled') || (r.status || '').includes('Notified')).length,
        topDemands
      }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Update status of a restock request
 */
export async function updateRestockRequestStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: 'Status is required.' });
    }

    // 1. Update in Supabase if valid UUID
    if (isSupabaseReady && supabase && isValidUUID(id)) {
      try {
        await supabase
          .from('restock_requests')
          .update({ status })
          .eq('id', id);
      } catch (err) {
        console.warn('Supabase status update warning:', err.message);
      }
    }

    // 2. Update in local storage
    const currentList = loadLocalRestockRequests();
    const updatedList = currentList.map(r => r.id === id ? { ...r, status } : r);
    saveLocalRestockRequests(updatedList);

    return res.status(200).json({
      success: true,
      message: `Request status updated to ${status}.`,
      data: { id, status }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Delete a restock request
 */
export async function deleteRestockRequest(req, res, next) {
  try {
    const { id } = req.params;

    // 1. Delete in Supabase if valid UUID
    if (isSupabaseReady && supabase && isValidUUID(id)) {
      try {
        await supabase
          .from('restock_requests')
          .delete()
          .eq('id', id);
      } catch (err) {
        console.warn('Supabase delete warning:', err.message);
      }
    }

    // 2. Delete from local storage
    const currentList = loadLocalRestockRequests();
    const updatedList = currentList.filter(r => r.id !== id);
    saveLocalRestockRequests(updatedList);

    return res.status(200).json({
      success: true,
      message: `Request #${id} removed successfully.`
    });
  } catch (err) {
    next(err);
  }
}
