-- Step 21: Guardian/representative details for minor PWD beneficiaries

ALTER TABLE public.account_requests
  ADD COLUMN IF NOT EXISTS representative_name TEXT,
  ADD COLUMN IF NOT EXISTS representative_contact TEXT,
  ADD COLUMN IF NOT EXISTS representative_relationship TEXT,
  ADD COLUMN IF NOT EXISTS representative_valid_id_url TEXT;

ALTER TABLE public.residents
  ADD COLUMN IF NOT EXISTS representative_name TEXT,
  ADD COLUMN IF NOT EXISTS representative_contact TEXT,
  ADD COLUMN IF NOT EXISTS representative_relationship TEXT,
  ADD COLUMN IF NOT EXISTS representative_valid_id_url TEXT;

NOTIFY pgrst, 'reload schema';
