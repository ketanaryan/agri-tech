"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

// Generates a unique profile ID with 10000 possibilities + 5-retry fallback
async function generateProfileId(prefix: string): Promise<string> {
  const supabaseAdmin = createAdminClient();
  for (let i = 0; i < 5; i++) {
    const digits = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    const uid = `${prefix}${digits}`;
    const { count } = await supabaseAdmin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("unique_id", uid);
    if (!count || count === 0) return uid;
  }
  // Timestamp fallback — guaranteed unique
  return `${prefix}${Date.now().toString().slice(-5)}`;
}

export type CreateUserState = { error?: string; success?: boolean } | null;

export async function createUserAction(
  prevState: CreateUserState,
  data: FormData
): Promise<CreateUserState> {
  const email = data.get("email") as string;
  const password = data.get("password") as string;
  const name = data.get("name") as string;
  const phone = data.get("phone") as string;
  const role = data.get("role") as string;
  const district = (data.get("district") as string) || null;

  if (!email || !password || !name || !role) {
    return { error: "All fields are required." };
  }

  if (phone && !/^\d{10}$/.test(phone)) {
    return { error: "Phone number must be exactly 10 digits." };
  }

  // Identify the caller
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return { error: "Unauthorized caller" };

  const { data: invokerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  const invokerRole = invokerProfile?.role;
  if (!invokerRole) return { error: "Unauthorized: Missing role" };

  // Hierarchy enforcement
  if (invokerRole === "Leader") {
    if (role !== "FieldOfficer")
      return { error: "Leaders can only create Field Officers." };
  } else if (invokerRole === "Counselor") {
    if (["Admin", "Telecaller", "Counselor"].includes(role))
      return { error: "Counselors cannot create Admins, Telecallers, or Counselors." };
  } else if (invokerRole !== "Admin") {
    return { error: "You do not have permission to create users." };
  }

  // Generate unique_id
  const prefixMap: Record<string, string> = {
    FieldOfficer: "BPFO",
    Leader: "BPLD",
    Telecaller: "BPTL",
    Counselor: "BPCS",
  };
  const prefix = prefixMap[role];
  const unique_id = prefix ? await generateProfileId(prefix) : null;

  const supabaseAdmin = createAdminClient();
  const { data: newUser, error: authError } =
    await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (authError || !newUser.user)
    return { error: authError?.message || "Failed to create auth user." };

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .insert({ id: newUser.user.id, name, phone, role, district, unique_id });

  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(newUser.user.id);
    return { error: "Profile creation failed: " + profileError.message };
  }

  revalidatePath("/admin");
  revalidatePath("/counselor");
  revalidatePath("/leader");
  return { success: true };
}

// Thin wrapper kept for backward compat
export async function createUser(data: FormData) {
  return createUserAction(null, data);
}

export async function createItem(data: FormData) {
  const name = data.get("name") as string;
  const rate_per_unit = parseFloat(data.get("rate_per_unit") as string);
  if (!name || isNaN(rate_per_unit)) return { error: "Invalid item data" };

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return { error: "Unauthorized caller" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profile?.role !== "Admin") {
    return { error: "You do not have permission to manage items." };
  }

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from("items")
    .insert({ name, rate_per_unit });
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/counselor");
  return { success: true };
}

export async function deleteItem(id: string) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return { error: "Unauthorized caller" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profile?.role !== "Admin") {
    return { error: "You do not have permission to manage items." };
  }

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from("items")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  revalidatePath("/counselor");
  return { success: true };
}
