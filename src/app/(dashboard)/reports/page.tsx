import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3, CheckCircle2, Clock, XCircle } from "lucide-react";

export default async function ReportsPage() {
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
  const district = profile?.district;

  const allowedRoles = ["Admin", "FieldOfficer", "Leader", "Counselor"];
  if (!role || !allowedRoles.includes(role)) redirect("/");

  const isOfficer = role === "FieldOfficer";
  const isLeader = role === "Leader";
  // Only Admin and Leader see revenue (Counselor and FieldOfficer do NOT)
  const showRevenue = role === "Admin" || role === "Leader";

  // Build base query
  let query = supabase
    .from("bookings")
    .select(
      `id, qty, total_amount, booking_amount, balance_amount, status, created_at, farmer_id,
       farmers ( name, unique_id ),
       items ( name )`
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  let skipQuery = false;

  if (isOfficer) {
    query = query.eq("created_by", user.id);
  } else if (isLeader) {
    if (!district) {
      skipQuery = true;
    } else {
      // Scope to farmers in this leader's district
      const { data: districtFarmers } = await supabase
        .from("farmers")
        .select("id")
        .eq("district", district)
        .is("deleted_at", null);

      const farmerIds = districtFarmers?.map((f) => f.id) || [];
      if (farmerIds.length === 0) {
        skipQuery = true;
      } else {
        query = query.in("farmer_id", farmerIds);
      }
    }
  }

  const { data: bookings } = skipQuery ? { data: [] } : await query;

  const totalBookings = bookings?.length || 0;
  const pendingBookings =
    bookings?.filter((b) => b.status === "Pending").length || 0;
  const completedBookings =
    bookings?.filter((b) => b.status === "Completed").length || 0;
  const cancelledBookings =
    bookings?.filter((b) => b.status === "Cancelled").length || 0;
  const totalValue =
    bookings?.reduce((sum, b) => sum + Number(b.total_amount), 0) || 0;

  const pageTitle =
    isOfficer
      ? "My Performance Report"
      : isLeader
      ? `${district || "District"} Reports`
      : "System Reports";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{pageTitle}</h1>

      {/* KPI Cards */}
      <div
        className={`grid grid-cols-1 md:grid-cols-2 ${
          showRevenue ? "lg:grid-cols-4" : "lg:grid-cols-3"
        } gap-6`}
      >
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Bookings
            </CardTitle>
            <BarChart3 className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBookings}</div>
            <p className="text-xs text-gray-500 mt-1">Total orders processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Pending
            </CardTitle>
            <Clock className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingBookings}</div>
            <p className="text-xs text-gray-500 mt-1">Awaiting delivery</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Completed
            </CardTitle>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedBookings}</div>
            <p className="text-xs text-gray-500 mt-1">Successfully fulfilled</p>
          </CardContent>
        </Card>

        {/* Revenue — Admin and Leader ONLY */}
        {showRevenue && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Pipeline Value
              </CardTitle>
              <span className="w-4 h-4 text-emerald-600 font-bold text-sm">₹</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex gap-1 items-baseline">
                <span>₹</span>
                {totalValue.toLocaleString("en-IN")}
              </div>
              <p className="text-xs text-gray-500 mt-1">Gross merchandise value</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Cancelled indicator (non-revenue info, safe for all roles) */}
      {cancelledBookings > 0 && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 w-fit">
          <XCircle className="w-4 h-4" />
          <span>{cancelledBookings} booking(s) cancelled</span>
        </div>
      )}

      {/* District notice for Leader with no district */}
      {isLeader && !district && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
          No district assigned to your profile. Contact Admin to set your district so reports are scoped correctly.
        </div>
      )}

      {/* Recent Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Booking Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Farmer</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty</TableHead>
                  {showRevenue && <TableHead>Total</TableHead>}
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings?.slice(0, 20).map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(b.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {/* @ts-ignore */}
                      <div className="font-medium">{b.farmers?.name}</div>
                      {/* @ts-ignore */}
                      <div className="text-xs text-gray-500">{b.farmers?.unique_id}</div>
                    </TableCell>
                    {/* @ts-ignore */}
                    <TableCell>{b.items?.name}</TableCell>
                    <TableCell>{b.qty}</TableCell>
                    {showRevenue && (
                      <TableCell className="whitespace-nowrap font-mono">
                        ₹ {Number(b.total_amount).toLocaleString("en-IN")}
                      </TableCell>
                    )}
                    <TableCell>
                      <span
                        className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${
                          b.status === "Completed"
                            ? "bg-green-100 text-green-800"
                            : b.status === "Cancelled"
                            ? "bg-red-100 text-red-700"
                            : "bg-orange-100 text-orange-800"
                        }`}
                      >
                        {b.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {bookings?.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={showRevenue ? 6 : 5}
                      className="h-24 text-center text-gray-500"
                    >
                      No booking activity found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
