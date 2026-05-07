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
  control_number TEXT UNIQUE NOT NULL,
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_assistance_requests_resident_id ON public.assistance_requests(resident_id);
CREATE INDEX IF NOT EXISTS idx_assistance_requests_status ON public.assistance_requests(status);
CREATE INDEX IF NOT EXISTS idx_assistance_requests_request_date ON public.assistance_requests(request_date);

-- Ensure columns exist on older installs
ALTER TABLE public.assistance_requests ADD COLUMN IF NOT EXISTS requirements_urls JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.assistance_requests ADD COLUMN IF NOT EXISTS requirements_files JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.assistance_requests ADD COLUMN IF NOT EXISTS requirements_checklist JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.assistance_requests ADD COLUMN IF NOT EXISTS requirements_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE public.assistance_requests ADD COLUMN IF NOT EXISTS request_source TEXT DEFAULT 'online';

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
  ('Burial Assistance', 1000),
  ('Others', 0)
ON CONFLICT (assistance_type) DO NOTHING;

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
  role TEXT NOT NULL DEFAULT 'Staff' CHECK (role IN ('Admin', 'Staff')),
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

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
  password_hash TEXT,

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
  valid_id_url TEXT,
  valid_id_urls JSONB DEFAULT '[]'::jsonb,
  age INTEGER,
  birthplace TEXT,
  sex TEXT,
  citizenship TEXT,
  civil_status TEXT,
  
  -- Request Info
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Archived')),
  notes TEXT,
  processed_by TEXT,
  processed_at TIMESTAMPTZ,
  
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

CREATE INDEX IF NOT EXISTS idx_account_requests_created ON public.account_requests(created_at);

CREATE TRIGGER update_account_requests_updated_at
  BEFORE UPDATE ON public.account_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Normalize legacy values + ensure only Pending/Approved/Archived are allowed
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
SET status = 'Archived'
WHERE status = 'Rejected';

ALTER TABLE public.account_requests
  DROP CONSTRAINT IF EXISTS account_requests_status_check;

ALTER TABLE public.account_requests
  ADD CONSTRAINT account_requests_status_check
  CHECK (status IN ('Pending', 'Approved', 'Archived'));

-- Ensure password columns exist (safe to run multiple times)
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS valid_id_url TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS valid_id_urls JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS birthplace TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS sex TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS citizenship TEXT;
ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS civil_status TEXT;
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

    -- Ensure updated_at auto-refreshes on updates
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_residents_updated_at') THEN
      CREATE TRIGGER update_residents_updated_at
        BEFORE UPDATE ON public.residents
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    END IF;
  END IF;
END $$;

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
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.assistance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistance_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Assistance Requests Policies
CREATE POLICY "Anyone can view assistance requests" ON public.assistance_requests
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert assistance requests" ON public.assistance_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can update assistance requests" ON public.assistance_requests
  FOR UPDATE USING (auth.role() = 'authenticated');

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

-- Users Policies
CREATE POLICY "Users can view all users" ON public.users
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage users" ON public.users
  FOR ALL USING (auth.role() = 'authenticated');

-- Account Requests Policies
CREATE POLICY "Anyone can create account requests" ON public.account_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can view account requests" ON public.account_requests
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can update account requests" ON public.account_requests
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Notifications Policies
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- 7. STORAGE BUCKETS
-- =====================================================
-- Run these commands in Supabase Storage section or via SQL:

-- Documents bucket for IDs, prescriptions, receipts, etc.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policy for documents
CREATE POLICY "Anyone can upload documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Anyone can view documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'documents');

-- =====================================================
-- SCRIPT COMPLETE
-- =====================================================
-- All tables, indexes, triggers, and policies created!
