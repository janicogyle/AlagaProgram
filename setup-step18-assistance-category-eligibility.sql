-- =====================================================
-- STEP 18: Assistance category eligibility guardrails
-- =====================================================
-- Run this in Supabase SQL Editor.
--
-- This supports the rule that a beneficiary may belong to multiple sectors,
-- but may only have one active request per assistance category at a time.
--
-- IMPORTANT:
-- The partial unique index below will fail if duplicate active category
-- requests already exist for the same resident. Review and resolve duplicates
-- before running this script:
--
-- SELECT resident_id, assistance_type, COUNT(*)
-- FROM public.assistance_requests
-- WHERE resident_id IS NOT NULL
--   AND status IN ('Pending', 'Resubmitted', 'Approved')
-- GROUP BY resident_id, assistance_type
-- HAVING COUNT(*) > 1;

CREATE INDEX IF NOT EXISTS idx_assistance_requests_resident_type_status_date
  ON public.assistance_requests (resident_id, assistance_type, status, request_date);

CREATE UNIQUE INDEX IF NOT EXISTS assistance_requests_one_active_per_category_uidx
  ON public.assistance_requests (resident_id, assistance_type)
  WHERE resident_id IS NOT NULL
    AND status IN ('Pending', 'Resubmitted', 'Approved');

NOTIFY pgrst, 'reload schema';
