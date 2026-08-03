export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart3, CheckCircle2, Clock, XCircle } from "lucide-react";

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, district")
    .eq("id", user.id)
    .single();

  const role = profile?.role;
  const district = profile?.district;

  const allowedRoles = ["Admin", "FieldOfficer", "Dealer"];
  if (!role || !allowedRoles.includes(role)) redirect("/");

  const isOfficer = role === "FieldOfficer";
  const isDealer = role === "Dealer";
  // Only Admin and Dealer see revenue (Counselor and FieldOfficer do NOT)
  const showRevenue = role === "Admin" || role === "Dealer";

  // Build base query
  let query = supabase
    .from("bookings")
    .select(
      `id, qty, replacement_qty, total_amount, booking_amount, balance_amount, harvest_amount, status, created_at, farmer_id, pesticide_id,
       farmers ( name, unique_id ),
       items ( name ),
       pesticide_inventory ( name )`
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  let skipQuery = false;

  if (isOfficer) {
    query = query.eq("created_by", user.id);
  } else if (isDealer) {
    if (!district) {
      skipQuery = true;
    } else {
      // Scope to farmers in this dealer's district
      const { data: districtFarmers } = await supabase
        .from("farmers")
        .select("id")
        .eq("district", district)
        .is("deleted_at", null);

      const farmerIds = districtFarmers?.map((f) => f.id) || [];
      if (farmerIds.length === 0) {
        skipQuery = true;
      } else {
        query = query.in("farmer_id", farmerIds);
      }
    }
  }

  const { data: bookings } = skipQuery ? { data: [] } : await query;

  const totalBookings = bookings?.length || 0;
  const cropBookingsCount = bookings?.filter((b) => !b.pesticide_id).length || 0;
  const pestBookingsCount = bookings?.filter((b) => !!b.pesticide_id).length || 0;

  const pendingBookings =
    bookings?.filter((b) => b.status === "Pending").length || 0;
  const completedBookings =
    bookings?.filter((b) => b.status === "Completed").length || 0;
  const cancelledBookings =
    bookings?.filter((b) => b.status === "Cancelled").length || 0;
  // Active Bookings (excluding cancelled)
  const activeBookings = bookings?.filter((b) => b.status !== "Cancelled") || [];
  
  let cropPipelineValue = 0, pestPipelineValue = 0;
  
  let cropExpectedBalance = 0, pestExpectedBalance = 0;
  let cropExpectedHarvest = 0, pestExpectedHarvest = 0;

  let cropAdvance = 0, pestAdvance = 0;
  let cropFull = 0, pestFull = 0;
  let cropDeliveryCash = 0, pestDeliveryCash = 0;
  let cropHarvestCash = 0, pestHarvestCash = 0;

  let advanceCount = 0;
  let fullPaymentCount = 0;
  
  activeBookings.forEach((b) => {
    const isPest = !!b.pesticide_id;
    const totalAmt = Number(b.total_amount || 0);
    const bookAmt = Number(b.booking_amount || 0);
    const balAmt = Number(b.balance_amount || 0);
    const harvAmt = Number(b.harvest_amount || 0);

    // Pipeline
    if (isPest) pestPipelineValue += totalAmt;
    else cropPipelineValue += totalAmt;

    // Expected Balances
    if (b.status === "Pending") {
      if (isPest) pestExpectedBalance += balAmt;
      else cropExpectedBalance += balAmt;
    }
    if (b.status === "HarvestPending") {
      if (isPest) pestExpectedHarvest += harvAmt;
      else cropExpectedHarvest += harvAmt;
    }

    // Cash Collected on Delivery & Harvest
    if (b.status === "Completed" || b.status === "HarvestPending") {
      if (isPest) pestDeliveryCash += balAmt;
      else cropDeliveryCash += balAmt;
    }
    if (b.status === "Completed") {
      if (isPest) pestHarvestCash += harvAmt;
      else cropHarvestCash += harvAmt;
    }

    // Advances and Full Payments
    if (bookAmt === totalAmt && totalAmt > 0) {
      fullPaymentCount++;
      if (isPest) pestFull += bookAmt;
      else cropFull += bookAmt;
    } else if (bookAmt > 0 || totalAmt > 0) {
      advanceCount++;
      if (isPest) pestAdvance += bookAmt;
      else cropAdvance += bookAmt;
    }
  });

  const pipelineValue = cropPipelineValue + pestPipelineValue;
  const expectedBalance = cropExpectedBalance + pestExpectedBalance;
  const expectedHarvestBalance = cropExpectedHarvest + pestExpectedHarvest;
  
  const advanceRevenue = cropAdvance + pestAdvance;
  const fullPaymentRevenue = cropFull + pestFull;
  const deliveryCashCollected = cropDeliveryCash + pestDeliveryCash;
  const harvestCashCollected = cropHarvestCash + pestHarvestCash;

  const totalCropRevenue = cropAdvance + cropFull + cropDeliveryCash + cropHarvestCash;
  const totalPestRevenue = pestAdvance + pestFull + pestDeliveryCash + pestHarvestCash;
  const totalRevenueEarned = totalCropRevenue + totalPestRevenue;

  const pageTitle =
    isOfficer
      ? "My Performance Report"
      : isDealer
      ? `${district || "District"} Reports`
      : "System Reports";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{pageTitle}</h1>

      {/* General KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Total Bookings
            </CardTitle>
            <BarChart3 className="w-4 h-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBookings}</div>
            <div className="mt-2 text-xs text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>🌾 Crops:</span>
                <span className="font-semibold text-gray-700">{cropBookingsCount}</span>
              </div>
              <div className="flex justify-between">
                <span>🧪 Pesticides:</span>
                <span className="font-semibold text-gray-700">{pestBookingsCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Pending
            </CardTitle>
            <Clock className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingBookings}</div>
            <p className="text-xs text-gray-500 mt-1">Awaiting delivery</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Completed
            </CardTitle>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completedBookings}</div>
            <p className="text-xs text-gray-500 mt-1">Successfully fulfilled</p>
          </CardContent>
        </Card>

      </div>

      {/* Financial Overview (Admin and Dealer ONLY) */}
      {showRevenue && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800">Financial Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Revenue Earned */}
            <Card className="bg-emerald-50 border-emerald-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-emerald-800">Total Revenue Earned</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-700">₹ {totalRevenueEarned.toLocaleString("en-IN")}</div>
                <div className="mt-2 text-xs text-emerald-700 space-y-1">
                  <div className="flex justify-between">
                    <span>🌾 Crops:</span>
                    <span className="font-semibold">₹ {totalCropRevenue.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>🧪 Pesticides:</span>
                    <span className="font-semibold">₹ {totalPestRevenue.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Expected Balance */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-blue-800">Expected Balances</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold text-blue-700">₹ {(expectedBalance + expectedHarvestBalance).toLocaleString("en-IN")}</div>
                <div className="mt-2 text-xs text-blue-700 space-y-1">
                  <div className="flex justify-between">
                    <span>🌾 Crops:</span>
                    <span className="font-semibold">₹ {(cropExpectedBalance + cropExpectedHarvest).toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>🧪 Pesticides:</span>
                    <span className="font-semibold">₹ {(pestExpectedBalance + pestExpectedHarvest).toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Total Pipeline */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Pipeline Value</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-800">₹ {pipelineValue.toLocaleString("en-IN")}</div>
                <div className="mt-2 text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>🌾 Crops:</span>
                    <span className="font-semibold text-gray-700">₹ {cropPipelineValue.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>🧪 Pesticides:</span>
                    <span className="font-semibold text-gray-700">₹ {pestPipelineValue.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Collections Breakdown */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Collections Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Advance ({advanceCount}):</span>
                    <span className="font-semibold">₹ {advanceRevenue.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">Full Pay ({fullPaymentCount}):</span>
                    <span className="font-semibold">₹ {fullPaymentRevenue.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-t pt-1 mt-1">
                    <span className="text-gray-600">Delivery COD:</span>
                    <span className="font-semibold text-emerald-600">₹ {deliveryCashCollected.toLocaleString("en-IN")}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm border-t pt-1 mt-1">
                    <span className="text-gray-600">Harvest COD:</span>
                    <span className="font-semibold text-emerald-600">₹ {harvestCashCollected.toLocaleString("en-IN")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Cancelled indicator (non-revenue info, safe for all roles) */}
      {cancelledBookings > 0 && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2 w-fit">
          <XCircle className="w-4 h-4" />
          <span>{cancelledBookings} booking(s) cancelled</span>
        </div>
      )}

      {/* District notice for Dealer with no district */}
      {isDealer && !district && (
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-800">
          No district assigned to your profile. Contact Admin to set your district so reports are scoped correctly.
        </div>
      )}

      {/* Recent Activity Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Booking Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Farmer</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Qty / Delivery</TableHead>
                  {showRevenue && <TableHead>Total</TableHead>}
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bookings?.slice(0, 20).map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(b.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {/* @ts-ignore */}
                      <div className="font-medium">{b.farmers?.name}</div>
                      {/* @ts-ignore */}
                      <div className="text-xs text-gray-500">{b.farmers?.unique_id}</div>
                    </TableCell>
                    {/* @ts-ignore */}
                    <TableCell>{b.items?.name || b.pesticide_inventory?.name || "Unknown"}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{b.qty} ordered</span>
                        {/* @ts-ignore */}
                        {(b.replacement_qty ?? 0) > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                            <span>🌱</span>
                            {/* @ts-ignore */}
                            +{b.replacement_qty} replacement
                          </span>
                        )}
                        {/* @ts-ignore */}
                        {(b.replacement_qty ?? 0) > 0 && (
                          <span className="text-xs text-gray-400">
                            {/* @ts-ignore */}
                            = {b.qty + (b.replacement_qty ?? 0)} total
                          </span>
                        )}
                      </div>
                    </TableCell>
                    {showRevenue && (
                      <TableCell className="whitespace-nowrap font-mono">
                        ₹ {Number(b.total_amount).toLocaleString("en-IN")}
                      </TableCell>
                    )}
                    <TableCell>
                      <span
                        className={`px-2 py-1 text-xs rounded-full whitespace-nowrap ${
                          b.status === "Completed"
                            ? "bg-green-100 text-green-800"
                            : b.status === "HarvestPending"
                            ? "bg-amber-100 text-amber-800"
                            : b.status === "Cancelled"
                            ? "bg-red-100 text-red-700"
                            : "bg-orange-100 text-orange-800"
                        }`}
                      >
                        {b.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {bookings?.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={showRevenue ? 6 : 5}
                      className="h-24 text-center text-gray-500"
                    >
                      No booking activity found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
