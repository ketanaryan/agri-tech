-- ============================================================
-- AgriTech ERP — Schema Update V5
-- Add Crop and Irrigation Tracking to Farmers and Plant Reports
-- ============================================================

-- 1. Add fields to farmers table
ALTER TABLE farmers
  ADD COLUMN IF NOT EXISTS crop_type TEXT,
  ADD COLUMN IF NOT EXISTS growth_stage TEXT,
  ADD COLUMN IF NOT EXISTS health_status TEXT,
  ADD COLUMN IF NOT EXISTS irrigation_status TEXT,
  ADD COLUMN IF NOT EXISTS irrigation_source TEXT;

-- 2. Add fields to plant_reports table
ALTER TABLE plant_reports
  ADD COLUMN IF NOT EXISTS crop_type TEXT,
  ADD COLUMN IF NOT EXISTS growth_stage TEXT,
  ADD COLUMN IF NOT EXISTS health_status TEXT,
  ADD COLUMN IF NOT EXISTS irrigation_status TEXT,
  ADD COLUMN IF NOT EXISTS irrigation_source TEXT;
