import { createClient } from "@/lib/supabase/server";
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

  // Fetch lists
  const { data: profiles } = await supabase.from("profiles").select("*").is("deleted_at", null).order("created_at", { ascending: false });
  const { data: items } = await supabase.from("items").select("*").is("deleted_at", null).order("name");
  
  // Analytics
  const { count: globalFarmersCount } = await supabase.from("farmers").select("*", { count: "exact", head: true }).is("deleted_at", null);
  const { data: globalBookings } = await supabase.from("bookings").select("status").is("deleted_at", null);
  
  const globalPendingCount = globalBookings?.filter(b => b.status === "Pending").length || 0;
  const totalOfficers = profiles?.filter(p => p.role === "FieldOfficer").length || 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Counselor Portal</h1>
      
      {/* Global Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
            <CardTitle className="text-sm font-medium text-gray-500">Global Pending Bookings</CardTitle>
            <AlertCircle className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalPendingCount}</div>
            <p className="text-xs text-gray-500 mt-1">Requiring action/payment</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Management */}
        <Card>
          <CardHeader>
            <CardTitle>Create New User</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateUserForm
              allowedRoles={[
                { value: "FieldOfficer", label: "Field Officer" },
                { value: "Leader", label: "Leader" },
              ]}
              defaultRole="FieldOfficer"
            />
          </CardContent>
        </Card>

        {/* Item Management */}
        <Card>
          <CardHeader>
            <CardTitle>Manage Catalog Items</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form action={createItem as (data: FormData) => void} className="flex gap-4 items-end">
              <div className="space-y-2 flex-1">
                <Label htmlFor="itemName">Item Name</Label>
                <Input id="itemName" name="name" placeholder="e.g. Fertilizer X" required />
              </div>
              <div className="space-y-2 w-32">
                <Label htmlFor="rate">Rate (₹)</Label>
                <Input id="rate" name="rate_per_unit" type="number" step="0.01" required />
              </div>
              <Button type="submit" className="bg-green-700 hover:bg-green-800">Add Item</Button>
            </form>

            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead className="w-[100px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>₹{item.rate_per_unit}</TableCell>
                      <TableCell>
                        <form action={deleteItem.bind(null, item.id) as () => void}>
                          <Button variant="ghost" size="sm" type="submit" className="text-red-500 hover:text-red-700">Delete</Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-gray-500">No items found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Users</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>District</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">
                    {p.unique_id ? (
                      <span className="text-green-700">{p.unique_id}</span>
                    ) : p.role === "Admin" ? (
                      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-[10px] rounded-full font-semibold uppercase tracking-wider">
                        Admin
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                      {p.role}
                    </span>
                  </TableCell>
                  <TableCell>{p.district || "—"}</TableCell>
                  <TableCell>{p.phone}</TableCell>
                  <TableCell>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
