"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, UserCircle2, MapPin, BadgeInfo } from "lucide-react";

interface NavbarProps {
  userName?: string;
  role?: string;
  district?: string | null;
  uniqueId?: string | null;
}

export function Navbar({ userName, role, district, uniqueId }: NavbarProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="h-16 border-b border-green-100 bg-white flex items-center justify-between px-6 pl-16 md:pl-6 shadow-sm">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm text-gray-500">
          Viewing as{" "}
          <span className="font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-md">
            {role || "User"}
          </span>
        </span>

        {/* District badge — shown only when district is set */}
        {district && (
          <span className="hidden sm:flex items-center gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full font-medium">
            <MapPin className="w-3 h-3" />
            {district}
          </span>
        )}

        {/* Unique ID badge — shown for non-Admin roles */}
        {uniqueId && (
          <span className="hidden md:flex items-center gap-1 text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full font-mono">
            <BadgeInfo className="w-3 h-3" />
            {uniqueId}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <UserCircle2 className="w-5 h-5 text-green-600" />
          <span className="font-medium text-gray-800">{userName || "Profile"}</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </div>
    </header>
  );
}
