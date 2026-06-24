-- =====================================================
-- STEP 19: Staff sector access assignments
-- =====================================================
-- Run this in Supabase SQL Editor.
--
-- Staff users get explicit sector access:
--   pwd, senior_citizen, solo_parent
--
-- Admin users ignore this column and keep full access.
-- Existing Staff default to [] and will not see sector-restricted records
-- until an Admin assigns at least one sector.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS sector_access JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.users
SET sector_access = '[]'::jsonb
WHERE sector_access IS NULL
   OR role = 'Admin';

CREATE INDEX IF NOT EXISTS idx_users_sector_access
  ON public.users USING GIN (sector_access);

NOTIFY pgrst, 'reload schema';
