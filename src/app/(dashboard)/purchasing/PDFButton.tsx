"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { processPayment } from "@/actions/purchasing";
import jsPDF from "jspdf";
import "jspdf-autotable";

interface BookingInfo {
  id: string;
  qty: number;
  total_amount: number;
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

export function PDFButton({ booking }: { booking: BookingInfo }) {
  const [loading, setLoading] = useState(false);

  const handleProcess = async () => {
    setLoading(true);
    
    // Process payment in database
    const res = await processPayment(booking.id);
    if (res.error) {
      alert("Failed to process payment: " + res.error);
      setLoading(false);
      return;
    }

    // Generate PDF Slip using jsPDF
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
    doc.setTextColor(0, 128, 0); // Green
    doc.text("PAYMENT COMPLETED", 14, finalY + 15);
    
    // Save PDF
    doc.save(`DeliverySlip_${booking.farmer.unique_id}.pdf`);

    setLoading(false);
  };

  return (
    <Button 
      onClick={handleProcess} 
      disabled={loading}
      className="bg-green-600 hover:bg-green-700 w-full font-semibold"
    >
      {loading ? "Processing..." : `Pay ₹${booking.balance_amount} & Print Slip`}
    </Button>
  );
}
