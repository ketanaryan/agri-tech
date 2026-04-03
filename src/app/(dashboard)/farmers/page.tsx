import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default async function FarmersDirectoryPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role;

  if (role !== "Admin" && role !== "FieldOfficer" && role !== "Telecaller") {
    redirect("/");
  }

  // Fetch all farmers. Admin sees all, FieldOfficer sees all (or should they only see their own?)
  // For a master directory, usually Field Officers can query all farmers to prevent duplicate entries, but let's keep it simple.
  const { data: farmers } = await supabase
    .from("farmers")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Farmer Directory</h1>
          <p className="text-gray-500 text-sm">Master list of all registered farmers in the system.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registered Farmers</CardTitle>
          <CardDescription>View contact details and demographics.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Farmer ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {farmers?.map((farmer) => (
                  <TableRow key={farmer.id}>
                    <TableCell className="font-medium text-green-700">{farmer.unique_id}</TableCell>
                    <TableCell>{farmer.name}</TableCell>
                    <TableCell>{farmer.phone}</TableCell>
                    <TableCell className="max-w-xs truncate">{farmer.address || "N/A"}</TableCell>
                    <TableCell>{new Date(farmer.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {farmers?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                      No farmers found in the directory.
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
