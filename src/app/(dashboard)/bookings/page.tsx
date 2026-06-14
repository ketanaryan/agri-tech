import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";

import { CreateBookingForm } from "@/components/shared/CreateBookingForm";
import Image from "next/image";
import { Users, MapPin, ShoppingBag } from "lucide-react";

export default async function BookingsPage() {
  const supabase = await createClient();

  // Security Check: Only Admin and FieldOfficer can view this page
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, district")
    .eq("id", user.id)
    .single();

  if (
    profile?.role !== "Admin" && 
    profile?.role !== "FieldOfficer" && 
    profile?.role !== "Counselor" && 
    profile?.role !== "Dealer"
  ) {
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

  // Full farmers for recent display & stats
  const { data: recentFarmers } = await supabase
    .from("farmers")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(9);

  // Stats: Total farmers count
  const { count: totalFarmersCount } = await supabase
    .from("farmers")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);

  // Stats: Distinct villages (addresses)
  const { data: allFarmersForVillages } = await supabase
    .from("farmers")
    .select("address")
    .is("deleted_at", null)
    .not("address", "is", null);

  const uniqueVillages = new Set(
    allFarmersForVillages
      ?.map((f) => f.address?.trim().toLowerCase())
      .filter(Boolean) ?? []
  );
  const villageCount = uniqueVillages.size;

  // Stats: Total bookings count
  const { count: totalBookingsCount } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true });

  // Determine QR Code URL for payments
  let dealerQrCodeUrl = profile?.qr_code_url || null;

  if (profile?.role === "FieldOfficer" && profile?.district) {
    const { data: dealer } = await supabase
      .from("profiles")
      .select("qr_code_url")
      .eq("role", "Dealer")
      .eq("district", profile.district)
      .limit(1)
      .single();
    if (dealer?.qr_code_url) dealerQrCodeUrl = dealer.qr_code_url;
  }

  // Fallback to Admin QR Code
  if (!dealerQrCodeUrl) {
    const { data: admin } = await supabase
      .from("profiles")
      .select("qr_code_url")
      .eq("role", "Admin")
      .not("qr_code_url", "is", null)
      .limit(1)
      .single();
    dealerQrCodeUrl = admin?.qr_code_url || null;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bookings &amp; Farmers</h1>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <Users className="w-6 h-6 text-green-700" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{totalFarmersCount ?? 0}</div>
              <div className="text-xs text-gray-500">Total Farmers</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-xl">
              <MapPin className="w-6 h-6 text-blue-700" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{villageCount}</div>
              <div className="text-xs text-gray-500">Villages Covered</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4 flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-xl">
              <ShoppingBag className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{totalBookingsCount ?? 0}</div>
              <div className="text-xs text-gray-500">Total Bookings</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="max-w-xl">
        {/* Create Booking & Farmer Form */}
        <Card>
          <CardHeader>
            <CardTitle>Create Booking</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateBookingForm
              farmers={farmers ?? []}
              items={items ?? []}
              mode="new"
              dealerQrCodeUrl={dealerQrCodeUrl}
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
                className="border p-4 rounded-xl shadow-sm flex items-start gap-3"
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
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm text-green-700">
                    {f.unique_id}
                  </div>
                  <div className="font-medium text-gray-900 truncate">
                    {f.name}
                  </div>
                  <div className="text-gray-500 text-xs">{f.phone}</div>
                  {f.alternate_phone && (
                    <div className="text-gray-400 text-xs">Alt: {f.alternate_phone}</div>
                  )}
                  {f.address && (
                    <div className="text-gray-400 text-xs truncate">
                      📍 {f.address}
                    </div>
                  )}
                  {/* ID badges */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {f.pan_card && (
                      <span className="text-[10px] font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100">
                        PAN: {f.pan_card}
                      </span>
                    )}
                    {f.aadhar_card && (
                      <span className="text-[10px] font-mono bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded border border-purple-100">
                        Aadhar: {f.aadhar_card}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
