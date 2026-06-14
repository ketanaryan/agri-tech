"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function logTelecallerAction(formData: FormData) {
  const bookingId = formData.get("booking_id") as string;
  const notes = formData.get("notes") as string | null;
  const pesticide_given = formData.get("pesticide_given") === "yes";
  const water_given = formData.get("water_given") as string | null;
  const no_issue = formData.get("no_issue") === "true";
  const forward_to = formData.get("forward_to") as string | null;

  // New fields
  const telecaller_name = formData.get("telecaller_name") as string | null;
  const farmer_id = formData.get("farmer_id") as string | null;
  const follow_up_number = parseInt(formData.get("follow_up_number") as string) || 1;
  const call_date = formData.get("call_date") as string | null;
  const call_time = formData.get("call_time") as string | null;
  const call_duration_mins_raw = formData.get("call_duration_mins") as string | null;
  const call_duration_mins = call_duration_mins_raw ? parseInt(call_duration_mins_raw) : null;
  const call_response = formData.get("call_response") as string | null;

  if (!bookingId) {
    return { error: "Missing required fields" };
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)) {
    return { error: "Invalid booking ID format" };
  }
  if (farmer_id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(farmer_id)) {
    return { error: "Invalid farmer ID format" };
  }
  if (notes && notes.length > 2000) return { error: "Notes too long (max 2000 chars)." };
  if (forward_to && forward_to.length > 200) return { error: "Forward to too long." };
  if (telecaller_name && telecaller_name.length > 200) return { error: "Telecaller name too long." };
  if (call_response && call_response.length > 1000) return { error: "Call response too long." };
  if (call_duration_mins !== null && (call_duration_mins < 0 || call_duration_mins > 10000)) {
    return { error: "Invalid call duration." };
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

  // Build insert data — only include new columns if they have values
  // This ensures backward compat if the DB hasn't been migrated yet
  const insertData: Record<string, any> = {
    booking_id: bookingId,
    caller_id: user.id,
    notes: notes,
    pesticide_given,
    water_given,
    no_issue,
    forward_to,
  };

  // Add new fields if present
  if (telecaller_name) insertData.telecaller_name = telecaller_name;
  if (farmer_id) insertData.farmer_id = farmer_id;
  if (follow_up_number) insertData.follow_up_number = follow_up_number;
  if (call_date) insertData.call_date = call_date;
  if (call_time) insertData.call_time = call_time;
  if (call_duration_mins !== null) insertData.call_duration_mins = call_duration_mins;
  if (call_response) insertData.call_response = call_response;

  // Insert into call_logs Table
  const { error } = await supabase.from("call_logs").insert(insertData);

  if (error) {
    console.error("Error logging call:", error);
    
    // Fallback: try without new columns (in case migration hasn't run)
    const { error: fallbackError } = await supabase.from("call_logs").insert({
      booking_id: bookingId,
      caller_id: user.id,
      notes: notes,
      pesticide_given,
      water_given,
      no_issue,
      forward_to,
    });

    if (fallbackError) {
      return { error: "Failed to log call. Make sure the call_logs table exists!" };
    }
  }

  revalidatePath("/telecaller");
  return { success: true };
}
