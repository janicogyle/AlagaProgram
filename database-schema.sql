-- =====================================================
-- ALAGA PROGRAM - DATABASE SCHEMA
-- =====================================================
-- This script creates all missing tables for the system
-- Run this in Supabase SQL Editor

-- =====================================================
-- 1. ASSISTANCE REQUESTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.assistance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_number TEXT NOT NULL,
  resident_id UUID REFERENCES public.residents(id) ON DELETE SET NULL,
  
  -- Requester Info
  requester_name TEXT,
  requester_contact TEXT,
  requester_address TEXT,
  
  -- Beneficiary Info
  beneficiary_name TEXT,
  beneficiary_contact TEXT,
  beneficiary_address TEXT,
  
  -- Assistance Details
  assistance_type TEXT NOT NULL,
  amount DECIMAL(10, 2) DEFAULT 0,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Resubmitted', 'Approved', 'Released', 'Rejected')),
  request_source TEXT DEFAULT 'online' CHECK (request_source IN ('online', 'walk-in')),
  
  -- Processing Info
  processed_by TEXT,
  decision_remarks TEXT,
  
  -- Documents
  valid_id_url TEXT,
  requirements_urls JSONB DEFAULT '[]'::jsonb,
  requirements_files JSONB DEFAULT '[]'::jsonb,

  -- Admin/Staff verification (no file uploads)
  requirements_checklist JSONB DEFAULT '[]'::jsonb,
  requirements_completed BOOLEAN DEFAULT FALSE,
  
  -- Timestamps
  request_date DATE DEFAULT CURRENT_DATE,
  released_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Control numbers are displayed as global references (YYYY-###), so uniqueness
-- must not depend on assistance type.
DROP INDEX IF EXISTS public.assistance_requests_assistance_type_control_number_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS assistance_requests_control_number_uidx
  ON public.assistance_requests (control_number);

CREATE INDEX IF NOT EXISTS idx_assistance_requests_resident_id ON public.assistance_requests(resident_id);
CREATE INDEX IF NOT EXISTS idx_assistance_requests_status ON public.assistance_requests(status);
CREATE INDEX IF NOT EXISTS idx_assistance_requests_request_date ON public.assistance_requests(request_date);
CREATE INDEX IF NOT EXISTS idx_assistance_requests_assistance_type_control_number
  ON public.assistance_requests (assistance_type, control_number);

-- Database-level guard against simultaneous duplicate active submissions from
-- either the beneficiary portal or the walk-in registration flow.
DROP INDEX IF EXISTS public.assistance_requests_one_active_per_category_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS assistance_requests_one_active_per_resident_uidx
  ON public.assistance_requests (resident_id)
  WHERE resident_id IS NOT NULL
    AND status IN ('Pending', 'Resubmitted', 'Approved');

-- Ensure columns exist on older installs
ALTER TABLE public.assistance_requests ADD COLUMN IF NOT EXISTS requirements_urls JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.assistance_requests ADD COLUMN IF NOT EXISTS requirements_files JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.assistance_requests ADD COLUMN IF NOT EXISTS requirements_checklist JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.assistance_requests ADD COLUMN IF NOT EXISTS requirements_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.assistance_requests ADD COLUMN IF NOT EXISTS request_source TEXT DEFAULT 'online';
ALTER TABLE public.assistance_requests ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_assistance_requests_resident_status_released
  ON public.assistance_requests (resident_id, status, released_at DESC);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_assistance_requests_updated_at
  BEFORE UPDATE ON public.assistance_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. ASSISTANCE BUDGETS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.assistance_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assistance_type TEXT UNIQUE NOT NULL,
  ceiling DECIMAL(10, 2) NOT NULL DEFAULT 0,
  requirements JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default budget ceilings
INSERT INTO public.assistance_budgets (assistance_type, ceiling) VALUES
  ('Medicine Assistance', 500),
  ('Confinement Assistance', 1000),
  ('Burial Assistance', 1000)
ON CONFLICT (assistance_type) DO NOTHING;

DELETE FROM public.assistance_budgets
WHERE assistance_type = 'Others';

CREATE TRIGGER update_assistance_budgets_updated_at
  BEFORE UPDATE ON public.assistance_budgets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.assistance_budgets ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '[]'::jsonb;

-- =====================================================
-- 3. ADMIN USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  contact_number TEXT,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'PWD Coordinator', 'Solo Parent Coordinator', 'Senior Citizen Coordinator', 'Staff')),
  sector_access JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS sector_access JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 4. ACCOUNT REQUESTS TABLE (Beneficiary Signups)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.account_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Personal Info
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  birthday DATE,
  contact_number TEXT NOT NULL,
  email TEXT,
  verification_method TEXT NOT NULL DEFAULT 'sms' CHECK (verification_method IN ('sms', 'email')),
  contact_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash TEXT,
  consent_given_at TIMESTAMPTZ,
  consent_version TEXT,
  consent_actor_type TEXT CHECK (
    consent_actor_type IS NULL
    OR consent_actor_type IN ('self', 'guardian_or_representative')
  ),

  -- Address
  house_no TEXT,
  purok TEXT,
  street TEXT,
  barangay TEXT DEFAULT 'Sta. Rita',
  city TEXT DEFAULT 'Olongapo City',
  
  -- Sectors
  is_pwd BOOLEAN DEFAULT FALSE,
  is_senior_citizen BOOLEAN DEFAULT FALSE,
  is_solo_parent BOOLEAN DEFAULT FALSE,
  primary_sector TEXT CHECK (primary_sector IS NULL OR primary_sector IN ('pwd', 'senior_citizen', 'solo_parent')),
  secondary_sector TEXT CHECK (
    secondary_sector IS NULL OR secondary_sector IN ('pwd', 'senior_citizen', 'solo_parent')
  ),
  CHECK (primary_sector IS NULL OR secondary_sector IS NULL OR primary_sector <> secondary_sector),
  valid_id_url TEXT,
  valid_id_urls JSONB DEFAULT '[]'::jsonb,
  valid_id_front_url TEXT,
  valid_id_back_url TEXT,
  selfie_url TEXT,
  face_verification_status TEXT CHECK (
    face_verification_status IS NULL
    OR face_verification_status IN ('passed', 'failed', 'manual_review')
  ),
  face_verification_score NUMERIC,
  face_verification_provider TEXT,
  face_verified_at TIMESTAMPTZ,
  face_verification_error TEXT,
  ocr_verification_status TEXT CHECK (ocr_verification_status IS NULL OR ocr_verification_status = 'passed'),
  ocr_id_type TEXT,
  ocr_id_number_masked TEXT,
  ocr_extracted_name TEXT,
  ocr_extracted_birth_date DATE,
  ocr_provider TEXT,
  ocr_verified_at TIMESTAMPTZ,
  representative_name TEXT,
  representative_contact TEXT,
  representative_relationship TEXT,
  representative_valid_id_url TEXT,
  age INTEGER,
  birthplace TEXT,
  sex TEXT,
  citizenship TEXT,
  civil_status TEXT,
  
  -- Request Info
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Incomplete', 'Resubmitted', 'Approved', 'Rejected')),
  notes TEXT,
  processed_by TEXT,
  processed_at TIMESTAMPTZ,
  resubmission_token_hash TEXT,
  resubmission_token_created_at TIMESTAMPTZ,
  resubmission_sent_at TIMESTAMPTZ,
  resubmitted_at TIMESTAMPTZ,
  
  -- Timestamps
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_requests_email_unique
  ON public.account_requests(lower(email))
  WHERE email IS NOT NULL AND email <> '';

