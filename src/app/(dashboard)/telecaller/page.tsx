import React from "react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { PhoneCall, XCircle, MessageSquare, Search } from "lucide-react";
import { cancelBooking } from "@/actions/bookings";
import { LogCallModal } from "@/components/shared/LogCallModal";

export default async function TelecallerPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "Telecaller" && profile?.role !== "Admin") {
    redirect("/");
  }

  const { q } = await searchParams;
  const searchQuery = q?.trim() ?? "";

  // Fetch all bookings (not just pending)
  let query = supabase
    .from("bookings")
    .select(
      `id, balance_amount, created_at, status,
       farmers!inner ( name, phone, unique_id ),
       items ( name )`
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Add search by Farmer ID or Name
  if (searchQuery) {
    query = query.or(`unique_id.ilike.%${searchQuery}%,name.ilike.%${searchQuery}%`, { referencedTable: 'farmers' });
  }

  const { data: pendingBookings } = await query;

  // Fetch call logs for the fetched bookings
  const bookingIds = pendingBookings?.map((b) => b.id) || [];
  const { data: allCallLogs } = bookingIds.length > 0
    ? await supabase
        .from("call_logs")
        .select("id, booking_id, notes, created_at, pesticide_given, water_given, no_issue, forward_to")
        .in("booking_id", bookingIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Group call logs by booking_id for easy lookup
  const logsByBooking: Record<string, any[]> = {};
  allCallLogs?.forEach((log) => {
    if (!logsByBooking[log.booking_id]) logsByBooking[log.booking_id] = [];
    logsByBooking[log.booking_id].push(log);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Follow-Up Workflow</h1>
          <p className="text-gray-500 text-sm">
            Contact farmers, log interactions, and manage bookings.
          </p>
        </div>

        {/* Search bar */}
        <form className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            name="q"
            defaultValue={searchQuery}
            placeholder="Search by Farmer ID or Name..."
            className="w-full pl-9 pr-4 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bookings Queue</CardTitle>
          <CardDescription>
            {pendingBookings?.length || 0} booking(s) found.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Farmer</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Due Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="min-w-[120px]">Log Outcome</TableHead>
                  <TableHead>Cancel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingBookings?.map((b) => {
                  const farmer = b.farmers as any;
                  const item = b.items as any;
                  const logs = logsByBooking[b.id] || [];

                  return (
                    <React.Fragment key={b.id}>
                      {/* Main booking row */}
                      <TableRow className="align-top">
                        <TableCell>
                          <div className="font-medium text-green-700">{farmer?.name}</div>
                          <div className="text-xs text-gray-500">{farmer?.unique_id}</div>
                        </TableCell>
                        <TableCell>{item?.name}</TableCell>
                        <TableCell className="font-bold text-orange-600 whitespace-nowrap">
                          ₹ {Number(b.balance_amount).toLocaleString("en-IN")}
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded-full ${
                            b.status === "Pending" ? "bg-orange-100 text-orange-700" :
                            b.status === "Delivered" ? "bg-green-100 text-green-700" :
                            "bg-gray-100 text-gray-700"
                          }`}>
                            {b.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <a
                            href={`tel:${farmer?.phone}`}
                            className="flex items-center gap-2 text-green-700 hover:text-green-900 bg-green-50 px-3 py-1 rounded-full w-fit transition-colors"
                          >
                            <PhoneCall className="w-3 h-3" />
                            <span className="text-sm font-medium">{farmer?.phone}</span>
                          </a>
                        </TableCell>
                        <TableCell>
                          <LogCallModal bookingId={b.id} />
                        </TableCell>
                        <TableCell>
                          <form action={cancelBooking.bind(null, b.id) as () => void}>
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 text-xs"
                              title="Cancel this booking"
                              disabled={b.status === "Cancelled" || b.status === "Delivered"}
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" />
                              Cancel
                            </Button>
                          </form>
                        </TableCell>
                      </TableRow>

                      {/* Call log history sub-row */}
                      {logs.length > 0 && (
                        <TableRow className="bg-gray-50/70">
                          <TableCell colSpan={7} className="py-2 px-4">
                            <div className="flex items-start gap-2">
                              <MessageSquare className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                              <div className="space-y-2 w-full">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                                  Call History ({logs.length})
                                </span>
                                {logs.map((log, i) => (
                                  <div key={i} className="flex flex-col gap-1 text-xs text-gray-600 bg-white p-2 rounded border">
                                    <div className="flex justify-between text-gray-400 mb-1 border-b pb-1">
                                      <span>
                                        {new Date(log.created_at).toLocaleDateString("en-IN", {
                                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                                        })}
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                      <div><span className="font-semibold">Pesticide:</span> {log.pesticide_given ? "Yes" : "No"}</div>
                                      <div><span className="font-semibold">No Issue:</span> {log.no_issue ? "Yes" : "No"}</div>
                                      <div className="col-span-2"><span className="font-semibold">Watering:</span> {log.water_given || "-"}</div>
                                      {log.forward_to && log.forward_to !== "None" && (
                                        <div className="col-span-2 text-amber-600 font-semibold">Forwarded to: {log.forward_to}</div>
                                      )}
                                      {log.notes && (
                                        <div className="col-span-2 italic text-gray-500 mt-1">"{log.notes}"</div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
                {pendingBookings?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                      No bookings found.
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
