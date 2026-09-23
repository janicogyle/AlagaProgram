-- =====================================================
-- STEP 27: Multi-user concurrency safety constraints
-- =====================================================
-- Run this in the Supabase SQL Editor after setup-step26.
--
-- This migration intentionally stops when duplicate live data exists. Review and
-- resolve the reported rows first; it never guesses which user record to delete.

-- Assistance control numbers are generated globally per year (YYYY-###), so they
-- must also be globally unique. The older composite index allowed two categories
-- to receive the same visible reference number during concurrent submissions.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.assistance_requests
    GROUP BY control_number
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate assistance control numbers exist. Resolve them before applying setup-step27.';
  END IF;
END $$;

DROP INDEX IF EXISTS public.assistance_requests_assistance_type_control_number_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS assistance_requests_control_number_uidx
  ON public.assistance_requests (control_number);

-- Atomic reference-number allocators. A row-level UPDATE lock makes allocation
-- safe even when requests are handled by different application servers.
CREATE TABLE IF NOT EXISTS public.control_number_counters (
  counter_key TEXT PRIMARY KEY,
  last_value BIGINT NOT NULL CHECK (last_value >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- This is an internal server-only table. RLS plus the grants below prevent
-- browser clients from reading or changing allocation state.
ALTER TABLE public.control_number_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.allocate_assistance_control_number(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  counter_name TEXT := 'assistance:' || p_year::TEXT;
  existing_max BIGINT;
  allocated BIGINT;
BEGIN
  SELECT COALESCE(
    MAX((substring(control_number FROM '^[0-9]{4}-([0-9]+)$'))::BIGINT),
    0
  )
  INTO existing_max
  FROM public.assistance_requests
  WHERE control_number LIKE p_year::TEXT || '-%';

  INSERT INTO public.control_number_counters (counter_key, last_value)
  VALUES (counter_name, existing_max)
  ON CONFLICT (counter_key) DO NOTHING;

  UPDATE public.control_number_counters
  SET last_value = GREATEST(last_value, existing_max) + 1,
      updated_at = NOW()
  WHERE counter_key = counter_name
  RETURNING last_value INTO allocated;

  RETURN p_year::TEXT || '-' || LPAD(allocated::TEXT, 3, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.allocate_beneficiary_control_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  counter_name CONSTANT TEXT := 'beneficiary';
  existing_max BIGINT;
  allocated BIGINT;
BEGIN
  SELECT COALESCE(
    MAX((substring(control_number FROM '^BENEF-([0-9]+)$'))::BIGINT),
    0
  )
  INTO existing_max
  FROM public.residents
  WHERE control_number ~* '^BENEF-[0-9]+$';

  INSERT INTO public.control_number_counters (counter_key, last_value)
  VALUES (counter_name, existing_max)
  ON CONFLICT (counter_key) DO NOTHING;

  UPDATE public.control_number_counters
  SET last_value = GREATEST(last_value, existing_max) + 1,
      updated_at = NOW()
  WHERE counter_key = counter_name
  RETURNING last_value INTO allocated;

  RETURN 'BENEF-' || LPAD(allocated::TEXT, 3, '0');
END;
$$;

REVOKE ALL ON TABLE public.control_number_counters FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.allocate_assistance_control_number(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.allocate_beneficiary_control_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allocate_assistance_control_number(INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.allocate_beneficiary_control_number() TO service_role;

-- The application checks this rule before inserting, while this partial unique
-- index closes the race where two requests pass that check at the same time.
CREATE UNIQUE INDEX IF NOT EXISTS assistance_requests_one_active_per_category_uidx
  ON public.assistance_requests (resident_id, assistance_type)
  WHERE resident_id IS NOT NULL
    AND status IN ('Pending', 'Resubmitted', 'Approved');

-- Only one non-revoked QR card may be current for a beneficiary.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.beneficiary_cards
    WHERE revoked_at IS NULL
    GROUP BY resident_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Multiple current beneficiary cards exist for one or more residents. Resolve them before applying setup-step27.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS beneficiary_cards_one_current_per_resident_uidx
  ON public.beneficiary_cards (resident_id)
  WHERE revoked_at IS NULL;

-- Two simultaneous renewal submissions must not create two review items.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.beneficiary_id_renewal_requests
    WHERE status = 'Pending'
    GROUP BY resident_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Multiple pending renewal requests exist for one or more residents. Resolve them before applying setup-step27.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS beneficiary_id_renewals_one_pending_per_resident_uidx
  ON public.beneficiary_id_renewal_requests (resident_id)
  WHERE status = 'Pending';

-- A signup approval must map to at most one permanent resident, even if two
-- staff members approve the same request at nearly the same time.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.residents
    WHERE account_request_id IS NOT NULL
    GROUP BY account_request_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate residents.account_request_id values exist. Resolve them before applying setup-step27.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS residents_account_request_id_uidx
  ON public.residents (account_request_id)
  WHERE account_request_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
