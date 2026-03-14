-- ============================================================
-- Barangay Sta. Rita - Digital ID System
-- Run this SQL in Supabase: Dashboard → SQL Editor → New Query
-- ============================================================

-- ─── RESIDENTS TABLE ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS residents (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  control_number  TEXT UNIQUE NOT NULL,
  last_name       TEXT NOT NULL,
  first_name      TEXT NOT NULL,
  middle_name     TEXT,
  house_no        TEXT,
  street          TEXT,
  barangay        TEXT,
  city            TEXT,
  birthday        DATE,
  birthplace      TEXT,
  age             INTEGER,
  sex             TEXT,
  citizenship     TEXT,
  civil_status    TEXT,
  contact_number  TEXT,
  is_pwd          BOOLEAN DEFAULT FALSE,
  is_senior_citizen BOOLEAN DEFAULT FALSE,
  is_solo_parent  BOOLEAN DEFAULT FALSE,
  representative_name    TEXT,
  representative_contact TEXT,
  status          TEXT DEFAULT 'Active',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ASSISTANCE REQUESTS TABLE ──────────────────────────────
CREATE TABLE IF NOT EXISTS assistance_requests (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  control_number      TEXT UNIQUE NOT NULL,
  requester_name      TEXT NOT NULL,
  requester_contact   TEXT,
  requester_address   TEXT,
  service_type        TEXT NOT NULL,
  other_service       TEXT,
  beneficiary_name    TEXT NOT NULL,
  beneficiary_address TEXT,
  beneficiary_contact TEXT,
  amount              NUMERIC(10,2),
  approver_name       TEXT,
  date                DATE,
  status              TEXT DEFAULT 'Pending',
  remarks             TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────
-- Enable RLS
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistance_requests ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access
CREATE POLICY "Allow authenticated users full access on residents"
  ON residents FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access on assistance_requests"
  ON assistance_requests FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Realtime: enable for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE residents;
ALTER PUBLICATION supabase_realtime ADD TABLE assistance_requests;
