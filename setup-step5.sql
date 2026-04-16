-- =====================================================
-- STEP 5: Create beneficiary_cards table (QR ID cards)
-- =====================================================

-- Needed for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Generic updated_at trigger helper (used by the trigger below)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.beneficiary_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES public.residents(id) ON DELETE CASCADE,
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Revoked', 'Expired')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_beneficiary_cards_resident_id ON public.beneficiary_cards(resident_id);
CREATE INDEX IF NOT EXISTS idx_beneficiary_cards_expires_at ON public.beneficiary_cards(expires_at);

-- Trigger to update updated_at timestamp
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_beneficiary_cards_updated_at') THEN
    CREATE TRIGGER update_beneficiary_cards_updated_at
      BEFORE UPDATE ON public.beneficiary_cards
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Enable RLS (API routes use service role, but this prevents accidental public access)
ALTER TABLE public.beneficiary_cards ENABLE ROW LEVEL SECURITY;

-- Allow authenticated staff/admin sessions to manage cards if needed
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'beneficiary_cards' AND policyname = 'Authenticated users can manage beneficiary cards'
  ) THEN
    CREATE POLICY "Authenticated users can manage beneficiary cards" ON public.beneficiary_cards
      FOR ALL
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
