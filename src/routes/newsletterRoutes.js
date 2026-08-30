import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase, isSupabaseReady } from '../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const SUBSCRIBERS_FILE = path.join(DATA_DIR, 'subscribers.json');

const router = express.Router();

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Load subscribers from disk
const loadSubscribers = () => {
  try {
    if (fs.existsSync(SUBSCRIBERS_FILE)) {
      const data = fs.readFileSync(SUBSCRIBERS_FILE, 'utf8');
      return JSON.parse(data || '[]');
    }
  } catch (err) {
    console.warn('Error loading subscribers file:', err);
  }
  return [];
};

// Save subscribers to disk
const saveSubscribers = (subscribers) => {
  try {
    fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subscribers, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving subscribers file:', err);
  }
};

// POST /api/newsletter/subscribe
router.post('/subscribe', async (req, res) => {
  try {
    const { email, source = 'Seasonal Capsule Newsletter' } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const subscribers = loadSubscribers();

    const existingIndex = subscribers.findIndex(s => s.email.toLowerCase() === cleanEmail);
    const now = new Date().toISOString();

    const subscriberRecord = {
      email: cleanEmail,
      source: source || 'Seasonal Capsule Newsletter',
      subscribedAt: now,
      status: 'Active VIP'
    };

    if (existingIndex >= 0) {
      subscribers[existingIndex] = { ...subscribers[existingIndex], ...subscriberRecord };
    } else {
      subscribers.unshift(subscriberRecord);
    }

    saveSubscribers(subscribers);

    // Sync to Supabase if connected
    if (isSupabaseReady && supabase) {
      try {
        await supabase
          .from('newsletter_subscribers')
          .upsert({
            email: cleanEmail,
            source: subscriberRecord.source,
            created_at: now
          }, { onConflict: 'email' });
      } catch (sbErr) {
        console.warn('Supabase newsletter upsert notice:', sbErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Email successfully subscribed to Maison ELVANY capsule invitations.',
      subscriber: subscriberRecord,
      totalCount: subscribers.length
    });
  } catch (err) {
    console.error('Newsletter subscribe error:', err);
    return res.status(500).json({ error: 'Server error registering subscriber.' });
  }
});

// GET /api/newsletter/subscribers
router.get('/subscribers', async (req, res) => {
  if (isSupabaseReady && supabase) {
    try {
      const { data: dbSubscribers, error } = await supabase
        .from('newsletter_subscribers')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(dbSubscribers)) {
        return res.status(200).json({
          total: dbSubscribers.length,
          subscribers: dbSubscribers.map(s => ({
            id: s.id,
            email: s.email,
            source: s.source || 'Capsule Newsletter',
            subscribedAt: s.created_at,
            status: s.is_active !== false ? 'Active VIP' : 'Inactive'
          }))
        });
      }
    } catch (err) {
      console.warn('Supabase newsletter fetch notice:', err);
    }
  }

  const subscribers = loadSubscribers();
  res.status(200).json({
    total: subscribers.length,
    subscribers
  });
});

// GET /api/newsletter/export - Download CSV/Excel Spreadsheet
router.get('/export', async (req, res) => {
  try {
    let subscribers = [];

    if (isSupabaseReady && supabase) {
      try {
        const { data: dbSubscribers, error } = await supabase
          .from('newsletter_subscribers')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(dbSubscribers)) {
          subscribers = dbSubscribers.map(s => ({
            email: s.email,
            source: s.source || 'Capsule Newsletter',
            subscribedAt: s.created_at,
            status: s.is_active !== false ? 'Active VIP' : 'Inactive'
          }));
        }
      } catch (sbErr) {
        console.warn('Supabase newsletter export notice:', sbErr);
      }
    }

    if (subscribers.length === 0) {
      subscribers = loadSubscribers();
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const fileName = `ELVANY_VIP_Subscribers_${dateStr}.csv`;

    // Build Excel-compatible CSV format with UTF-8 BOM for Microsoft Excel
    const BOM = '\uFEFF';
    let csvContent = BOM + 'Subscriber Email,Subscription Date & Time,Source Channel,VIP Status\r\n';

    if (subscribers.length === 0) {
      csvContent += 'no-subscribers@elvany.com,2026-08-30 00:00:00,Atelier Desk,Pending\r\n';
    } else {
      subscribers.forEach((s) => {
        const email = `"${(s.email || '').replace(/"/g, '""')}"`;
        const date = `"${(s.subscribedAt ? new Date(s.subscribedAt).toLocaleString() : new Date().toLocaleString()).replace(/"/g, '""')}"`;
        const src = `"${(s.source || 'Capsule Newsletter').replace(/"/g, '""')}"`;
        const status = `"${(s.status || 'Active VIP').replace(/"/g, '""')}"`;
        csvContent += `${email},${date},${src},${status}\r\n`;
      });
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('Export subscribers error:', err);
    return res.status(500).json({ error: 'Failed to export subscribers.' });
  }
});

export default router;

