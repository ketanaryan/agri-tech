import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";
import Razorpay from "razorpay";

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
      farmerId,
      pesticideId,
      qty,
      paymentMethod = "online",
      paymentType = "advance",
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    if (!farmerId) {
      return NextResponse.json({ error: "Farmer ID missing" }, { status: 400 });
    }
    if (!pesticideId || !qty || qty <= 0) {
      return NextResponse.json({ error: "Invalid pesticide booking inputs" }, { status: 400 });
    }

    // Verify Razorpay signature only for online payments (and if amount > 0)
    // We will verify the amount after fetching the pesticide details
    
    // Fetch pesticide rate
    const { data: pesticide, error: pestError } = await supabase
      .from("pesticide_inventory")
      .select("rate_per_unit")
      .eq("id", pesticideId)
      .single();

    if (pestError || !pesticide) {
      return NextResponse.json({ error: "Pesticide not found" }, { status: 404 });
    }

    const rate = pesticide.rate_per_unit || 0;
    const total_amount = rate * qty;
    const booking_amount = paymentType === "full" 
      ? total_amount 
      : Math.round(total_amount * 0.1 * 100) / 100;
    const balance_amount = Math.round((total_amount - booking_amount) * 100) / 100;

    if (paymentMethod === "online" && booking_amount > 0) {
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

      const razorpay = new Razorpay({
        key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
        key_secret: process.env.RAZORPAY_KEY_SECRET!,
      });
      const order = await razorpay.orders.fetch(razorpay_order_id);
      const expectedAmountPaise = Math.round(booking_amount * 100);
      if (order.amount !== expectedAmountPaise) {
        return NextResponse.json(
          { error: "Payment amount mismatch detected. Verification failed." },
          { status: 400 }
        );
      }
    }

    // Pesticides don't get free replacements like plants (unless specified)
    const replacement_qty = 0;

    const insertData: Record<string, any> = {
      farmer_id: farmerId,
      pesticide_id: pesticideId, 
      item_id: null, // explicit null
      qty,
      replacement_qty,
      rate_snapshot: rate, 
      total_amount,
      booking_amount,
      balance_amount,
      status: "Pending",
      created_by: user.id,
      advance_payment_method: paymentMethod,
    };

    if (paymentMethod === "online" && booking_amount > 0) {
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
      console.error(insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, bookingId: newBooking?.id });
  } catch (err: any) {
    console.error("[/api/bookings/pesticide-create]", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown server error" },
      { status: 500 }
    );
  }
}
