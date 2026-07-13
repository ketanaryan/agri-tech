-- ============================================================
-- AgriTech ERP — Multi-Stage Payments for Anarr
-- ============================================================

-- 1. Add harvest_rate to items table
-- This allows items to have a portion of their total price deferred until crop harvest
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS harvest_rate NUMERIC(10,2) DEFAULT 0;

-- 2. Add harvest tracking fields to bookings table
-- harvest_amount tracks the total ₹ owed at harvest time
-- harvest_status tracks if it's been paid ('None', 'Pending', 'Paid')
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS harvest_amount NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS harvest_status TEXT DEFAULT 'None';

-- 3. Add HarvestPending to booking_status ENUM
-- This represents a booking that has been delivered but the harvest payment is still pending
ALTER TYPE booking_status ADD VALUE IF NOT EXISTS 'HarvestPending';
