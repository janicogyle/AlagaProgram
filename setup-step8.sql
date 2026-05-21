-- =====================================================
-- ALAGA PROGRAM - STEP 8: Control number sequences
-- =====================================================
-- Assistance requests: unique per (assistance_type, control_number)
-- Beneficiary residents: permanent BENEF-### (assigned once at approval/registration)

-- Drop global unique on assistance control_number (allows same YYYY-### per type)
ALTER TABLE public.assistance_requests
  DROP CONSTRAINT IF EXISTS assistance_requests_control_number_key;

-- Composite unique: separate sequences per assistance type
CREATE UNIQUE INDEX IF NOT EXISTS assistance_requests_assistance_type_control_number_uidx
  ON public.assistance_requests (assistance_type, control_number);

CREATE INDEX IF NOT EXISTS idx_assistance_requests_assistance_type_control_number
  ON public.assistance_requests (assistance_type, control_number);
