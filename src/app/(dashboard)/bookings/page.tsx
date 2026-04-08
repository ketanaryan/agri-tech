import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { RegisterFarmerForm } from "@/components/shared/RegisterFarmerForm";
import { CreateBookingForm } from "@/components/shared/CreateBookingForm";
import Image from "next/image";

export default async function BookingsPage() {
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

  if (profile?.role !== "Admin" && profile?.role !== "FieldOfficer" && profile?.role !== "Counselor") {
    redirect("/"); // redirect unauthorized users
  }

  // Fetch necessary data
  const { data: farmers } = await supabase
    .from("farmers")
    .select("id, name, unique_id, phone")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: items } = await supabase
    .from("items")
    .select("id, name, rate_per_unit")
    .is("deleted_at", null)
    .order("name");

  // Full farmers for recent display
  const { data: recentFarmers } = await supabase
    .from("farmers")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(9);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bookings &amp; Farmers</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Register Farmer Form — client component with photo upload */}
        <Card>
          <CardHeader>
            <CardTitle>Register New Farmer</CardTitle>
          </CardHeader>
          <CardContent>
            <RegisterFarmerForm />
          </CardContent>
        </Card>

        {/* Create Booking Form — Razorpay-integrated client component */}
        <Card>
          <CardHeader>
            <CardTitle>Create Booking</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateBookingForm
              farmers={farmers ?? []}
              items={items ?? []}
            />
          </CardContent>
        </Card>
      </div>

      {/* Recent Farmers with photo */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Farmers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {recentFarmers?.map((f) => (
              <div
                key={f.id}
                className="border p-4 rounded-xl shadow-sm flex items-center gap-3"
              >
                {/* Avatar / Photo */}
                <div className="relative w-12 h-12 rounded-full overflow-hidden border border-green-200 flex-shrink-0 bg-green-50 flex items-center justify-center">
                  {f.photo_url ? (
                    <Image
                      src={f.photo_url}
                      alt={f.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-7 w-7 text-green-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-sm text-green-700">
                    {f.unique_id}
                  </div>
                  <div className="font-medium text-gray-900 truncate">
                    {f.name}
                  </div>
                  <div className="text-gray-500 text-xs">{f.phone}</div>
                  {f.address && (
                    <div className="text-gray-400 text-xs truncate">
                      {f.address}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
