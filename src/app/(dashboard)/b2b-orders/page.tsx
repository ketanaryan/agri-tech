import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import B2BOrdersClient from "./B2BOrdersClient";

export default async function B2BOrdersPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile || !["Admin", "SuperDistributor", "Dealer"].includes(profile.role)) {
    redirect("/");
  }

  // Fetch pesticide inventory for new orders
  const { data: inventory } = await supabase
    .from("pesticide_inventory")
    .select("*")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  // Fetch B2B orders
  // - Admin sees orders where seller_id is null (placed by SuperDistributor to Admin)
  // - SuperDistributor sees:
  //    1. Orders they placed to Admin (buyer_id = self)
  //    2. Orders placed to them by Dealers (seller_id = self)
  // - Dealer sees orders they placed to SuperDistributor (buyer_id = self)

  let query = supabase
    .from("b2b_orders")
    .select(`
      *,
      buyer:buyer_id(name, unique_id, role, district),
      seller:seller_id(name, unique_id, role, district),
      pesticide:pesticide_id(name)
    `)
    .order("created_at", { ascending: false });

  if (profile.role === "Admin") {
    query = query.is("seller_id", null);
  } else if (profile.role === "SuperDistributor") {
    query = query.or(`buyer_id.eq.${profile.id},seller_id.eq.${profile.id}`);
  } else if (profile.role === "Dealer") {
    query = query.eq("buyer_id", profile.id);
  }

  const { data: orders } = await query;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">B2B Orders</h1>
        <p className="text-gray-500 text-sm mt-1">
          {profile.role === "Admin" && "Manage bulk internal orders from Super Distributors."}
          {profile.role === "SuperDistributor" && "Manage bulk internal orders from your Dealers and place orders to the Super Admin."}
          {profile.role === "Dealer" && "Place and track bulk internal pesticide orders."}
        </p>
      </div>

      <B2BOrdersClient 
        orders={orders || []} 
        inventory={inventory || []} 
        userRole={profile.role} 
        userId={profile.id}
      />
    </div>
  );
}
