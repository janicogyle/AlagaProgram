-- =====================================================
-- STEP 14: Beneficiary ID renewals
-- =====================================================
-- Run this in Supabase SQL Editor.
--
-- This migration affects beneficiary residents and beneficiary QR cards only.
-- Admin/staff users in public.users still use Active/Inactive.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  c RECORD;
BEGIN
  IF to_regclass('public.residents') IS NOT NULL THEN
    ALTER TABLE public.residents
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';

    FOR c IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.residents'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%status%'
    LOOP
      EXECUTE format('ALTER TABLE public.residents DROP CONSTRAINT IF EXISTS %I', c.conname);
    END LOOP;

    UPDATE public.residents
    SET status = CASE
      WHEN status = 'Inactive' THEN 'Expired'
      WHEN status IN ('Active', 'Expiring Soon', 'Expired', 'Renewal Pending') THEN status
      ELSE 'Active'
    END;

    ALTER TABLE public.residents
      ADD CONSTRAINT residents_status_check
      CHECK (status IN ('Active', 'Expiring Soon', 'Expired', 'Renewal Pending'));
  END IF;
END $$;

DO $$
DECLARE
  c RECORD;
BEGIN
  IF to_regclass('public.beneficiary_cards') IS NOT NULL THEN
    ALTER TABLE public.beneficiary_cards
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';

    FOR c IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.beneficiary_cards'::regclass
        AND contype = 'c'
        AND pg_get_constraintdef(oid) ILIKE '%status%'
    LOOP
      EXECUTE format('ALTER TABLE public.beneficiary_cards DROP CONSTRAINT IF EXISTS %I', c.conname);
    END LOOP;

    UPDATE public.beneficiary_cards
    SET status = CASE
      WHEN status = 'Revoked' THEN 'Expired'
      WHEN status IN ('Active', 'Expiring Soon', 'Expired') THEN status
      ELSE 'Active'
    END;

    ALTER TABLE public.beneficiary_cards
      ADD CONSTRAINT beneficiary_cards_status_check
      CHECK (status IN ('Active', 'Expiring Soon', 'Expired'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.beneficiary_id_renewal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  card_id UUID REFERENCES public.beneficiary_cards(id) ON DELETE SET NULL,
  current_expires_at TIMESTAMPTZ,
  updated_valid_id_url TEXT NOT NULL,
  remarks TEXT,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Incomplete', 'Approved')),
  admin_remarks TEXT,
  processed_by TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beneficiary_id_renewals_resident_id
  ON public.beneficiary_id_renewal_requests(resident_id);
CREATE INDEX IF NOT EXISTS idx_beneficiary_id_renewals_status
  ON public.beneficiary_id_renewal_requests(status);
CREATE INDEX IF NOT EXISTS idx_beneficiary_id_renewals_current_expires_at
  ON public.beneficiary_id_renewal_requests(current_expires_at);
CREATE INDEX IF NOT EXISTS idx_beneficiary_id_renewals_created_at
  ON public.beneficiary_id_renewal_requests(created_at);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_beneficiary_id_renewals_updated_at') THEN
    CREATE TRIGGER update_beneficiary_id_renewals_updated_at
      BEFORE UPDATE ON public.beneficiary_id_renewal_requests
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

ALTER TABLE public.beneficiary_id_renewal_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'beneficiary_id_renewal_requests'
      AND policyname = 'Authenticated users can manage beneficiary ID renewals'
  ) THEN
    CREATE POLICY "Authenticated users can manage beneficiary ID renewals"
      ON public.beneficiary_id_renewal_requests
      FOR ALL
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
