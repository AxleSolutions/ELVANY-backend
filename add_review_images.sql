-- =========================================================================
-- MAISON ELVANY — Add image_url and images to Reviews Table
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql
-- =========================================================================

ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

COMMENT ON COLUMN public.reviews.image_url IS 'Primary customer review garment photo URL (Cloudinary)';
COMMENT ON COLUMN public.reviews.images IS 'Array of customer review garment photos';
