-- STEP 16: Multi Valid ID URLs on account_requests (Cloudinary)
-- Run in Supabase SQL Editor if resubmit/signup fails with:
-- "Could not find the 'valid_id_urls' column of 'account_requests' in the schema cache"

ALTER TABLE public.account_requests
  ADD COLUMN IF NOT EXISTS valid_id_urls JSONB DEFAULT '[]'::jsonb;

-- Backfill from legacy single URL when present
UPDATE public.account_requests
SET valid_id_urls = jsonb_build_array(valid_id_url)
WHERE valid_id_url IS NOT NULL
  AND valid_id_url <> ''
  AND COALESCE(valid_id_urls, '[]'::jsonb) = '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
