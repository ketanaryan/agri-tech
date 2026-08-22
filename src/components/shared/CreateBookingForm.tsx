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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

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
  advance_percentage?: number;
  harvest_rate?: number;
}

interface CreateBookingFormProps {
  farmers: Farmer[];
  items: Item[];
  mode?: "new" | "existing" | "both";
  dealerQrCodeUrl?: string | null;
  dealerInvoiceSettings?: {
    companyName: string;
    gst: string;
    address: string;
  } | null;
}

export function CreateBookingForm({
  farmers,
  items,
  mode = "both",
  dealerQrCodeUrl,
  dealerInvoiceSettings,
}: CreateBookingFormProps) {
  const [farmerMode, setFarmerMode] = useState<"existing" | "new">(mode === "new" ? "new" : "existing");
  const [farmerId, setFarmerId] = useState("");

  
  // New Farmer State
  const [newFarmerName, setNewFarmerName] = useState("");
  const [newFarmerPhone, setNewFarmerPhone] = useState("");
  const [newFarmerAddress, setNewFarmerAddress] = useState("");
  const [newFarmerAltPhone, setNewFarmerAltPhone] = useState("");
  const [newFarmerLandSize, setNewFarmerLandSize] = useState("");
  const [newFarmerLandUnit, setNewFarmerLandUnit] = useState("acres");
  const [newFarmerLandType, setNewFarmerLandType] = useState("");

  // Photo Upload State
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Multi-item order lines
  interface OrderLine { itemId: string; qtyStr: string; }
  const [orderLines, setOrderLines] = useState<OrderLine[]>([{ itemId: "", qtyStr: "1" }]);
  const payMethod = "online";
  const [payType, setPayType] = useState<"advance" | "full">("advance");
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error"; waUrl?: string; localPdfUrl?: string; bookingId?: string } | null>(null);
  const [paying, setPaying] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showQrModal, setShowQrModal] = useState(false);

  const updateOrderLine = (index: number, field: keyof OrderLine, value: string) => {
    setOrderLines(prev => prev.map((line, i) => i === index ? { ...line, [field]: value } : line));
  };
  const addOrderLine = () => {
    setOrderLines(prev => [...prev, { itemId: "", qtyStr: "1" }]);
  };
  const removeOrderLine = (index: number) => {
    if (orderLines.length <= 1) return;
    setOrderLines(prev => prev.filter((_, i) => i !== index));
  };

  const selectedFarmer = farmers.find((f) => f.id === farmerId);

  // Compute per-line and combined totals
  const lineSummaries = orderLines.map((line) => {
    const item = items.find((i) => i.id === line.itemId);
    const qty = parseInt(line.qtyStr, 10) || 0;
    if (!item || qty <= 0) return null;
    const lineTotal = item.rate_per_unit * qty;
    const advPct = item.advance_percentage ?? 10;
    const harvestAmt = (item.harvest_rate || 0) * qty;
    const checkout = payType === "full" ? (lineTotal - harvestAmt) : Math.round(lineTotal * (advPct / 100) * 100) / 100;
    const balance = Math.round((lineTotal - checkout - harvestAmt) * 100) / 100;
    const isAnarLine = /anar|annar|pomegranate/i.test(item.name || "");
    const replQty = (qty > 0 && !isAnarLine) ? Math.floor(qty * 0.1) : 0;
    return { item, qty, lineTotal, advPct, harvestAmt, checkout, balance, isAnarLine, replQty, totalDelivered: qty + replQty };
  });
  const validLines = lineSummaries.filter(Boolean) as NonNullable<(typeof lineSummaries)[number]>[];

  const totalAmount = validLines.reduce((s, l) => s + l.lineTotal, 0);
  const checkoutAmount = validLines.reduce((s, l) => s + l.checkout, 0);
  const balanceAmount = validLines.reduce((s, l) => s + l.balance, 0);
  const harvestAmount = validLines.reduce((s, l) => s + l.harvestAmt, 0);
  const totalQty = validLines.reduce((s, l) => s + l.qty, 0);
  const totalReplacementQty = validLines.reduce((s, l) => s + l.replQty, 0);
  const totalDelivered = totalQty + totalReplacementQty;

  // For backward compat in single-line cases
  const firstLine = orderLines[0];
  const itemId = firstLine?.itemId || "";
  const selectedItem = items.find((i) => i.id === itemId);
  const qty = parseInt(firstLine?.qtyStr || "0", 10) || 0;
  const advancePercent = selectedItem?.advance_percentage ?? 10;
  const hasValidItems = validLines.length > 0;

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



  const createBookingInDB = async (paymentData?: {
    gateway_order_id?: string;
    method?: string;
    payment_receipt_url?: string;
    utr_number?: string;
  }) => {
    const methodToUse = paymentData?.method || payMethod;
    
    // Create one booking per order line
    const bookingResults: { bookingId: string; itemName: string; qty: number; lineTotal: number; checkout: number; balance: number; harvestAmt: number; replQty: number; totalDelivered: number; advPct: number }[] = [];
    let resolvedFarmerId = farmerMode === "existing" ? farmerId : undefined;
    let resolvedFarmerUniqueId = farmerMode === "existing" ? selectedFarmer?.unique_id : undefined;
    let currentFarmerMode: "existing" | "new" = farmerMode;

    for (let i = 0; i < validLines.length; i++) {
      const line = validLines[i];
      const bookRes = await fetch("/api/bookings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmerMode: currentFarmerMode,
          farmerId: currentFarmerMode === "existing" ? resolvedFarmerId : undefined,
          newFarmerData: currentFarmerMode === "new" ? {
            name: newFarmerName,
            phone: newFarmerPhone,
            address: newFarmerAddress,
            photo_url: photoUrl,
            alternate_phone: newFarmerAltPhone,
            land_size: newFarmerLandSize ? parseFloat(newFarmerLandSize) : null,
            land_unit: newFarmerLandUnit || "acres",
            land_type: newFarmerLandType || null,
          } : undefined,
          itemId: line.item.id,
          qty: line.qty,
          paymentMethod: methodToUse,
          paymentType: payType,
          ...paymentData,
        }),
      });
      const bookData = await bookRes.json();
      if (!bookRes.ok || bookData.error) {
        setMsg({ text: `Booking failed for ${line.item.name}: ${bookData.error}`, type: "error" });
        setPaying(false);
        return;
      }
      bookingResults.push({
        bookingId: bookData.bookingId,
        itemName: line.item.name,
        qty: line.qty,
        lineTotal: line.lineTotal,
        checkout: line.checkout,
        balance: line.balance,
        harvestAmt: line.harvestAmt,
        replQty: line.replQty,
        totalDelivered: line.totalDelivered,
        advPct: line.advPct,
      });
      // After first booking with new farmer, switch to existing mode
      if (currentFarmerMode === "new" && bookData.farmerId) {
        resolvedFarmerId = bookData.farmerId;
        resolvedFarmerUniqueId = bookData.finalFarmerUniqueId;
        currentFarmerMode = "existing";
      }
      if (!resolvedFarmerUniqueId && bookData.finalFarmerUniqueId) {
        resolvedFarmerUniqueId = bookData.finalFarmerUniqueId;
      }
    }

    // All bookings created successfully
    const fName = farmerMode === "existing" ? selectedFarmer?.name : newFarmerName;
    const fPhone = farmerMode === "existing" ? selectedFarmer?.phone : newFarmerPhone;
    const fUid = resolvedFarmerUniqueId || "Processing";
    const firstBookingId = bookingResults[0]?.bookingId;

    // Generate PDF Receipt
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    
    let currentY = 20;
    
    if (dealerInvoiceSettings?.companyName) {
      doc.setFontSize(22);
      doc.setTextColor(22, 163, 74);
      doc.text(dealerInvoiceSettings.companyName, 20, currentY);
      currentY += 8;
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      if (dealerInvoiceSettings.address) {
        doc.text(dealerInvoiceSettings.address, 20, currentY);
        currentY += 6;
      }
      if (dealerInvoiceSettings.gst) {
        doc.text(`GSTIN: ${dealerInvoiceSettings.gst}`, 20, currentY);
        currentY += 6;
      }
      currentY += 4;
    } else {
      doc.setFontSize(22);
      doc.setTextColor(22, 163, 74);
      doc.text("Bio Eagle Petroleum Pvt Ltd - Official Receipt", 20, currentY);
      currentY += 10;
    }

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, currentY);
    currentY += 8;
    const bookingIdsStr = bookingResults.map(b => b.bookingId?.slice(0, 8)).join(", ");
    doc.text(`Booking ID(s): ${bookingIdsStr || "N/A"}`, 20, currentY);
    currentY += 12;
    
    doc.setFontSize(14);
    doc.setTextColor(50, 50, 50);
    doc.text("Farmer Details:", 20, currentY);
    currentY += 8;
    doc.setFontSize(12);
    doc.text(`Name: ${fName}`, 20, currentY);
    currentY += 8;
    doc.text(`Farmer ID: ${fUid}`, 20, currentY);
    currentY += 8;
    doc.text(`Phone: ${fPhone}`, 20, currentY);
    currentY += 16;

    doc.setFontSize(14);
    doc.text("Order Summary:", 20, currentY);
    currentY += 8;
    doc.setFontSize(12);

    for (const br of bookingResults) {
      doc.setTextColor(0, 0, 0);
      doc.text(`• ${br.itemName}: ${br.qty} plants — Rs. ${br.lineTotal.toFixed(2)}`, 20, currentY);
      currentY += 7;
      if (br.replQty > 0) {
        doc.setFontSize(10);
        doc.setTextColor(21, 128, 61);
        doc.text(`  + ${br.replQty} free replacement plants`, 24, currentY);
        currentY += 6;
        doc.setFontSize(12);
      }
    }
    currentY += 4;

    doc.setTextColor(0, 0, 0);
    doc.text(`Total Ordered: ${totalQty} plants`, 20, currentY);
    currentY += 8;
    doc.text(`Total Amount: Rs. ${totalAmount.toFixed(2)}`, 20, currentY);
    currentY += 8;

    if (totalReplacementQty > 0) {
      doc.setFontSize(11);
      doc.setTextColor(21, 128, 61);
      doc.text(`Total Replacement Plants: ${totalReplacementQty} (Free)`, 20, currentY);
      currentY += 7;
    }
    doc.setTextColor(21, 128, 61);
    doc.setFontSize(11);
    doc.text(`Total Plants to be Delivered: ${totalDelivered} plants`, 20, currentY);
    currentY += 12;

    doc.setFontSize(12);
    doc.setTextColor(22, 163, 74);
    doc.text(`${payType === "full" ? "Full Payment" : "Advance Paid"}: Rs. ${checkoutAmount.toFixed(2)}`, 20, currentY);
    currentY += 8;
    
    doc.setTextColor(220, 38, 38);
    doc.text(`Balance Due at Delivery: Rs. ${(balanceAmount + harvestAmount).toFixed(2)}`, 20, currentY);
    currentY += 8;
    
    currentY += 4;
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(10);
    doc.text("This is an electronically generated receipt.", 20, currentY);

    const pdfBlob = doc.output('blob');
    const localPdfUrl = URL.createObjectURL(pdfBlob);

    // Upload PDF
    let publicReceiptUrl = "";
    try {
      const fd = new FormData();
      fd.append("receipt", pdfBlob, `receipt_${firstBookingId}.pdf`);
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

    // WhatsApp message
    const itemsSummary = bookingResults.map(br => {
      let line = `📦 ${br.itemName}: ${br.qty} plants`;
      if (br.replQty > 0) line += ` (+${br.replQty} free)`;
      return line;
    }).join("\n");

    let waText = `Hello ${fName},\nYour Bio Eagle Petroleum Booking is Confirmed! 🌱\n\nFarmer ID: ${fUid}\n\n${itemsSummary}\n\n✅ Total Delivery: ${totalDelivered} plants\n\n💰 ${payType === "full" ? "Total Paid" : "Advance Paid"}: ₹${checkoutAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n💵 Balance Due at Delivery: ₹${(balanceAmount + harvestAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}\n`;
    if (publicReceiptUrl) {
       waText += `\n📄 Download Receipt: ${publicReceiptUrl}\n`;
    }
    waText += `\nThank you for choosing us! 🙏`;

    const waUrl = `https://wa.me/91${fPhone}?text=${encodeURIComponent(waText)}`;

    setMsg({
      text: `✅ ${bookingResults.length > 1 ? `${bookingResults.length} bookings` : "Booking"} created! ${payType === "full" ? "Full payment" : "Advance"} of ₹${checkoutAmount.toFixed(2)} paid (Online). ID(s): ${bookingIdsStr}`,
      type: "success",
      waUrl,
      localPdfUrl,
      bookingId: firstBookingId
    });
    // Reset form
    setFarmerId("");
    setNewFarmerName("");
    setNewFarmerPhone("");
    setNewFarmerAddress("");
    setPhotoPreview(null);
    setPhotoUrl("");
    setOrderLines([{ itemId: "", qtyStr: "1" }]);
    setNewFarmerLandSize("");
    setNewFarmerLandUnit("acres");
    setNewFarmerLandType("");
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
    if (!hasValidItems) {
      setMsg({ text: "Please select at least one item with a valid quantity.", type: "error" });
      return;
    }
    // Validate all lines have items selected
    for (const line of orderLines) {
      if (line.itemId && (parseInt(line.qtyStr, 10) || 0) <= 0) {
        const item = items.find(i => i.id === line.itemId);
        setMsg({ text: `Please enter a valid quantity for ${item?.name || "selected item"}.`, type: "error" });
        return;
      }
    }

    setPaying(true);
    setMsg(null);

    try {
      if (checkoutAmount === 0) {
        // If there's no advance payment to collect, bypass the QR modal
        startTransition(async () => {
          await createBookingInDB({
            gateway_order_id: "no_payment_required",
            method: "none",
            payment_receipt_url: undefined,
            utr_number: undefined,
          });
        });
      } else {
        // Show QR Modal to collect payment
        setShowQrModal(true);
      }
      return;
    } catch (err: any) {
      setMsg({ text: err?.message ?? "An unexpected error occurred.", type: "error" });
      setPaying(false);
    }
  };

  const handleManualQrPaid = () => {
    setShowQrModal(false);
    startTransition(async () => {
      await createBookingInDB({
        gateway_order_id: "qr_payment",
        method: "qr",
      });
    });
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
            <div className="space-y-2">
              <Label htmlFor="newFarmerAltPhone">Alternate Phone (Optional)</Label>
              <Input
                id="newFarmerAltPhone"
                value={newFarmerAltPhone}
                onChange={(e) => setNewFarmerAltPhone(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="9876543211"
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

            {/* Land Details Section */}
            <div className="md:col-span-2 border-t pt-4 mt-2">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">🌾 Land Details</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newFarmerLandSize">Land Size</Label>
                  <Input
                    id="newFarmerLandSize"
                    value={newFarmerLandSize}
                    onChange={(e) => setNewFarmerLandSize(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="e.g. 2.5"
                    inputMode="decimal"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newFarmerLandUnit">Unit</Label>
                  <Select value={newFarmerLandUnit} onValueChange={(v) => { if (v) setNewFarmerLandUnit(v); }}>
                    <SelectTrigger id="newFarmerLandUnit">
                      <SelectValue placeholder="Select unit" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="acres">Acres</SelectItem>
                      <SelectItem value="hectares">Hectares</SelectItem>
                      <SelectItem value="bigha">Bigha</SelectItem>
                      <SelectItem value="guntha">Guntha</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newFarmerLandType">Land Type</Label>
                  <Select value={newFarmerLandType} onValueChange={(v) => { if (v) setNewFarmerLandType(v); }}>
                    <SelectTrigger id="newFarmerLandType">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="irrigated">Irrigated</SelectItem>
                      <SelectItem value="rainfed">Rainfed (Non-irrigated)</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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

      {/* Item(s) Selection */}
      <div className="space-y-3">
        <Label>Select Item(s)</Label>
        {orderLines.map((line, idx) => {
          const lineItem = items.find(i => i.id === line.itemId);
          return (
            <div key={idx} className="flex gap-2 items-end">
              <div className="flex-1 space-y-1">
                {idx === 0 && <span className="text-xs text-gray-500">Item</span>}
                <Select value={line.itemId} onValueChange={(v) => updateOrderLine(idx, "itemId", v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an item">
                      {line.itemId && lineItem ? `${lineItem.name} — ₹${lineItem.rate_per_unit}` : null}
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
              <div className="w-24 space-y-1">
                {idx === 0 && <span className="text-xs text-gray-500">Qty</span>}
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Qty"
                  value={line.qtyStr}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, "");
                    updateOrderLine(idx, "qtyStr", val);
                  }}
                />
              </div>
              {orderLines.length > 1 && (
                <Button type="button" variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50 shrink-0" onClick={() => removeOrderLine(idx)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </Button>
              )}
            </div>
          );
        })}
        <Button type="button" variant="outline" size="sm" className="w-full border-dashed text-green-700 hover:bg-green-50" onClick={addOrderLine}>
          + Add Another Item
        </Button>
      </div>

      {/* Payment Method */}
      <div className="space-y-2">
        <Label>Payment Method</Label>
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 flex items-center">
          💳 Pay via Dealer QR Code
        </div>
      </div>

      {/* Price Preview */}
      {hasValidItems && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-2 text-sm">
          {/* Per-item breakdown */}
          {validLines.map((line, idx) => (
            <div key={idx} className="flex justify-between">
              <span className="text-gray-600">{line.item.name} × {line.qty}:</span>
              <span className="font-semibold">₹{line.lineTotal.toLocaleString("en-IN")}</span>
            </div>
          ))}

          {validLines.length > 1 && (
            <div className="flex justify-between border-t pt-1">
              <span className="text-gray-600">Total Amount:</span>
              <span className="font-semibold">₹{totalAmount.toLocaleString("en-IN")}</span>
            </div>
          )}

          {/* Replacement plants highlight */}
          {totalReplacementQty > 0 && (
            <div className="flex items-start justify-between bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 mt-1">
              <div>
                <p className="text-emerald-700 font-semibold text-xs uppercase tracking-wide">🌱 Free Replacement Plants (Moringa Only)</p>
                <p className="text-emerald-600 text-xs mt-0.5">10% buffer — no extra charge (not applicable for Anar)</p>
              </div>
              <span className="text-emerald-700 font-bold text-base">+{totalReplacementQty}</span>
            </div>
          )}

          <div className="flex justify-between font-semibold border-t pt-2 mt-1">
            <span className="text-gray-700">📦 Total Plants to be Delivered:</span>
            <span className="text-green-700">{totalDelivered}</span>
          </div>

          <div className="flex justify-between text-green-700 font-medium border-t pt-2">
            <span>{payType === "full" ? "Pay Now (Full):" : "Advance Now:"}</span>
            <span>₹{checkoutAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between text-gray-500 font-medium text-xs mt-1">
            <span>Balance at Delivery:</span>
            <span>₹{(balanceAmount + harvestAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span>
          </div>
          <p className="text-xs text-gray-400">
            📷 A QR code will be displayed for manual payment verification.
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
          !hasValidItems ||
          (uploading) ||
          (farmerMode === "existing" && !farmerId) ||
          (farmerMode === "new" && (!newFarmerName || !newFarmerPhone))
        }
        className="w-full bg-green-600 hover:bg-green-700"
      >
        {paying || isPending || uploading
          ? "Processing..."
          : hasValidItems
          ? `Pay ₹${checkoutAmount.toFixed(2)} & Generate ${validLines.length > 1 ? `${validLines.length} Bookings` : "Booking"}`
          : "Generate Booking"}
      </Button>

      <Dialog open={showQrModal} onOpenChange={setShowQrModal}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Complete Payment via QR</DialogTitle>
            <DialogDescription>
              Please scan the QR code below to pay ₹{checkoutAmount.toFixed(2)}. Once paid, click "Payment Done".
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center p-2 space-y-4">
            {dealerQrCodeUrl ? (
              <div className="w-64 h-64 border-4 border-green-500 rounded-xl bg-gray-50 flex items-center justify-center p-2 relative overflow-hidden">
                <Image src={dealerQrCodeUrl} fill alt="Dealer QR Code" className="object-contain" />
              </div>
            ) : (
              <div className="w-64 h-64 border-4 border-dashed border-gray-300 rounded-xl bg-gray-50 flex flex-col items-center justify-center p-4 text-center text-gray-500">
                 No QR Code found for this Dealer. Please pay directly and attach receipt.
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setShowQrModal(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleManualQrPaid} disabled={isPending}>
              {isPending ? "Processing..." : "Payment Done"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
