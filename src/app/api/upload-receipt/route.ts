import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  // Authenticate user
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Allow Admin, FieldOfficer, Leader, Counselor to upload receipts
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (
    profile?.role !== "Admin" && 
    profile?.role !== "FieldOfficer" && 
    profile?.role !== "Leader" &&
    profile?.role !== "Counselor"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("receipt") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file type
  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Invalid file type. Only PDF is allowed." },
      { status: 400 }
    );
  }

  // Validate file size (max 5MB)
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Max size is 5MB." },
      { status: 400 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Generate a unique filename under the receipts folder
  const fileName = `receipt_${Date.now()}_${Math.random().toString(36).slice(2)}.pdf`;
  const filePath = `receipts/${fileName}`;

  // Use admin client to bypass RLS for storage
  const adminClient = createAdminClient();

  const { error: uploadError } = await adminClient.storage
    .from("farmer-photos")
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Get the public URL
  const {
    data: { publicUrl },
  } = adminClient.storage.from("farmer-photos").getPublicUrl(filePath);

  return NextResponse.json({ url: publicUrl });
}