CREATE INDEX IF NOT EXISTS idx_account_requests_created ON public.account_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_account_requests_primary_sector ON public.account_requests(primary_sector);

CREATE TRIGGER update_account_requests_updated_at
  BEFORE UPDATE ON public.account_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Normalize legacy values + ensure account request resubmission statuses are allowed
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.account_requests'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
      AND pg_get_constraintdef(oid) ILIKE '%Pending%'
      AND pg_get_constraintdef(oid) ILIKE '%Approved%'
  LOOP
    EXECUTE format('ALTER TABLE public.account_requests DROP CONSTRAINT IF EXISTS %I', c.conname);
  END LOOP;
END $$;

UPDATE public.account_requests
SET status = 'Incomplete'
WHERE status = 'Archived';

ALTER TABLE public.account_requests
  DROP CONSTRAINT IF EXISTS account_requests_status_check;

ALTER TABLE public.account_requests
  ADD CONSTRAINT account_requests_status_check
  CHECK (status IN ('Pending', 'Incomplete', 'Resubmitted', 'Approved', 'Rejected'));

-- Ensure password columns exist (safe to run multiple times)
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS consent_given_at TIMESTAMPTZ;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS consent_version TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS consent_actor_type TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS verification_method TEXT NOT NULL DEFAULT 'sms';
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS contact_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS valid_id_url TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS valid_id_urls JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS valid_id_front_url TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS valid_id_back_url TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS selfie_url TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS face_verification_status TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS face_verification_score NUMERIC;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS face_verification_provider TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS face_verified_at TIMESTAMPTZ;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS face_verification_error TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS primary_sector TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS ocr_verification_status TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS ocr_id_type TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS ocr_id_number_masked TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS ocr_extracted_name TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS ocr_extracted_birth_date DATE;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS ocr_provider TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS ocr_verified_at TIMESTAMPTZ;
ALTER TABLE public.account_requests
  DROP CONSTRAINT IF EXISTS account_requests_ocr_verification_status_check;
