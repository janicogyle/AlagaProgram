-- =====================================================
-- ALAGA PROGRAM - STEP 10: Requirements verification columns
-- =====================================================
-- Ensures assistance request requirement verification is stored reliably.

ALTER TABLE public.assistance_requests
  ADD COLUMN IF NOT EXISTS requirements_checklist JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.assistance_requests
  ADD COLUMN IF NOT EXISTS requirements_completed BOOLEAN DEFAULT FALSE;

UPDATE public.assistance_requests
SET requirements_checklist = '[]'::jsonb
WHERE requirements_checklist IS NULL;

UPDATE public.assistance_requests
SET requirements_completed = FALSE
WHERE requirements_completed IS NULL;

ALTER TABLE public.assistance_requests
  ALTER COLUMN requirements_checklist SET DEFAULT '[]'::jsonb;

ALTER TABLE public.assistance_requests
  ALTER COLUMN requirements_completed SET DEFAULT FALSE;

NOTIFY pgrst, 'reload schema';
