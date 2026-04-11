"use client";

import { useState, useTransition, useRef } from "react";
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
import Image from "next/image";

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
  const [farmerMode, setFarmerMode] = useState<"existing" | "new">("existing");
  const [farmerId, setFarmerId] = useState("");
  
  // New Farmer State
  const [newFarmerName, setNewFarmerName] = useState("");
  const [newFarmerPhone, setNewFarmerPhone] = useState("");
  const [newFarmerAddress, setNewFarmerAddress] = useState("");
  
  // Photo Upload State
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [itemId, setItemId] = useState("");
  const [qtyStr, setQtyStr] = useState("1");
  const payMethod = "online";
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [paying, setPaying] = useState(false);
  const [isPending, startTransition] = useTransition();

  const qty = parseInt(qtyStr, 10) || 0;
  const selectedItem = items.find((i) => i.id === itemId);
  const selectedFarmer = farmers.find((f) => f.id === farmerId);

  const totalAmount = selectedItem ? selectedItem.rate_per_unit * qty : 0;
  const advanceAmount = Math.round(totalAmount * 0.1 * 100) / 100;
  const balanceAmount = Math.round((totalAmount - advanceAmount) * 100) / 100;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    // Upload to server
    setUploading(true);
    setUploadError(null);
    setPhotoUrl("");

    try {
      const fd = new FormData();
      fd.append("photo", file);

      const res = await fetch("/api/upload-farmer-photo", {
        method: "POST",
        body: fd,
      });

      const json = await res.json();
      if (!res.ok) {
        setUploadError(json.error || "Upload failed");
        setPhotoPreview(null);
      } else {
        setPhotoUrl(json.url);
      }
    } catch {
      setUploadError("Network error during upload");
      setPhotoPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const createBookingInDB = async (razorpayData?: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => {
    const bookRes = await fetch("/api/bookings/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farmerMode,
        farmerId: farmerMode === "existing" ? farmerId : undefined,
        newFarmerData: farmerMode === "new" ? {
          name: newFarmerName,
          phone: newFarmerPhone,
          address: newFarmerAddress,
          photo_url: photoUrl
        } : undefined,
        itemId,
        qty,
        paymentMethod: payMethod,
        ...razorpayData,
      }),
    });
    const bookData = await bookRes.json();
    if (!bookRes.ok || bookData.error) {
      setMsg({ text: `Booking failed: ${bookData.error}`, type: "error" });
    } else {
      setMsg({
        text: `✅ Booking created! Advance of ₹${advanceAmount.toFixed(2)} paid (Online). ID: ${bookData.bookingId?.slice(0, 8)}`,
        type: "success",
      });
      // Reset form
      setFarmerId("");
      setNewFarmerName("");
      setNewFarmerPhone("");
      setNewFarmerAddress("");
      setPhotoPreview(null);
      setPhotoUrl("");
      setItemId("");
      setQtyStr("1");
    }
    setPaying(false);
  };

  const handleGenerateBooking = async () => {
    if (farmerMode === "existing" && !farmerId) {
      setMsg({ text: "Please select an existing farmer.", type: "error" });
      return;
    }
    if (farmerMode === "new") {
      if (!newFarmerName || !newFarmerPhone) {
        setMsg({ text: "Please fill in Name and Phone for the new farmer.", type: "error" });
        return;
      }
      if (!/^\d{10}$/.test(newFarmerPhone)) {
        setMsg({ text: "Phone number must be exactly 10 digits.", type: "error" });
        return;
      }
    }
    if (!itemId || qty <= 0) {
      setMsg({ text: "Please fill item details correctly.", type: "error" });
      return;
    }

    setPaying(true);
    setMsg(null);

    try {
      // Online: Razorpay flow
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        setMsg({ text: "Failed to load Razorpay. Check your internet connection.", type: "error" });
        setPaying(false);
        return;
      }

      const receiptId = farmerMode === "existing" 
        ? `adv_${farmerId.slice(0, 8)}_${Date.now()}` 
        : `adv_new_${Date.now()}`;

      const notes = {
        item_id: itemId,
        qty: qty.toString(),
        type: "advance",
        ...(farmerMode === "existing" ? { farmer_id: farmerId } : { new_farmer: "true" })
      };

      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: advanceAmount,
          receipt: receiptId,
          notes,
        }),
      });

      const orderData = await orderRes.json();
      if (!orderRes.ok || orderData.error) {
        setMsg({ text: orderData.error ?? "Could not create payment order.", type: "error" });
        setPaying(false);
        return;
      }

      const prefillName = farmerMode === "existing" ? (selectedFarmer?.name ?? "") : newFarmerName;
      const prefillContact = farmerMode === "existing" ? (selectedFarmer?.phone ?? "") : newFarmerPhone;

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "",
        amount: orderData.amount,
        currency: orderData.currency,
        name: "AgriTech ERP",
        description: `Advance for ${selectedItem?.name} × ${qty}`,
        order_id: orderData.orderId,
        prefill: { name: prefillName, contact: prefillContact },
        theme: { color: "#16a34a" },
        handler: async function (response: any) {
          startTransition(async () => {
            await createBookingInDB({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
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
    <div className="space-y-6">
      {/* Farmer Mode Toggle */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={farmerMode === "existing" ? "default" : "outline"}
          onClick={() => setFarmerMode("existing")}
          className={farmerMode === "existing" ? "bg-green-700 hover:bg-green-800" : ""}
        >
          Existing Farmer
        </Button>
        <Button
          type="button"
          variant={farmerMode === "new" ? "default" : "outline"}
          onClick={() => setFarmerMode("new")}
          className={farmerMode === "new" ? "bg-green-700 hover:bg-green-800" : ""}
        >
          New Farmer
        </Button>
      </div>

      {farmerMode === "existing" ? (
        <div className="space-y-2">
          <Label htmlFor="farmerId">Select Farmer</Label>
          <Select value={farmerId} onValueChange={(v) => setFarmerId(v ?? "")}>
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
      ) : (
        <div className="space-y-4 border p-4 rounded-xl relative">
          <h3 className="text-sm font-semibold text-gray-700 absolute -top-2.5 bg-white px-2 left-3">
            Farmer Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="newFarmerName">Farmer Name</Label>
              <Input
                id="newFarmerName"
                value={newFarmerName}
                onChange={(e) => setNewFarmerName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newFarmerPhone">Phone Number</Label>
              <Input
                id="newFarmerPhone"
                value={newFarmerPhone}
                onChange={(e) => setNewFarmerPhone(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="9876543210"
                maxLength={10}
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="newFarmerAddress">Address / Village</Label>
              <Input
                id="newFarmerAddress"
                value={newFarmerAddress}
                onChange={(e) => setNewFarmerAddress(e.target.value)}
                placeholder="Village Name"
              />
            </div>

            {/* Photo Upload */}
            <div className="space-y-2 md:col-span-2">
              <Label>Farmer Photo (Optional)</Label>
              <div className="flex items-center gap-4">
                {/* Preview */}
                {photoPreview ? (
                  <div className="relative w-16 h-16 rounded-full overflow-hidden border border-green-600 shadow-sm flex-shrink-0">
                    <Image
                      src={photoPreview}
                      alt="Preview"
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gray-100 border border-dashed flex-shrink-0 flex items-center justify-center">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                  </div>
                )}
                
                <div className="flex-1">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start text-gray-600"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? "Uploading..." : photoUrl ? "Change Photo" : "Upload Photo"}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  {uploadError && (
                    <p className="text-xs text-red-600 mt-1">{uploadError}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Item Select */}
      <div className="space-y-2">
        <Label htmlFor="itemId">Select Item</Label>
        <Select value={itemId} onValueChange={(v) => setItemId(v ?? "")}>
          <SelectTrigger id="itemId">
            <SelectValue placeholder="Select an item" />
          </SelectTrigger>
          <SelectContent>
            {items.map((i) => (
              <SelectItem key={i.id} value={i.id}>
                {i.name} — ₹{i.rate_per_unit}
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
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="Enter quantity (e.g. 47)"
          value={qtyStr}
          onChange={(e) => {
            const val = e.target.value.replace(/[^0-9]/g, "");
            setQtyStr(val);
          }}
        />
      </div>

      {/* Payment Method */}
      <div className="space-y-2">
        <Label>Advance Payment Method</Label>
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 flex items-center">
          💳 Online Payment Only (via Razorpay)
        </div>
      </div>

      {/* Price Preview */}
      {selectedItem && qty > 0 && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Amount:</span>
            <span className="font-semibold">₹{totalAmount.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between text-green-700 font-medium">
            <span>Advance Now (10%):</span>
            <span>₹{advanceAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-gray-400 text-xs border-t pt-1 mt-1">
            <span>Balance at Delivery:</span>
            <span>₹{balanceAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          <p className="text-xs text-gray-400">
            💳 Razorpay will open for ₹{advanceAmount.toFixed(2)}.
          </p>
        </div>
      )}

      {/* Status Message */}
      {msg && (
        <div
          className={`p-3 rounded-md text-sm font-medium transition-all ${
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
        disabled={
          paying ||
          isPending ||
          !itemId ||
          qty <= 0 ||
          (uploading) ||
          (farmerMode === "existing" && !farmerId) ||
          (farmerMode === "new" && (!newFarmerName || !newFarmerPhone))
        }
        className="w-full bg-green-600 hover:bg-green-700"
      >
        {paying || isPending || uploading
          ? "Processing..."
          : selectedItem && qty > 0
          ? `Pay ₹${advanceAmount.toFixed(2)} & Generate Booking`
          : "Generate Booking"}
      </Button>
    </div>
  );
}