ALTER TABLE public.account_requests
  ADD CONSTRAINT account_requests_ocr_verification_status_check
  CHECK (ocr_verification_status IS NULL OR ocr_verification_status = 'passed');
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS secondary_sector TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS representative_name TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS representative_contact TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS representative_relationship TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS representative_valid_id_url TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS birthplace TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS sex TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS citizenship TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS civil_status TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS resubmission_token_hash TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS resubmission_token_created_at TIMESTAMPTZ;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS resubmission_sent_at TIMESTAMPTZ;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS resubmitted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_account_requests_resubmission_token_hash
  ON public.account_requests(resubmission_token_hash)
  WHERE resubmission_token_hash IS NOT NULL;
ALTER TABLE public.account_requests
  DROP CONSTRAINT IF EXISTS account_requests_face_verification_status_check;
ALTER TABLE public.account_requests
  ADD CONSTRAINT account_requests_face_verification_status_check
  CHECK (
    face_verification_status IS NULL
    OR face_verification_status IN ('passed', 'failed', 'manual_review')
  );
CREATE INDEX IF NOT EXISTS idx_account_requests_face_verification_status
  ON public.account_requests(face_verification_status);
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
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS email TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS verification_method TEXT NOT NULL DEFAULT 'sms';
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS contact_verified BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS house_no TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS purok TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS street TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS barangay TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS city TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS valid_id_url TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS is_pwd BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS is_senior_citizen BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS is_solo_parent BOOLEAN DEFAULT FALSE;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS primary_sector TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS secondary_sector TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS representative_name TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS representative_contact TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS representative_relationship TEXT;
    ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS representative_valid_id_url TEXT;

    -- Some existing DBs may not have timestamps on residents yet
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

    EXECUTE $$
      CREATE UNIQUE INDEX IF NOT EXISTS idx_residents_email_unique
      ON public.residents(lower(email))
      WHERE email IS NOT NULL AND email <> ''
    $$;

    -- Ensure updated_at auto-refreshes on updates
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_residents_updated_at') THEN
      CREATE TRIGGER update_residents_updated_at
        BEFORE UPDATE ON public.residents
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_residents_primary_sector ON public.residents(primary_sector);

-- Refresh PostgREST (Supabase API) schema cache so new columns are visible immediately
NOTIFY pgrst, 'reload schema';

-- =====================================================
-- 5. NOTIFICATIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  is_read BOOLEAN DEFAULT FALSE,
  link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON public.notifications(created_at);

