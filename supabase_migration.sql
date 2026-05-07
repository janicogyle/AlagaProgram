-- ============================================================
-- Barangay Sta. Rita - Digital ID System
-- Run this SQL in Supabase: Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── RESIDENTS TABLE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.residents (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  control_number  TEXT UNIQUE NOT NULL,
  last_name       TEXT NOT NULL,
  first_name      TEXT NOT NULL,
  middle_name     TEXT,
  contact_number  TEXT,

  house_no        TEXT,
  purok           TEXT,
  street          TEXT,
  barangay        TEXT,
  city            TEXT,

  birthday        DATE,
  birthplace      TEXT,
  age             INTEGER,
  sex             TEXT,
  citizenship     TEXT,
  civil_status    TEXT,

  -- Documents
  valid_id_url    TEXT,

  is_pwd          BOOLEAN DEFAULT FALSE,
  is_senior_citizen BOOLEAN DEFAULT FALSE,
  is_solo_parent  BOOLEAN DEFAULT FALSE,

  representative_name    TEXT,
  representative_contact TEXT,
  account_request_id UUID,

  status          TEXT DEFAULT 'Active',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist on older installs (CREATE TABLE won't add missing columns)
ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS purok TEXT;
ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS valid_id_url TEXT;
ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Enforce: one contact number can only be used once (when present)
CREATE UNIQUE INDEX IF NOT EXISTS idx_residents_contact_number_unique
ON public.residents(contact_number)
WHERE contact_number IS NOT NULL AND contact_number <> '';

-- ─── ASSISTANCE REQUESTS TABLE ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.assistance_requests (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  control_number      TEXT UNIQUE NOT NULL,
  requester_name      TEXT NOT NULL,
  requester_contact   TEXT,
  requester_address   TEXT,
  service_type        TEXT NOT NULL,
  other_service       TEXT,
  beneficiary_name    TEXT NOT NULL,
  beneficiary_address TEXT,
  beneficiary_contact TEXT,
  amount              NUMERIC(10,2),
  approver_name       TEXT,
  date                DATE,
  status              TEXT DEFAULT 'Pending',
  request_source      TEXT DEFAULT 'online',
  remarks             TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  -- Documents (new installs)
  valid_id_url        TEXT,
  requirements_urls   JSONB DEFAULT '[]'::jsonb,
  requirements_files  JSONB DEFAULT '[]'::jsonb,
  requirements_checklist JSONB DEFAULT '[]'::jsonb,
  requirements_completed BOOLEAN DEFAULT FALSE
);

-- Ensure columns exist on older installs
ALTER TABLE public.assistance_requests ADD COLUMN IF NOT EXISTS valid_id_url TEXT;
ALTER TABLE public.assistance_requests ADD COLUMN IF NOT EXISTS requirements_urls JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.assistance_requests ADD COLUMN IF NOT EXISTS requirements_files JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.assistance_requests ADD COLUMN IF NOT EXISTS requirements_checklist JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.assistance_requests ADD COLUMN IF NOT EXISTS requirements_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.assistance_requests ADD COLUMN IF NOT EXISTS request_source TEXT DEFAULT 'online';

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────
-- Enable RLS
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistance_requests ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
CREATE POLICY "Allow authenticated users full access on residents"
  ON public.residents FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access on assistance_requests"
  ON public.assistance_requests FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Realtime: enable for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.residents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assistance_requests;

-- Refresh PostgREST schema cache so new columns are visible immediately
NOTIFY pgrst, 'reload schema';
