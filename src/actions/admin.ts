"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export async function createUser(data: FormData) {
  const email = data.get("email") as string;
  const password = data.get("password") as string;
  const name = data.get("name") as string;
  const phone = data.get("phone") as string;
  const role = data.get("role") as string;

  if (!email || !password || !name || !role) {
    return { error: "Missing required fields" };
  }

  const supabaseAdmin = createAdminClient();

  const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (authError || !newUser.user) {
    console.error("Auth Error:", authError);
    return { error: authError?.message || "Failed to create authentication user" };
  }

  // Insert profile using the returned user id
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .insert({
      id: newUser.user.id,
      name,
      phone,
      role
    });

  if (profileError) {
    console.error("Profile Insert Error:", profileError);
    // Attempt rollback
    await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
    return { error: "Failed to create profile record" };
  }

  revalidatePath("/admin");
  return { success: true };
}

// Items CRUD
export async function createItem(data: FormData) {
  const name = data.get("name") as string;
  const rate_per_unit = parseFloat(data.get("rate_per_unit") as string);

  if (!name || isNaN(rate_per_unit)) {
    return { error: "Invalid item data" };
  }

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin.from("items").insert({ name, rate_per_unit });

  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true };
}

export async function deleteItem(id: string) {
  const supabaseAdmin = createAdminClient();
  // Soft delete
  const { error } = await supabaseAdmin
    .from("items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
    
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { success: true };
}
