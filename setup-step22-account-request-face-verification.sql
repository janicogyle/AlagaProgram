-- STEP 22: Account request valid ID front/back, selfie, and face verification

ALTER TABLE public.account_requests
  ADD COLUMN IF NOT EXISTS valid_id_front_url TEXT,
  ADD COLUMN IF NOT EXISTS valid_id_back_url TEXT,
  ADD COLUMN IF NOT EXISTS selfie_url TEXT,
  ADD COLUMN IF NOT EXISTS face_verification_status TEXT,
  ADD COLUMN IF NOT EXISTS face_verification_score NUMERIC,
  ADD COLUMN IF NOT EXISTS face_verification_provider TEXT,
  ADD COLUMN IF NOT EXISTS face_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS face_verification_error TEXT;

UPDATE public.account_requests
SET valid_id_front_url = valid_id_url
WHERE valid_id_front_url IS NULL
  AND valid_id_url IS NOT NULL
  AND valid_id_url <> '';

ALTER TABLE public.account_requests
  DROP CONSTRAINT IF EXISTS account_requests_face_verification_status_check;

ALTER TABLE public.account_requests
  ADD CONSTRAINT account_requests_face_verification_status_check
  CHECK (
    face_verification_status IS NULL
    OR face_verification_status IN ('passed', 'failed', 'manual_review')
  );

CREATE INDEX IF NOT EXISTS idx_account_requests_face_verification_status
  ON public.account_requests(face_verification_status);

NOTIFY pgrst, 'reload schema';
