import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createItem, deleteItem } from "@/actions/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { redirect } from "next/navigation";
import { Users, AlertCircle, Tractor } from "lucide-react";
import { CreateUserForm } from "@/components/shared/CreateUserForm";

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
    redirect("/"); // redirect unauthorized users
  }

  // Fetch lists for analytics
  const { data: profiles } = await supabase.from("profiles").select("role").is("deleted_at", null);
  
  // Analytics
  const { count: globalFarmersCount } = await supabase.from("farmers").select("*", { count: "exact", head: true }).is("deleted_at", null);
  
  const totalOfficers = profiles?.filter(p => p.role === "FieldOfficer").length || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Counselor Portal</h1>
      
      {/* Global Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Registered Farmers</CardTitle>
            <Tractor className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalFarmersCount || 0}</div>
            <p className="text-xs text-gray-500 mt-1">Across all field officers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Active Field Officers</CardTitle>
            <Users className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOfficers}</div>
            <p className="text-xs text-gray-500 mt-1">Currently operating in field</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
