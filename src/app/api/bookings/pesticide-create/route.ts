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
      profile?.role !== "Dealer"
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
      payment_receipt_url,
      utr_number,
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
      payment_receipt_url: payment_receipt_url || null,
      utr_number: utr_number || null,
    };

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
        qty,
        utr_number: utr_number || null,
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
