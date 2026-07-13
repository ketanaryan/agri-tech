import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logTransaction } from "@/lib/transaction-logger";

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
      farmerMode,
      farmerId,
      newFarmerData,
      itemId,
      qty,
      paymentMethod = "online",
      paymentType = "advance",
      payment_receipt_url,
      utr_number,
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
    if (qty > 100000) {
      return NextResponse.json({ error: "Quantity exceeds maximum allowed" }, { status: 400 });
    }

    // Input length validation
    if (farmerMode === "new") {
      if (newFarmerData?.name?.length > 200) return NextResponse.json({ error: "Farmer name too long" }, { status: 400 });
      if (newFarmerData?.phone?.length > 15) return NextResponse.json({ error: "Phone number too long" }, { status: 400 });
      if (newFarmerData?.address?.length > 500) return NextResponse.json({ error: "Address too long" }, { status: 400 });
    }
    if (utr_number && utr_number.length > 50) return NextResponse.json({ error: "UTR number too long" }, { status: 400 });
    if (payment_receipt_url && payment_receipt_url.length > 1000) return NextResponse.json({ error: "Receipt URL too long" }, { status: 400 });

    // Fetch item rate first to calculate expected payment amounts
    const { data: item, error: itemError } = await supabase
      .from("items")
      .select("rate_per_unit, advance_percentage, harvest_rate")
      .eq("id", itemId)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const advance_percentage = item.advance_percentage ?? 10;
    const total_amount = item.rate_per_unit * qty;
    const harvest_amount = (item.harvest_rate || 0) * qty;
    const harvest_status = harvest_amount > 0 ? "Pending" : "None";

    const booking_amount = paymentType === "full" 
      ? (total_amount - harvest_amount)
      : Math.round(total_amount * (advance_percentage / 100) * 100) / 100;
    const balance_amount = Math.round((total_amount - booking_amount - harvest_amount) * 100) / 100;

    // Payment verification is now done manually via Receipt/UTR
    // Proceed to create the farmer if it's a new farmer.
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
          pan_card: newFarmerData.pan_card || null,
          aadhar_card: newFarmerData.aadhar_card || null,
          alternate_phone: newFarmerData.alternate_phone || null,
          land_size: newFarmerData.land_size || null,
          land_unit: newFarmerData.land_unit || "acres",
          land_type: newFarmerData.land_type || null,
          crop_type: newFarmerData.crop_type || null,
          growth_stage: newFarmerData.growth_stage || null,
          health_status: newFarmerData.health_status || null,
          irrigation_status: newFarmerData.irrigation_status || null,
          irrigation_source: newFarmerData.irrigation_source || null,
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


    // Replacement plants: 10% of ordered qty, free of charge
    const replacement_qty = Math.floor(qty * 0.1);


    // Insert booking — try with gateway columns first, fallback without
    const insertData: Record<string, any> = {
      farmer_id: finalFarmerId,
      item_id: itemId,
      qty,
      replacement_qty,
      rate_snapshot: item.rate_per_unit,  // 🔒 frozen rate at booking time
      total_amount,
      booking_amount,
      balance_amount,
      harvest_amount,
      harvest_status,
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
      // Fallback — insert without optional tracking columns
      const { data: fallback, error: fallbackErr } = await adminClient
        .from("bookings")
        .insert({
          farmer_id: finalFarmerId,
          item_id: itemId,
          qty,
          replacement_qty,
          rate_snapshot: item.rate_per_unit,
          total_amount,
          booking_amount,
          balance_amount,
          harvest_amount,
          harvest_status,
          status: "Pending",
          created_by: user.id,
          payment_receipt_url: payment_receipt_url || null,
          utr_number: utr_number || null,
        })
        .select("id")
        .single();

      if (fallbackErr) {
        return NextResponse.json({ error: fallbackErr.message }, { status: 500 });
      }

      // Log transaction for fallback path too
      const fbId = fallback?.id;
      if (fbId) {
        const { data: itemInfo } = await supabase.from("items").select("name").eq("id", itemId).single();
        let resolvedFarmerName = farmerMode === "new" ? newFarmerData?.name : undefined;
        if (!resolvedFarmerName && finalFarmerId) {
          const { data: fInfo } = await supabase.from("farmers").select("name").eq("id", finalFarmerId).single();
          resolvedFarmerName = fInfo?.name;
        }
        const fbMeta = { item_name: itemInfo?.name || "Unknown", farmer_name: resolvedFarmerName || "Unknown", farmer_unique_id: finalFarmerUniqueId, payment_type: paymentType, qty };
        await logTransaction({ bookingId: fbId, farmerId: finalFarmerId, action: "BOOKING_CREATED", amount: total_amount, paymentMethod, performedBy: user.id, performerName: profile?.name || user.email || "Unknown", performerRole: profile?.role || "Unknown", metadata: fbMeta });
        if (booking_amount > 0) {
          await logTransaction({ bookingId: fbId, farmerId: finalFarmerId, action: "ADVANCE_PAID", amount: booking_amount, paymentMethod, performedBy: user.id, performerName: profile?.name || user.email || "Unknown", performerRole: profile?.role || "Unknown", metadata: fbMeta });
        }
      }

      return NextResponse.json({ success: true, bookingId: fallback?.id, finalFarmerUniqueId });
    }

    // — Transaction Logging —
    const bookingIdForLog = newBooking?.id;
    if (bookingIdForLog) {
      // Fetch item name and farmer name for metadata
      const { data: itemInfo } = await supabase.from("items").select("name").eq("id", itemId).single();
      const farmerName = farmerMode === "new" ? newFarmerData?.name : undefined;
      let resolvedFarmerName = farmerName;
      if (!resolvedFarmerName && finalFarmerId) {
        const { data: fInfo } = await supabase.from("farmers").select("name").eq("id", finalFarmerId).single();
        resolvedFarmerName = fInfo?.name;
      }

      const sharedMeta = {
        item_name: itemInfo?.name || "Unknown",
        farmer_name: resolvedFarmerName || "Unknown",
        farmer_unique_id: finalFarmerUniqueId,
        payment_type: paymentType,
        qty,
        utr_number: utr_number || null,
      };

      await logTransaction({
        bookingId: bookingIdForLog,
        farmerId: finalFarmerId,
        action: "BOOKING_CREATED",
        amount: total_amount,
        paymentMethod: paymentMethod,
        performedBy: user.id,
        performerName: profile?.name || user.email || "Unknown",
        performerRole: profile?.role || "Unknown",
        metadata: sharedMeta,
      });

      if (booking_amount > 0) {
        await logTransaction({
          bookingId: bookingIdForLog,
          farmerId: finalFarmerId,
          action: "ADVANCE_PAID",
          amount: booking_amount,
          paymentMethod: paymentMethod,
          performedBy: user.id,
          performerName: profile?.name || user.email || "Unknown",
          performerRole: profile?.role || "Unknown",
          metadata: sharedMeta,
        });
      }
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
