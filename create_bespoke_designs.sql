-- =========================================================================
-- MAISON ELVANY: BESPOKE ATELIER CUSTOM T-SHIRT DESIGNS TABLE
-- Run this in your Supabase SQL Editor to store custom customer lab creations.
-- Note: The system automatically works with local persistent JSON fallback!
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.bespoke_designs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    design_code TEXT UNIQUE NOT NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    fabric_name TEXT NOT NULL,
    fabric_gsm TEXT DEFAULT '240 GSM',
    cut_name TEXT NOT NULL DEFAULT 'Classic Regular Fit',
    cut_id TEXT DEFAULT 'tailored',
    color_name TEXT NOT NULL DEFAULT 'Pure Black',
    color_hex TEXT NOT NULL DEFAULT '#0a0a0b',
    sleeve_color_name TEXT,
    sleeve_color_hex TEXT,
    size TEXT NOT NULL DEFAULT 'L',
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC NOT NULL DEFAULT 14500,
    total_price NUMERIC NOT NULL DEFAULT 14500,
    artworks JSONB DEFAULT '{}'::jsonb,
    notes TEXT,
    tailor_tuning BOOLEAN DEFAULT true,
    customer_name TEXT DEFAULT 'VIP Guest',
    customer_email TEXT,
    customer_phone TEXT,
    status TEXT DEFAULT 'Saved / In Design',
    preview_thumbnail TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for lightning fast lookups
CREATE INDEX IF NOT EXISTS idx_bespoke_designs_code ON public.bespoke_designs(design_code);
CREATE INDEX IF NOT EXISTS idx_bespoke_designs_status ON public.bespoke_designs(status);
CREATE INDEX IF NOT EXISTS idx_bespoke_designs_created_at ON public.bespoke_designs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.bespoke_designs ENABLE ROW LEVEL SECURITY;

-- Policies for public creation and atelier management
CREATE POLICY "Allow public insert bespoke designs" 
ON public.bespoke_designs FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow public read bespoke designs" 
ON public.bespoke_designs FOR SELECT 
USING (true);

CREATE POLICY "Allow public update bespoke designs" 
ON public.bespoke_designs FOR UPDATE 
USING (true);

CREATE POLICY "Allow public delete bespoke designs" 
ON public.bespoke_designs FOR DELETE 
USING (true);
