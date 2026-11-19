-- =========================================================================
-- MAISON ELVANY: ENABLE ATELIER PRODUCT MANAGEMENT IN SUPABASE
-- Run this script in your Supabase SQL Editor (Dashboard -> SQL Editor)
-- to allow full product creation, updates, deletions, and draft management.
-- =========================================================================

-- 1. Enable Full Access to products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active products" ON public.products;
DROP POLICY IF EXISTS "Public read all products" ON public.products;
CREATE POLICY "Public read all products" ON public.products 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert products" ON public.products;
CREATE POLICY "Allow public insert products" ON public.products 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update products" ON public.products;
CREATE POLICY "Allow public update products" ON public.products 
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete products" ON public.products;
CREATE POLICY "Allow public delete products" ON public.products 
    FOR DELETE USING (true);


-- 2. Enable Full Access to product_variants
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read product_variants" ON public.product_variants;
CREATE POLICY "Allow public read product_variants" ON public.product_variants 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert product_variants" ON public.product_variants;
CREATE POLICY "Allow public insert product_variants" ON public.product_variants 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update product_variants" ON public.product_variants;
CREATE POLICY "Allow public update product_variants" ON public.product_variants 
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete product_variants" ON public.product_variants;
CREATE POLICY "Allow public delete product_variants" ON public.product_variants 
    FOR DELETE USING (true);


-- 3. Enable Full Access to product_stock
ALTER TABLE public.product_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read product_stock" ON public.product_stock;
CREATE POLICY "Allow public read product_stock" ON public.product_stock 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert product_stock" ON public.product_stock;
CREATE POLICY "Allow public insert product_stock" ON public.product_stock 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update product_stock" ON public.product_stock;
CREATE POLICY "Allow public update product_stock" ON public.product_stock 
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete product_stock" ON public.product_stock;
CREATE POLICY "Allow public delete product_stock" ON public.product_stock 
    FOR DELETE USING (true);


-- 4. Enable Full Access to promotions (Special Privileges & Entrance Popup Ad)
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


-- 5. Enable Full Access to reviews (Client Evaluations & Photo Submissions)
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read published reviews" ON public.reviews;
DROP POLICY IF EXISTS "Allow public read reviews" ON public.reviews;
CREATE POLICY "Allow public read reviews" ON public.reviews 
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public insert reviews" ON public.reviews;
CREATE POLICY "Allow public insert reviews" ON public.reviews 
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public update reviews" ON public.reviews;
CREATE POLICY "Allow public update reviews" ON public.reviews 
    FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public delete reviews" ON public.reviews;
CREATE POLICY "Allow public delete reviews" ON public.reviews 
    FOR DELETE USING (true);

