import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("pesticide_inventory")
      .select("id, name, unit, current_stock, low_stock_threshold")
      .order("name");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ pesticides: data ?? [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
