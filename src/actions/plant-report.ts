"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function submitPlantReport(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const farmerId = formData.get("farmer_id")?.toString();
  const plantsDelivered = Number(formData.get("plants_delivered"));
  const status = formData.get("status")?.toString();
  const pesticideGiven = formData.get("pesticide_given") === "yes";
  const remarks = formData.get("remarks")?.toString();
  const photosJson = formData.get("photos")?.toString();

  if (!farmerId || isNaN(plantsDelivered) || !status) {
    return { success: false, error: "Missing required fields" };
  }

  let photos: string[] = [];
  if (photosJson) {
    try {
      photos = JSON.parse(photosJson);
    } catch (e) {
      console.error("Invalid photos json", e);
    }
  }

  // Verify farmer exists
  const { data: farmer, error: farmerError } = await supabase
    .from("farmers")
    .select("id")
    .eq("unique_id", farmerId)
    .single();

  if (farmerError || !farmer) {
    return { success: false, error: "Farmer ID not found in database." };
  }

  // Insert report
  const { data, error } = await supabase
    .from("plant_reports")
    .insert([
      {
        farmer_id: farmerId,
        plants_delivered: plantsDelivered,
        status: status,
        pesticide_given: pesticideGiven,
        remarks: remarks || null,
        photos: photos,
        created_by: user.id,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error submitting plant report:", error);
    return { success: false, error: "Failed to submit report" };
  }

  revalidatePath("/plant-report");
  revalidatePath("/reports");
  
  return { success: true, data };
}
