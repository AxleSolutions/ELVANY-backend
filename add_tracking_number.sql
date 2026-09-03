-- =========================================================================
-- MAISON ELVANY: ADD TRACKING NUMBER COLUMN TO ORDERS TABLE
-- Run this in your Supabase Dashboard > SQL Editor > New Query > Run
-- =========================================================================

-- 1. Add the dedicated tracking_number column to public.orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS tracking_number TEXT;

-- 2. Populate any previously saved tracking numbers from delivery_address or courier_notes
UPDATE public.orders 
SET tracking_number = COALESCE(
  delivery_address->>'trackingNumber',
  substring(courier_notes from 'Citypak:\s*([A-Za-z0-9\-]+)')
)
WHERE tracking_number IS NULL 
  AND (delivery_address->>'trackingNumber' IS NOT NULL OR courier_notes LIKE 'Citypak%');

-- 3. Verify column is created
SELECT id, order_code, customer_name, status, tracking_number, courier_notes 
FROM public.orders 
ORDER BY created_at DESC 
LIMIT 10;
