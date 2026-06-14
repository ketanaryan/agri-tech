"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

const LOW_STOCK_THRESHOLD_FALLBACK = 5;

export async function submitPlantReport(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Unauthorized" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "FieldOfficer" && profile?.role !== "Admin") {
    return { success: false, error: "Forbidden: Only Field Officers can submit reports." };
  }

  const farmerId = formData.get("farmer_id")?.toString();
  const plantsDelivered = Number(formData.get("plants_delivered"));
  const status = formData.get("status")?.toString();
  const pesticideGiven = formData.get("pesticide_given") === "yes";
  const remarks = formData.get("remarks")?.toString();
  const photosJson = formData.get("photos")?.toString();

  // Pesticide fields (only relevant if pesticideGiven = true)
  const pesticideId = formData.get("pesticide_id")?.toString() || null;
  const pesticideQty = parseFloat(formData.get("pesticide_quantity")?.toString() || "0");

  if (!farmerId || isNaN(plantsDelivered) || plantsDelivered < 0 || plantsDelivered > 1000000 || !status) {
    return { success: false, error: "Invalid or missing required fields" };
  }

  if (remarks && remarks.length > 2000) {
    return { success: false, error: "Remarks too long (max 2000 chars)." };
  }

  // Validate pesticide qty if pesticide was given
  if (pesticideGiven && pesticideId && (isNaN(pesticideQty) || pesticideQty <= 0 || pesticideQty > 100000)) {
    return { success: false, error: "Please enter a valid pesticide quantity used." };
  }

  let photos: string[] = [];
  if (photosJson) {
    try {
      const parsed = JSON.parse(photosJson);
      if (Array.isArray(parsed)) {
        // Validate each photo is a valid URL string and max 10 photos
        photos = parsed
          .filter(p => typeof p === "string" && (p.startsWith("http://") || p.startsWith("https://")))
          .slice(0, 10);
      }
    } catch (e) {
      console.error("Invalid photos json", e);
    }
  }

  const crop_type = formData.get("crop_type")?.toString()?.slice(0, 100);
  const growth_stage = formData.get("growth_stage")?.toString()?.slice(0, 100);
  const health_status = formData.get("health_status")?.toString()?.slice(0, 100);
  const irrigation_status = formData.get("irrigation_status")?.toString()?.slice(0, 100);
  const irrigation_source = formData.get("irrigation_source")?.toString()?.slice(0, 100);

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
        crop_type: crop_type || null,
        growth_stage: growth_stage || null,
        health_status: health_status || null,
        irrigation_status: irrigation_status || null,
        irrigation_source: irrigation_source || null,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error submitting plant report:", error);
    return { success: false, error: "Failed to submit report" };
  }

  // --- Pesticide stock deduction ---
  let lowStockAlert: { name: string; remaining: number; unit: string } | null = null;

  if (pesticideGiven && pesticideId && pesticideQty > 0) {
    const adminClient = createAdminClient();

    // Fetch current stock
    const { data: pesticide } = await adminClient
      .from("pesticide_inventory")
      .select("name, unit, current_stock, low_stock_threshold")
      .eq("id", pesticideId)
      .single();

    if (pesticide) {
      const newStock = Math.max(0, Number(pesticide.current_stock) - pesticideQty);

      // Deduct stock
      await adminClient
        .from("pesticide_inventory")
        .update({ current_stock: newStock, updated_at: new Date().toISOString() })
        .eq("id", pesticideId);

      // Log usage
      await adminClient
        .from("pesticide_usage_log")
        .insert({
          plant_report_id: data.id,
          pesticide_id: pesticideId,
          quantity_used: pesticideQty,
          created_by: user.id,
        });

      // Check if low stock
      const threshold = Number(pesticide.low_stock_threshold) || LOW_STOCK_THRESHOLD_FALLBACK;
      if (newStock <= threshold) {
        lowStockAlert = {
          name: pesticide.name,
          remaining: newStock,
          unit: pesticide.unit,
        };
      }
    }
  }

  revalidatePath("/plant-report");
  revalidatePath("/reports");
  revalidatePath("/admin");

  return { success: true, data, lowStockAlert };
}
