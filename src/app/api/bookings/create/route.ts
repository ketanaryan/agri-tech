import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

async function generateFarmerUniqueId(supabase: any): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const digits = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
    const uid = `BPFRM${digits}`;
    const { count } = await supabase
      .from("farmers")
      .select("*", { count: "exact", head: true })
      .eq("unique_id", uid);
    if (!count || count === 0) return uid;
  }
  return `BPFRM${Date.now().toString().slice(-5)}`;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, district")
      .eq("id", user.id)
      .single();

    if (
      profile?.role !== "Admin" &&
      profile?.role !== "FieldOfficer" &&
      profile?.role !== "Counselor" &&
      profile?.role !== "Leader"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      farmerMode,
      farmerId,
      newFarmerData,
      itemId,
      qty,
      paymentMethod = "online",
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    if (farmerMode === "existing" && !farmerId) {
      return NextResponse.json({ error: "Existing farmer ID missing" }, { status: 400 });
    }
    if (farmerMode === "new" && (!newFarmerData?.name || !newFarmerData?.phone)) {
      return NextResponse.json({ error: "New farmer data incomplete" }, { status: 400 });
    }
    if (!itemId || !qty || qty <= 0) {
      return NextResponse.json({ error: "Invalid booking inputs" }, { status: 400 });
    }

    // Verify Razorpay signature only for online payments
    if (paymentMethod === "online") {
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return NextResponse.json({ error: "Missing Razorpay payment details" }, { status: 400 });
      }
      const key_secret = process.env.RAZORPAY_KEY_SECRET!;
      const generatedSignature = crypto
        .createHmac("sha256", key_secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest("hex");

      if (generatedSignature !== razorpay_signature) {
        return NextResponse.json(
          { error: "Payment verification failed. Please contact support." },
          { status: 400 }
        );
      }
    }

    // Payment is verified. Now we can safely create the farmer if it's a new farmer.
    let finalFarmerId = farmerId;
    let finalFarmerUniqueId = "";

    if (farmerMode === "new") {
      const adminClient = createAdminClient();
      const generated_unique_id = await generateFarmerUniqueId(adminClient);
      finalFarmerUniqueId = generated_unique_id;
      const district = profile?.district || null;

      const { data: newFarmer, error: farmerError } = await adminClient
        .from("farmers")
        .insert({
          name: newFarmerData.name,
          phone: newFarmerData.phone,
          address: newFarmerData.address || null,
          photo_url: newFarmerData.photo_url || null,
          unique_id: generated_unique_id,
          district,
        })
        .select("id")
        .single();

      if (farmerError || !newFarmer) {
        console.error("Failed to create farmer after payment:", farmerError);
        return NextResponse.json(
          { error: "Payment succeeded but failed to register farmer. Please contact support." },
          { status: 500 }
        );
      }
      finalFarmerId = newFarmer.id;
    } else {
      // Fetch existing farmer unique id if existing mode, though client already has it, we return it to be safe.
      // We don't necessarily have to query it if we just say the client already knows it.
      // I'll query it to be robust.
      const { data: existingFarmer } = await supabase.from("farmers").select("unique_id").eq("id", farmerId).single();
      if (existingFarmer) finalFarmerUniqueId = existingFarmer.unique_id;
    }

    // Fetch item rate
    const { data: item, error: itemError } = await supabase
      .from("items")
      .select("rate_per_unit")
      .eq("id", itemId)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const total_amount = item.rate_per_unit * qty;
    const booking_amount = Math.round(total_amount * 0.1 * 100) / 100;
    const balance_amount = Math.round((total_amount - booking_amount) * 100) / 100;

    // Insert booking — try with razorpay columns first, fallback without
    const insertData: Record<string, any> = {
      farmer_id: finalFarmerId,
      item_id: itemId,
      qty,
      total_amount,
      booking_amount,
      balance_amount,
      status: "Pending",
      created_by: user.id,
      advance_payment_method: paymentMethod,
    };
    if (paymentMethod === "online") {
      insertData.razorpay_order_id = razorpay_order_id ?? null;
      insertData.razorpay_payment_id = razorpay_payment_id ?? null;
    }

    const adminClient = createAdminClient();
    const { data: newBooking, error: insertError } = await adminClient
      .from("bookings")
      .insert(insertData)
      .select("id")
      .single();

    if (insertError) {
      // Fallback — insert without optional tracking columns
      const { data: fallback, error: fallbackErr } = await adminClient
        .from("bookings")
        .insert({
          farmer_id: finalFarmerId,
          item_id: itemId,
          qty,
          total_amount,
          booking_amount,
          balance_amount,
          status: "Pending",
          created_by: user.id,
        })
        .select("id")
        .single();

      if (fallbackErr) {
        return NextResponse.json({ error: fallbackErr.message }, { status: 500 });
      }
      return NextResponse.json({ success: true, bookingId: fallback?.id, finalFarmerUniqueId });
    }

    return NextResponse.json({ success: true, bookingId: newBooking?.id, finalFarmerUniqueId });
  } catch (err: any) {
    console.error("[/api/bookings/create]", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown server error" },
      { status: 500 }
    );
  }
}
