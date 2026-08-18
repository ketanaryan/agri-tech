import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { redirect } from "next/navigation";

import { CreatePesticideBookingForm } from "@/components/shared/CreatePesticideBookingForm";

export default async function PesticideBookingsPage() {
  const supabase = await createClient();

  // Security Check: Only Admin and FieldOfficer can view this page
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, district, qr_code_url, invoice_company_name, invoice_gst, invoice_address")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "Admin") {
    redirect("/"); // redirect unauthorized users
  }

  // Fetch necessary data
  const { data: farmers } = await supabase
    .from("farmers")
    .select("id, name, unique_id, phone")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const { data: pesticides } = await supabase
    .from("pesticide_inventory")
    .select("id, name, rate_per_unit, unit")
    .order("name");

  // Determine QR Code URL and Invoice Settings for payments/receipts
  let dealerQrCodeUrl = profile?.qr_code_url || null;
  let dealerInvoiceSettings = null;

  if (profile?.role === "Dealer") {
    if (profile.invoice_company_name) {
      dealerInvoiceSettings = {
        companyName: profile.invoice_company_name,
        gst: profile.invoice_gst,
        address: profile.invoice_address,
      };
    }
  } else if (profile?.role === "FieldOfficer" && profile?.district) {
    const { data: dealer } = await supabase
      .from("profiles")
      .select("qr_code_url, invoice_company_name, invoice_gst, invoice_address")
      .eq("role", "Dealer")
      .eq("district", profile.district)
      .limit(1)
      .single();
      
    if (dealer?.qr_code_url) dealerQrCodeUrl = dealer.qr_code_url;
    if (dealer?.invoice_company_name) {
      dealerInvoiceSettings = {
        companyName: dealer.invoice_company_name,
        gst: dealer.invoice_gst,
        address: dealer.invoice_address,
      };
    }
  }

  // Fallback to Admin QR Code
  if (!dealerQrCodeUrl) {
    const { data: admin } = await supabase
      .from("profiles")
      .select("qr_code_url")
      .eq("role", "Admin")
      .not("qr_code_url", "is", null)
      .limit(1)
      .single();
    dealerQrCodeUrl = admin?.qr_code_url || null;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Pesticide Booking</h1>
      <p className="text-gray-500 text-sm">
        Select a farmer and book a pesticide from the current inventory.
      </p>

      <div className="max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>Create Pesticide Booking</CardTitle>
          </CardHeader>
          <CardContent>
            <CreatePesticideBookingForm
              farmers={farmers ?? []}
              pesticides={pesticides ?? []}
              dealerQrCodeUrl={dealerQrCodeUrl}
              dealerInvoiceSettings={dealerInvoiceSettings}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
