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
import { PhoneCall, Loader2, Clock, Calendar } from "lucide-react";

interface Farmer {
  id: string;
  name: string;
  unique_id: string;
}

interface LogCallModalProps {
  bookingId: string;
  farmers?: Farmer[];
  existingLogsCount?: number;
}

export function LogCallModal({ bookingId, farmers = [], existingLogsCount = 0 }: LogCallModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeFollowUp, setActiveFollowUp] = useState(Math.min(existingLogsCount + 1, 3));

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const nowTime = today.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    formData.append("booking_id", bookingId);
    formData.append("follow_up_number", activeFollowUp.toString());
    
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
      <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-700 to-green-800 text-white px-6 py-4">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5" />
            <div>
              <DialogHeader>
                <DialogTitle className="text-white text-lg font-semibold">Telecaller follow-up</DialogTitle>
              </DialogHeader>
              <p className="text-green-200 text-xs mt-0.5">Farmer onboarding call log</p>
            </div>
          </div>
        </div>

        {/* Follow-up Tabs */}
        <div className="bg-green-800 px-6 py-2 flex gap-1">
          {[1, 2, 3].map((num) => {
            const isCompleted = num <= existingLogsCount;
            const isActive = num === activeFollowUp;
            return (
              <button
                key={num}
                type="button"
                onClick={() => setActiveFollowUp(num)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  isActive
                    ? "bg-white text-green-800 shadow-md"
                    : isCompleted
                    ? "bg-green-600 text-green-100 hover:bg-green-500"
                    : "bg-green-900/50 text-green-300 hover:bg-green-700"
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isActive ? "bg-green-700 text-white" : isCompleted ? "bg-green-400 text-white" : "bg-green-700/50 text-green-400"
                }`}>
                  {isCompleted ? "✓" : num}
                </span>
                Follow-up {num}
              </button>
            );
          })}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-5">
          {/* Farmer & Telecaller Details */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-3">
              Farmer & Telecaller Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor={`tc-name-${bookingId}`} className="text-xs">
                  Telecaller name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id={`tc-name-${bookingId}`}
                  name="telecaller_name"
                  placeholder="eg: Anjali Sharma"
                  className="h-9 text-sm"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Farmer <span className="text-red-500">*</span>
                </Label>
                {farmers.length > 0 ? (
                  <Select name="farmer_id">
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Select registered farmer" />
                    </SelectTrigger>
                    <SelectContent>
                      {farmers.map((f) => (
                        <SelectItem key={f.id} value={f.unique_id}>
                          {f.name} ({f.unique_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    name="farmer_id"
                    placeholder="Farmer ID"
                    className="h-9 text-sm"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Call Info Bar */}
          <div className="flex items-center gap-3 bg-gray-50 border rounded-lg px-3 py-2 text-xs text-gray-600">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            <span>Call date: <strong>{today.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</strong></span>
            <span className="text-gray-300">|</span>
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span>Follow-up {activeFollowUp}</span>
          </div>

          {/* Call Details */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-red-500 mb-3">
              Call Details
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor={`call-date-${bookingId}`} className="text-xs">
                  Call date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id={`call-date-${bookingId}`}
                  name="call_date"
                  type="date"
                  defaultValue={todayStr}
                  className="h-9 text-sm"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`call-time-${bookingId}`} className="text-xs">
                  Call time
                </Label>
                <Input
                  id={`call-time-${bookingId}`}
                  name="call_time"
                  type="time"
                  defaultValue={nowTime}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`call-dur-${bookingId}`} className="text-xs">
                  Duration (mins)
                </Label>
                <Input
                  id={`call-dur-${bookingId}`}
                  name="call_duration_mins"
                  type="number"
                  min="0"
                  placeholder="e.g. 5"
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Call Response */}
          <div>
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-red-500 mb-3">
              Call Response
            </h3>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Pesticide is given?</Label>
                <RadioGroup defaultValue="no" name="pesticide_given" className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="yes" id={`pes-yes-${bookingId}`} />
                    <Label htmlFor={`pes-yes-${bookingId}`} className="text-sm">Yes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="no" id={`pes-no-${bookingId}`} />
                    <Label htmlFor={`pes-no-${bookingId}`} className="text-sm">No</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`water-${bookingId}`} className="text-xs">How are they giving water?</Label>
                <Input id={`water-${bookingId}`} name="water_given" placeholder="e.g. Drip irrigation, 2 times a day" className="h-9 text-sm" />
              </div>

              <div className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  id={`no-issue-${bookingId}`} 
                  name="no_issue" 
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <Label htmlFor={`no-issue-${bookingId}`} className="text-sm">No issue</Label>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Take Action Forward To</Label>
                <Select name="forward_to">
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select (Optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="None">None</SelectItem>
                    <SelectItem value="Leader">Leader</SelectItem>
                    <SelectItem value="FieldOfficer">Field Officer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`notes-${bookingId}`} className="text-xs">Notes (Optional)</Label>
                <Textarea 
                  id={`notes-${bookingId}`} 
                  name="notes" 
                  placeholder="Any other observations..." 
                  className="min-h-[60px] text-sm"
                />
              </div>
            </div>
          </div>

          <Button type="submit" className="w-full bg-green-600 hover:bg-green-700 h-10" disabled={loading}>
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : `Save Follow-up ${activeFollowUp} Log`}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
