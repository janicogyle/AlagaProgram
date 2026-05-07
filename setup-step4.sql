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
  valid_id_url TEXT,
  valid_id_urls JSONB DEFAULT '[]'::jsonb,
  age INTEGER,
  birthplace TEXT,
  sex TEXT,
  citizenship TEXT,
  civil_status TEXT,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Archived')),
  notes TEXT,
  processed_by TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_requests_status ON public.account_requests(status);

-- Enforce: one contact number can only be used once
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM (
      SELECT contact_number
      FROM public.account_requests
      WHERE contact_number IS NOT NULL AND contact_number <> ''
      GROUP BY contact_number
      HAVING COUNT(*) > 1
    ) d
  ) THEN
    RAISE EXCEPTION 'Duplicate contact_number values exist in public.account_requests. Clean them up before adding UNIQUE constraint.';
  END IF;
END $$;

DROP INDEX IF EXISTS public.idx_account_requests_contact;
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_requests_contact ON public.account_requests(contact_number);
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS valid_id_urls JSONB DEFAULT '[]'::jsonb;

-- Ensure residents has password_hash for beneficiary password login (if residents table exists)
DO $$
BEGIN
  IF to_regclass('public.residents') IS NOT NULL THEN
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS password_hash TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS account_request_id UUID;

    -- Ensure sign-up fields exist on residents so approved requests can reflect them
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS birthday DATE;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS age INTEGER;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS birthplace TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS sex TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS citizenship TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS civil_status TEXT;

    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS contact_number TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS house_no TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS purok TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS street TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS barangay TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS city TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS valid_id_url TEXT;

    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS is_pwd BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS is_senior_citizen BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS is_solo_parent BOOLEAN DEFAULT FALSE;

    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

    -- Enforce: one contact number can only be used once (when present)
    IF EXISTS (
      SELECT 1
      FROM (
        SELECT contact_number
        FROM public.residents
        WHERE contact_number IS NOT NULL AND contact_number <> ''
        GROUP BY contact_number
        HAVING COUNT(*) > 1
      ) d
    ) THEN
      RAISE EXCEPTION 'Duplicate contact_number values exist in public.residents. Clean them up before adding UNIQUE constraint.';
    END IF;

    EXECUTE $$
      CREATE UNIQUE INDEX IF NOT EXISTS idx_residents_contact_number_unique
      ON public.residents(contact_number)
      WHERE contact_number IS NOT NULL AND contact_number <> ''
    $$;
  END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
