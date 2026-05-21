-- =====================================================
-- ALAGA PROGRAM - STEP 9: Migrate beneficiary control numbers
-- =====================================================
-- Converts legacy resident numbers (2026-001, etc.) to permanent BENEF-###.
-- Assistance request control numbers (2026-### per type) are NOT changed.

WITH existing_benef AS (
  SELECT COALESCE(
    MAX(
      NULLIF(REGEXP_REPLACE(control_number, '^BENEF-', '', 'i'), '')::INTEGER
    ),
    0
  ) AS max_seq
  FROM public.residents
  WHERE control_number ~* '^BENEF-\d+$'
),
legacy AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at ASC NULLS LAST, id ASC) AS rn
  FROM public.residents
  WHERE control_number IS NULL
     OR control_number !~* '^BENEF-\d+$'
)
UPDATE public.residents r
SET control_number = 'BENEF-' || LPAD((eb.max_seq + l.rn)::TEXT, 3, '0')
FROM legacy l
CROSS JOIN existing_benef eb
WHERE r.id = l.id;
