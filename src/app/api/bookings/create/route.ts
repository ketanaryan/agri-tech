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

    if (
      profile?.role !== "Admin" &&
      profile?.role !== "FieldOfficer" &&
      profile?.role !== "Counselor"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      farmerId,
      itemId,
      qty,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    if (!farmerId || !itemId || !qty || qty <= 0) {
      return NextResponse.json({ error: "Invalid booking inputs" }, { status: 400 });
    }

    // Verify Razorpay signature
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
    const booking_amount = total_amount * 0.1;
    const balance_amount = total_amount - booking_amount;

    // Insert booking
    const { data: newBooking, error: insertError } = await supabase
      .from("bookings")
      .insert({
        farmer_id: farmerId,
        item_id: itemId,
        qty,
        total_amount,
        booking_amount,
        balance_amount,
        status: "Pending",
        created_by: user.id,
        razorpay_order_id: razorpay_order_id ?? null,
        razorpay_payment_id: razorpay_payment_id ?? null,
      })
      .select("id")
      .single();

    if (insertError) {
      // If columns don't exist yet, try without Razorpay fields
      const { data: fallback, error: fallbackErr } = await supabase
        .from("bookings")
        .insert({
          farmer_id: farmerId,
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
      return NextResponse.json({ success: true, bookingId: fallback?.id });
    }

    return NextResponse.json({ success: true, bookingId: newBooking?.id });
  } catch (err: any) {
    console.error("[/api/bookings/create]", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown server error" },
      { status: 500 }
    );
  }
}
