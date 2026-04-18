-- ============================================================
-- AgriTech ERP — Run this in your Supabase SQL Editor
-- This script adds the rate_snapshot column for Rate Card Versioning
-- ============================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS rate_snapshot DECIMAL(10,2);
