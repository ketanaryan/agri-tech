-- ============================================================
-- AgriTech ERP — Schema Update V4
-- Adds village coverage to profiles (Field Officers)
-- and land details to farmers table.
-- Run this in your Supabase SQL Editor.
-- ============================================================

-- 1. Add village coverage fields to profiles (for Field Officers)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS villages_covered INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS village_names TEXT;

-- 2. Add land detail fields to farmers table
ALTER TABLE farmers
  ADD COLUMN IF NOT EXISTS land_size NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS land_unit TEXT DEFAULT 'acres',
  ADD COLUMN IF NOT EXISTS land_type TEXT;
