import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlantReportForm } from "@/components/shared/PlantReportForm";

export default async function PlantReportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Ensure only FieldOfficers (and maybe Admin) can access
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "FieldOfficer" && profile?.role !== "Admin") {
    redirect("/"); // triggers role-based routing in app/page.tsx
  }

  // Fetch farmers for the combobox
  const { data: farmers } = await supabase
    .from("farmers")
    .select("id, name, unique_id, phone")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          Plant Report Submission
        </h1>
      </div>
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <PlantReportForm farmers={farmers ?? []} />
      </div>
    </div>
  );
}
