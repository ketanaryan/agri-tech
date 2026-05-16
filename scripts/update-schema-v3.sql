-- ============================================================
-- AgriTech ERP — Run this in your Supabase SQL Editor
-- (Dashboard → SQL Editor → New Query → Run All)
-- ============================================================

-- Add new identification fields to farmers table
ALTER TABLE farmers
  ADD COLUMN IF NOT EXISTS pan_card TEXT,
  ADD COLUMN IF NOT EXISTS aadhar_card TEXT,
  ADD COLUMN IF NOT EXISTS alternate_phone TEXT;
