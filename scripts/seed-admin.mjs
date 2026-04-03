import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seedAdmin() {
  const email = "superadmin@agritech.com";
  const password = "adminpassword123";

  console.log(`Creating Admin user: ${email}...`);

  // 1. Create User in Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true,
  });

  if (authError) {
    console.error("Error creating auth user:", authError.message);
    return;
  }

  const userId = authData.user.id;
  console.log("Auth user created. ID:", userId);

  // 2. Add profile
  const { error: profileError } = await supabase.from("profiles").insert({
    id: userId,
    role: "Admin",
    name: "System Administrator",
    phone: "0000000000",
  });

  if (profileError) {
    console.error("Error creating user profile:", profileError.message);
    return;
  }

  console.log("=========================================");
  console.log("SUCCESS! First admin account created.");
  console.log("Email:    superadmin@agritech.com");
  console.log("Password: adminpassword123");
  console.log("=========================================");
  console.log("You can now login with these credentials and use the /admin portal to create real users.");
}

seedAdmin();
