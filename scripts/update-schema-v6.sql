-- ============================================================
-- AgriTech ERP — Schema Update V6
-- Transaction Logs for Admin Audit Trail
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create transaction_logs table
CREATE TABLE IF NOT EXISTS transaction_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      UUID REFERENCES bookings(id) ON DELETE SET NULL,
  farmer_id       UUID REFERENCES farmers(id) ON DELETE SET NULL,
  action          TEXT NOT NULL,  -- BOOKING_CREATED, ADVANCE_PAID, BALANCE_COLLECTED, BOOKING_COMPLETED, BOOKING_CANCELLED
  amount          NUMERIC(12,2) DEFAULT 0,
  payment_method  TEXT,           -- online, qr, cash
  performed_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  performer_name  TEXT,           -- denormalized for quick display
  performer_role  TEXT,           -- role at time of action
  metadata        JSONB DEFAULT '{}'::jsonb,  -- extra context
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Index for fast lookups
CREATE INDEX IF NOT EXISTS transaction_logs_booking_id_idx ON transaction_logs(booking_id);
CREATE INDEX IF NOT EXISTS transaction_logs_created_at_idx ON transaction_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS transaction_logs_action_idx ON transaction_logs(action);

-- 3. RLS policies
ALTER TABLE transaction_logs ENABLE ROW LEVEL SECURITY;

-- Admin can read all transaction logs
DROP POLICY IF EXISTS "Admin can read transaction logs" ON transaction_logs;
CREATE POLICY "Admin can read transaction logs"
  ON transaction_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'Admin'
    )
  );

-- Authenticated users can insert transaction logs (server-side controlled)
DROP POLICY IF EXISTS "Authenticated users can insert transaction logs" ON transaction_logs;
CREATE POLICY "Authenticated users can insert transaction logs"
  ON transaction_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow service role full access (for admin client inserts)
DROP POLICY IF EXISTS "Service role full access on transaction logs" ON transaction_logs;
CREATE POLICY "Service role full access on transaction logs"
  ON transaction_logs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
