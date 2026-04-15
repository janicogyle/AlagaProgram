-- =====================================================
-- STEP 2: Create assistance_budgets table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.assistance_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistance_type TEXT UNIQUE NOT NULL,
  ceiling DECIMAL(10, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.assistance_budgets (assistance_type, ceiling) VALUES
  ('Medicine Assistance', 500),
  ('Confinement Assistance', 1000),
  ('Burial Assistance', 1000),
  ('Others', 0)
ON CONFLICT (assistance_type) DO NOTHING;
