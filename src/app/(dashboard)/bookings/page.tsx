import { createClient } from "@/lib/supabase/server";
import { registerFarmer, createBooking } from "@/actions/bookings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { redirect } from "next/navigation";

export default async function BookingsPage() {
  const supabase = await createClient();
  
  // Security Check: Only Admin and FieldOfficer can view this page
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "Admin" && profile?.role !== "FieldOfficer") {
    redirect("/"); // redirect unauthorized users
  }

  // Fetch necessary data
  const { data: farmers } = await supabase.from("farmers").select("*").is("deleted_at", null).order("created_at", { ascending: false }).limit(50);
  const { data: items } = await supabase.from("items").select("*").is("deleted_at", null).order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bookings & Farmers</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Register Farmer Form */}
        <Card>
          <CardHeader>
            <CardTitle>Register New Farmer</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={registerFarmer as (data: FormData) => void} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Farmer Name</Label>
                <Input id="name" name="name" placeholder="John Doe" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" name="phone" placeholder="9876543210" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address / Village</Label>
                <Input id="address" name="address" placeholder="Village Name" />
              </div>
              <Button type="submit" className="w-full bg-green-700 hover:bg-green-800">
                Register Farmer
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Create Booking Form */}
        <Card>
          <CardHeader>
            <CardTitle>Create Booking</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={createBooking as (data: FormData) => void} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="farmerId">Select Farmer</Label>
                <Select name="farmerId" required>
                  <SelectTrigger id="farmerId">
                    <SelectValue placeholder="Select a farmer" />
                  </SelectTrigger>
                  <SelectContent>
                    {farmers?.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name} ({f.unique_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="itemId">Select Item</Label>
                <Select name="itemId" required>
                  <SelectTrigger id="itemId">
                    <SelectValue placeholder="Select an item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items?.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name} - ₹{i.rate_per_unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="qty">Quantity</Label>
                <Input id="qty" name="qty" type="number" min="1" defaultValue="1" required />
              </div>

              <div className="p-4 bg-gray-50 rounded-md space-y-2 text-sm text-gray-700">
                <p><strong>Note:</strong> Total calculation will be processed securely on the server. The booking requires 10% advance.</p>
              </div>

              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">
                Generate Booking
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Farmers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {farmers?.map((f) => (
              <div key={f.id} className="border p-4 rounded-md shadow-sm">
                <div className="font-semibold text-lg text-green-700">{f.unique_id}</div>
                <div className="font-medium text-gray-900">{f.name}</div>
                <div className="text-gray-500 text-sm mt-1">{f.phone}</div>
                {f.address && <div className="text-gray-500 text-sm">{f.address}</div>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
