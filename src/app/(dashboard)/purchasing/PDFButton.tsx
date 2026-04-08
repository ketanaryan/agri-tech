"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface BookingInfo {
  id: string;
  qty: number;
  total_amount: number;
  booking_amount: number;
  balance_amount: number;
  created_at: string;
  farmer: {
    name: string;
    unique_id: string;
    phone: string;
    address: string;
  };
  item: {
    name: string;
    rate_per_unit: number;
  };
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window.Razorpay !== "undefined") {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function generatePDF(booking: BookingInfo, payMethod: string) {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.text("AgriTech — Final Delivery Slip", 14, 22);

  doc.setFontSize(11);
  doc.setTextColor(100);
  doc.text(`Date: ${new Date().toLocaleDateString("en-IN")}`, 14, 31);
  doc.text(`Booking ID: ${booking.id.slice(0, 8).toUpperCase()}`, 14, 37);
  doc.text(`Payment Method: ${payMethod === "cash" ? "Cash" : "Online (Razorpay)"}`, 14, 43);

  doc.setTextColor(0);
  doc.setFontSize(12);
  doc.text("Farmer Details:", 14, 53);
  doc.setFontSize(10);
  doc.text(`Name: ${booking.farmer.name} (${booking.farmer.unique_id})`, 14, 59);
  doc.text(`Phone: ${booking.farmer.phone}`, 14, 65);
  doc.text(`Address: ${booking.farmer.address || "N/A"}`, 14, 71);

  (doc as any).autoTable({
    startY: 78,
    head: [["Item", "Rate (₹)", "Qty", "Total (₹)", "Advance (₹)", "Balance Paid (₹)"]],
    body: [
      [
        booking.item.name,
        booking.item.rate_per_unit,
        booking.qty,
        booking.total_amount,
        booking.booking_amount,
        booking.balance_amount,
      ],
    ],
    theme: "grid",
    styles: { fontSize: 9 },
    headStyles: { fillColor: [22, 163, 74] },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 95;
  doc.setFontSize(13);
  doc.setTextColor(0, 128, 0);
  doc.text("✓ DELIVERED — PAYMENT COMPLETED", 14, finalY + 14);

  doc.save(`DeliverySlip_${booking.farmer.unique_id}_${Date.now()}.pdf`);
}

async function completeBooking(
  bookingId: string,
  paymentMethod: "online" | "cash",
  razorpayData?: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
) {
  const res = await fetch("/api/bookings/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bookingId, paymentMethod, ...razorpayData }),
  });
  return res;
}

export function PDFButton({ booking }: { booking: BookingInfo }) {
  const [loading, setLoading] = useState<"online" | "cash" | null>(null);
  const [done, setDone] = useState(false);
  const [paidMethod, setPaidMethod] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleCash = async () => {
    setLoading("cash");
    setError(null);
    try {
      const res = await completeBooking(booking.id, "cash");
      if (res.ok) {
        setPaidMethod("cash");
        setDone(true);
        generatePDF(booking, "cash");
      } else {
        const d = await res.json();
        setError(d.error ?? "Could not complete booking.");
      }
    } catch {
      setError("Failed to complete booking.");
    } finally {
      setLoading(null);
    }
  };

  const handleOnline = async () => {
    setLoading("online");
    setError(null);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setError("Failed to load Razorpay. Check your internet connection.");
        setLoading(null);
        return;
      }

      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: booking.balance_amount,
          receipt: `bal_${booking.id.slice(0, 8)}_${Date.now()}`,
          notes: { booking_id: booking.id, payment_type: "balance" },
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || orderData.error) {
        setError(orderData.error ?? "Could not create payment order.");
        setLoading(null);
        return;
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
        amount: orderData.amount,
        currency: orderData.currency,
        name: "AgriTech ERP",
        description: `Balance payment — ${booking.item.name}`,
        order_id: orderData.orderId,
        prefill: { name: booking.farmer.name, contact: booking.farmer.phone },
        theme: { color: "#16a34a" },
        handler: async function (response: any) {
          try {
            const res = await completeBooking(booking.id, "online", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            if (res.ok) {
              setPaidMethod("online");
              setDone(true);
              generatePDF(booking, "online");
            } else {
              const d = await res.json();
              setError(d.error ?? "Could not complete booking after payment.");
            }
          } catch {
            setError("Failed to complete booking after payment.");
          } finally {
            setLoading(null);
          }
        },
        modal: {
          ondismiss: () => {
            setError("Payment cancelled.");
            setLoading(null);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response: any) => {
        setError(`Payment failed: ${response.error.description}`);
        setLoading(null);
      });
      rzp.open();
    } catch (err: any) {
      setError(err?.message ?? "Unexpected error.");
      setLoading(null);
    }
  };

  if (done) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
          <span className="text-green-700 font-medium text-sm">
            ✅ Delivered — {paidMethod === "cash" ? "Cash Paid" : "Online Paid"}
          </span>
        </div>
        <Button
          onClick={() => generatePDF(booking, paidMethod)}
          variant="outline"
          className="w-full border-green-600 text-green-700 text-sm"
        >
          🖨 Re-print Delivery Slip
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-sm text-red-600 font-medium bg-red-50 p-2 rounded">{error}</p>
      )}

      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
        Collect Balance: ₹{booking.balance_amount}
      </p>

      <div className="flex gap-2">
        {/* Online */}
        <Button
          onClick={handleOnline}
          disabled={!!loading}
          className="flex-1 bg-green-600 hover:bg-green-700 text-sm"
        >
          {loading === "online" ? "Opening..." : "💳 Pay Online"}
        </Button>

        {/* Cash */}
        <Button
          onClick={handleCash}
          disabled={!!loading}
          className="flex-1 bg-amber-500 hover:bg-amber-600 text-sm text-white"
        >
          {loading === "cash" ? "Confirming..." : "💵 Cash Paid"}
        </Button>
      </div>
    </div>
  );
}
