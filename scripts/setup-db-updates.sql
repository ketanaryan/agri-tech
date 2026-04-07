-- ============================================================
-- AgriTech ERP — Run this in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query → Run All)
-- ============================================================

-- 1. Add 'district' and 'unique_id' to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS district TEXT,
  ADD COLUMN IF NOT EXISTS unique_id TEXT;

-- 2. Add 'district' to farmers
ALTER TABLE farmers
  ADD COLUMN IF NOT EXISTS district TEXT;

-- 3. Add Counselor to the role ENUM (if your DB uses an ENUM type)
--    Skip this if role is stored as plain TEXT.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Counselor';

-- 4. Add UNIQUE constraints to prevent duplicate IDs at the DB level
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_unique_id_key;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_unique_id_key UNIQUE (unique_id);

ALTER TABLE farmers
  DROP CONSTRAINT IF EXISTS farmers_unique_id_key;
ALTER TABLE farmers
  ADD CONSTRAINT farmers_unique_id_key UNIQUE (unique_id);

-- 5. Allow 'Cancelled' as a valid booking status
--    Your DB uses an ENUM type called booking_status, so we add the value to it.
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'Cancelled';

-- 6. Create the call_logs table (required for Telecaller follow-up logging)
CREATE TABLE IF NOT EXISTS call_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  caller_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  notes       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by booking
CREATE INDEX IF NOT EXISTS call_logs_booking_id_idx ON call_logs(booking_id);

-- 7. RLS for call_logs — Telecallers and Admins can insert; everyone in system can read
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Telecallers can insert call logs" ON call_logs;
CREATE POLICY "Telecallers can insert call logs"
  ON call_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('Telecaller', 'Admin')
    )
  );

DROP POLICY IF EXISTS "Authenticated users can read call logs" ON call_logs;
CREATE POLICY "Authenticated users can read call logs"
  ON call_logs FOR SELECT
  TO authenticated
  USING (true);

-- 8. Remove any old trigger that forces a short unique_id on farmers
--    (The app now generates IDs itself — 5-digit BPFRM#### format)
DROP TRIGGER IF EXISTS set_farmer_unique_id ON farmers;
