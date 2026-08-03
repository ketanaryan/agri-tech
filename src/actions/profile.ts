"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateProfileQrCode(qrUrl: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  if (qrUrl.length > 1000 || (!qrUrl.startsWith("http://") && !qrUrl.startsWith("https://"))) {
    return { error: "Invalid QR code URL" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ qr_code_url: qrUrl })
    .eq("id", user.id);

  if (error) {
    return { error: "Failed to update QR code" };
  }

  revalidatePath("/admin");
  revalidatePath("/dealer");
  return { success: true };
}

export async function updateInvoiceSettings(companyName: string, gst: string, address: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ 
      invoice_company_name: companyName || null,
      invoice_gst: gst || null,
      invoice_address: address || null
    })
    .eq("id", user.id);

  if (error) {
    return { error: "Failed to update invoice settings" };
  }

  revalidatePath("/dealer");
  revalidatePath("/bookings");
  revalidatePath("/bookings/pesticide");
  return { success: true };
}
