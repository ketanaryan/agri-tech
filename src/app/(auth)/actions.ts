"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"

export async function loginAction(formData: FormData) {
  const identifier = (formData.get("email") as string)?.trim()
  const password = formData.get("password") as string

  if (!identifier || !password) {
    return { error: "User ID/Email and password are required" }
  }

  let email = identifier

  // If input doesn't look like an email, treat it as a User ID and resolve to email
  if (!identifier.includes("@")) {
    const supabaseAdmin = createAdminClient()
    const { data: profile, error: lookupError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("unique_id", identifier.toUpperCase())
      .is("deleted_at", null)
      .single()

    if (lookupError || !profile) {
      return { error: "No user found with this ID. Check your User ID and try again." }
    }

    // Get the email from Supabase Auth using the profile's auth user id
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(profile.id)

    if (authError || !authUser?.user?.email) {
      return { error: "Could not resolve account. Please contact your administrator." }
    }

    email = authUser.user.email
  }

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: "Invalid credentials. Check your ID/Email and password." }
  }

  redirect("/")
}
