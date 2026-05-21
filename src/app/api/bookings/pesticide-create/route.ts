import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logTransaction } from "@/lib/transaction-logger";

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
      .select("role, district, name")
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
      gateway_order_id,
    } = body;

    if (!farmerId) {
      return NextResponse.json({ error: "Farmer ID missing" }, { status: 400 });
    }
    if (!pesticideId || !qty || qty <= 0) {
      return NextResponse.json({ error: "Invalid pesticide booking inputs" }, { status: 400 });
    }

    // Verify Cashfree payment status only for online payments (and if amount > 0)
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
      if (!gateway_order_id) {
        return NextResponse.json({ error: "Missing Payment details" }, { status: 400 });
      }

      const appId = process.env.CASHFREE_APP_ID;
      const secretKey = process.env.CASHFREE_SECRET_KEY;
      const environment = process.env.CASHFREE_ENVIRONMENT || "SANDBOX";
      const baseUrl = environment === "PRODUCTION" ? "https://api.cashfree.com/pg/orders" : "https://sandbox.cashfree.com/pg/orders";

      try {
        const response = await fetch(`${baseUrl}/${gateway_order_id}`, {
          method: "GET",
          headers: {
            "x-api-version": "2023-08-01",
            "x-client-id": appId!,
            "x-client-secret": secretKey!,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
        });
        const orderData = await response.json();
        
        if (!response.ok || orderData.order_status !== "PAID") {
          return NextResponse.json(
            { error: "Payment verification failed or payment not completed." },
            { status: 400 }
          );
        }

        if (Math.abs(orderData.order_amount - booking_amount) > 1) { // Allowing 1 INR difference max due to rounding
           return NextResponse.json(
             { error: "Payment amount mismatch detected. Verification failed." },
             { status: 400 }
           );
        }
      } catch (e) {
        return NextResponse.json(
          { error: "Error verifying payment with payment gateway." },
          { status: 500 }
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
      insertData.razorpay_order_id = gateway_order_id ?? null;
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

    // — Transaction Logging —
    const pestBookingId = newBooking?.id;
    if (pestBookingId) {
      // Fetch farmer & pesticide name for metadata
      let farmerName = "Unknown";
      let pesticideName = "Unknown";
      const { data: fInfo } = await supabase.from("farmers").select("name, unique_id").eq("id", farmerId).single();
      if (fInfo) farmerName = fInfo.name;
      const { data: pInfo } = await supabase.from("pesticide_inventory").select("name").eq("id", pesticideId).single();
      if (pInfo) pesticideName = pInfo.name;

      const pestMeta = {
        item_name: pesticideName,
        farmer_name: farmerName,
        farmer_unique_id: fInfo?.unique_id || "",
        booking_type: "pesticide",
        payment_type: paymentType,
        gateway_order_id: gateway_order_id || null,
        qty,
      };

      await logTransaction({
        bookingId: pestBookingId,
        farmerId: farmerId,
        action: "BOOKING_CREATED",
        amount: total_amount,
        paymentMethod,
        performedBy: user.id,
        performerName: profile?.name || user.email || "Unknown",
        performerRole: profile?.role || "Unknown",
        metadata: pestMeta,
      });

      if (booking_amount > 0) {
        await logTransaction({
          bookingId: pestBookingId,
          farmerId: farmerId,
          action: "ADVANCE_PAID",
          amount: booking_amount,
          paymentMethod,
          performedBy: user.id,
          performerName: profile?.name || user.email || "Unknown",
          performerRole: profile?.role || "Unknown",
          metadata: pestMeta,
        });
      }
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
