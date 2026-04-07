import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
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
import { redirect } from "next/navigation";
import { Users, UserPlus, Tractor, FileText } from "lucide-react";
import { CreateUserForm } from "@/components/shared/CreateUserForm";



export default async function LeaderDashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "Leader" && profile?.role !== "Admin") {
    redirect("/");
  }

  // Fetch field officers created by this leader (or all if admin)
  // We scope by district if set
  let officersQuery = supabase
    .from("profiles")
    .select("*")
    .eq("role", "FieldOfficer")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (profile?.district) {
    officersQuery = officersQuery.eq("district", profile.district);
  }

  const { data: officers } = await officersQuery;

  // Count farmers under each officer's district
  const { count: farmersCount } = await supabase
    .from("farmers")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("district", profile?.district || "");

  const { count: bookingsCount } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Leader Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage your Field Officers and monitor team activity.
          {profile?.district && (
            <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-medium">
              District: {profile.district}
            </span>
          )}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Field Officers
            </CardTitle>
            <Users className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{officers?.length || 0}</div>
            <p className="text-xs text-gray-500 mt-1">In your district</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Registered Farmers
            </CardTitle>
            <Tractor className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{farmersCount || 0}</div>
            {farmersCount === 0 ? (
              <p className="text-xs text-orange-500 mt-1">
                No farmers yet — ask your Field Officers to register farmers in {profile?.district ? `the ${profile.district} district` : "your district"}.
              </p>
            ) : (
              <p className="text-xs text-gray-500 mt-1">In your district</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Bookings
            </CardTitle>
            <FileText className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bookingsCount || 0}</div>
            <p className="text-xs text-gray-500 mt-1">System-wide</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Create Field Officer */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-green-600" />
              Create Field Officer
            </CardTitle>
            <CardDescription>
              Add a new Field Officer under your district. An ID will be
              auto-generated.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateUserForm
              allowedRoles={[{ value: "FieldOfficer", label: "Field Officer" }]}
              fixedDistrict={profile?.district || undefined}
              showDistrictField={!profile?.district}
            />
          </CardContent>
        </Card>

        {/* My Field Officers */}
        <Card>
          <CardHeader>
            <CardTitle>My Field Officers</CardTitle>
            <CardDescription>
              Officers in{" "}
              {profile?.district ? `${profile.district} district` : "your team"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>District</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {officers?.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-xs text-green-700 font-medium">
                        {o.unique_id || "N/A"}
                      </TableCell>
                      <TableCell className="font-medium">{o.name}</TableCell>
                      <TableCell className="text-gray-600">{o.phone}</TableCell>
                      <TableCell>{o.district || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {officers?.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-20 text-center text-gray-500"
                      >
                        No field officers yet. Create one above.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
