"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Farmer {
  id: string;
  name: string;
  unique_id: string;
  phone: string;
}

interface Item {
  id: string;
  name: string;
  rate_per_unit: number;
}

interface CreateBookingFormProps {
  farmers: Farmer[];
  items: Item[];
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

export function CreateBookingForm({ farmers, items }: CreateBookingFormProps) {
  const [farmerId, setFarmerId] = useState("");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [paying, setPaying] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectedItem = items.find((i) => i.id === itemId);
  const selectedFarmer = farmers.find((f) => f.id === farmerId);

  const totalAmount = selectedItem ? selectedItem.rate_per_unit * qty : 0;
  const advanceAmount = totalAmount * 0.1; // 10% advance
  const balanceAmount = totalAmount - advanceAmount;

  const handleGenerateBooking = async () => {
    if (!farmerId || !itemId || qty <= 0) {
      setMsg({ text: "Please fill all fields correctly.", type: "error" });
      return;
    }

    setPaying(true);
    setMsg(null);

    try {
      // Load Razorpay SDK
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setMsg({ text: "Failed to load Razorpay. Check your internet connection.", type: "error" });
        setPaying(false);
        return;
      }

      // Create Razorpay order via our API
      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: advanceAmount,
          receipt: `advance_${farmerId.slice(0, 8)}_${Date.now()}`,
          notes: {
            farmer_id: farmerId,
            item_id: itemId,
            qty: qty.toString(),
            payment_type: "advance",
          },
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || orderData.error) {
        setMsg({ text: orderData.error ?? "Could not create payment order.", type: "error" });
        setPaying(false);
        return;
      }

      // Open Razorpay checkout
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
        amount: orderData.amount,
        currency: orderData.currency,
        name: "AgriTech ERP",
        description: `Advance for ${selectedItem?.name} × ${qty}`,
        order_id: orderData.orderId,
        prefill: {
          name: selectedFarmer?.name ?? "",
          contact: selectedFarmer?.phone ?? "",
        },
        notes: {
          farmer: selectedFarmer?.name ?? "",
          item: selectedItem?.name ?? "",
        },
        theme: { color: "#16a34a" },
        handler: async function (response: any) {
          // Payment succeeded → create booking in DB
          startTransition(async () => {
            try {
              const bookRes = await fetch("/api/bookings/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  farmerId,
                  itemId,
                  qty,
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                }),
              });
              const bookData = await bookRes.json();
              if (!bookRes.ok || bookData.error) {
                setMsg({ text: `Payment done but booking failed: ${bookData.error}`, type: "error" });
              } else {
                setMsg({
                  text: `✅ Booking created! Advance of ₹${advanceAmount.toFixed(2)} paid. Booking ID: ${bookData.bookingId?.slice(0, 8)}`,
                  type: "success",
                });
                // Reset form
                setFarmerId("");
                setItemId("");
                setQty(1);
              }
            } catch (e: any) {
              setMsg({ text: "Booking creation failed after payment.", type: "error" });
            } finally {
              setPaying(false);
            }
          });
        },
        modal: {
          ondismiss: () => {
            setMsg({ text: "Payment cancelled. No booking was created.", type: "error" });
            setPaying(false);
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response: any) => {
        setMsg({ text: `Payment failed: ${response.error.description}`, type: "error" });
        setPaying(false);
      });
      rzp.open();
    } catch (err: any) {
      setMsg({ text: err?.message ?? "An unexpected error occurred.", type: "error" });
      setPaying(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Farmer Select */}
      <div className="space-y-2">
        <Label htmlFor="farmerId">Select Farmer</Label>
        <Select value={farmerId} onValueChange={setFarmerId} required>
          <SelectTrigger id="farmerId">
            <SelectValue placeholder="Select a farmer" />
          </SelectTrigger>
          <SelectContent>
            {farmers.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name} ({f.unique_id})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Item Select */}
      <div className="space-y-2">
        <Label htmlFor="itemId">Select Item</Label>
        <Select value={itemId} onValueChange={setItemId} required>
          <SelectTrigger id="itemId">
            <SelectValue placeholder="Select an item" />
          </SelectTrigger>
          <SelectContent>
            {items.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.name} - ₹{i.rate_per_unit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Quantity */}
      <div className="space-y-2">
        <Label htmlFor="qty">Quantity</Label>
        <Input
          id="qty"
          name="qty"
          type="number"
          min="1"
          value={qty}
          onChange={(e) => setQty(parseInt(e.target.value, 10) || 1)}
          required
        />
      </div>

      {/* Price Preview */}
      {selectedItem && qty > 0 && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Amount:</span>
            <span className="font-semibold">₹{totalAmount.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between text-green-700">
            <span>Advance (10%):</span>
            <span className="font-semibold">₹{advanceAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-gray-500 text-xs border-t pt-1 mt-1">
            <span>Balance Due Later:</span>
            <span>₹{balanceAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            💳 You will be charged ₹{advanceAmount.toFixed(2)} now via Razorpay.
          </p>
        </div>
      )}

      {!selectedItem && (
        <div className="p-3 bg-gray-50 rounded-md text-sm text-gray-500">
          <strong>Note:</strong> Booking requires 10% advance payment via Razorpay.
        </div>
      )}

      {/* Status Message */}
      {msg && (
        <div
          className={`p-3 rounded-md text-sm font-medium ${
            msg.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      <Button
        type="button"
        onClick={handleGenerateBooking}
        disabled={paying || isPending || !farmerId || !itemId || qty <= 0}
        className="w-full bg-green-600 hover:bg-green-700"
      >
        {paying || isPending
          ? "Processing..."
          : selectedItem
          ? `Pay ₹${advanceAmount.toFixed(2)} & Generate Booking`
          : "Generate Booking"}
      </Button>
    </div>
  );
}
