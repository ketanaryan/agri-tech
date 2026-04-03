"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function logTelecallerAction(formData: FormData) {
  const bookingId = formData.get("booking_id") as string;
  const notes = formData.get("notes") as string;

  if (!bookingId || !notes) {
    return { error: "Missing required fields" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Ensure the user is a Telecaller (or Admin)
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "Telecaller" && profile?.role !== "Admin") {
    return { error: "Permission denied" };
  }

  // Insert into call_logs Table (Requires Admin to have run the SQL to create this schema first!)
  const { error } = await supabase.from("call_logs").insert({
    booking_id: bookingId,
    caller_id: user.id,
    notes: notes,
  });

  if (error) {
    console.error("Error logging call:", error);
    return { error: "Failed to log call. Make sure the call_logs table exists!" };
  }

  revalidatePath("/telecaller");
  return { success: true };
}
