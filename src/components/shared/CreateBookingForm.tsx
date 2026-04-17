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
  mode?: "new" | "existing" | "both";
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

export function CreateBookingForm({ farmers, items, mode = "both" }: CreateBookingFormProps) {
  const [farmerMode, setFarmerMode] = useState<"existing" | "new">(mode === "new" ? "new" : "existing");
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
  const [payType, setPayType] = useState<"advance" | "full">("advance");
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error"; waUrl?: string; localPdfUrl?: string; bookingId?: string } | null>(null);
  const [paying, setPaying] = useState(false);
  const [isPending, startTransition] = useTransition();

  const qty = parseInt(qtyStr, 10) || 0;
  const selectedItem = items.find((i) => i.id === itemId);
  const selectedFarmer = farmers.find((f) => f.id === farmerId);

  const totalAmount = selectedItem ? selectedItem.rate_per_unit * qty : 0;
  const checkoutAmount = payType === "full" ? totalAmount : Math.round(totalAmount * 0.1 * 100) / 100;
  const balanceAmount = Math.round((totalAmount - checkoutAmount) * 100) / 100;

  // Replacement plants: 10% free buffer — no charge
  const replacementQty = qty > 0 ? Math.floor(qty * 0.1) : 0;
  const totalDelivered = qty + replacementQty;

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
        paymentType: payType,
        ...razorpayData,
      }),
    });
    const bookData = await bookRes.json();
    if (!bookRes.ok || bookData.error) {
      setMsg({ text: `Booking failed: ${bookData.error}`, type: "error" });
    } else {
      const fName = farmerMode === "existing" ? selectedFarmer?.name : newFarmerName;
      const fPhone = farmerMode === "existing" ? selectedFarmer?.phone : newFarmerPhone;
      const itemName = selectedItem?.name;
      const fUid = bookData.finalFarmerUniqueId || (farmerMode === "existing" ? selectedFarmer?.unique_id : "Processing");

      // Generate PDF Receipt
      const { jsPDF } = await import("jspdf"); // Dynamic import for client side
      const doc = new jsPDF();
      doc.setFontSize(22);
      doc.setTextColor(22, 163, 74); // green-600
      doc.text("AgriTech ERP - Official Receipt", 20, 20);

      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 30);
      doc.text(`Booking ID: ${bookData.bookingId?.slice(0, 8) || "N/A"}`, 20, 38);
      
      doc.setFontSize(14);
      doc.setTextColor(50, 50, 50);
      doc.text("Farmer Details:", 20, 50);
      doc.setFontSize(12);
      doc.text(`Name: ${fName}`, 20, 58);
      doc.text(`Farmer ID: ${fUid}`, 20, 66);
      doc.text(`Phone: ${fPhone}`, 20, 74);

      doc.setFontSize(14);
      doc.text("Order Summary:", 20, 90);
      doc.setFontSize(12);
      doc.text(`Item: ${itemName}`, 20, 98);
      doc.text(`Ordered Quantity: ${qty} plants`, 20, 106);
      doc.text(`Total Amount: Rs. ${totalAmount.toFixed(2)}`, 20, 114);

      // Replacement plants info
      const localReplacementQty = Math.floor(qty * 0.1);
      const localTotalDelivered = qty + localReplacementQty;
      doc.setFontSize(11);
      doc.setTextColor(21, 128, 61); // green-700
      doc.text(`Free Replacement Plants (10%): ${localReplacementQty} plants (No charge)`, 20, 122);
      doc.text(`Total Plants to be Delivered: ${localTotalDelivered} plants`, 20, 130);

      doc.setFontSize(12);
      doc.setTextColor(22, 163, 74);
      doc.text(`${payType === "full" ? "Full Payment" : "Advance Paid (10%)"}: Rs. ${checkoutAmount.toFixed(2)}`, 20, 142);
      
      doc.setTextColor(220, 38, 38);
      doc.text(`Balance Due at Delivery: Rs. ${balanceAmount.toFixed(2)}`, 20, 150);
      
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(10);
      doc.text("This is an electronically generated receipt.", 20, 162);

      const pdfBlob = doc.output('blob');
      const localPdfUrl = URL.createObjectURL(pdfBlob);

      // Upload PDF
      let publicReceiptUrl = "";
      try {
        const fd = new FormData();
        fd.append("receipt", pdfBlob, `receipt_${bookData.bookingId}.pdf`);
        const upRes = await fetch("/api/upload-receipt", {
          method: "POST",
          body: fd,
        });
        const upData = await upRes.json();
        if (upRes.ok && upData.url) {
          publicReceiptUrl = upData.url;
        }
      } catch (e) {
        console.error("Failed to upload receipt", e);
      }

      const waReplacementQty = Math.floor(qty * 0.1);
      const waTotalDelivered = qty + waReplacementQty;
      let waText = `Hello ${fName},\nYour AgriTech ERP Booking is Confirmed! 🌱\n\nFarmer ID: ${fUid}\nItem: ${itemName}\n\n📦 Ordered: ${qty} plants\n🎁 Free Replacement (10%): ${waReplacementQty} plants\n✅ Total Delivery: ${waTotalDelivered} plants\n\n💰 ${payType === "full" ? "Total Paid" : "Advance Paid"}: ₹${checkoutAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n💵 Balance Due at Delivery: ₹${balanceAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n`;
      if (publicReceiptUrl) {
         waText += `\n📄 Download Receipt: ${publicReceiptUrl}\n`;
      }
      waText += `\nThank you for choosing us! 🙏`;

      const waUrl = `https://wa.me/91${fPhone}?text=${encodeURIComponent(waText)}`;

      setMsg({
        text: `✅ Booking created! ${payType === "full" ? "Full payment" : "Advance"} of ₹${checkoutAmount.toFixed(2)} paid (Online). ID: ${bookData.bookingId?.slice(0, 8)}`,
        type: "success",
        waUrl,
        localPdfUrl,
        bookingId: bookData.bookingId
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
        ? `${payType}_${farmerId.slice(0, 8)}_${Date.now()}` 
        : `${payType}_new_${Date.now()}`;

      const notes = {
        item_id: itemId,
        qty: qty.toString(),
        type: payType,
        ...(farmerMode === "existing" ? { farmer_id: farmerId } : { new_farmer: "true" })
      };

      const orderRes = await fetch("/api/razorpay/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: checkoutAmount,
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
        description: `${payType === "full" ? "Full Payment" : "Advance"} for ${selectedItem?.name} × ${qty}`,
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
      {mode === "both" && (
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
      )}

      {farmerMode === "existing" ? (
        <div className="space-y-2">
          <Label htmlFor="farmerId">Select Farmer</Label>
          <Select value={farmerId} onValueChange={(v) => setFarmerId(v ?? "")}>
            <SelectTrigger id="farmerId">
              <SelectValue placeholder="Select a farmer">
                {farmerId && selectedFarmer ? `${selectedFarmer.name} (${selectedFarmer.unique_id})` : null}
              </SelectValue>
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
            <SelectValue placeholder="Select an item">
              {itemId && selectedItem ? `${selectedItem.name} — ₹${selectedItem.rate_per_unit}` : null}
            </SelectValue>
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

      {/* Payment Type */}
      <div className="space-y-2">
        <Label>Payment Type</Label>
        <div className="flex gap-2 mb-2">
          <Button
            type="button"
            variant={payType === "advance" ? "default" : "outline"}
            onClick={() => setPayType("advance")}
            className={payType === "advance" ? "bg-green-700 hover:bg-green-800" : ""}
          >
            Advance Payment (10%)
          </Button>
          <Button
            type="button"
            variant={payType === "full" ? "default" : "outline"}
            onClick={() => setPayType("full")}
            className={payType === "full" ? "bg-green-700 hover:bg-green-800" : ""}
          >
            Full Payment (100%)
          </Button>
        </div>
      </div>

      {/* Payment Method */}
      <div className="space-y-2">
        <Label>Payment Method</Label>
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 flex items-center">
          💳 Online Payment Only (via Razorpay)
        </div>
      </div>

      {/* Price Preview */}
      {selectedItem && qty > 0 && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2 text-sm">
          {/* Billing breakdown */}
          <div className="flex justify-between">
            <span className="text-gray-600">Ordered Quantity:</span>
            <span className="font-semibold">{qty} plants</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total Amount:</span>
            <span className="font-semibold">₹{totalAmount.toLocaleString("en-IN")}</span>
          </div>

          {/* Replacement plants highlight */}
          {replacementQty > 0 && (
            <div className="flex items-start justify-between bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 mt-1">
              <div>
                <p className="text-emerald-700 font-semibold text-xs uppercase tracking-wide">🌱 Free Replacement Plants</p>
                <p className="text-emerald-600 text-xs mt-0.5">10% buffer — no extra charge</p>
              </div>
              <span className="text-emerald-700 font-bold text-base">+{replacementQty}</span>
            </div>
          )}

          <div className="flex justify-between font-semibold border-t pt-2 mt-1">
            <span className="text-gray-700">📦 Total Plants to be Delivered:</span>
            <span className="text-green-700">{totalDelivered}</span>
          </div>

          <div className="flex justify-between text-green-700 font-medium border-t pt-2">
            <span>{payType === "full" ? "Pay Now (Full):" : "Advance Now (10%):"}</span>
            <span>₹{checkoutAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-gray-400 text-xs">
            <span>Balance at Delivery:</span>
            <span>₹{balanceAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          <p className="text-xs text-gray-400">
            💳 Razorpay will open for ₹{checkoutAmount.toFixed(2)}.
          </p>
        </div>
      )}

      {/* Status Message */}
      {msg && (
        <div
          className={`p-4 rounded-md text-sm font-medium transition-all flex flex-col ${
            msg.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          <span>{msg.text}</span>
          {msg.waUrl && (
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              {msg.localPdfUrl && (
                <a 
                  href={msg.localPdfUrl}
                  download={`Receipt_${msg.bookingId?.slice(0,8) || "new"}.pdf`}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md transition-colors font-semibold shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  Download PDF
                </a>
              )}
              <a 
                href={msg.waUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-md transition-colors font-semibold shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                </svg>
                Send WhatsApp Confirmation
              </a>
            </div>
          )}
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
          ? `Pay ₹${checkoutAmount.toFixed(2)} & Generate Booking`
          : "Generate Booking"}
      </Button>
    </div>
  );
}
