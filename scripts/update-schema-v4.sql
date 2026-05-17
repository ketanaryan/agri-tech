-- ============================================================
-- AgriTech ERP — Schema Update V4
-- Run this in your Supabase SQL Editor.
-- ============================================================

-- 1. Add village coverage + taluka fields to profiles (for Field Officers)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS villages_covered INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS village_names TEXT,
  ADD COLUMN IF NOT EXISTS taluka TEXT;

-- 2. Add land detail fields to farmers table
ALTER TABLE farmers
  ADD COLUMN IF NOT EXISTS land_size NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS land_unit TEXT DEFAULT 'acres',
  ADD COLUMN IF NOT EXISTS land_type TEXT;

-- 3. Add new call log detail fields for enhanced telecaller follow-up
ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS telecaller_name TEXT,
  ADD COLUMN IF NOT EXISTS farmer_id TEXT,
  ADD COLUMN IF NOT EXISTS follow_up_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS call_date DATE,
  ADD COLUMN IF NOT EXISTS call_time TIME,
  ADD COLUMN IF NOT EXISTS call_duration_mins INTEGER,
  ADD COLUMN IF NOT EXISTS call_response TEXT;
