-- Step 23: Google OAuth email link for beneficiary accounts

ALTER TABLE public.account_requests ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.residents ADD COLUMN IF NOT EXISTS email TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_requests_email_unique
  ON public.account_requests(lower(email))
  WHERE email IS NOT NULL AND email <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_residents_email_unique
  ON public.residents(lower(email))
  WHERE email IS NOT NULL AND email <> '';

NOTIFY pgrst, 'reload schema';
