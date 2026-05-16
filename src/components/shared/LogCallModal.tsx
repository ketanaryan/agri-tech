"use client";

import { useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { logTelecallerAction } from "@/actions/telecaller";
import { PhoneCall, Loader2 } from "lucide-react";

export function LogCallModal({ bookingId }: { bookingId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.append("booking_id", bookingId);
    
    // Convert checkbox to boolean string
    const noIssue = formData.get("no_issue") === "on" ? "true" : "false";
    formData.set("no_issue", noIssue);

    await logTelecallerAction(formData);
    setLoading(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger 
        render={
          <Button size="sm" className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white shrink-0">
            <PhoneCall className="w-3.5 h-3.5 mr-1" /> Log Call
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Log Follow-Up Call</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          
          <div className="space-y-2">
            <Label>Pesticide is given?</Label>
            <RadioGroup defaultValue="no" name="pesticide_given" className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id={`pes-yes-${bookingId}`} />
                <Label htmlFor={`pes-yes-${bookingId}`}>Yes</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id={`pes-no-${bookingId}`} />
                <Label htmlFor={`pes-no-${bookingId}`}>No</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`water-${bookingId}`}>How are they giving water?</Label>
            <Input id={`water-${bookingId}`} name="water_given" placeholder="e.g. Drip irrigation, 2 times a day" />
          </div>

          <div className="flex items-center space-x-2">
            <input 
              type="checkbox" 
              id={`no-issue-${bookingId}`} 
              name="no_issue" 
              className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
            <Label htmlFor={`no-issue-${bookingId}`}>No issue</Label>
          </div>

          <div className="space-y-2">
            <Label>Take Action Forward To</Label>
            <Select name="forward_to">
              <SelectTrigger>
                <SelectValue placeholder="Select (Optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="None">None</SelectItem>
                <SelectItem value="Leader">Leader</SelectItem>
                <SelectItem value="FieldOfficer">Field Officer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`notes-${bookingId}`}>Notes (Optional)</Label>
            <Textarea 
              id={`notes-${bookingId}`} 
              name="notes" 
              placeholder="Any other observations..." 
              className="min-h-[80px]"
            />
          </div>

          <Button type="submit" className="w-full bg-green-600 hover:bg-green-700" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : "Save Log"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
