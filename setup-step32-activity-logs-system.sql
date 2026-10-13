-- Step 32: Complete, persistent, read-only Activity Logs System.
-- Safe to run after the main database schema and earlier setup steps.

BEGIN;

CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  actor_resident_id UUID,
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL CHECK (
    actor_role IN (
      'Admin',
      'PWD Coordinator',
      'Solo Parent Coordinator',
      'Senior Citizen Coordinator',
      'Staff',
      'Beneficiary',
      'System'
    )
  ),
  action TEXT NOT NULL,
  message TEXT,
  entity_type TEXT,
  entity_id UUID,
  reference_number TEXT,
  link TEXT,
  audience_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  audience_resident_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS actor_user_id UUID;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS actor_resident_id UUID;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS actor_name TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS actor_role TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS entity_type TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS entity_id UUID;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS link TEXT;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS audience_user_id UUID;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS audience_resident_id UUID;
ALTER TABLE public.activity_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

UPDATE public.activity_logs SET actor_name = 'System' WHERE actor_name IS NULL;
UPDATE public.activity_logs SET actor_role = 'System' WHERE actor_role IS NULL;
UPDATE public.activity_logs SET action = 'Recorded activity' WHERE action IS NULL;
UPDATE public.activity_logs SET created_at = NOW() WHERE created_at IS NULL;

ALTER TABLE public.activity_logs ALTER COLUMN actor_name SET NOT NULL;
ALTER TABLE public.activity_logs ALTER COLUMN actor_role SET NOT NULL;
ALTER TABLE public.activity_logs ALTER COLUMN action SET NOT NULL;
ALTER TABLE public.activity_logs ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.activity_logs ALTER COLUMN created_at SET DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at
  ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_user_id
  ON public.activity_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_resident_id
  ON public.activity_logs(actor_resident_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_audience_user_id
  ON public.activity_logs(audience_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_audience_resident_id
  ON public.activity_logs(audience_resident_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_reference_number
  ON public.activity_logs(reference_number);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_role_created_at
  ON public.activity_logs(actor_role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_created_at
  ON public.activity_logs(action, created_at DESC);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view all activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can view their own activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Staff can view own activity logs" ON public.activity_logs;

CREATE POLICY "Admins can view all activity logs"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role = 'Admin'
        AND u.status = 'Active'
    )
  );

CREATE POLICY "Staff can view own activity logs"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (actor_user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.activity_logs FROM anon, authenticated;
GRANT SELECT ON public.activity_logs TO authenticated;
GRANT SELECT, INSERT ON public.activity_logs TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
