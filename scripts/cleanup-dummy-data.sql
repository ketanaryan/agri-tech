-- ============================================================
-- AgriTech ERP — Cleanup Dummy / Trial Data
-- Run this in your Supabase SQL Editor
-- ⚠️ WARNING: This permanently deletes data. Run only once!
-- ============================================================

-- 1. Delete all call_logs (telecaller follow-up logs)
DELETE FROM call_logs;

-- 2. Delete all bookings (orders, payments)
DELETE FROM bookings;

-- 3. Delete all transaction_logs (start fresh)
DELETE FROM transaction_logs;

-- NOTE: farmers, profiles, items, and pesticide_inventory are NOT touched.
-- All farmer registrations, user accounts, rate cards, and pesticide inventory remain intact.
