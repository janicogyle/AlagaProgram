-- =====================================================
-- ALAGA PROGRAM - STEP 17: Assistance request source and type cleanup
-- =====================================================
-- Ensures assistance requests can distinguish online uploads from walk-in
-- physical-document verification, and keeps the assistance catalog to the
-- three supported program types.

ALTER TABLE public.assistance_requests
  ADD COLUMN IF NOT EXISTS request_source TEXT DEFAULT 'online';

ALTER TABLE public.assistance_requests
  ADD COLUMN IF NOT EXISTS requirements_urls JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.assistance_requests
  ADD COLUMN IF NOT EXISTS requirements_files JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.assistance_requests
  ADD COLUMN IF NOT EXISTS requirements_checklist JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.assistance_requests
  ADD COLUMN IF NOT EXISTS requirements_completed BOOLEAN DEFAULT FALSE;

UPDATE public.assistance_requests
SET request_source = 'online'
WHERE request_source IS NULL OR request_source NOT IN ('online', 'walk-in');

UPDATE public.assistance_requests
SET requirements_urls = '[]'::jsonb
WHERE requirements_urls IS NULL;

UPDATE public.assistance_requests
SET requirements_files = '[]'::jsonb
WHERE requirements_files IS NULL;

UPDATE public.assistance_requests
SET requirements_checklist = '[]'::jsonb
WHERE requirements_checklist IS NULL;

UPDATE public.assistance_requests
SET requirements_completed = FALSE
WHERE requirements_completed IS NULL;

ALTER TABLE public.assistance_requests
  ALTER COLUMN request_source SET DEFAULT 'online';

ALTER TABLE public.assistance_requests
  ALTER COLUMN requirements_urls SET DEFAULT '[]'::jsonb;

ALTER TABLE public.assistance_requests
  ALTER COLUMN requirements_files SET DEFAULT '[]'::jsonb;

ALTER TABLE public.assistance_requests
  ALTER COLUMN requirements_checklist SET DEFAULT '[]'::jsonb;

ALTER TABLE public.assistance_requests
  ALTER COLUMN requirements_completed SET DEFAULT FALSE;

ALTER TABLE public.assistance_requests
  DROP CONSTRAINT IF EXISTS assistance_requests_request_source_check;

ALTER TABLE public.assistance_requests
  ADD CONSTRAINT assistance_requests_request_source_check
  CHECK (request_source IN ('online', 'walk-in'));

ALTER TABLE public.assistance_budgets
  ADD COLUMN IF NOT EXISTS requirements JSONB DEFAULT '[]'::jsonb;

INSERT INTO public.assistance_budgets (assistance_type, ceiling) VALUES
  ('Medicine Assistance', 500),
  ('Confinement Assistance', 1000),
  ('Burial Assistance', 1000)
ON CONFLICT (assistance_type) DO UPDATE
SET ceiling = EXCLUDED.ceiling;

UPDATE public.assistance_budgets
SET requirements = '[
  "Original copy of prescription of medicine dated within July-December 2025 (must include: name of Senior Citizen / PWD / Solo Parent, medicines prescribed, name & signature of physician, and physician''s license number)",
  "Official receipt of medicine purchased within the quarter",
  "Original and photocopy of Senior Citizen ID / PWD ID / Solo Parent ID"
]'::jsonb
WHERE assistance_type = 'Medicine Assistance';

UPDATE public.assistance_budgets
SET requirements = '[
  "Official receipt",
  "Certificate of confinement dated within July-December 2025",
  "Clinical abstract",
  "Original and photocopy of Senior Citizen ID / PWD ID / Solo Parent ID"
]'::jsonb
WHERE assistance_type = 'Confinement Assistance';

UPDATE public.assistance_budgets
SET requirements = '[
  "Original copy of death certificate within July-December 2025",
  "Original and photocopy of Senior Citizen ID / PWD ID / Solo Parent ID",
  "Valid ID of claimant or proof of relation to deceased"
]'::jsonb
WHERE assistance_type = 'Burial Assistance';

DELETE FROM public.assistance_budgets
WHERE assistance_type = 'Others';

UPDATE public.assistance_requests
SET assistance_type = 'Medicine Assistance'
WHERE assistance_type IN ('Medical Assistance', 'Financial Assistance', 'Educational Assistance');

NOTIFY pgrst, 'reload schema';
