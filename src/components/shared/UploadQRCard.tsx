"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { updateProfileQrCode } from "@/actions/profile";
import Image from "next/image";
import { Loader2, QrCode, CheckCircle2, AlertCircle } from "lucide-react";

export function UploadQRCard({ initialQrUrl }: { initialQrUrl: string | null }) {
  const [qrUrl, setQrUrl] = useState<string | null>(initialQrUrl);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMsg(null);

    try {
      const fd = new FormData();
      fd.append("photo", file); // Reusing the photo upload API which uploads to Supabase
      
      const res = await fetch("/api/upload-farmer-photo", {
        method: "POST",
        body: fd,
      });

      const json = await res.json();
      if (!res.ok) {
        setMsg({ text: json.error || "Upload failed", type: "error" });
      } else {
        const newUrl = json.url;
        setQrUrl(newUrl);
        // Save to profile
        const updateRes = await updateProfileQrCode(newUrl);
        if (updateRes.error) {
          setMsg({ text: updateRes.error, type: "error" });
        } else {
          setMsg({ text: "QR Code updated successfully!", type: "success" });
        }
      }
    } catch {
      setMsg({ text: "Network error during upload", type: "error" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="w-5 h-5 text-blue-600" />
          Payment QR Code
        </CardTitle>
        <CardDescription>
          Upload your personal UPI QR code here. Field Officers will scan this code to collect payments on your behalf.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          {qrUrl ? (
            <div className="relative w-24 h-24 rounded-lg overflow-hidden border-2 border-blue-100 shadow-sm">
              <Image src={qrUrl} alt="Your QR Code" fill className="object-cover" />
            </div>
          ) : (
            <div className="w-24 h-24 rounded-lg bg-gray-50 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
              <QrCode className="w-8 h-8 mb-1" />
              <span className="text-[10px] uppercase font-bold tracking-wider">No QR</span>
            </div>
          )}
          <div className="flex-1 space-y-2">
            <Button 
              variant="outline" 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full justify-start"
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</>
              ) : qrUrl ? "Update QR Image" : "Upload QR Image"}
            </Button>
            <input 
              ref={fileInputRef} 
              type="file" 
              accept="image/jpeg,image/png,image/webp" 
              className="hidden" 
              onChange={handleFileChange} 
            />
          </div>
        </div>

        {msg && (
          <div className={`flex items-start gap-2 p-3 text-sm rounded-lg border ${
            msg.type === "success" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
          }`}>
            {msg.type === "success" ? <CheckCircle2 className="w-4 h-4 mt-0.5" /> : <AlertCircle className="w-4 h-4 mt-0.5" />}
            <span>{msg.text}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
