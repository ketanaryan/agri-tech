import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

    // Fetch booking to verify the harvest amount securely on backend
    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("harvest_amount, farmer_id, item_id, total_amount, status")
      .eq("id", bookingId)
      .single();

    if (bookingErr || !booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.status !== "HarvestPending") {
      return NextResponse.json({ error: "Booking is not pending harvest collection." }, { status: 400 });
    }

    // Mark booking as Completed and Harvest Status Paid
    const updateData: Record<string, any> = {
      status: "Completed",
      harvest_status: "Paid",
    };

    const adminClient = createAdminClient();
    const { error: updateError, data: updatedRows } = await adminClient
      .from("bookings")
      .update(updateData)
      .eq("id", bookingId)
      .eq("status", "HarvestPending")
      .select();

    if (updateError || !updatedRows || updatedRows.length === 0) {
      return NextResponse.json({ error: updateError?.message ?? "Could not update booking. It may have been modified already." }, { status: 500 });
    }

    // — Transaction Logging —
    const harvestAmt = Number(booking?.harvest_amount || 0);
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
      payment_method_harvest: paymentMethod,
      total_amount: Number(booking?.total_amount || 0),
    };

    if (harvestAmt > 0) {
      await logTransaction({
        bookingId,
        farmerId: farmerIdForLog || "",
        action: "BALANCE_COLLECTED", // Using BALANCE_COLLECTED for now, but conceptually it's Harvest Collection
        amount: harvestAmt,
        paymentMethod,
        performedBy: user.id,
        performerName: profile?.name || user.email || "Unknown",
        performerRole: profile?.role || "Unknown",
        metadata: { ...completeMeta, is_harvest_payment: true },
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
    console.error("[/api/bookings/harvest-collect]", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown server error" },
      { status: 500 }
    );
  }
}
