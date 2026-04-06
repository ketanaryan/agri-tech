-- ============================================================
-- Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- 1. Create plant_reports table
CREATE TABLE IF NOT EXISTS plant_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farmer_id TEXT NOT NULL,
  plants_delivered INTEGER NOT NULL,
  status TEXT NOT NULL,
  pesticide_given BOOLEAN NOT NULL DEFAULT false,
  remarks TEXT,
  photos TEXT[],
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Add Row Level Security (RLS) to plant_reports
ALTER TABLE plant_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create plant reports"
  ON plant_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "FieldOfficers can view their own reports and Admins can view all"
  ON plant_reports
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = created_by
    OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'Admin')
  );

-- 3. Create the storage bucket for plant report photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('plant-reports', 'plant-reports', true)
ON CONFLICT (id) DO NOTHING;

-- 4. Storage policy: Allow public READ of all objects in this bucket
CREATE POLICY "Public read plant report photos"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'plant-reports');

-- 5. Allow authenticated users to insert photos
CREATE POLICY "Auth users can upload plant report photos"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'plant-reports');

-- 6. Allow authenticated users to delete/update their uploads
CREATE POLICY "Auth users can update plant report photos"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'plant-reports');
CREATE POLICY "Auth users can delete plant report photos"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'plant-reports');
