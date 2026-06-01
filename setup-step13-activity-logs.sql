-- =====================================================
-- STEP 13: ACTIVITY LOGS / AUDIT TRAIL
-- =====================================================
-- Run this in Supabase SQL Editor, then reload PostgREST.

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_resident_id UUID,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK (actor_role IN ('Admin', 'Staff', 'Beneficiary', 'System')),
  action TEXT NOT NULL,
  message TEXT,
  entity_type TEXT,
  entity_id UUID,
  reference_number TEXT,
  link TEXT,
  audience_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  audience_resident_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_user_id ON public.activity_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_resident_id ON public.activity_logs(actor_resident_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_audience_user_id ON public.activity_logs(audience_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_audience_resident_id ON public.activity_logs(audience_resident_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_reference_number ON public.activity_logs(reference_number);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.activity_logs;

CREATE POLICY "Admins can view all activity logs" ON public.activity_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'Admin'
        AND u.status = 'Active'
    )
  );

CREATE POLICY "Users can view their own activity logs" ON public.activity_logs
  FOR SELECT USING (
    actor_user_id = auth.uid()
    OR audience_user_id = auth.uid()
  );

NOTIFY pgrst, 'reload schema';
