"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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

  if (!name || !phone) return { error: "Name and phone are required." };

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

export async function createBooking(data: FormData) {
  const farmerId = data.get("farmerId") as string;
  const itemId = data.get("itemId") as string;
  const qty = parseInt(data.get("qty") as string, 10);

  if (!farmerId || !itemId || isNaN(qty) || qty <= 0) {
    return { error: "Invalid booking inputs" };
  }

  const supabase = await createClient();
  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("rate_per_unit")
    .eq("id", itemId)
    .single();

  if (itemError || !item) return { error: "Item not found" };

  const total_amount = item.rate_per_unit * qty;
  const booking_amount = total_amount * 0.1;
  const balance_amount = total_amount - booking_amount;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: insertError } = await supabase.from("bookings").insert({
    farmer_id: farmerId,
    item_id: itemId,
    qty,
    total_amount,
    booking_amount,
    balance_amount,
    status: "Pending",
    created_by: user?.id,
  });

  if (insertError) return { error: insertError.message };

  revalidatePath("/bookings");
  return { success: true };
}

export async function cancelBooking(bookingId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
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

  revalidatePath("/telecaller");
  revalidatePath("/reports");
  revalidatePath("/admin");
  return { success: true };
}
