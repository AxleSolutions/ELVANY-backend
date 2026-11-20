-- =========================================================================
-- ELVANY: ALLOW PUBLIC ACCESS TO ATELIER VOUCHERS IN SUPABASE PROMOTIONS TABLE
-- Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor)
-- to allow instant voucher sync and verification across all client devices.
-- =========================================================================

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read promotions" ON public.promotions;
CREATE POLICY "Allow public read promotions" ON public.promotions 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert promotions" ON public.promotions;
CREATE POLICY "Allow public insert promotions" ON public.promotions 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update promotions" ON public.promotions;
CREATE POLICY "Allow public update promotions" ON public.promotions 
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete promotions" ON public.promotions;
CREATE POLICY "Allow public delete promotions" ON public.promotions 
    FOR DELETE USING (true);
