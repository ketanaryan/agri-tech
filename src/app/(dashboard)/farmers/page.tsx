import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
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
import { FarmerSearchInput } from "@/components/shared/FarmerSearchInput";
import { Suspense } from "react";

export default async function FarmersDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
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
    role !== "Telecaller" &&
    role !== "Counselor" &&
    role !== "Leader"
  ) {
    redirect("/");
  }

  const { q } = await searchParams;
  const searchQuery = q?.trim() ?? "";

  // Build base query
  let query = supabase
    .from("farmers")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Scope to district for Leader
  if (role === "Leader" && profile?.district) {
    query = query.eq("district", profile.district);
  }

  // Apply text search filter (name OR unique_id)
  if (searchQuery) {
    query = query.or(
      `name.ilike.%${searchQuery}%,unique_id.ilike.%${searchQuery}%`
    );
  }

  const { data: farmers } = await query;

  // Total count (without search filter) for the hint
  let totalQuery = supabase
    .from("farmers")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);
  if (role === "Leader" && profile?.district) {
    totalQuery = totalQuery.eq("district", profile.district);
  }
  const { count: totalCount } = await totalQuery;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Farmer Directory</h1>
          <p className="text-gray-500 text-sm">
            {role === "Leader" && profile?.district
              ? `Showing farmers in ${profile.district} district.`
              : "Master list of all registered farmers in the system."}
          </p>
        </div>

        {/* Search bar */}
        <Suspense>
          <FarmerSearchInput
            defaultValue={searchQuery}
            totalCount={totalCount ?? 0}
            filteredCount={farmers?.length ?? 0}
          />
        </Suspense>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registered Farmers</CardTitle>
          <CardDescription>
            {searchQuery
              ? `Results for "${searchQuery}" — ${farmers?.length ?? 0} farmer(s) found.`
              : "View contact details and photos."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Photo</TableHead>
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
                    <TableCell>
                      <div className="relative w-10 h-10 rounded-full overflow-hidden border border-green-200 bg-green-50 flex items-center justify-center">
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
                            className="h-6 w-6 text-green-300"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-green-700">
                      {farmer.unique_id}
                    </TableCell>
                    <TableCell>{farmer.name}</TableCell>
                    <TableCell>{farmer.phone}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {farmer.address || "N/A"}
                    </TableCell>
                    <TableCell>
                      {new Date(farmer.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
                {farmers?.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-gray-500"
                    >
                      {searchQuery
                        ? `No farmers matched "${searchQuery}". Try a different name or ID.`
                        : "No farmers found in the directory."}
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
