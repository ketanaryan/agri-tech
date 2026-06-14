-- Enable Row Level Security (RLS) on unprotected tables
ALTER TABLE farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE pesticide_inventory ENABLE ROW LEVEL SECURITY;

-- 1. Farmers Table Policies
-- Allow all authenticated users to read farmers (needed for lookups)
CREATE POLICY "Farmers: Authenticated users can view" ON farmers FOR SELECT TO authenticated USING (true);

-- Allow FieldOfficers and Admins to insert farmers
CREATE POLICY "Farmers: FieldOfficers and Admins can insert" ON farmers FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('FieldOfficer', 'Admin'))
);

-- Allow FieldOfficers and Admins to update farmers
CREATE POLICY "Farmers: FieldOfficers and Admins can update" ON farmers FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('FieldOfficer', 'Admin'))
);

-- 2. Profiles Table Policies
-- Allow all authenticated users to read profiles
CREATE POLICY "Profiles: Users can read all profiles" ON profiles FOR SELECT TO authenticated USING (true);

-- Allow users to update their OWN profile (e.g., uploading QR codes)
CREATE POLICY "Profiles: Users can update their own profile" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid());

-- Allow Admins to update ALL profiles
CREATE POLICY "Profiles: Admins can update all profiles" ON profiles FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'Admin')
);

-- 3. Pesticide Inventory Policies
-- Allow all authenticated users to read inventory
CREATE POLICY "Pesticide: All users can read" ON pesticide_inventory FOR SELECT TO authenticated USING (true);

-- Note: Insert, Update, and Delete actions for Pesticides use the Supabase Service Role (Admin Client) 
-- in the Next.js API, which automatically bypasses RLS. So no further policies are needed here.

-- 4. Bookings Table Policies (Adding missing INSERT and UPDATE)
-- Allow authorized roles to insert bookings
CREATE POLICY "Bookings: FieldOfficers and Admins can insert" ON bookings FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('FieldOfficer', 'Admin', 'Dealer'))
);

-- Allow Admin, Dealer, and Telecaller to update bookings (process payment, cancel booking)
CREATE POLICY "Bookings: Authorized roles can update" ON bookings FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('Admin', 'Dealer', 'Telecaller'))
);
