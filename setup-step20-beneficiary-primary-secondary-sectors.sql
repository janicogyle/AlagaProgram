-- Step 20: Beneficiary primary/secondary sector selection
-- Adds ordered sector slots while preserving existing boolean sector flags.

ALTER TABLE public.account_requests
  ADD COLUMN IF NOT EXISTS primary_sector TEXT,
  ADD COLUMN IF NOT EXISTS secondary_sector TEXT;

ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS primary_sector TEXT,
  ADD COLUMN IF NOT EXISTS secondary_sector TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_requests_primary_sector_valid'
      AND conrelid = 'public.account_requests'::regclass
  ) THEN
    ALTER TABLE public.account_requests
      ADD CONSTRAINT account_requests_primary_sector_valid
      CHECK (primary_sector IS NULL OR primary_sector IN ('pwd', 'senior_citizen', 'solo_parent'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_requests_secondary_sector_valid'
      AND conrelid = 'public.account_requests'::regclass
  ) THEN
    ALTER TABLE public.account_requests
      ADD CONSTRAINT account_requests_secondary_sector_valid
      CHECK (secondary_sector IS NULL OR secondary_sector IN ('pwd', 'senior_citizen', 'solo_parent'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_requests_sector_pair_distinct'
      AND conrelid = 'public.account_requests'::regclass
  ) THEN
    ALTER TABLE public.account_requests
      ADD CONSTRAINT account_requests_sector_pair_distinct
      CHECK (primary_sector IS NULL OR secondary_sector IS NULL OR primary_sector <> secondary_sector);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'residents_primary_sector_valid'
      AND conrelid = 'public.residents'::regclass
  ) THEN
    ALTER TABLE public.residents
      ADD CONSTRAINT residents_primary_sector_valid
      CHECK (primary_sector IS NULL OR primary_sector IN ('pwd', 'senior_citizen', 'solo_parent'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'residents_secondary_sector_valid'
      AND conrelid = 'public.residents'::regclass
  ) THEN
    ALTER TABLE public.residents
      ADD CONSTRAINT residents_secondary_sector_valid
      CHECK (secondary_sector IS NULL OR secondary_sector IN ('pwd', 'senior_citizen', 'solo_parent'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'residents_sector_pair_distinct'
      AND conrelid = 'public.residents'::regclass
  ) THEN
    ALTER TABLE public.residents
      ADD CONSTRAINT residents_sector_pair_distinct
      CHECK (primary_sector IS NULL OR secondary_sector IS NULL OR primary_sector <> secondary_sector);
  END IF;
END $$;

WITH ranked AS (
  SELECT
    id,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN is_pwd THEN 'pwd' END,
      CASE WHEN is_senior_citizen THEN 'senior_citizen' END,
      CASE WHEN is_solo_parent THEN 'solo_parent' END
    ], NULL) AS sectors
  FROM public.account_requests
)
UPDATE public.account_requests ar
SET
  primary_sector = COALESCE(ar.primary_sector, ranked.sectors[1]),
  secondary_sector = COALESCE(ar.secondary_sector, ranked.sectors[2])
FROM ranked
WHERE ar.id = ranked.id
  AND (ar.primary_sector IS NULL OR ar.secondary_sector IS NULL)
  AND ARRAY_LENGTH(ranked.sectors, 1) > 0;

WITH ranked AS (
  SELECT
    id,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN is_pwd THEN 'pwd' END,
      CASE WHEN is_senior_citizen THEN 'senior_citizen' END,
      CASE WHEN is_solo_parent THEN 'solo_parent' END
    ], NULL) AS sectors
  FROM public.residents
)
UPDATE public.residents r
SET
  primary_sector = COALESCE(r.primary_sector, ranked.sectors[1]),
  secondary_sector = COALESCE(r.secondary_sector, ranked.sectors[2])
FROM ranked
WHERE r.id = ranked.id
  AND (r.primary_sector IS NULL OR r.secondary_sector IS NULL)
  AND ARRAY_LENGTH(ranked.sectors, 1) > 0;

NOTIFY pgrst, 'reload schema';
