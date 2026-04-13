"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { submitPlantReport } from "@/actions/plant-report";
import { Camera, Loader2, X, AlertTriangle } from "lucide-react";

interface Pesticide {
  id: string;
  name: string;
  unit: string;
  current_stock: number;
  low_stock_threshold: number;
}

export function PlantReportForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [lowStockAlert, setLowStockAlert] = useState<{ name: string; remaining: number; unit: string } | null>(null);

  // Form State
  const [farmerId, setFarmerId] = useState("");
  const [plantsDelivered, setPlantsDelivered] = useState("");
  const [status, setStatus] = useState("Delivered");
  const [pesticideGiven, setPesticideGiven] = useState("no");
  const [remarks, setRemarks] = useState("");

  // Pesticide tracking fields
  const [pesticides, setPesticides] = useState<Pesticide[]>([]);
  const [pesticideId, setPesticideId] = useState("");
  const [pesticideQty, setPesticideQty] = useState("");
  const [loadingPesticides, setLoadingPesticides] = useState(false);

  // Files
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Fetch pesticides on mount
  useEffect(() => {
    const fetchPesticides = async () => {
      setLoadingPesticides(true);
      try {
        const res = await fetch("/api/pesticides");
        const data = await res.json();
        if (res.ok) setPesticides(data.pesticides ?? []);
      } catch {
        // silently fail — pesticide section will just be empty
      } finally {
        setLoadingPesticides(false);
      }
    };
    fetchPesticides();
  }, []);

  const selectedPesticide = pesticides.find((p) => p.id === pesticideId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const newFiles = [...files, ...selectedFiles].slice(0, 3);
      setFiles(newFiles);
      const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
      setPreviewUrls(newPreviews);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
    const newPreviews = [...previewUrls];
    newPreviews.splice(index, 1);
    setPreviewUrls(newPreviews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    setLowStockAlert(null);
    setUploadingFiles(true);

    try {
      // 1. Upload photos first
      let uploadedPhotoUrls: string[] = [];
      for (const file of files) {
        const formData = new FormData();
        formData.append("photo", file);
        const res = await fetch("/api/upload-plant-photo", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to upload photo");
        }
        const data = await res.json();
        uploadedPhotoUrls.push(data.url);
      }
      setUploadingFiles(false);

      // 2. Submit form data
      const formData = new FormData();
      formData.append("farmer_id", farmerId);
      formData.append("plants_delivered", plantsDelivered);
      formData.append("status", status);
      formData.append("pesticide_given", pesticideGiven);
      formData.append("remarks", remarks);
      formData.append("photos", JSON.stringify(uploadedPhotoUrls));

      // Pesticide tracking
      if (pesticideGiven === "yes" && pesticideId) {
        formData.append("pesticide_id", pesticideId);
        formData.append("pesticide_quantity", pesticideQty);
      }

      const result = await submitPlantReport(formData);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Show low stock alert if returned
      if (result.lowStockAlert) {
        setLowStockAlert(result.lowStockAlert);
      }

      setSuccessMsg("✅ Plant report submitted successfully!");

      // Reset form
      setFarmerId("");
      setPlantsDelivered("");
      setStatus("Delivered");
      setPesticideGiven("no");
      setPesticideId("");
      setPesticideQty("");
      setRemarks("");
      setFiles([]);
      setPreviewUrls([]);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred");
      setUploadingFiles(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md border border-red-200">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="p-3 text-sm text-green-700 bg-green-50 rounded-md border border-green-200">
          {successMsg}
        </div>
      )}

      {/* Low Stock Alert Banner */}
      {lowStockAlert && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-300 rounded-lg text-amber-800">
          <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-sm">⚠️ Low Pesticide Stock Alert</p>
            <p className="text-sm mt-0.5">
              <strong>{lowStockAlert.name}</strong> is now low:{" "}
              <span className="font-bold text-amber-700">
                {lowStockAlert.remaining} {lowStockAlert.unit}
              </span>{" "}
              remaining. Please inform Admin to restock.
            </p>
          </div>
        </div>
      )}

      {/* Farmer ID */}
      <div className="space-y-2">
        <Label htmlFor="farmerId">Farmer ID</Label>
        <Input
          id="farmerId"
          placeholder="Enter Farmer ID (e.g., BPFRM1234)"
          value={farmerId}
          onChange={(e) => setFarmerId(e.target.value)}
          required
        />
      </div>

      {/* Plants Delivered + Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="plantsDelivered">Number of Plants Delivered (Ordered)</Label>
          <Input
            id="plantsDelivered"
            type="number"
            min="1"
            placeholder="Enter ordered quantity"
            value={plantsDelivered}
            onChange={(e) => setPlantsDelivered(e.target.value)}
            required
          />
          {/* Replacement plant breakdown */}
          {parseInt(plantsDelivered, 10) > 0 && (() => {
            const ordered = parseInt(plantsDelivered, 10);
            const replacement = Math.floor(ordered * 0.1);
            const total = ordered + replacement;
            return (
              <div className="flex items-center gap-3 mt-1 p-2.5 bg-emerald-50 border border-emerald-200 rounded-md text-xs">
                <span className="text-emerald-700">🌱</span>
                <div className="flex gap-4 flex-wrap">
                  <span className="text-gray-600">Ordered: <strong className="text-gray-900">{ordered}</strong></span>
                  <span className="text-emerald-600">+ Replacement (10%): <strong>{replacement}</strong></span>
                  <span className="text-gray-700 font-semibold">📦 Total Delivered: {total}</span>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={(val) => setStatus(val || "")}>
            <SelectTrigger>
              <SelectValue placeholder="Select Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Delivered">Delivered</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pesticide Given */}
      <div className="space-y-3">
        <Label>Pesticide Given</Label>
        <RadioGroup
          defaultValue="no"
          value={pesticideGiven}
          onValueChange={(v) => {
            setPesticideGiven(v);
            if (v === "no") {
              setPesticideId("");
              setPesticideQty("");
            }
          }}
          className="flex items-center space-x-4"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="yes" id="pes-yes" />
            <Label htmlFor="pes-yes" className="font-normal">Yes</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="no" id="pes-no" />
            <Label htmlFor="pes-no" className="font-normal">No</Label>
          </div>
        </RadioGroup>

        {/* Pesticide Details — show only if yes */}
        {pesticideGiven === "yes" && (
          <div className="border border-emerald-200 bg-emerald-50 rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">🧪 Pesticide Usage Details</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pesticideId">Select Pesticide</Label>
                {loadingPesticides ? (
                  <p className="text-xs text-gray-500">Loading pesticides...</p>
                ) : pesticides.length === 0 ? (
                  <p className="text-xs text-amber-600">⚠️ No pesticides in inventory. Ask Admin to add.</p>
                ) : (
                  <Select value={pesticideId} onValueChange={(v) => setPesticideId(v ?? "")}>
                    <SelectTrigger id="pesticideId">
                      <SelectValue placeholder="Select pesticide" />
                    </SelectTrigger>
                    <SelectContent>
                      {pesticides.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.current_stock} {p.unit} left)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pesticideQty">
                  Quantity Used {selectedPesticide ? `(${selectedPesticide.unit})` : ""}
                </Label>
                <Input
                  id="pesticideQty"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="e.g. 2.5"
                  value={pesticideQty}
                  onChange={(e) => setPesticideQty(e.target.value)}
                  required={pesticideGiven === "yes" && !!pesticideId}
                />
              </div>
            </div>

            {/* Current stock info */}
            {selectedPesticide && (
              <div className="flex items-center gap-2 text-xs">
                <span className={selectedPesticide.current_stock <= selectedPesticide.low_stock_threshold
                  ? "text-red-600 font-semibold" : "text-gray-500"}>
                  📦 Current stock: <strong>{selectedPesticide.current_stock} {selectedPesticide.unit}</strong>
                  {selectedPesticide.current_stock <= selectedPesticide.low_stock_threshold && " ⚠️ LOW"}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Remarks */}
      <div className="space-y-2">
        <Label htmlFor="remarks">Remarks</Label>
        <Textarea
          id="remarks"
          placeholder="Add any additional notes or observations"
          className="min-h-[100px]"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </div>

      {/* Photos */}
      <div className="space-y-2">
        <Label>Upload Photos (2-3 photos)</Label>
        {files.length < 3 && (
          <div className="mt-2 flex justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10 hover:bg-gray-50 transition-colors">
            <div className="text-center">
              <Camera className="mx-auto h-12 w-12 text-gray-300" aria-hidden="true" />
              <div className="mt-4 flex text-sm leading-6 text-gray-600 justify-center">
                <label
                  htmlFor="file-upload"
                  className="relative cursor-pointer rounded-md bg-white font-semibold text-green-600 focus-within:outline-none focus-within:ring-2 focus-within:ring-green-600 focus-within:ring-offset-2 hover:text-green-500"
                >
                  <span>Upload a file</span>
                  <input id="file-upload" name="file-upload" type="file" className="sr-only" multiple accept="image/*" onChange={handleFileChange} />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs leading-5 text-gray-600">PNG, JPG, up to 5MB</p>
            </div>
          </div>
        )}

        {previewUrls.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mt-4">
            {previewUrls.map((url, index) => (
              <div key={index} className="relative group">
                <img src={url} alt={`Preview ${index}`} className="h-24 w-full object-cover rounded-md border" />
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Submit */}
      <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {uploadingFiles ? "Uploading photos..." : "Submitting report..."}
          </>
        ) : (
          "Submit Report"
        )}
      </Button>
    </form>
  );
}
