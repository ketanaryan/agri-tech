"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function processPayment(bookingId: string) {
  const supabase = await createClient();

  const { error } = await supabase
    .from("bookings")
    .update({ status: "Completed" })
    .eq("id", bookingId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/purchasing");
  return { success: true };
}
