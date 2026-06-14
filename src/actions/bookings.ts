"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logTransaction } from "@/lib/transaction-logger";

// Unique farmer ID: 10000 range + 5-retry fallback
async function generateFarmerUniqueId(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const digits = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    const uid = `BPFRM${digits}`;
    const { count } = await supabase
      .from("farmers")
      .select("*", { count: "exact", head: true })
      .eq("unique_id", uid);
    if (!count || count === 0) return uid;
  }
  return `BPFRM${Date.now().toString().slice(-5)}`;
}

export async function registerFarmer(data: FormData) {
  const name = data.get("name") as string;
  const phone = data.get("phone") as string;
  const address = data.get("address") as string;
  const photo_url = data.get("photo_url") as string | null;
  const pan_card = data.get("pan_card") as string | null;
  const aadhar_card = data.get("aadhar_card") as string | null;
  const alternate_phone = data.get("alternate_phone") as string | null;
  const land_size_raw = data.get("land_size") as string | null;
  const land_size = land_size_raw ? parseFloat(land_size_raw) : null;
  const land_unit = (data.get("land_unit") as string) || "acres";
  const land_type = (data.get("land_type") as string) || null;

  const crop_type = data.get("crop_type") as string | null;
  const growth_stage = data.get("growth_stage") as string | null;
  const health_status = data.get("health_status") as string | null;
  const irrigation_status = data.get("irrigation_status") as string | null;
  const irrigation_source = data.get("irrigation_source") as string | null;

  if (!name || !phone) return { error: "Name and phone are required." };
  if (!pan_card) return { error: "PAN Card is required." };
  if (!aadhar_card) return { error: "Aadhar Card is required." };

  if (name.length > 200) return { error: "Name is too long." };
  if (address && address.length > 500) return { error: "Address is too long." };
  if (pan_card.length > 10) return { error: "PAN Card is too long." };
  if (!/^\d{12}$/.test(aadhar_card)) return { error: "Aadhar must be 12 digits." };
  if (crop_type && crop_type.length > 100) return { error: "Crop type too long." };
  if (growth_stage && growth_stage.length > 100) return { error: "Growth stage too long." };
  if (health_status && health_status.length > 100) return { error: "Health status too long." };
  if (irrigation_status && irrigation_status.length > 100) return { error: "Irrigation status too long." };
  if (irrigation_source && irrigation_source.length > 100) return { error: "Irrigation source too long." };
  if (land_size !== null && (land_size < 0 || land_size > 10000)) return { error: "Invalid land size." };

  // Phone validation (server-side)
  if (!/^\d{10}$/.test(phone)) {
    return { error: "Phone number must be exactly 10 digits." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, district")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "FieldOfficer" && profile?.role !== "Admin") {
    return { error: "Only Field Officers can register farmers." };
  }

  const district = profile?.district || null;
  const unique_id = await generateFarmerUniqueId(supabase);

  const { data: newFarmer, error } = await supabase
    .from("farmers")
    .insert({
      name,
      phone,
      address,
      photo_url: photo_url || null,
      pan_card: pan_card || null,
      aadhar_card: aadhar_card || null,
      alternate_phone: alternate_phone || null,
      land_size: land_size || null,
      land_unit,
      land_type,
      crop_type: crop_type || null,
      growth_stage: growth_stage || null,
      health_status: health_status || null,
      irrigation_status: irrigation_status || null,
      irrigation_source: irrigation_source || null,
      unique_id,
      district,
    })
    .select("id, unique_id")
    .single();

  if (error) return { error: error.message };

  revalidatePath("/bookings");
  revalidatePath("/farmers");
  return { success: true, data: newFarmer };
}


export async function cancelBooking(bookingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)) {
    return { error: "Invalid booking ID format" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "Admin" && profile?.role !== "Telecaller") {
    return { error: "Only Admin or Telecaller can cancel bookings." };
  }

  const { error } = await supabase
    .from("bookings")
    .update({ status: "Cancelled" })
    .eq("id", bookingId)
    .eq("status", "Pending"); // only cancel pending ones

  if (error) return { error: error.message };

  // — Transaction Logging —
  // Fetch booking info for the log
  const { data: bookingInfo } = await supabase
    .from("bookings")
    .select("total_amount, booking_amount, farmer_id, item_id")
    .eq("id", bookingId)
    .single();

  if (bookingInfo) {
    let farmerName = "Unknown";
    let itemName = "Unknown";
    if (bookingInfo.farmer_id) {
      const { data: fInfo } = await supabase.from("farmers").select("name").eq("id", bookingInfo.farmer_id).single();
      if (fInfo) farmerName = fInfo.name;
    }
    if (bookingInfo.item_id) {
      const { data: iInfo } = await supabase.from("items").select("name").eq("id", bookingInfo.item_id).single();
      if (iInfo) itemName = iInfo.name;
    }

    await logTransaction({
      bookingId,
      farmerId: bookingInfo.farmer_id || "",
      action: "BOOKING_CANCELLED",
      amount: Number(bookingInfo.total_amount || 0),
      paymentMethod: null,
      performedBy: user.id,
      performerName: profile?.name || "Unknown",
      performerRole: profile?.role || "Unknown",
      metadata: {
        item_name: itemName,
        farmer_name: farmerName,
        advance_paid: Number(bookingInfo.booking_amount || 0),
      },
    });
  }

  revalidatePath("/telecaller");
  revalidatePath("/reports");
  revalidatePath("/admin");
  return { success: true };
}
