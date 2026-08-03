"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createB2BOrderAction(formData: FormData) {
  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) return { error: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authData.user.id)
    .single();

  if (!profile) return { error: "Profile not found" };

  const pesticide_id = formData.get("pesticide_id") as string;
  const qty = parseInt(formData.get("qty") as string);
  
  if (!pesticide_id || isNaN(qty) || qty <= 0) {
    return { error: "Invalid pesticide selection or quantity." };
  }

  // Get pesticide rate
  const { data: pesticide } = await supabase
    .from("pesticide_inventory")
    .select("rate_per_unit, stock")
    .eq("id", pesticide_id)
    .single();

  if (!pesticide) return { error: "Pesticide not found." };
  
  const total_amount = pesticide.rate_per_unit * qty;
  
  let seller_id = null; // Default to Admin
  
  // If Dealer, seller is their SuperDistributor in the same district
  if (profile.role === "Dealer") {
    if (!profile.district) return { error: "You are not assigned to a district." };
    
    const { data: sd } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "SuperDistributor")
      .eq("district", profile.district)
      .is("deleted_at", null)
      .limit(1)
      .single();
      
    if (!sd) {
      return { error: "No Super Distributor found for your district. Contact Admin." };
    }
    seller_id = sd.id;
  } else if (profile.role !== "SuperDistributor") {
    return { error: "Only Dealers and Super Distributors can place B2B orders." };
  }
  
  const { error: insertError } = await supabase.from("b2b_orders").insert({
    buyer_id: profile.id,
    seller_id: seller_id,
    pesticide_id,
    qty,
    rate_snapshot: pesticide.rate_per_unit,
    total_amount,
    booking_amount: 0,
    balance_amount: total_amount,
    status: "Pending",
  });

  if (insertError) {
    console.error("B2B Order Insert Error:", insertError);
    return { error: "Failed to place order. " + insertError.message };
  }

  revalidatePath("/b2b-orders");
  return { success: true };
}

export async function updateB2BOrderPaymentAction(orderId: string, amount: number) {
  const supabase = await createClient();
  
  const { data: order } = await supabase.from("b2b_orders").select("*").eq("id", orderId).single();
  if (!order) return { error: "Order not found" };

  const newBookingAmt = Number(order.booking_amount) + amount;
  const newBalanceAmt = Math.max(0, Number(order.total_amount) - newBookingAmt);

  const { error } = await supabase.from("b2b_orders").update({
    booking_amount: newBookingAmt,
    balance_amount: newBalanceAmt
  }).eq("id", orderId);

  if (error) return { error: error.message };

  revalidatePath("/b2b-orders");
  return { success: true };
}

export async function updateB2BOrderStatusAction(orderId: string, status: string) {
  const supabase = await createClient();
  
  const { error } = await supabase.from("b2b_orders").update({
    status: status
  }).eq("id", orderId);

  if (error) return { error: error.message };

  revalidatePath("/b2b-orders");
  return { success: true };
}
