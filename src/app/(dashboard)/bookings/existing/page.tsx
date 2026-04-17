import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";

import { CreateBookingForm } from "@/components/shared/CreateBookingForm";

export default async function ExistingBookingsPage() {
  const supabase = await createClient();

  // Security Check: Only Admin and FieldOfficer can view this page
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (
    profile?.role !== "Admin" && 
    profile?.role !== "FieldOfficer" && 
    profile?.role !== "Counselor" && 
    profile?.role !== "Leader"
  ) {
    redirect("/"); // redirect unauthorized users
  }

  // Fetch necessary data
  const { data: farmers } = await supabase
    .from("farmers")
    .select("id, name, unique_id, phone")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const { data: items } = await supabase
    .from("items")
    .select("id, name, rate_per_unit")
    .is("deleted_at", null)
    .order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Existing Farmer Booking</h1>
      <p className="text-gray-500 text-sm">
        Select a farmer from the directory and create a new booking for them.
      </p>

      <div className="max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Create Booking for Existing Farmer</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateBookingForm
              farmers={farmers ?? []}
              items={items ?? []}
              mode="existing"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
