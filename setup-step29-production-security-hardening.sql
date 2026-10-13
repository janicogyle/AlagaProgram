-- =====================================================
-- STEP 29: Production RLS security hardening
-- =====================================================
-- Run after setup-step28-admin-registration-security.sql.
-- This removes anonymous access to personal, identity, assistance, and staff data.
-- Server API routes use SUPABASE_SERVICE_ROLE_KEY and continue to bypass RLS.

BEGIN;

ALTER TABLE public.account_requests
  ADD COLUMN IF NOT EXISTS consent_given_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_version text,
  ADD COLUMN IF NOT EXISTS consent_actor_type text;

ALTER TABLE public.account_requests
  DROP CONSTRAINT IF EXISTS account_requests_consent_actor_type_check;
ALTER TABLE public.account_requests
  ADD CONSTRAINT account_requests_consent_actor_type_check
  CHECK (
    consent_actor_type IS NULL
    OR consent_actor_type IN ('self', 'guardian_or_representative')
  );

CREATE TABLE IF NOT EXISTS public.beneficiary_login_rate_limits (
  key_hash text PRIMARY KEY,
  attempts integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.beneficiary_login_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_beneficiary_login_rate_limits_updated_at
  ON public.beneficiary_login_rate_limits(updated_at);

CREATE OR REPLACE FUNCTION public.record_beneficiary_login_failure(
  p_key_hash text,
  p_max_attempts integer,
  p_window_seconds integer DEFAULT 900,
  p_lockout_seconds integer DEFAULT 900
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_row public.beneficiary_login_rate_limits%ROWTYPE;
  inserted_count integer := 0;
  next_attempts integer;
  current_time timestamptz := now();
BEGIN
  INSERT INTO public.beneficiary_login_rate_limits (
    key_hash,
    attempts,
    window_started_at,
    locked_until,
    updated_at
  ) VALUES (p_key_hash, 1, current_time, NULL, current_time)
  ON CONFLICT (key_hash) DO NOTHING;
  GET DIAGNOSTICS inserted_count = ROW_COUNT;

  IF inserted_count = 1 THEN
    RETURN;
  END IF;

  SELECT * INTO current_row
  FROM public.beneficiary_login_rate_limits
  WHERE key_hash = p_key_hash
  FOR UPDATE;

  IF current_row.window_started_at + make_interval(secs => p_window_seconds) <= current_time THEN
    UPDATE public.beneficiary_login_rate_limits
    SET attempts = 1,
        window_started_at = current_time,
        locked_until = NULL,
        updated_at = current_time
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

REVOKE ALL ON FUNCTION public.record_beneficiary_login_failure(text, integer, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_beneficiary_login_failure(text, integer, integer, integer) TO service_role;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assistance_requests ENABLE ROW LEVEL SECURITY;

-- Remove legacy policies that exposed records or allowed broad direct writes.
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
DROP POLICY IF EXISTS "Portal users read permitted staff profiles" ON public.users;
DROP POLICY IF EXISTS "Portal users read permitted residents" ON public.residents;
DROP POLICY IF EXISTS "Portal users read permitted account requests" ON public.account_requests;
DROP POLICY IF EXISTS "Portal users read permitted assistance requests" ON public.assistance_requests;

DROP FUNCTION IF EXISTS public.current_portal_user_can_access_sector(boolean, boolean, boolean);

-- SECURITY DEFINER is required so policies can inspect the staff profile without
-- recursively evaluating the users table policy. Keep the search path fixed.
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
    SELECT 1
    FROM public.users u
    WHERE u.id = auth.uid()
      AND u.status = 'Active'
      AND u.role = 'Admin'
  );
$$;

REVOKE ALL ON FUNCTION public.current_portal_user_can_access_sector(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.current_portal_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_portal_user_can_access_sector(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_portal_user_is_admin() TO authenticated, service_role;

-- Staff can read only their own directory profile; active Admins can read all.
-- All staff mutations must pass through authenticated server API routes.
CREATE POLICY "Portal users read permitted staff profiles"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.current_portal_user_is_admin());

-- Staff reads are sector-scoped. Beneficiary reads must use cookie-authenticated
-- server routes rather than trusting a browser-provided resident id.
CREATE POLICY "Portal users read permitted residents"
  ON public.residents
  FOR SELECT
  TO authenticated
  USING (
    public.current_portal_user_can_access_sector(primary_sector)
  );

CREATE POLICY "Portal users read permitted account requests"
  ON public.account_requests
  FOR SELECT
  TO authenticated
  USING (
    public.current_portal_user_can_access_sector(primary_sector)
  );

CREATE POLICY "Portal users read permitted assistance requests"
  ON public.assistance_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.residents r
      WHERE r.id = assistance_requests.resident_id
        AND public.current_portal_user_can_access_sector(r.primary_sector)
    )
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
