-- =====================================================
-- STEP 1: Create assistance_requests table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.assistance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  control_number TEXT UNIQUE NOT NULL,
  resident_id UUID REFERENCES public.residents(id) ON DELETE SET NULL,
  requester_name TEXT,
  requester_contact TEXT,
  requester_address TEXT,
  beneficiary_name TEXT,
  beneficiary_contact TEXT,
  beneficiary_address TEXT,
  assistance_type TEXT NOT NULL,
  amount DECIMAL(10, 2) DEFAULT 0,
  status TEXT DEFAULT 'Pending',
  request_source TEXT DEFAULT 'online',
  processed_by TEXT,
  decision_remarks TEXT,
  valid_id_url TEXT,
  requirements_urls JSONB DEFAULT '[]'::jsonb,
  requirements_files JSONB DEFAULT '[]'::jsonb,
  requirements_checklist JSONB DEFAULT '[]'::jsonb,
  requirements_completed BOOLEAN DEFAULT FALSE,
  request_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assistance_requests_resident_id ON public.assistance_requests(resident_id);
CREATE INDEX IF NOT EXISTS idx_assistance_requests_status ON public.assistance_requests(status);
