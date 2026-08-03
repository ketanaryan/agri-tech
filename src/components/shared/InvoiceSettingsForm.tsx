"use client";

import { useState } from "react";
import { updateInvoiceSettings } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface InvoiceSettingsFormProps {
  initialCompanyName?: string | null;
  initialGst?: string | null;
  initialAddress?: string | null;
}

export function InvoiceSettingsForm({
  initialCompanyName,
  initialGst,
  initialAddress,
}: InvoiceSettingsFormProps) {
  const [companyName, setCompanyName] = useState(initialCompanyName || "");
  const [gst, setGst] = useState(initialGst || "");
  const [address, setAddress] = useState(initialAddress || "");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    const res = await updateInvoiceSettings(companyName, gst, address);
    
    setIsLoading(false);
    
    if (res.error) {
      setMessage({ text: res.error, type: "error" });
    } else {
      setMessage({ text: "Invoice settings updated successfully", type: "success" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoice Customization</CardTitle>
        <CardDescription>
          Customize the header details that appear on the PDF receipts generated for your customers.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">Shop / Company Name</Label>
            <Input
              id="companyName"
              placeholder="e.g. Kisan Agro Center"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="gst">GST Number</Label>
            <Input
              id="gst"
              placeholder="Your GSTIN"
              value={gst}
              onChange={(e) => setGst(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="address">Shop Address</Label>
            <Input
              id="address"
              placeholder="Full address for invoice"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          {message && (
            <div className={`p-3 rounded-md text-sm ${message.type === "error" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
              {message.text}
            </div>
          )}

          <Button type="submit" disabled={isLoading} className="w-full">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
