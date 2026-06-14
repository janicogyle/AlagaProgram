-- STEP 15: Account request resubmission links
-- Adds real Incomplete/Resubmitted statuses and token storage for secure signup corrections.

ALTER TABLE public.account_requests
  ADD COLUMN IF NOT EXISTS resubmission_token_hash TEXT;

ALTER TABLE public.account_requests
  ADD COLUMN IF NOT EXISTS resubmission_token_created_at TIMESTAMPTZ;

ALTER TABLE public.account_requests
  ADD COLUMN IF NOT EXISTS resubmission_sent_at TIMESTAMPTZ;

ALTER TABLE public.account_requests
  ADD COLUMN IF NOT EXISTS resubmitted_at TIMESTAMPTZ;

-- Convert the old admin-only archived state into the user-facing incomplete state.
UPDATE public.account_requests
SET status = 'Incomplete'
WHERE status = 'Archived';

DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.account_requests'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.account_requests DROP CONSTRAINT IF EXISTS %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.account_requests
  ADD CONSTRAINT account_requests_status_check
  CHECK (status IN ('Pending', 'Incomplete', 'Resubmitted', 'Approved', 'Rejected'));

CREATE INDEX IF NOT EXISTS idx_account_requests_resubmission_token_hash
  ON public.account_requests(resubmission_token_hash)
  WHERE resubmission_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_account_requests_resubmitted_at
  ON public.account_requests(resubmitted_at DESC);

NOTIFY pgrst, 'reload schema';
