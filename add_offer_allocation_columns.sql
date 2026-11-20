-- =========================================================================
-- MAISON ELVANY: ADD ALLOCATION SCARCITY COLUMNS TO PROMOTIONS TABLE
-- Run this in your Supabase Dashboard > SQL Editor > New Query > Run
-- =========================================================================

-- 1. Add dedicated allocation columns to public.promotions
ALTER TABLE public.promotions 
ADD COLUMN IF NOT EXISTS remaining_units INTEGER DEFAULT 12,
ADD COLUMN IF NOT EXISTS total_allocation INTEGER DEFAULT 25,
ADD COLUMN IF NOT EXISTS sold_units INTEGER DEFAULT 13;

-- 2. Populate default allocation values for existing promotion records
UPDATE public.promotions
SET 
  remaining_units = COALESCE(remaining_units, 12),
  total_allocation = COALESCE(total_allocation, 25),
  sold_units = COALESCE(sold_units, 13)
WHERE remaining_units IS NULL OR total_allocation IS NULL;

-- 3. Verify columns and existing data
SELECT id, code, title, badge_label, remaining_units, total_allocation, sold_units, is_active
FROM public.promotions
ORDER BY created_at DESC;
