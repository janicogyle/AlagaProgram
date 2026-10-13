-- Step 31: Scope coordinator and legacy staff access by PRIMARY sector only.
-- Requires setup-step20-beneficiary-primary-secondary-sectors.sql.

BEGIN;

-- Keep legacy records usable by assigning their ordered sector fields from the
-- existing boolean flags when Step 20 was not fully backfilled.
WITH ranked AS (
  SELECT id, ARRAY_REMOVE(ARRAY[
    CASE WHEN is_pwd THEN 'pwd' END,
    CASE WHEN is_senior_citizen THEN 'senior_citizen' END,
    CASE WHEN is_solo_parent THEN 'solo_parent' END
  ], NULL) AS sectors
  FROM public.residents
)
UPDATE public.residents r
SET primary_sector = COALESCE(r.primary_sector, ranked.sectors[1]),
    secondary_sector = COALESCE(r.secondary_sector, ranked.sectors[2])
FROM ranked
WHERE r.id = ranked.id
  AND ranked.sectors[1] IS NOT NULL
  AND (r.primary_sector IS NULL OR r.secondary_sector IS NULL);

WITH ranked AS (
  SELECT id, ARRAY_REMOVE(ARRAY[
    CASE WHEN is_pwd THEN 'pwd' END,
    CASE WHEN is_senior_citizen THEN 'senior_citizen' END,
    CASE WHEN is_solo_parent THEN 'solo_parent' END
  ], NULL) AS sectors
  FROM public.account_requests
)
UPDATE public.account_requests ar
SET primary_sector = COALESCE(ar.primary_sector, ranked.sectors[1]),
    secondary_sector = COALESCE(ar.secondary_sector, ranked.sectors[2])
FROM ranked
WHERE ar.id = ranked.id
  AND ranked.sectors[1] IS NOT NULL
  AND (ar.primary_sector IS NULL OR ar.secondary_sector IS NULL);

CREATE INDEX IF NOT EXISTS idx_residents_primary_sector
  ON public.residents(primary_sector);
CREATE INDEX IF NOT EXISTS idx_account_requests_primary_sector
  ON public.account_requests(primary_sector);

DROP POLICY IF EXISTS "Portal users read permitted residents" ON public.residents;
DROP POLICY IF EXISTS "Portal users read permitted account requests" ON public.account_requests;
DROP POLICY IF EXISTS "Portal users read permitted assistance requests" ON public.assistance_requests;

DROP FUNCTION IF EXISTS public.current_portal_user_can_access_sector(boolean, boolean, boolean);

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

REVOKE ALL ON FUNCTION public.current_portal_user_can_access_sector(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_portal_user_can_access_sector(text)
  TO authenticated, service_role;

CREATE POLICY "Portal users read permitted residents"
  ON public.residents
  FOR SELECT
  TO authenticated
  USING (public.current_portal_user_can_access_sector(primary_sector));

CREATE POLICY "Portal users read permitted account requests"
  ON public.account_requests
  FOR SELECT
  TO authenticated
  USING (public.current_portal_user_can_access_sector(primary_sector));

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
