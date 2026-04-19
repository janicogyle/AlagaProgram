-- =====================================================
-- STEP 3: Create admin users table (linked to Supabase Auth)
-- =====================================================
-- IMPORTANT: Admin/staff login in the app expects public.users.id == auth.users.id

-- Needed for gen_random_uuid() in other tables; safe to run multiple times
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  contact_number TEXT,
  role TEXT NOT NULL DEFAULT 'Staff' CHECK (role IN ('Admin', 'Staff')),
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(status);

-- Optional but recommended: enable RLS + policies so authenticated sessions can read/manage
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Users can view all users'
  ) THEN
    CREATE POLICY "Users can view all users" ON public.users
      FOR SELECT USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'Authenticated users can manage users'
  ) THEN
    CREATE POLICY "Authenticated users can manage users" ON public.users
      FOR ALL
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- Refresh PostgREST schema cache
NOTIFY pgrst, 'reload schema';
