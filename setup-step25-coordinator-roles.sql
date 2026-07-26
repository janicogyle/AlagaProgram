-- =====================================================
-- STEP 25: Coordinator user roles and fixed sector access
-- =====================================================
-- Run this in Supabase SQL Editor before creating coordinator accounts.
-- "Staff" stays in the constraints only for backward compatibility.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS sector_access JSONB NOT NULL DEFAULT '[]'::jsonb;


ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_check
  CHECK (
    role IN (
      'Admin',
      'PWD Coordinator',
      'Solo Parent Coordinator',
      'Senior Citizen Coordinator',
      'Staff'
    )
  );

-- Upgrade legacy single-sector staff accounts without changing their access.
UPDATE public.users
SET role = CASE sector_access
  WHEN '["pwd"]'::jsonb THEN 'PWD Coordinator'
  WHEN '["solo_parent"]'::jsonb THEN 'Solo Parent Coordinator'
  WHEN '["senior_citizen"]'::jsonb THEN 'Senior Citizen Coordinator'
  ELSE role
END
WHERE role = 'Staff'
  AND jsonb_typeof(sector_access) = 'array'
  AND jsonb_array_length(sector_access) = 1;

ALTER TABLE public.users
  ALTER COLUMN role DROP DEFAULT;

-- Enforce each new coordinator role's sector. Admins always have full access.
UPDATE public.users
SET sector_access = CASE role
  WHEN 'Admin' THEN '[]'::jsonb
  WHEN 'PWD Coordinator' THEN '["pwd"]'::jsonb
  WHEN 'Solo Parent Coordinator' THEN '["solo_parent"]'::jsonb
  WHEN 'Senior Citizen Coordinator' THEN '["senior_citizen"]'::jsonb
  ELSE sector_access
END;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_role_sector_access_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_role_sector_access_check
  CHECK (
    role = 'Staff'
    OR (role = 'Admin' AND sector_access = '[]'::jsonb)
    OR (role = 'PWD Coordinator' AND sector_access = '["pwd"]'::jsonb)
    OR (role = 'Solo Parent Coordinator' AND sector_access = '["solo_parent"]'::jsonb)
    OR (role = 'Senior Citizen Coordinator' AND sector_access = '["senior_citizen"]'::jsonb)
  );

DO $$
BEGIN
  IF to_regclass('public.activity_logs') IS NOT NULL THEN
    ALTER TABLE public.activity_logs
      DROP CONSTRAINT IF EXISTS activity_logs_actor_role_check;

    ALTER TABLE public.activity_logs
      ADD CONSTRAINT activity_logs_actor_role_check
      CHECK (
        actor_role IN (
          'Admin',
          'PWD Coordinator',
          'Solo Parent Coordinator',
          'Senior Citizen Coordinator',
          'Staff',
          'Beneficiary',
          'System'
        )
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
