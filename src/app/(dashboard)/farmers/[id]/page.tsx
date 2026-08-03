import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Image from "next/image";
import Link from "next/link";

const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-800",
  Delivered: "bg-green-100 text-green-800",
  Completed: "bg-blue-100 text-blue-800",
  Cancelled: "bg-red-100 text-red-700",
};

export default async function FarmerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, district")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  if (
    role !== "Admin" &&
    role !== "FieldOfficer" &&
    role !== "Dealer" &&
    role !== "Counselor" &&
    role !== "Telecaller"
  ) {
    redirect("/");
  }

  // Fetch farmer
  const { data: farmer } = await supabase
    .from("farmers")
    .select("*")
    .eq("id", id)
    .is("deleted_at", null)
    .single();

  if (!farmer) notFound();

  // Fetch all bookings for this farmer
  const { data: bookings } = await supabase
    .from("bookings")
    .select(`
      id,
      qty,
      total_amount,
      booking_amount,
      balance_amount,
      status,
      created_at,
      pesticide_id,
      item:items ( name, rate_per_unit ),
      pesticide_inventory ( name )
    `)
    .eq("farmer_id", id)
    .order("created_at", { ascending: false });

  const totalBookings = bookings?.length ?? 0;
  const cropBookingsCount = bookings?.filter((b) => !b.pesticide_id).length ?? 0;
  const pestBookingsCount = bookings?.filter((b) => !!b.pesticide_id).length ?? 0;

  const pendingCount = bookings?.filter((b) => b.status === "Pending").length ?? 0;
  const deliveredCount = bookings?.filter((b) => b.status === "Delivered" || b.status === "Completed").length ?? 0;
  
  const totalValue = bookings?.reduce((sum, b) => sum + (b.total_amount ?? 0), 0) ?? 0;
  const cropValue = bookings?.filter((b) => !b.pesticide_id).reduce((sum, b) => sum + (b.total_amount ?? 0), 0) ?? 0;
  const pestValue = bookings?.filter((b) => !!b.pesticide_id).reduce((sum, b) => sum + (b.total_amount ?? 0), 0) ?? 0;

  const totalPaid = bookings?.reduce((sum, b) => {
    if (b.status === "Delivered" || b.status === "Completed") return sum + (b.total_amount ?? 0);
    return sum + (b.booking_amount ?? 0);
  }, 0) ?? 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Back link */}
      <div>
        <Link
          href="/farmers"
          className="text-sm text-green-700 hover:text-green-800 font-medium flex items-center gap-1"
        >
          ← Back to Farmer Directory
        </Link>
      </div>

      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Photo */}
            <div className="relative w-24 h-24 rounded-full overflow-hidden border-4 border-green-200 flex-shrink-0 bg-green-50 flex items-center justify-center shadow-md">
              {farmer.photo_url ? (
                <Image
                  src={farmer.photo_url}
                  alt={farmer.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-12 w-12 text-green-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <h1 className="text-2xl font-bold text-gray-900">{farmer.name}</h1>
                <span className="inline-block bg-green-100 text-green-800 text-sm font-semibold px-3 py-0.5 rounded-full">
                  {farmer.unique_id}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                <p>📞 {farmer.phone}</p>
                {farmer.alternate_phone && <p>📱 Alt: {farmer.alternate_phone}</p>}
                {farmer.address && <p>📍 {farmer.address}</p>}
                {farmer.district && <p>🏘 District: {farmer.district}</p>}
                <p>🗓 Registered: {new Date(farmer.created_at).toLocaleDateString("en-IN", { dateStyle: "long" })}</p>
              </div>

              {/* ID Documents */}
              {role === "Admin" && (farmer.pan_card || farmer.aadhar_card) && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {farmer.pan_card && (
                    <span className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-800 text-xs font-medium px-3 py-1.5 rounded-lg border border-blue-200">
                      🪪 PAN: <span className="font-mono font-semibold tracking-wide">{farmer.pan_card}</span>
                    </span>
                  )}
                  {farmer.aadhar_card && (
                    <span className="inline-flex items-center gap-1.5 bg-purple-50 text-purple-800 text-xs font-medium px-3 py-1.5 rounded-lg border border-purple-200">
                      🆔 Aadhar: <span className="font-mono font-semibold tracking-wide">{farmer.aadhar_card}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Land Details */}
              {farmer.land_size && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 text-xs font-medium px-3 py-1.5 rounded-lg border border-amber-200">
                    🌾 Land: <span className="font-semibold">{farmer.land_size} {farmer.land_unit || "acres"}</span>
                  </span>
                  {farmer.land_type && (
                    <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 text-xs font-medium px-3 py-1.5 rounded-lg border border-emerald-200">
                      🚿 Type: <span className="font-semibold capitalize">{farmer.land_type}</span>
                    </span>
                  )}
                </div>
              )}

              {/* Crop & Irrigation Details */}
              {(farmer.crop_type || farmer.growth_stage || farmer.health_status || farmer.irrigation_status || farmer.irrigation_source) && (
                <div className="mt-3 flex flex-wrap gap-3">
                  {farmer.crop_type && (
                    <span className="inline-flex items-center gap-1.5 bg-lime-50 text-lime-800 text-xs font-medium px-3 py-1.5 rounded-lg border border-lime-200">
                      🌱 Crop: <span className="font-semibold">{farmer.crop_type}</span>
                    </span>
                  )}
                  {farmer.growth_stage && (
                    <span className="inline-flex items-center gap-1.5 bg-teal-50 text-teal-800 text-xs font-medium px-3 py-1.5 rounded-lg border border-teal-200">
                      📈 Stage: <span className="font-semibold">{farmer.growth_stage}</span>
                    </span>
                  )}
                  {farmer.health_status && (
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border ${farmer.health_status === 'Good' ? 'bg-green-50 text-green-800 border-green-200' : farmer.health_status === 'Fair' ? 'bg-yellow-50 text-yellow-800 border-yellow-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
                      {farmer.health_status === 'Good' ? '✅' : farmer.health_status === 'Fair' ? '⚠️' : '🚨'} Health: <span className="font-semibold">{farmer.health_status}</span>
                    </span>
                  )}
                  {farmer.irrigation_status && (
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border ${farmer.irrigation_status === 'Adequate' ? 'bg-blue-50 text-blue-800 border-blue-200' : farmer.irrigation_status === 'Deficit' ? 'bg-orange-50 text-orange-800 border-orange-200' : 'bg-cyan-50 text-cyan-800 border-cyan-200'}`}>
                      {farmer.irrigation_status === 'Adequate' ? '💧' : farmer.irrigation_status === 'Deficit' ? '🏜️' : '🌊'} Water: <span className="font-semibold">{farmer.irrigation_status}</span>
                    </span>
                  )}
                  {farmer.irrigation_source && (
                    <span className="inline-flex items-center gap-1.5 bg-indigo-50 text-indigo-800 text-xs font-medium px-3 py-1.5 rounded-lg border border-indigo-200">
                      🚰 Source: <span className="font-semibold">{farmer.irrigation_source}</span>
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-bold text-gray-900">{totalBookings}</div>
            <div className="text-xs text-gray-500 mt-1">Total Bookings</div>
            {(cropBookingsCount > 0 || pestBookingsCount > 0) && (
              <div className="mt-2 text-[10px] text-gray-500 flex flex-col items-center">
                {cropBookingsCount > 0 && <span>🌾 {cropBookingsCount}</span>}
                {pestBookingsCount > 0 && <span>🧪 {pestBookingsCount}</span>}
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-bold text-yellow-600">{pendingCount}</div>
            <div className="text-xs text-gray-500 mt-1">Pending</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-bold text-green-700">{deliveredCount}</div>
            <div className="text-xs text-gray-500 mt-1">Delivered</div>
          </CardContent>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              ₹{totalValue.toLocaleString("en-IN")}
            </div>
            <div className="text-xs text-gray-500 mt-1">Total Order Value</div>
            {(cropValue > 0 || pestValue > 0) && (
              <div className="mt-2 text-[10px] text-gray-500 flex flex-col items-center">
                {cropValue > 0 && <span>🌾 ₹{cropValue.toLocaleString("en-IN")}</span>}
                {pestValue > 0 && <span>🧪 ₹{pestValue.toLocaleString("en-IN")}</span>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Booking History */}
      <Card>
        <CardHeader>
          <CardTitle>Booking History</CardTitle>
          <CardDescription>
            All orders placed by {farmer.name} — most recent first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bookings && bookings.length > 0 ? (
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking ID</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Total (₹)</TableHead>
                    <TableHead>Advance (₹)</TableHead>
                    <TableHead>Balance (₹)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((b) => {
                    const item = Array.isArray(b.item) ? b.item[0] : b.item;
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-xs text-gray-500">
                          {b.id.slice(0, 8).toUpperCase()}
                        </TableCell>
                        <TableCell className="font-medium">
                          {/* @ts-ignore */}
                          {item?.name || b.pesticide_inventory?.name || "—"}
                        </TableCell>
                        <TableCell>{b.qty}</TableCell>
                        <TableCell className="font-mono">
                          {b.total_amount?.toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="font-mono text-green-700">
                          {b.booking_amount?.toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell className="font-mono text-red-600">
                          {b.balance_amount?.toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              STATUS_STYLES[b.status] ?? "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {b.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {new Date(b.created_at).toLocaleDateString("en-IN")}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400 border border-dashed rounded-xl">
              No bookings found for this farmer.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
