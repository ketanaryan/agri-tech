"use client";

import { useActionState } from "react";
import { createUserAction } from "@/actions/admin";
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
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

interface RoleOption {
  value: string;
  label: string;
}

interface CreateUserFormProps {
  /** Roles visible in the dropdown. Pass 1 item to hide dropdown (uses hidden input). */
  allowedRoles: RoleOption[];
  defaultRole?: string;
  /** Pre-fills district as a hidden field (used by Leader) */
  fixedDistrict?: string;
  /** Show district text field? True by default. Set false when fixedDistrict is used. */
  showDistrictField?: boolean;
}

export function CreateUserForm({
  allowedRoles,
  defaultRole,
  fixedDistrict,
  showDistrictField = true,
}: CreateUserFormProps) {
  const [state, formAction, isPending] = useActionState(createUserAction, null);

  return (
    <form action={formAction} className="space-y-4">
      {/* Hidden fields */}
      {fixedDistrict && (
        <input type="hidden" name="district" value={fixedDistrict} />
      )}
      {allowedRoles.length === 1 && (
        <input type="hidden" name="role" value={allowedRoles[0].value} />
      )}

      {/* Name + Phone */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cu-name">Full Name</Label>
          <Input id="cu-name" name="name" placeholder="Full name" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cu-phone">Phone</Label>
          <Input
            id="cu-phone"
            name="phone"
            placeholder="10-digit number"
            pattern="[0-9]{10}"
            maxLength={10}
            title="Enter exactly 10 digits"
            required
          />
        </div>
      </div>

      {/* Email + Password */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cu-email">Email</Label>
          <Input
            id="cu-email"
            name="email"
            type="email"
            placeholder="user@example.com"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cu-password">Password</Label>
          <Input
            id="cu-password"
            name="password"
            type="password"
            placeholder="Min. 6 characters"
            minLength={6}
            required
          />
        </div>
      </div>

      {/* Role dropdown (hidden if only 1 role) */}
      {allowedRoles.length > 1 && (
        <div
          className={`grid gap-4 ${
            showDistrictField && !fixedDistrict ? "grid-cols-2" : "grid-cols-1"
          }`}
        >
          <div className="space-y-2">
            <Label htmlFor="cu-role">Role</Label>
            <Select
              name="role"
              defaultValue={defaultRole || allowedRoles[0]?.value}
              required
            >
              <SelectTrigger id="cu-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {allowedRoles.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showDistrictField && !fixedDistrict && (
            <div className="space-y-2">
              <Label htmlFor="cu-district">District (Optional)</Label>
              <Input
                id="cu-district"
                name="district"
                placeholder="e.g. Pune"
              />
            </div>
          )}
        </div>
      )}

      {/* Feedback */}
      {state?.error && (
        <div className="flex items-start gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      )}
      {state?.success && (
        <div className="flex items-start gap-2 p-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>User created successfully! They can now log in.</span>
        </div>
      )}

      <Button
        type="submit"
        className="w-full bg-green-700 hover:bg-green-800"
        disabled={isPending}
      >
        {isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating…
          </>
        ) : (
          "Create User"
        )}
      </Button>
    </form>
  );
}
