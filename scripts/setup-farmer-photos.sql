-- ============================================================
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Add photo_url column to farmers table (if not already present)
ALTER TABLE farmers
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- 2. Create the storage bucket for farmer photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('farmer-photos', 'farmer-photos', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage policy: anyone with service_role can upload
--    (our API uses the admin client so this is handled automatically)
--    Allow public READ of all objects in this bucket
CREATE POLICY "Public read farmer photos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'farmer-photos');

-- 4. Allow authenticated users (FieldOfficer / Admin) to insert photos
CREATE POLICY "Auth users can upload farmer photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'farmer-photos');

-- 5. Allow authenticated users to delete/update their uploads
CREATE POLICY "Auth users can update farmer photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'farmer-photos');
