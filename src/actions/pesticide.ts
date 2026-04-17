"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "Admin") throw new Error("Forbidden: Admin only");
  return supabase;
}

export async function addPesticide(data: FormData) {
  try {
    await requireAdmin();
    const name = (data.get("name") as string)?.trim();
    const unit = (data.get("unit") as string)?.trim() || "litre";
    const current_stock = parseFloat(data.get("current_stock") as string);
    const low_stock_threshold = parseFloat(data.get("low_stock_threshold") as string);

    if (!name || isNaN(current_stock) || isNaN(low_stock_threshold)) {
      return { error: "All fields are required." };
    }

    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("pesticide_inventory")
      .insert({ name, unit, current_stock, low_stock_threshold });

    if (error) return { error: error.message };

    revalidatePath("/admin");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function adjustPesticideStock(id: string, delta: number) {
  try {
    await requireAdmin();
    const adminClient = createAdminClient();

    // Fetch current stock first
    const { data: pest, error: fetchErr } = await adminClient
      .from("pesticide_inventory")
      .select("current_stock")
      .eq("id", id)
      .single();

    if (fetchErr || !pest) return { error: "Pesticide not found." };

    const newStock = Math.max(0, Number(pest.current_stock) + delta);

    const { error } = await adminClient
      .from("pesticide_inventory")
      .update({ current_stock: newStock, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) return { error: error.message };
    revalidatePath("/admin");
    return { success: true, newStock };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function deletePesticide(id: string) {
  try {
    await requireAdmin();
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("pesticide_inventory")
      .delete()
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/admin");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function updateItemRate(id: string, data: FormData) {
  try {
    await requireAdmin();
    const newRate = parseFloat((data.get("newRate") as string) ?? "0");
    if (isNaN(newRate) || newRate <= 0) return { error: "Invalid rate." };
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("items")
      .update({ rate_per_unit: newRate })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/admin");
    revalidatePath("/counselor");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}

export async function updatePesticideRate(id: string, data: FormData) {
  try {
    await requireAdmin();
    const newRate = parseFloat((data.get("newRate") as string) ?? "0");
    if (isNaN(newRate) || newRate < 0) return { error: "Invalid rate." };
    const adminClient = createAdminClient();
    const { error } = await adminClient
      .from("pesticide_inventory")
      .update({ rate_per_unit: newRate })
      .eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/admin");
    return { success: true };
  } catch (e: any) {
    return { error: e.message };
  }
}
