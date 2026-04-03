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
import { BarChart3, CheckCircle2, Clock } from "lucide-react";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch the role for conditional queries (Admin could see all, FieldOfficer sees own)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isOfficer = profile?.role === "FieldOfficer";

  // Query bookings
  let query = supabase
    .from("bookings")
    .select(`
      id,
      qty,
      total_amount,
      booking_amount,
      balance_amount,
      status,
      created_at,
      farmers ( name, unique_id ),
      items ( name )
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (isOfficer) {
    query = query.eq("created_by", user.id);
  }

  const { data: bookings } = await query;

  const totalBookings = bookings?.length || 0;
  const pendingBookings = bookings?.filter(b => b.status === "Pending").length || 0;
  const completedBookings = bookings?.filter(b => b.status === "Completed").length || 0;
  
  const totalValue = bookings?.reduce((sum, b) => sum + Number(b.total_amount), 0) || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{isOfficer ? "My Performance Report" : "System Reports"}</h1>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Bookings</CardTitle>
            <BarChart3 className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBookings}</div>
            <p className="text-xs text-gray-500 mt-1">Total orders processed</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Pending</CardTitle>
            <Clock className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingBookings}</div>
            <p className="text-xs text-gray-500 mt-1">Awaiting delivery/payment</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Completed</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedBookings}</div>
            <p className="text-xs text-gray-500 mt-1">Successfully fulfilled</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Pipeline Value</CardTitle>
            <span className="w-4 h-4 text-emerald-600 font-bold">₹</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex gap-1 items-baseline">
               <span>₹</span>
               {totalValue.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-gray-500 mt-1">Gross merchandise value</p>
          </CardContent>
        </Card>
      </div>

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
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings?.slice(0, 10).map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="whitespace-nowrap">{new Date(b.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      {/* @ts-ignore - Supabase type inference for joined tables */}
                      <div className="font-medium">{b.farmers?.name}</div>
                      {/* @ts-ignore */}
                      <div className="text-xs text-gray-500">{b.farmers?.unique_id}</div>
                    </TableCell>
                    {/* @ts-ignore */}
                    <TableCell>{b.items?.name}</TableCell>
                    <TableCell>{b.qty}</TableCell>
                    <TableCell className="whitespace-nowrap">₹ {b.total_amount}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${
                        b.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                        {b.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {bookings?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                      No recent booking activity found. Get to registering!
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
