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
    role !== "Leader" &&
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
      item:items ( name, rate_per_unit )
    `)
    .eq("farmer_id", id)
    .order("created_at", { ascending: false });

  // Summary stats
  const totalBookings = bookings?.length ?? 0;
  const pendingCount = bookings?.filter((b) => b.status === "Pending").length ?? 0;
  const deliveredCount = bookings?.filter((b) => b.status === "Delivered" || b.status === "Completed").length ?? 0;
  const totalValue = bookings?.reduce((sum, b) => sum + (b.total_amount ?? 0), 0) ?? 0;
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
                {farmer.address && <p>📍 {farmer.address}</p>}
                {farmer.district && <p>🏘 District: {farmer.district}</p>}
                <p>🗓 Registered: {new Date(farmer.created_at).toLocaleDateString("en-IN", { dateStyle: "long" })}</p>
              </div>
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
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-2xl font-bold text-gray-900">
              ₹{totalValue.toLocaleString("en-IN")}
            </div>
            <div className="text-xs text-gray-500 mt-1">Total Order Value</div>
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
                        <TableCell className="font-medium">{item?.name ?? "—"}</TableCell>
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
