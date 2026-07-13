"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import Image from "next/image";

export function HarvestButton({ booking }: { booking: any }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"qr" | "cash" | null>(null);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showQrModal, setShowQrModal] = useState(false);

  const completeHarvest = async (method: "qr" | "cash") => {
    setLoading(method);
    setError(null);
    try {
      const res = await fetch("/api/bookings/harvest-collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId: booking.id, paymentMethod: method }),
      });
      if (res.ok) {
        setDone(true);
        setShowQrModal(false);
        router.refresh();
      } else {
        const d = await res.json();
        setError(d.error ?? "Could not collect harvest payment.");
      }
    } catch (err: any) {
      setError(`Failed: ${err?.message || "Unknown error"}`);
    } finally {
      setLoading(null);
    }
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-200">
        <span className="text-emerald-700 font-medium text-sm">
          ✅ Harvest Payment Collected
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2 mt-4 pt-4 border-t border-dashed border-amber-200">
      {error && <p className="text-sm text-red-600 font-medium bg-red-50 p-2 rounded">{error}</p>}

      <p className="text-xs text-amber-700 font-bold uppercase tracking-wide flex items-center gap-1">
        🌾 Collect Harvest Return: ₹{booking.harvest_amount}
      </p>

      <div className="flex gap-2">
        <Button onClick={() => setShowQrModal(true)} disabled={!!loading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-sm text-white">
          {loading === "qr" ? "Processing..." : "📷 Pay via QR"}
        </Button>
        <Button onClick={() => completeHarvest("cash")} disabled={!!loading} className="flex-1 bg-amber-500 hover:bg-amber-600 text-sm text-white">
          {loading === "cash" ? "Processing..." : "💵 Cash Paid"}
        </Button>
      </div>

      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Collect Harvest Payment via QR</DialogTitle>
            <DialogDescription>
              Show this QR code to {booking.farmer.name} to collect the harvest amount of ₹{Number(booking.harvest_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center p-4">
            <div className="w-64 h-64 border-4 border-blue-500 rounded-xl bg-gray-50 flex items-center justify-center p-2 relative overflow-hidden">
               <Image src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=upi://pay?pa=agritecherp@upi&pn=AgriTechERP&am=${booking.harvest_amount}`} fill alt="QR Code" className="object-contain" />
            </div>
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowQrModal(false)} disabled={!!loading}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => completeHarvest("qr")} disabled={!!loading}>
              {loading === "qr" ? "Processing..." : "OK, Collected"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
