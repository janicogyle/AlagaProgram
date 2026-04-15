-- =====================================================
-- STEP 4: Create account_requests table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.account_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  birthday DATE,
  contact_number TEXT NOT NULL,
  password_hash TEXT,
  house_no TEXT,
  purok TEXT,
  street TEXT,
  barangay TEXT DEFAULT 'Sta. Rita',
  city TEXT DEFAULT 'Olongapo City',
  is_pwd BOOLEAN DEFAULT FALSE,
  is_senior_citizen BOOLEAN DEFAULT FALSE,
  is_solo_parent BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Archived')),
  notes TEXT,
  processed_by TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_requests_status ON public.account_requests(status);
CREATE INDEX IF NOT EXISTS idx_account_requests_contact ON public.account_requests(contact_number);

-- Ensure residents has password_hash for beneficiary password login (if residents table exists)
DO $$
BEGIN
  IF to_regclass('public.residents') IS NOT NULL THEN
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS password_hash TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS purok TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
