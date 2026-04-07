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
import { Input } from "@/components/ui/input";
import { PhoneCall, XCircle, MessageSquare } from "lucide-react";
import { logTelecallerAction } from "@/actions/telecaller";
import { cancelBooking } from "@/actions/bookings";

export default async function TelecallerPage() {
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

  // Fetch pending bookings
  const { data: pendingBookings } = await supabase
    .from("bookings")
    .select(
      `id, balance_amount, created_at,
       farmers ( name, phone, unique_id ),
       items ( name )`
    )
    .eq("status", "Pending")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Fetch call logs for all pending bookings (issue #8)
  const bookingIds = pendingBookings?.map((b) => b.id) || [];
  const { data: allCallLogs } = bookingIds.length > 0
    ? await supabase
        .from("call_logs")
        .select("id, booking_id, notes, created_at")
        .in("booking_id", bookingIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  // Group call logs by booking_id for easy lookup
  const logsByBooking: Record<string, { notes: string; created_at: string }[]> = {};
  allCallLogs?.forEach((log) => {
    if (!logsByBooking[log.booking_id]) logsByBooking[log.booking_id] = [];
    logsByBooking[log.booking_id].push(log);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Follow-Up Workflow</h1>
        <p className="text-gray-500 text-sm">
          Contact farmers with pending balances, log interactions, and cancel dead bookings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending Bookings Queue</CardTitle>
          <CardDescription>
            {pendingBookings?.length || 0} farmer(s) require follow-up regarding their balances.
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
                  <TableHead>Contact</TableHead>
                  <TableHead className="min-w-[260px]">Log Outcome</TableHead>
                  <TableHead>Cancel</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingBookings?.map((b) => {
                  const farmer = b.farmers as any;
                  const item = b.items as any;
                  const logs = logsByBooking[b.id] || [];

                  return (
                    <>
                      {/* Main booking row */}
                      <TableRow key={b.id} className="align-top">
                        <TableCell>
                          <div className="font-medium text-green-700">{farmer?.name}</div>
                          <div className="text-xs text-gray-500">{farmer?.unique_id}</div>
                        </TableCell>
                        <TableCell>{item?.name}</TableCell>
                        <TableCell className="font-bold text-orange-600 whitespace-nowrap">
                          ₹ {Number(b.balance_amount).toLocaleString("en-IN")}
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
                          <form
                            action={logTelecallerAction as (data: FormData) => void}
                            className="flex gap-2"
                          >
                            <input type="hidden" name="booking_id" value={b.id} />
                            <Input
                              name="notes"
                              placeholder="Call outcome…"
                              className="h-8 text-xs"
                              required
                            />
                            <Button
                              type="submit"
                              size="sm"
                              className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white shrink-0"
                            >
                              Log
                            </Button>
                          </form>
                        </TableCell>
                        <TableCell>
                          {/* Issue #6 — Cancel booking */}
                          <form action={cancelBooking.bind(null, b.id) as () => void}>
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 text-xs"
                              title="Cancel this booking"
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1" />
                              Cancel
                            </Button>
                          </form>
                        </TableCell>
                      </TableRow>

                      {/* Issue #8 — Call log history sub-row */}
                      {logs.length > 0 && (
                        <TableRow key={`${b.id}-logs`} className="bg-gray-50/70">
                          <TableCell colSpan={6} className="py-2 px-4">
                            <div className="flex items-start gap-2">
                              <MessageSquare className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                              <div className="space-y-1 w-full">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                                  Call History ({logs.length})
                                </span>
                                {logs.map((log, i) => (
                                  <div key={i} className="flex gap-3 text-xs text-gray-600">
                                    <span className="text-gray-400 whitespace-nowrap shrink-0">
                                      {new Date(log.created_at).toLocaleDateString("en-IN", {
                                        day: "numeric",
                                        month: "short",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                    <span>— {log.notes}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
                {pendingBookings?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                      Great job! The pending queue is completely clear.
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
