"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";


interface BookingInfo {
  id: string;
  qty: number;
  replacement_qty?: number;
  rate_snapshot?: number;
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

async function generatePDFBlob(booking: BookingInfo, payMethod: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const autoTableModule = await import("jspdf-autotable");
  const autoTable = autoTableModule.default || autoTableModule;
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

  autoTable(doc, {
    startY: 78,
    head: [["Item", "Rate (\u20b9)", "Ordered", "Replacement", "Total Delivered", "Total (\u20b9)", "Advance (\u20b9)", "Balance (\u20b9)"]],
    body: [
      [
        booking.item.name,
        booking.rate_snapshot || (booking.qty ? (booking.total_amount / booking.qty) : booking.item.rate_per_unit),
        booking.qty,
        booking.replacement_qty ?? 0,
        booking.qty + (booking.replacement_qty ?? 0),
        booking.total_amount,
        booking.booking_amount,
        booking.balance_amount,
      ],
    ],
    theme: "grid",
    styles: { fontSize: 7.5 },
    headStyles: { fillColor: [22, 163, 74] },
  });

  const finalY = (doc as any).lastAutoTable.finalY || 95;
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(
    `Rate locked at booking time: \u20b9${booking.rate_snapshot || (booking.qty ? (booking.total_amount / booking.qty) : booking.item.rate_per_unit)}/unit`,
    14, finalY + 8
  );
  doc.setFontSize(13);
  doc.setTextColor(0, 128, 0);
  doc.text("\u2713 DELIVERED \u2014 PAYMENT COMPLETED", 14, finalY + 18);

  return doc.output('blob');
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
  
  // WhatsApp and Download state
  const [waUrl, setWaUrl] = useState<string>("");
  const [localPdfUrl, setLocalPdfUrl] = useState<string>("");

  const handleSuccess = async (method: string) => {
    // Generate PDF Blob
    const blob = await generatePDFBlob(booking, method);
    const localUrl = URL.createObjectURL(blob);
    setLocalPdfUrl(localUrl);

    // Upload to server silently
    let remoteUrl = "";
    try {
      const fd = new FormData();
      fd.append("receipt", blob, `delivery_${booking.id}.pdf`);
      const upRes = await fetch("/api/upload-receipt", { method: "POST", body: fd });
      const upData = await upRes.json();
      if (upRes.ok && upData.url) {
        remoteUrl = upData.url;
      }
    } catch (e) {
      console.error("Failed receipt upload", e);
    }

    // Generate WhatsApp Text
    let text = `Hello ${booking.farmer?.name || "Farmer"},\nYour AgriTech ERP Delivery is Complete.\nFarmer ID: ${booking.farmer?.unique_id || "N/A"}\nItem: ${booking.item?.name || "N/A"}\nQuantity: ${booking.qty}\nTotal Cost: ₹${booking.total_amount?.toLocaleString("en-IN")}\nBalance Paid: ₹${booking.balance_amount?.toLocaleString("en-IN")}\n`;
    if (remoteUrl) {
      text += `\nDownload Final Slip: ${remoteUrl}\n`;
    }
    text += `Thank you!`;
    
    // Format phone number
    const phoneDigits = booking.farmer?.phone?.replace(/\D/g, "") || "";
    const waPhone = phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits;

    setWaUrl(`https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`);

    setPaidMethod(method);
    setDone(true);
  };

  const handleCash = async () => {
    setLoading("cash");
    setError(null);
    try {
      const res = await completeBooking(booking.id, "cash");
      if (res.ok) {
        await handleSuccess("cash");
      } else {
        const d = await res.json();
        setError(d.error ?? "Could not complete booking.");
      }
    } catch (err: any) {
      console.error(err);
      setError(`Failed to complete booking: ${err?.message || "Unknown error"}`);
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
              await handleSuccess("online");
            } else {
              const d = await res.json();
              setError(d.error ?? "Could not complete booking after payment.");
            }
          } catch (err: any) {
            console.error(err);
            setError(`Failed to complete booking after payment: ${err?.message || "Unknown error"}`);
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
      <div className="space-y-3">
        <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
          <span className="text-green-700 font-medium text-sm">
            ✅ Delivered — {paidMethod === "cash" ? "Cash Paid" : "Online Paid"}
          </span>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          {localPdfUrl && (
            <a 
              href={localPdfUrl}
              download={`DeliverySlip_${booking.farmer.unique_id}.pdf`}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md transition-colors font-semibold shadow-sm text-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Download PDF
            </a>
          )}
          {waUrl && (
            <a 
              href={waUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-md transition-colors font-semibold shadow-sm text-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
              </svg>
              Send WhatsApp Confirmation
            </a>
          )}
        </div>
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
