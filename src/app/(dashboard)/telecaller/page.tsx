import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { PhoneCall } from "lucide-react";
import { logTelecallerAction } from "@/actions/telecaller";

export default async function TelecallerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  
  if (profile?.role !== "Telecaller" && profile?.role !== "Admin") {
    redirect("/");
  }

  // Fetch pending bookings only
  const { data: pendingBookings } = await supabase
    .from("bookings")
    .select(`
      id,
      balance_amount,
      created_at,
      farmers ( name, phone, unique_id ),
      items ( name )
    `)
    .eq("status", "Pending")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Follow-Up Workflow</h1>
      <p className="text-gray-500 text-sm">Contact farmers with pending balances and log interactions.</p>

      <Card>
        <CardHeader>
          <CardTitle>Pending Bookings Queue</CardTitle>
          <CardDescription>
            {pendingBookings?.length || 0} farmers require follow-up regarding their balances.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Farmer</TableHead>
                  <TableHead>Purchased Item</TableHead>
                  <TableHead>Due Balance</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="w-[300px]">Action Log</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingBookings?.map((b) => {
                  // Supabase infers joined tables as arrays; cast for safe access
                  const farmer = b.farmers as any;
                  const item = b.items as any;
                  return (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div className="font-medium text-green-700">{farmer?.name}</div>
                        <div className="text-xs text-gray-500">{farmer?.unique_id}</div>
                      </TableCell>
                      <TableCell>{item?.name}</TableCell>
                      <TableCell className="font-bold text-orange-600">₹ {b.balance_amount}</TableCell>
                      <TableCell>
                        <a
                          href={`tel:${farmer?.phone}`}
                          className="flex items-center gap-2 text-green-700 hover:text-green-900 transition-colors bg-green-50 px-3 py-1 rounded-full w-fit"
                        >
                          <PhoneCall className="w-3 h-3" />
                          <span className="text-sm font-medium">{farmer?.phone}</span>
                        </a>
                      </TableCell>
                      <TableCell>
                        {/* Note Logging Form */}
                        <form action={logTelecallerAction as (data: FormData) => void} className="flex gap-2">
                          <input type="hidden" name="booking_id" value={b.id} />
                          <Input
                            name="notes"
                            placeholder="Outcome..."
                            className="h-8 text-xs"
                            required
                          />
                          <Button type="submit" size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white">
                            Log
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {pendingBookings?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                      Great job! The pending queue is completely clear.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      
      {/* Schema Requirement Notice for Admin */}
      {profile?.role === "Admin" && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800 text-sm">Admin Schema Notice</CardTitle>
          </CardHeader>
          <CardContent className="text-orange-700 text-xs">
            To enable the Telecaller "Log Action" functionality to permanently save, ensure you execute the `call_logs` SQL creation script in the Supabase Dashboard, otherwise logs will fail to insert.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
