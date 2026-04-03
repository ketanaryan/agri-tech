import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  // Redirect to correct portal based on assigned role
  switch (profile.role) {
    case "Admin":
      redirect("/admin");
    case "FieldOfficer":
      redirect("/bookings");
    case "Leader":
      redirect("/purchasing");
    case "Telecaller":
      redirect("/telecaller");
    default:
      redirect("/login");
  }
}
