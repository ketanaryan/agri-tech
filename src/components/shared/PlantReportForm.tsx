"use client";

import React, { useState } from "react";
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
import { Camera, Loader2, X } from "lucide-react";

export function PlantReportForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form State
  const [farmerId, setFarmerId] = useState("");
  const [plantsDelivered, setPlantsDelivered] = useState("");
  const [status, setStatus] = useState("Delivered");
  const [pesticideGiven, setPesticideGiven] = useState("no");
  const [remarks, setRemarks] = useState("");
  
  // Files
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const newFiles = [...files, ...selectedFiles].slice(0, 3); // max 3 files
      setFiles(newFiles);
      
      // Create previews
      const newPreviews = newFiles.map(f => URL.createObjectURL(f));
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

      const result = await submitPlantReport(formData);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Success
      router.push("/reports"); // Or wherever you want to redirect
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
        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      {/* Row 1 */}
      <div className="space-y-2">
        <Label htmlFor="farmerId">Farmer ID</Label>
        <Input
          id="farmerId"
          placeholder="Enter Farmer ID (e.g., FM1234)"
          value={farmerId}
          onChange={(e) => setFarmerId(e.target.value)}
          required
        />
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="plantsDelivered">Number of Plants Delivered</Label>
          <Input
            id="plantsDelivered"
            type="number"
            min="1"
            placeholder="Enter quantity"
            value={plantsDelivered}
            onChange={(e) => setPlantsDelivered(e.target.value)}
            required
          />
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

      {/* Row 3 - Radio */}
      <div className="space-y-2">
        <Label>Pesticide Given</Label>
        <RadioGroup 
          defaultValue="no" 
          value={pesticideGiven} 
          onValueChange={setPesticideGiven}
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
      </div>

      {/* Row 4 - Remarks */}
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

      {/* Row 5 - Photos */}
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

        {/* Previews */}
        {previewUrls.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mt-4">
            {previewUrls.map((url, index) => (
              <div key={index} className="relative group">
                <img 
                  src={url} 
                  alt={`Preview ${index}`} 
                  className="h-24 w-full object-cover rounded-md border" 
                />
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

      {/* Submit Button */}
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
