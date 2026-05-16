-- ============================================================
-- AgriTech ERP — Update Schema V2
-- ============================================================

-- 1. Add new columns to call_logs table for Telecaller follow-up form
ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS pesticide_given BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS water_given TEXT,
  ADD COLUMN IF NOT EXISTS no_issue BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS forward_to TEXT;

-- Make notes column optional
ALTER TABLE call_logs ALTER COLUMN notes DROP NOT NULL;

-- 2. Ensure Telecallers can read bookings
--    If RLS is enabled on bookings, this ensures Telecallers are allowed to see them.
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read bookings" ON bookings;
CREATE POLICY "Authenticated users can read bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (true);

-- (Optional) If items are restricted too
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read items" ON items;
CREATE POLICY "Authenticated users can read items"
  ON items FOR SELECT
  TO authenticated
  USING (true);

-- 3. Add advance_percentage to items table for Plant-wise Booking percentage
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS advance_percentage NUMERIC(5,2) DEFAULT 10.00;
