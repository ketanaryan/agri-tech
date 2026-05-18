import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

export default async function PlantReportsDashboard() {
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

  const adminClient = createAdminClient();
  const { data: plantReports } = await adminClient
    .from("plant_reports")
    .select("*")
    .order("created_at", { ascending: false });

  const farmerIds = plantReports?.map(r => r.farmer_id) || [];
  const { data: farmers } = await adminClient
    .from("farmers")
    .select("unique_id, name, phone")
    .in("unique_id", farmerIds);
  const farmerMap = new Map(farmers?.map(f => [f.unique_id, f]));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Plant Reports Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>Submitted Plant Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Farmer ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pesticide</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead>Photos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plantReports?.map((report) => {
                const farmer = farmerMap.get(report.farmer_id);
                return (
                  <TableRow key={report.id}>
                    <TableCell>{new Date(report.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <div className="font-mono text-xs text-green-700 font-semibold">{report.farmer_id}</div>
                      {farmer && (
                        <div className="text-xs text-gray-500 mt-1">
                          <div>{farmer.name}</div>
                          <div>{farmer.phone}</div>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full border border-green-200">
                        {report.status}
                      </span>
                    </TableCell>
                  <TableCell>
                    {report.pesticide_given ? (
                      <span className="text-red-600 font-medium text-xs">Yes</span>
                    ) : (
                      <span className="text-green-600 font-medium text-xs">No</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate" title={report.remarks || ""}>
                    {report.remarks || "—"}
                  </TableCell>
                  <TableCell>
                    {report.photos && report.photos.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {report.photos.map((photo: string, i: number) => {
                          const publicUrl = photo.startsWith("http") 
                            ? photo 
                            : supabase.storage.from("plant-reports").getPublicUrl(photo).data.publicUrl;
                          
                          return (
                            <a key={i} href={publicUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs bg-blue-50 px-2 py-1 rounded">
                              View Photo {i + 1}
                            </a>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">No photos</span>
                    )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!plantReports || plantReports.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-4">No plant reports found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