-- =====================================================
-- 5B. ACTIVITY LOGS / AUDIT TRAIL
-- =====================================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_resident_id UUID,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('Admin', 'PWD Coordinator', 'Solo Parent Coordinator', 'Senior Citizen Coordinator', 'Staff', 'Beneficiary', 'System')),
  action TEXT NOT NULL,
  message TEXT,
  entity_type TEXT,
  entity_id UUID,
  reference_number TEXT,
  link TEXT,
  audience_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  audience_resident_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_user_id ON public.activity_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_resident_id ON public.activity_logs(actor_resident_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_audience_user_id ON public.activity_logs(audience_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_audience_resident_id ON public.activity_logs(audience_resident_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_reference_number ON public.activity_logs(reference_number);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_role_created_at ON public.activity_logs(actor_role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_created_at ON public.activity_logs(action, created_at DESC);

-- =====================================================
-- 6. SMS OTPs + SMS LOGS
-- =====================================================
CREATE TABLE IF NOT EXISTS public.sms_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_number TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'signup',
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_otps_contact_number ON public.sms_otps(contact_number);
CREATE INDEX IF NOT EXISTS idx_sms_otps_purpose ON public.sms_otps(purpose);
CREATE INDEX IF NOT EXISTS idx_sms_otps_created_at ON public.sms_otps(created_at);

CREATE TABLE IF NOT EXISTS public.sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_number TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  provider TEXT DEFAULT 'unisms',
  provider_id TEXT,
  error TEXT,
  reference_type TEXT,
  reference_id TEXT,
  reference_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_contact_number ON public.sms_logs(contact_number);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON public.sms_logs(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_logs_reference_unique
  ON public.sms_logs(reference_type, reference_key)
  WHERE reference_type IS NOT NULL AND reference_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.beneficiary_login_rate_limits (
  key_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beneficiary_login_rate_limits_updated_at
  ON public.beneficiary_login_rate_limits(updated_at);

CREATE OR REPLACE FUNCTION public.record_beneficiary_login_failure(
  p_key_hash TEXT,
  p_max_attempts INTEGER,
  p_window_seconds INTEGER DEFAULT 900,
  p_lockout_seconds INTEGER DEFAULT 900
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_row public.beneficiary_login_rate_limits%ROWTYPE;
  inserted_count INTEGER := 0;
  next_attempts INTEGER;
  current_time TIMESTAMPTZ := NOW();
BEGIN
  INSERT INTO public.beneficiary_login_rate_limits (
    key_hash, attempts, window_started_at, locked_until, updated_at
  ) VALUES (p_key_hash, 1, current_time, NULL, current_time)
  ON CONFLICT (key_hash) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF inserted_count = 1 THEN RETURN; END IF;

  SELECT * INTO current_row
  FROM public.beneficiary_login_rate_limits
  WHERE key_hash = p_key_hash
  FOR UPDATE;

  IF current_row.window_started_at + make_interval(secs => p_window_seconds) <= current_time THEN
    UPDATE public.beneficiary_login_rate_limits
    SET attempts = 1, window_started_at = current_time, locked_until = NULL, updated_at = current_time
    WHERE key_hash = p_key_hash;
    RETURN;
  END IF;

  next_attempts := current_row.attempts + 1;
  UPDATE public.beneficiary_login_rate_limits
  SET attempts = next_attempts,
      locked_until = CASE
        WHEN next_attempts >= p_max_attempts
          THEN current_time + make_interval(secs => p_lockout_seconds)
        ELSE current_row.locked_until
      END,
      updated_at = current_time
  WHERE key_hash = p_key_hash;
END;
$$;

REVOKE ALL ON FUNCTION public.record_beneficiary_login_failure(TEXT, INTEGER, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_beneficiary_login_failure(TEXT, INTEGER, INTEGER, INTEGER) TO service_role;

-- =====================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.assistance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistance_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.beneficiary_login_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_portal_user_can_access_sector(
  row_primary_sector text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.status = 'Active'
      AND (
        u.role = 'Admin'
        OR (u.role = 'PWD Coordinator' AND row_primary_sector = 'pwd')
        OR (u.role = 'Senior Citizen Coordinator' AND row_primary_sector = 'senior_citizen')
        OR (u.role = 'Solo Parent Coordinator' AND row_primary_sector = 'solo_parent')
        OR (
          u.role = 'Staff'
          AND COALESCE(u.sector_access, '[]'::jsonb) ? COALESCE(row_primary_sector, '')
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_portal_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = auth.uid()
      AND u.status = 'Active'
      AND u.role = 'Admin'
  );
$$;

REVOKE ALL ON FUNCTION public.current_portal_user_can_access_sector(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_portal_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_portal_user_can_access_sector(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_portal_user_is_admin() TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can view all users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can manage users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users full access on residents" ON public.residents;
DROP POLICY IF EXISTS "Anyone can create account requests" ON public.account_requests;
DROP POLICY IF EXISTS "Anyone can view account requests" ON public.account_requests;
DROP POLICY IF EXISTS "Authenticated users can update account requests" ON public.account_requests;
DROP POLICY IF EXISTS "Anyone can view assistance requests" ON public.assistance_requests;
DROP POLICY IF EXISTS "Anyone can insert assistance requests" ON public.assistance_requests;
DROP POLICY IF EXISTS "Authenticated users can update assistance requests" ON public.assistance_requests;
DROP POLICY IF EXISTS "Allow authenticated users full access on assistance_requests" ON public.assistance_requests;

DROP POLICY IF EXISTS "Portal users read permitted residents" ON public.residents;
CREATE POLICY "Portal users read permitted residents" ON public.residents
  FOR SELECT TO authenticated
  USING (public.current_portal_user_can_access_sector(primary_sector));

DROP POLICY IF EXISTS "Portal users read permitted assistance requests" ON public.assistance_requests;
CREATE POLICY "Portal users read permitted assistance requests" ON public.assistance_requests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.residents r
      WHERE r.id = assistance_requests.resident_id
        AND public.current_portal_user_can_access_sector(r.primary_sector)
    )
  );

-- Assistance Budgets Policies
DROP POLICY IF EXISTS "Anyone can view assistance budgets" ON public.assistance_budgets;
DROP POLICY IF EXISTS "Authenticated users can update budgets" ON public.assistance_budgets;
DROP POLICY IF EXISTS "Admins can manage assistance budgets" ON public.assistance_budgets;

CREATE POLICY "Anyone can view assistance budgets" ON public.assistance_budgets
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage assistance budgets" ON public.assistance_budgets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'Admin'
        AND u.status = 'Active'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'Admin'
        AND u.status = 'Active'
    )
  );

-- Staff mutations use authenticated server API routes with the service role.
DROP POLICY IF EXISTS "Portal users read permitted staff profiles" ON public.users;
CREATE POLICY "Portal users read permitted staff profiles" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.current_portal_user_is_admin());

DROP POLICY IF EXISTS "Portal users read permitted account requests" ON public.account_requests;
CREATE POLICY "Portal users read permitted account requests" ON public.account_requests
  FOR SELECT TO authenticated
  USING (
    public.current_portal_user_can_access_sector(primary_sector)
  );

-- Notifications Policies
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Activity Logs Policies
DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Staff can view own activity logs" ON public.activity_logs;

CREATE POLICY "Admins can view all activity logs" ON public.activity_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'Admin'
        AND u.status = 'Active'
    )
  );

CREATE POLICY "Staff can view own activity logs" ON public.activity_logs
  FOR SELECT USING (actor_user_id = auth.uid());

-- The browser may only read permitted logs. All inserts go through authenticated
-- server routes using the service role; updates and deletes are intentionally denied.
REVOKE INSERT, UPDATE, DELETE ON public.activity_logs FROM anon, authenticated;
GRANT SELECT ON public.activity_logs TO authenticated;
GRANT SELECT, INSERT ON public.activity_logs TO service_role;

-- =====================================================
-- 7. DOCUMENT STORAGE (Cloudinary only)
-- =====================================================
-- Valid IDs and requirement files are uploaded to Cloudinary.
-- The database stores Cloudinary HTTPS URLs (valid_id_url, requirements_urls, etc.).
-- To remove legacy Supabase Storage files and DB paths, run setup-step7.sql.

-- =====================================================
-- SCRIPT COMPLETE
-- =====================================================
-- All tables, indexes, triggers, and policies created!
