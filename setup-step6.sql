-- =====================================================
-- STEP 6: SMS OTP + SMS Logs
-- =====================================================

-- Needed for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.sms_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_number TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'signup',
  otp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_otps_contact_number ON public.sms_otps(contact_number);
CREATE INDEX IF NOT EXISTS idx_sms_otps_purpose ON public.sms_otps(purpose);
CREATE INDEX IF NOT EXISTS idx_sms_otps_created_at ON public.sms_otps(created_at);

CREATE TABLE IF NOT EXISTS public.sms_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_number TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed')),
  provider TEXT DEFAULT 'unisms',
  provider_id TEXT,
  error TEXT,
  reference_type TEXT,
  reference_id TEXT,
  reference_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_logs_contact_number ON public.sms_logs(contact_number);
CREATE INDEX IF NOT EXISTS idx_sms_logs_created_at ON public.sms_logs(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_logs_reference_unique
  ON public.sms_logs(reference_type, reference_key)
  WHERE reference_type IS NOT NULL AND reference_key IS NOT NULL;

ALTER TABLE public.sms_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_logs ENABLE ROW LEVEL SECURITY;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
