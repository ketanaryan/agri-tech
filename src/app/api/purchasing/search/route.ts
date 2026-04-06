import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();

    if (!q) {
      return NextResponse.json({ bookings: [] });
    }

    const supabase = await createClient();

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "Admin" && profile?.role !== "Leader") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Step 1: Find matching farmers
    const { data: matchedFarmers, error: farmerError } = await supabase
      .from("farmers")
      .select("id")
      .or(`unique_id.ilike.%${q}%,name.ilike.%${q}%`);

    if (farmerError) {
      return NextResponse.json(
        { error: `Farmer lookup failed: ${farmerError.message}` },
        { status: 500 }
      );
    }

    if (!matchedFarmers || matchedFarmers.length === 0) {
      return NextResponse.json({ bookings: [] });
    }

    const farmerIds = matchedFarmers.map((f: any) => f.id);

    // Step 2: Fetch pending bookings
    const { data: bookings, error: bookingError } = await supabase
      .from("bookings")
      .select(`
        id,
        qty,
        total_amount,
        booking_amount,
        balance_amount,
        status,
        created_at,
        farmer:farmers ( id, name, unique_id, phone, address ),
        item:items ( id, name, rate_per_unit )
      `)
      .eq("status", "Pending")
      .in("farmer_id", farmerIds);

    if (bookingError) {
      return NextResponse.json(
        { error: `Booking lookup failed: ${bookingError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ bookings: bookings ?? [] });
  } catch (err: any) {
    console.error("[/api/purchasing/search] Unhandled error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Unknown server error" },
      { status: 500 }
    );
  }
}
