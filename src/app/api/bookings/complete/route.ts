import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";

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
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "Admin" && profile?.role !== "Leader" && profile?.role !== "FieldOfficer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      bookingId,
      paymentMethod = "online",
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    if (!bookingId) {
      return NextResponse.json({ error: "Booking ID is required" }, { status: 400 });
    }

    // For online payments: verify Razorpay signature
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
    // For cash: no signature needed — leader confirms receipt of cash

    // Mark booking as Delivered
    const updateData: Record<string, any> = {
      status: "Delivered",
      balance_payment_method: paymentMethod,
      delivered_at: new Date().toISOString(),
      delivered_by: user.id,
    };
    if (paymentMethod === "online") {
      updateData.balance_razorpay_payment_id = razorpay_payment_id ?? null;
    }

    const { error: updateError } = await supabase
      .from("bookings")
      .update(updateData)
      .eq("id", bookingId)
      .eq("status", "Pending");

    if (updateError) {
      // Fallback: update with just status
      const { error: fallbackErr } = await supabase
        .from("bookings")
        .update({ status: "Delivered" })
        .eq("id", bookingId)
        .eq("status", "Pending");

      if (fallbackErr) {
        return NextResponse.json({ error: fallbackErr.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[/api/bookings/complete]", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown server error" },
      { status: 500 }
    );
  }
}
