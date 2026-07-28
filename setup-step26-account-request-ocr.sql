-- STEP 26: Store structured OCR verification metadata for beneficiary signups.
-- Safe to run multiple times.

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

NOTIFY pgrst, 'reload schema';
