import { createClient } from "@/lib/supabase/server";
import { createItem, deleteItem } from "@/actions/admin";
import { updateItemRate, addPesticide, deletePesticide } from "@/actions/pesticide";
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
import { Users, AlertCircle, IndianRupee, Tractor, FlaskConical, AlertTriangle } from "lucide-react";
import { CreateUserForm } from "@/components/shared/CreateUserForm";

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "Admin") {
    redirect("/");
  }

  // Fetch lists
  const { data: profiles } = await supabase.from("profiles").select("*").is("deleted_at", null).order("created_at", { ascending: false });
  const { data: items } = await supabase.from("items").select("*").is("deleted_at", null).order("name");
  const { data: pesticides } = await supabase.from("pesticide_inventory").select("*").order("name");

  // Analytics
  const { count: globalFarmersCount } = await supabase.from("farmers").select("*", { count: "exact", head: true }).is("deleted_at", null);
  const { data: globalBookings } = await supabase.from("bookings").select("total_amount, status").is("deleted_at", null);

  const globalPendingCount = globalBookings?.filter(b => b.status === "Pending").length || 0;
  const globalTotalValue = globalBookings?.reduce((sum, b) => sum + Number(b.total_amount), 0) || 0;
  const totalOfficers = profiles?.filter(p => p.role === "FieldOfficer").length || 0;

  // Low stock pesticides
  const lowStockPesticides = pesticides?.filter(p => Number(p.current_stock) <= Number(p.low_stock_threshold)) || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Admin Portal</h1>

      {/* 🔴 Low Stock Alert Banner */}
      {lowStockPesticides.length > 0 && (
        <div className="border border-red-300 bg-red-50 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-700 font-semibold">
            <AlertTriangle className="w-5 h-5" />
            <span>⚠️ Low Pesticide stock Alert — {lowStockPesticides.length} item(s) need restocking!</span>
          </div>
          <div className="flex flex-wrap gap-3 mt-1">
            {lowStockPesticides.map((p) => (
              <span key={p.id} className="px-3 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full border border-red-200">
                🧪 {p.name}: <strong>{p.current_stock} {p.unit}</strong> left (threshold: {p.low_stock_threshold})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Global Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            <CardTitle className="text-sm font-medium text-gray-500">System Pipeline Value</CardTitle>
            <IndianRupee className="w-4 h-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-baseline gap-1">
              <span>₹</span>{globalTotalValue.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-gray-500 mt-1">Total combined bookings GMV</p>
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
                { value: "Admin", label: "Admin" },
                { value: "FieldOfficer", label: "Field Officer" },
                { value: "Leader", label: "Leader" },
                { value: "Telecaller", label: "Telecaller" },
                { value: "Counselor", label: "Counselor" },
              ]}
              defaultRole="FieldOfficer"
            />
          </CardContent>
        </Card>

        {/* Item/Rate Card Management */}
        <Card>
          <CardHeader>
            <CardTitle>Rate Card (Plant Catalog)</CardTitle>
            <p className="text-xs text-amber-600 mt-1">
              ⚠️ Rate changes only affect new bookings. Existing bookings keep their locked rate.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <form action={createItem as (data: FormData) => void} className="flex gap-4 items-end">
              <div className="space-y-2 flex-1">
                <Label htmlFor="itemName">Item Name</Label>
                <Input id="itemName" name="name" placeholder="e.g. Mango Sapling" required />
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
                    <TableHead>Current Rate</TableHead>
                    <TableHead>Update Rate</TableHead>
                    <TableHead className="w-[80px]">Delete</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items?.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="font-mono text-green-700 font-semibold">₹{item.rate_per_unit}</TableCell>
                      <TableCell>
                        <form action={updateItemRate.bind(null, item.id) as (data: FormData) => void}
                          className="flex gap-2 items-center">
                          <Input
                            name="newRate"
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="New rate"
                            className="h-7 text-xs w-24"
                            required
                          />
                          <Button type="submit" size="sm" variant="outline"
                            className="h-7 text-xs border-amber-400 text-amber-700 hover:bg-amber-50">
                            Update
                          </Button>
                        </form>
                      </TableCell>
                      <TableCell>
                        <form action={deleteItem.bind(null, item.id) as () => void}>
                          <Button variant="ghost" size="sm" type="submit"
                            className="text-red-500 hover:text-red-700 h-7 text-xs">Delete</Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-gray-500">No items found.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 🧪 Pesticide Inventory Management */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <FlaskConical className="w-5 h-5 text-emerald-600" />
          <CardTitle>Pesticide Inventory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add pesticide form */}
          <form action={addPesticide as (data: FormData) => void}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end bg-gray-50 p-4 rounded-lg border">
            <div className="space-y-1">
              <Label htmlFor="pestName">Pesticide Name</Label>
              <Input id="pestName" name="name" placeholder="e.g. Chlorpyrifos" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pestUnit">Unit</Label>
              <Input id="pestUnit" name="unit" placeholder="litre / kg / ml" defaultValue="litre" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pestStock">Initial Stock</Label>
              <Input id="pestStock" name="current_stock" type="number" step="0.01" min="0" placeholder="0" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pestThreshold">Low Stock Alert At</Label>
              <Input id="pestThreshold" name="low_stock_threshold" type="number" step="0.01" min="0" placeholder="5" required />
            </div>
            <div className="md:col-span-4 flex justify-end">
              <Button type="submit" className="bg-emerald-700 hover:bg-emerald-800">
                + Add Pesticide
              </Button>
            </div>
          </form>

          {/* Pesticide table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pesticide</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Low Alert At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Delete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pesticides?.map((p) => {
                  const isLow = Number(p.current_stock) <= Number(p.low_stock_threshold);
                  return (
                    <TableRow key={p.id} className={isLow ? "bg-red-50" : ""}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-gray-500">{p.unit}</TableCell>
                      <TableCell>
                        <span className={`font-bold font-mono ${isLow ? "text-red-600" : "text-emerald-700"}`}>
                          {p.current_stock}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-500">{p.low_stock_threshold}</TableCell>
                      <TableCell>
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-semibold">
                            <AlertTriangle className="w-3 h-3" /> LOW STOCK
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full font-semibold">OK</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <form action={deletePesticide.bind(null, p.id) as () => void}>
                          <Button variant="ghost" size="sm" type="submit"
                            className="text-red-500 hover:text-red-700 h-7 text-xs">Delete</Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(!pesticides || pesticides.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                      No pesticides in inventory. Add one above.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* System Users */}
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
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">{p.role}</span>
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
