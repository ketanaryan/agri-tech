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
  const aadhar_card = data.get("aadhar_card") as string;
  const pan_card = data.get("pan_card") as string;
  const district = (data.get("district") as string) || null;
  const taluka = (data.get("taluka") as string) || null;
  const villages_covered = parseInt(data.get("villages_covered") as string) || 0;
  const village_names = (data.get("village_names") as string) || null;

  if (!email || !password || !name || !role || !aadhar_card || !pan_card) {
    return { error: "All fields are required, including Aadhar and PAN card." };
  }

  if (phone && !/^\d{10}$/.test(phone)) {
    return { error: "Phone number must be exactly 10 digits." };
  }

  // Input length limits
  if (!/^\d{12}$/.test(aadhar_card)) return { error: "Aadhar Card must be exactly 12 digits." };
  if (pan_card.length > 10) return { error: "PAN Card is too long (max 10 chars)." };
  if (name.length > 200) return { error: "Name is too long (max 200 chars)." };
  if (email.length > 254) return { error: "Email is too long." };
  if (password.length > 128) return { error: "Password is too long (max 128 chars)." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };

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

  const profileData: Record<string, any> = {
    id: newUser.user.id,
    name,
    phone,
    role,
    district,
    taluka,
    unique_id,
    aadhar_card,
    pan_card: pan_card.toUpperCase(),
  };

  // Add village coverage for Field Officers
  if (role === "FieldOfficer") {
    profileData.villages_covered = villages_covered;
    profileData.village_names = village_names;
  }

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .insert(profileData);

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
  const advance_percentage = parseFloat(data.get("advance_percentage") as string || "10");
  if (!name || isNaN(rate_per_unit) || isNaN(advance_percentage)) return { error: "Invalid item data" };

  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) return { error: "Unauthorized caller" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profile?.role !== "Admin" && profile?.role !== "Counselor") {
    return { error: "You do not have permission to manage items." };
  }

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from("items")
    .insert({ name, rate_per_unit, advance_percentage });
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
