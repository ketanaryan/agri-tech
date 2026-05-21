"use client";

import { useState, useRef, useTransition } from "react";
import { registerFarmer } from "@/actions/bookings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";

export function RegisterFarmerForm() {
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitMsg(null);

    const formData = new FormData(formRef.current!);
    // Inject the uploaded photo URL
    formData.set("photo_url", photoUrl);

    startTransition(async () => {
      const result = await registerFarmer(formData);
      if (result?.error) {
        setSubmitMsg(`❌ ${result.error}`);
      } else {
        setSubmitMsg("✅ Farmer registered successfully!");
        formRef.current?.reset();
        setPhotoPreview(null);
        setPhotoUrl("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {/* Farmer Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Farmer Name</Label>
        <Input id="name" name="name" placeholder="John Doe" required />
      </div>

      {/* Phone */}
      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input
          id="phone"
          name="phone"
          placeholder="9876543210"
          pattern="[0-9]{10}"
          maxLength={10}
          title="Enter exactly 10 digits"
          inputMode="numeric"
          required
        />
      </div>

      {/* Address */}
      <div className="space-y-2">
        <Label htmlFor="address">Address / Village</Label>
        <Input id="address" name="address" placeholder="Village Name" />
      </div>

      {/* Alternate Phone */}
      <div className="space-y-2">
        <Label htmlFor="alternate_phone">Alternate Phone (Optional)</Label>
        <Input
          id="alternate_phone"
          name="alternate_phone"
          placeholder="9876543211"
          pattern="[0-9]{10}"
          maxLength={10}
          title="Enter exactly 10 digits if provided"
          inputMode="numeric"
        />
      </div>

      {/* PAN Card */}
      <div className="space-y-2">
        <Label htmlFor="pan_card">PAN Card Number</Label>
        <Input
          id="pan_card"
          name="pan_card"
          placeholder="ABCDE1234F"
          maxLength={10}
          style={{ textTransform: 'uppercase' }}
          required
        />
      </div>

      {/* Aadhar Card */}
      <div className="space-y-2">
        <Label htmlFor="aadhar_card">Aadhar Card Number</Label>
        <Input
          id="aadhar_card"
          name="aadhar_card"
          placeholder="123456789012"
          pattern="[0-9]{12}"
          maxLength={12}
          title="Enter exactly 12 digits"
          inputMode="numeric"
          required
        />
      </div>

      <div className="pt-4 border-t border-gray-100">
        <h3 className="text-sm font-bold text-green-800 uppercase tracking-wider mb-4">Crop Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-2">
            <Label htmlFor="crop_type">Crop Type</Label>
            <Input id="crop_type" name="crop_type" placeholder="e.g. Wheat, Cotton, Sugarcane" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="growth_stage">Growth Stage</Label>
            <select
              id="growth_stage"
              name="growth_stage"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select stage</option>
              <option value="Seedling">Seedling</option>
              <option value="Vegetative">Vegetative</option>
              <option value="Flowering">Flowering</option>
              <option value="Fruiting">Fruiting</option>
              <option value="Mature/Harvest">Mature / Harvest</option>
            </select>
          </div>
        </div>

        <div className="space-y-2 mb-6">
          <Label>Overall Health Status</Label>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center space-x-2 border rounded-lg px-4 py-2 cursor-pointer hover:bg-green-50 has-[:checked]:bg-green-50 has-[:checked]:border-green-600 transition-colors">
              <input type="radio" name="health_status" value="Good" className="text-green-600 focus:ring-green-600" />
              <span className="text-sm font-medium">✅ Good</span>
            </label>
            <label className="flex items-center space-x-2 border rounded-lg px-4 py-2 cursor-pointer hover:bg-yellow-50 has-[:checked]:bg-yellow-50 has-[:checked]:border-yellow-500 transition-colors">
              <input type="radio" name="health_status" value="Fair" className="text-yellow-600 focus:ring-yellow-500" />
              <span className="text-sm font-medium">⚠️ Fair</span>
            </label>
            <label className="flex items-center space-x-2 border rounded-lg px-4 py-2 cursor-pointer hover:bg-red-50 has-[:checked]:bg-red-50 has-[:checked]:border-red-600 transition-colors">
              <input type="radio" name="health_status" value="Poor" className="text-red-600 focus:ring-red-600" />
              <span className="text-sm font-medium">🚨 Poor</span>
            </label>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wider mb-4">Irrigation Status</h3>
        
        <div className="space-y-2 mb-4">
          <Label>Current Irrigation Status</Label>
          <div className="flex flex-wrap gap-4 pt-1">
            <label className="flex items-center space-x-2 border rounded-lg px-4 py-2 cursor-pointer hover:bg-blue-50 has-[:checked]:bg-blue-50 has-[:checked]:border-blue-600 transition-colors">
              <input type="radio" name="irrigation_status" value="Adequate" className="text-blue-600 focus:ring-blue-600" />
              <span className="text-sm font-medium">💧 Adequate</span>
            </label>
            <label className="flex items-center space-x-2 border rounded-lg px-4 py-2 cursor-pointer hover:bg-orange-50 has-[:checked]:bg-orange-50 has-[:checked]:border-orange-500 transition-colors">
              <input type="radio" name="irrigation_status" value="Deficit" className="text-orange-600 focus:ring-orange-500" />
              <span className="text-sm font-medium">🏜️ Deficit</span>
            </label>
            <label className="flex items-center space-x-2 border rounded-lg px-4 py-2 cursor-pointer hover:bg-cyan-50 has-[:checked]:bg-cyan-50 has-[:checked]:border-cyan-500 transition-colors">
              <input type="radio" name="irrigation_status" value="Excess" className="text-cyan-600 focus:ring-cyan-500" />
              <span className="text-sm font-medium">🌊 Excess</span>
            </label>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <Label htmlFor="irrigation_source">Irrigation Source</Label>
          <Input id="irrigation_source" name="irrigation_source" placeholder="e.g. Borewell, Canal, Rainfed" />
        </div>
      </div>

      {/* Photo Upload */}
      <div className="space-y-2">
        <Label>Farmer Photo</Label>

        {/* Preview */}
        {photoPreview && (
          <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-green-600 shadow-md mx-auto">
            <Image
              src={photoPreview}
              alt="Farmer Preview"
              fill
              className="object-cover"
            />
          </div>
        )}

        {/* Drop Zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center border-2 border-dashed border-green-300 rounded-xl p-5 cursor-pointer hover:border-green-500 hover:bg-green-50 transition-all"
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-green-700">
              <svg
                className="animate-spin h-8 w-8"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <span className="text-sm font-medium">Uploading photo…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1 text-gray-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-10 w-10 text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <span className="text-sm font-medium text-green-700">
                {photoUrl ? "✅ Photo uploaded — click to change" : "Click to upload farmer photo"}
              </span>
              <span className="text-xs text-gray-400">JPG, PNG, WebP · Max 5MB</span>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />

        {uploadError && (
          <p className="text-xs text-red-600 font-medium">{uploadError}</p>
        )}
      </div>

      {/* Status Message */}
      {submitMsg && (
        <p
          className={`text-sm font-medium ${
            submitMsg.startsWith("✅") ? "text-green-700" : "text-red-600"
          }`}
        >
          {submitMsg}
        </p>
      )}

      <Button
        type="submit"
        className="w-full bg-green-700 hover:bg-green-800"
        disabled={isPending || uploading}
      >
        {isPending ? "Registering…" : "Register Farmer"}
      </Button>
    </form>
  );
}
