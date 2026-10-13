-- Step 30: Unify assistance-request eligibility across online and walk-in flows.
-- Run this once in the Supabase SQL editor after reviewing any duplicate rows.

ALTER TABLE public.assistance_requests
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

-- Existing rows predate the dedicated release timestamp. updated_at is the
-- closest available record of when staff marked the request as Released.
UPDATE public.assistance_requests
SET released_at = COALESCE(updated_at, request_date::timestamptz, created_at, NOW())
WHERE status = 'Released'
  AND released_at IS NULL;

DO $$
DECLARE
  duplicate_resident UUID;
BEGIN
  SELECT resident_id
  INTO duplicate_resident
  FROM public.assistance_requests
  WHERE resident_id IS NOT NULL
    AND status IN ('Pending', 'Resubmitted', 'Approved')
  GROUP BY resident_id
  HAVING COUNT(*) > 1
  LIMIT 1;

  IF duplicate_resident IS NOT NULL THEN
    RAISE EXCEPTION
      'Cannot enable unified assistance eligibility: resident % has multiple active requests. Resolve the duplicate Pending/Resubmitted/Approved rows first.',
      duplicate_resident;
  END IF;
END $$;

DROP INDEX IF EXISTS public.assistance_requests_one_active_per_category_uidx;

CREATE UNIQUE INDEX IF NOT EXISTS assistance_requests_one_active_per_resident_uidx
  ON public.assistance_requests (resident_id)
  WHERE resident_id IS NOT NULL
    AND status IN ('Pending', 'Resubmitted', 'Approved');

CREATE INDEX IF NOT EXISTS idx_assistance_requests_resident_status_released
  ON public.assistance_requests (resident_id, status, released_at DESC);

NOTIFY pgrst, 'reload schema';
