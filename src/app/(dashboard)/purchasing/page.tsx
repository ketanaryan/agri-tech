import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { redirect } from "next/navigation";
import { PDFButton } from "./PDFButton";
import Link from "next/link";
import { Search } from "lucide-react";

export default async function PurchasingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const { q } = await searchParams;

  // Security Check: Only Admin and Leader can view this page
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "Admin" && profile?.role !== "Leader") {
    redirect("/");
  }

  // Fetch pending bookings based on last 3 digits of farmer unique_id
  let bookings: any[] = [];
  let fetchError: string | null = null;

  if (q) {
    try {
      // Step 1: Find farmers whose unique_id ends with the searched digits
      const { data: matchedFarmers, error: farmerError } = await supabase
        .from("farmers")
        .select("id")
        .ilike("unique_id", `%${q}`);

      if (farmerError) {
        throw new Error(`Farmer lookup failed: ${farmerError.message}`);
      }

      if (matchedFarmers && matchedFarmers.length > 0) {
        const farmerIds = matchedFarmers.map((f: any) => f.id);

        // Step 2: Fetch pending bookings for those farmer IDs
        const { data, error: bookingError } = await supabase
          .from("bookings")
          .select(`
            *,
            farmer:farmers(*),
            item:items(*)
          `)
          .eq("status", "Pending")
          .in("farmer_id", farmerIds);

        if (bookingError) {
          throw new Error(`Booking lookup failed: ${bookingError.message}`);
        }

        if (data) {
          bookings = data;
        }
      }
    } catch (err: any) {
      console.error("[PurchasingPage] Error:", err);
      fetchError = err?.message ?? "An unknown error occurred.";
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">Purchasing &amp; Delivery</h1>

      <Card>
        <CardHeader>
          <CardTitle>Search Farmer</CardTitle>
          <CardDescription>
            Enter the last 3 digits of the Farmer&apos;s Token ID to locate their pending order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex gap-4 items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                name="q"
                defaultValue={q}
                placeholder="e.g. 012"
                className="pl-10 text-lg"
                pattern="\d{1,4}"
                title="Enter digit ID"
                required
              />
            </div>
            <Button type="submit" size="lg">Find Order</Button>
            {q && (
              <Link
                href="/purchasing"
                className={buttonVariants({ variant: "outline", size: "lg" })}
              >
                Clear
              </Link>
            )}
          </form>
        </CardContent>
      </Card>

      {fetchError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          <strong>Error:</strong> {fetchError}
        </div>
      )}

      {q && !fetchError && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Search Results</h2>
          {bookings.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2">
              {bookings.map((b) => (
                <Card key={b.id} className="border-l-4 border-l-yellow-400">
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-lg flex justify-between">
                      {b.farmer?.name}
                      <span className="text-sm bg-gray-100 px-2 py-1 rounded text-gray-700">
                        {b.farmer?.unique_id}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    <div className="grid grid-cols-2 gap-y-2 text-sm">
                      <div className="text-gray-500">Item:</div>
                      <div className="font-medium text-right">{b.item?.name}</div>

                      <div className="text-gray-500">Rate:</div>
                      <div className="font-medium text-right text-gray-700 font-mono">
                        &#8377;{b.item?.rate_per_unit}
                      </div>

                      <div className="text-gray-500">Qty:</div>
                      <div className="font-medium text-right">{b.qty}</div>
                    </div>

                    <div className="border-t pt-3 grid grid-cols-2 gap-y-2 text-sm">
                      <div className="text-gray-500">Total Amount:</div>
                      <div className="text-right font-mono">&#8377;{b.total_amount}</div>

                      <div className="text-gray-500">Advance (10%):</div>
                      <div className="text-right text-green-700 font-mono">
                        - &#8377;{b.booking_amount}
                      </div>

                      <div className="text-gray-900 font-bold mt-2">Balance Due:</div>
                      <div className="text-right text-lg font-bold text-red-600 font-mono mt-2">
                        &#8377;{b.balance_amount}
                      </div>
                    </div>

                    <div className="pt-4">
                      <PDFButton booking={b} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center border rounded border-dashed text-gray-500">
              No pending orders found for Farmer ID ending in &quot;{q}&quot;.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
