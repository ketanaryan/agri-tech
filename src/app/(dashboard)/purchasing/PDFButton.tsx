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

function generatePDF(booking: BookingInfo) {
  const doc = new jsPDF();

  doc.setFontSize(20);
  doc.text("AgriTech Final Delivery Slip", 14, 22);

  doc.setFontSize(12);
  doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 32);
  doc.text(`Booking ID: ${booking.id.slice(0, 8)}`, 14, 38);

  doc.text("Farmer Details:", 14, 50);
  doc.setFontSize(10);
  doc.text(`Name: ${booking.farmer.name} (${booking.farmer.unique_id})`, 14, 56);
  doc.text(`Phone: ${booking.farmer.phone}`, 14, 62);
  doc.text(`Address: ${booking.farmer.address || "N/A"}`, 14, 68);

  (doc as any).autoTable({
    startY: 75,
    head: [["Item", "Rate", "Quantity", "Total Amt", "Balance Paid"]],
    body: [
      [
        booking.item.name,
        `Rs. ${booking.item.rate_per_unit}`,
        booking.qty,
        `Rs. ${booking.total_amount}`,
        `Rs. ${booking.balance_amount}`,
      ],
    ],
    theme: "grid",
  });

  const finalY = (doc as any).lastAutoTable.finalY || 90;
  doc.setFontSize(12);
  doc.setTextColor(0, 128, 0);
  doc.text("PAYMENT COMPLETED", 14, finalY + 15);

  doc.save(`DeliverySlip_${booking.farmer.unique_id}.pdf`);
}

export function PDFButton({ booking }: { booking: BookingInfo }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProcess = async () => {
    setLoading(true);
    setError(null);

    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setError("Failed to load Razorpay. Check your internet connection.");
        setLoading(false);
        return;
      }

      // Create Razorpay order for balance amount
      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: booking.balance_amount,
          receipt: `balance_${booking.id.slice(0, 8)}_${Date.now()}`,
          notes: {
            booking_id: booking.id,
            payment_type: "balance",
          },
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || orderData.error) {
        setError(orderData.error ?? "Could not create payment order.");
        setLoading(false);
        return;
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
        amount: orderData.amount,
        currency: orderData.currency,
        name: "AgriTech ERP",
        description: `Balance payment for ${booking.item.name}`,
        order_id: orderData.orderId,
        prefill: {
          name: booking.farmer.name,
          contact: booking.farmer.phone,
        },
        notes: {
          booking_id: booking.id,
          farmer: booking.farmer.name,
        },
        theme: { color: "#16a34a" },
        handler: async function (response: any) {
          // Mark booking as Completed
          try {
            const completeRes = await fetch("/api/bookings/complete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                bookingId: booking.id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (completeRes.ok) {
              generatePDF(booking);
              setDone(true);
            } else {
              const d = await completeRes.json();
              setError(d.error ?? "Could not complete booking.");
            }
          } catch {
            setError("Failed to complete booking after payment.");
          } finally {
            setLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setError("Payment cancelled.");
            setLoading(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response: any) => {
        setError(`Payment failed: ${response.error.description}`);
        setLoading(false);
      });
      rzp.open();
    } catch (err: any) {
      setError(err?.message ?? "Unexpected error.");
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="flex gap-2">
        <Button
          onClick={() => generatePDF(booking)}
          variant="outline"
          className="w-full border-green-600 text-green-700"
        >
          🖨 Re-print Slip
        </Button>
        <span className="text-green-700 text-sm font-medium self-center whitespace-nowrap">
          ✅ Paid
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-sm text-red-600 font-medium">{error}</p>
      )}
      <Button
        onClick={handleProcess}
        disabled={loading}
        className="bg-green-600 hover:bg-green-700 w-full font-semibold"
      >
        {loading ? "Processing..." : `Pay ₹${booking.balance_amount} & Print Slip`}
      </Button>
    </div>
  );
}
