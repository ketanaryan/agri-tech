import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, PhoneCall, Tractor } from "lucide-react";

export default async function CounselorDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "Counselor" && profile?.role !== "Admin") {
    redirect("/");
  }

  // Fetch counts without revenue
  const { count: farmersCount } = await supabase.from("farmers").select("*", { count: "exact", head: true }).is("deleted_at", null);
  const { count: bookingsCount } = await supabase.from("bookings").select("*", { count: "exact", head: true }).is("deleted_at", null);
  const { count: pendingBookingsCount } = await supabase.from("bookings").select("*", { count: "exact", head: true }).eq("status", "Pending").is("deleted_at", null);
  
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Counselor Dashboard</h1>
      <p className="text-gray-500">Overview of operational metrics (excluding financial data).</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Registered Farmers</CardTitle>
            <Tractor className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{farmersCount || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Bookings</CardTitle>
            <FileText className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookingsCount || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Pending Actions</CardTitle>
            <PhoneCall className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingBookingsCount || 0}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
