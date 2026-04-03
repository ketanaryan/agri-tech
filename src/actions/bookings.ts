"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function registerFarmer(data: FormData) {
  const name = data.get("name") as string;
  const phone = data.get("phone") as string;
  const address = data.get("address") as string;

  if (!name || !phone) return { error: "Missing required fields" };

  const supabase = await createClient();

  const { data: newFarmer, error } = await supabase
    .from("farmers")
    .insert({ name, phone, address })
    .select("id, unique_id")
    .single();

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/bookings");
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

  // Fetch item to get the rate for calculation securely on server
  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("rate_per_unit")
    .eq("id", itemId)
    .single();

  if (itemError || !item) {
    return { error: "Item not found" };
  }

  const total_amount = item.rate_per_unit * qty;
  const booking_amount = total_amount * 0.10; // 10%
  const balance_amount = total_amount - booking_amount; // 90%

  // Get user for created_by
  const { data: { user } } = await supabase.auth.getUser();

  const { error: insertError } = await supabase
    .from("bookings")
    .insert({
      farmer_id: farmerId,
      item_id: itemId,
      qty,
      total_amount,
      booking_amount,
      balance_amount,
      status: "Pending",
      created_by: user?.id,
    });

  if (insertError) {
    return { error: insertError.message };
  }

  revalidatePath("/bookings");
  return { success: true };
}
