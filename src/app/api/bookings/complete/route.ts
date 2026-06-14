import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
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
      .select("role, name")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "Admin" && profile?.role !== "Dealer" && profile?.role !== "FieldOfficer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const {
      bookingId,
      paymentMethod = "qr",
    } = body;

    if (!bookingId) {
      return NextResponse.json({ error: "Booking ID is required" }, { status: 400 });
    }

    // Fetch booking to verify the balance amount securely on backend
    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("balance_amount, farmer_id, item_id, total_amount")
      .eq("id", bookingId)
      .single();

    if (bookingErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // We removed online payment verification here because for the balance 
    // we only support cash or manual QR code verification as requested.
    // If online method is passed, we will treat it as a manual QR verification for now.
    
    // For cash or qr: no signature needed — dealer confirms receipt of cash or qr payment


    // Mark booking as Completed
    const updateData: Record<string, any> = {
      status: "Completed",
      balance_payment_method: paymentMethod,
      delivered_at: new Date().toISOString(),
      delivered_by: user.id,
    };

    const adminClient = createAdminClient();
    const { error: updateError, data: updatedRows } = await adminClient
      .from("bookings")
      .update(updateData)
      .eq("id", bookingId)
      .eq("status", "Pending")
      .select();

    if (updateError || !updatedRows || updatedRows.length === 0) {
      // Fallback: update with just status
      const { error: fallbackErr, data: fallbackRows } = await adminClient
        .from("bookings")
        .update({ status: "Completed" })
        .eq("id", bookingId)
        .eq("status", "Pending")
        .select();

      if (fallbackErr || !fallbackRows || fallbackRows.length === 0) {
        return NextResponse.json({ error: fallbackErr?.message ?? "Could not update booking. It may have been modified already." }, { status: 500 });
      }
    }

    // — Transaction Logging —
    const balanceAmt = Number(booking?.balance_amount || 0);
    const farmerIdForLog = booking?.farmer_id;

    // Fetch farmer & item name for metadata
    let farmerName = "Unknown";
    let itemName = "Unknown";
    if (farmerIdForLog) {
      const { data: fInfo } = await supabase.from("farmers").select("name, unique_id").eq("id", farmerIdForLog).single();
      if (fInfo) farmerName = fInfo.name;
    }
    if (booking?.item_id) {
      const { data: iInfo } = await supabase.from("items").select("name").eq("id", booking.item_id).single();
      if (iInfo) itemName = iInfo.name;
    }

    const completeMeta = {
      item_name: itemName,
      farmer_name: farmerName,
      payment_method_balance: paymentMethod,
      total_amount: Number(booking?.total_amount || 0),
    };

    if (balanceAmt > 0) {
      await logTransaction({
        bookingId,
        farmerId: farmerIdForLog || "",
        action: "BALANCE_COLLECTED",
        amount: balanceAmt,
        paymentMethod,
        performedBy: user.id,
        performerName: profile?.name || user.email || "Unknown",
        performerRole: profile?.role || "Unknown",
        metadata: completeMeta,
      });
    }

    await logTransaction({
      bookingId,
      farmerId: farmerIdForLog || "",
      action: "BOOKING_COMPLETED",
      amount: Number(booking?.total_amount || 0),
      paymentMethod,
      performedBy: user.id,
      performerName: profile?.name || user.email || "Unknown",
      performerRole: profile?.role || "Unknown",
      metadata: completeMeta,
    });

    revalidatePath("/", "layout");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[/api/bookings/complete]", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown server error" },
      { status: 500 }
    );
  }
}
