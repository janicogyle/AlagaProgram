-- Track which signup channel was actually verified.
-- Existing accounts used the original SMS-required signup flow, so their
-- contact numbers can be safely backfilled as verified.

ALTER TABLE public.account_requests
  ADD COLUMN IF NOT EXISTS verification_method TEXT NOT NULL DEFAULT 'sms',
  ADD COLUMN IF NOT EXISTS contact_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.account_requests
  DROP CONSTRAINT IF EXISTS account_requests_verification_method_check;

ALTER TABLE public.account_requests
  ADD CONSTRAINT account_requests_verification_method_check
  CHECK (verification_method IN ('sms', 'email'));

UPDATE public.account_requests
SET
  verification_method = 'sms',
  contact_verified = TRUE,
  email_verified = CASE WHEN email IS NOT NULL AND email <> '' THEN TRUE ELSE FALSE END
WHERE verification_method = 'sms'
  AND contact_verified = FALSE;

ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS verification_method TEXT NOT NULL DEFAULT 'sms',
  ADD COLUMN IF NOT EXISTS contact_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.residents
  DROP CONSTRAINT IF EXISTS residents_verification_method_check;

ALTER TABLE public.residents
  ADD CONSTRAINT residents_verification_method_check
  CHECK (verification_method IN ('sms', 'email'));

UPDATE public.residents
SET
  verification_method = 'sms',
  contact_verified = TRUE,
  email_verified = CASE WHEN email IS NOT NULL AND email <> '' THEN TRUE ELSE FALSE END
WHERE verification_method = 'sms'
  AND contact_verified = FALSE;

NOTIFY pgrst, 'reload schema';
