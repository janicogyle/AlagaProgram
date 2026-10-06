-- Step 28: Integrity and direct-database sector controls for staff-created beneficiaries.
-- Run once in the Supabase SQL Editor before deploying the Admin Registration flow.

CREATE UNIQUE INDEX IF NOT EXISTS idx_residents_contact_number_unique
  ON public.residents(contact_number)
  WHERE contact_number IS NOT NULL AND contact_number <> '';

CREATE OR REPLACE FUNCTION public.enforce_resident_sector_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_role text;
  allowed_sectors jsonb;
  requested text[];
BEGIN
  -- Service-role backend requests have no auth.uid(); they are authorized in the API route.
  -- Direct client database calls are checked here as a second enforcement layer.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role, COALESCE(sector_access, '[]'::jsonb)
    INTO actor_role, allowed_sectors
  FROM public.users
  WHERE id = auth.uid();

  IF actor_role IS NULL THEN
    RAISE EXCEPTION 'Only an authorized Admin or assigned staff member can register beneficiaries.';
  END IF;
  IF actor_role = 'Admin' THEN
    RETURN NEW;
  END IF;

  requested := ARRAY_REMOVE(ARRAY[NEW.primary_sector, NEW.secondary_sector], NULL);
  IF COALESCE(array_length(requested, 1), 0) <> 1 THEN
    RAISE EXCEPTION 'Staff may register exactly one beneficiary sector.';
  END IF;

  IF (actor_role = 'PWD Coordinator' AND requested[1] <> 'pwd')
     OR (actor_role = 'Senior Citizen Coordinator' AND requested[1] <> 'senior_citizen')
     OR (actor_role = 'Solo Parent Coordinator' AND requested[1] <> 'solo_parent')
     OR (actor_role = 'Staff' AND NOT (allowed_sectors ? requested[1])) THEN
    RAISE EXCEPTION 'Beneficiary sector is outside the staff member''s assigned access.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS residents_enforce_sector_access ON public.residents;
CREATE TRIGGER residents_enforce_sector_access
  BEFORE INSERT OR UPDATE OF primary_sector, secondary_sector, is_pwd, is_senior_citizen, is_solo_parent
  ON public.residents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_resident_sector_access();

-- A beneficiary account must always carry its official photo. Existing legacy rows remain valid.
ALTER TABLE public.residents
  DROP CONSTRAINT IF EXISTS residents_account_requires_profile_photo;
ALTER TABLE public.residents
  ADD CONSTRAINT residents_account_requires_profile_photo
  CHECK (password_hash IS NULL OR NULLIF(trim(profile_photo_url), '') IS NOT NULL) NOT VALID;

NOTIFY pgrst, 'reload schema';