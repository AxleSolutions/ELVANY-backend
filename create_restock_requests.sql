-- =========================================================================
-- MAISON ELVANY: RESTOCK & RE-ISSUE DEMAND REQUESTS TABLE
-- Run this in your Supabase SQL Editor if you wish to have a dedicated table.
-- Note: The system automatically works seamlessly even without running this!
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.restock_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_title TEXT NOT NULL,
    product_image TEXT,
    variant_color TEXT DEFAULT 'Onyx Black',
    size_code TEXT DEFAULT 'M (40)',
    customer_name TEXT NOT NULL,
    customer_email TEXT,
    customer_phone TEXT,
    notes TEXT,
    status TEXT DEFAULT 'Pending Atelier Review',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.restock_requests ENABLE ROW LEVEL SECURITY;

-- Policies for public registration and atelier backoffice management
CREATE POLICY "Allow public insert restock requests" 
ON public.restock_requests FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow read restock requests" 
ON public.restock_requests FOR SELECT 
USING (true);

CREATE POLICY "Allow update restock requests" 
ON public.restock_requests FOR UPDATE 
USING (true);

CREATE POLICY "Allow delete restock requests" 
ON public.restock_requests FOR DELETE 
USING (true);
