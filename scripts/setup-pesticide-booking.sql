-- ============================================================
-- AgriTech ERP — Run this in your Supabase SQL Editor
-- This script enables Pesticide Booking functionality
-- ============================================================

-- 1. Add rate_per_unit to pesticide_inventory 
-- (Assuming pesticides cost money when booked)
ALTER TABLE pesticide_inventory
  ADD COLUMN IF NOT EXISTS rate_per_unit DECIMAL(10,2) DEFAULT 0;

-- 2. Make item_id nullable in bookings (so we can book pesticides without plants)
ALTER TABLE bookings
  ALTER COLUMN item_id DROP NOT NULL;

-- 3. Add pesticide_id to bookings table to link the pesticide
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS pesticide_id UUID REFERENCES pesticide_inventory(id);
