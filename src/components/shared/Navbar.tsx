"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { LogOut, UserCircle2 } from "lucide-react";

interface NavbarProps {
  userName?: string;
  role?: string;
}

export function Navbar({ userName, role }: NavbarProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="h-16 border-b border-green-100 bg-white flex items-center justify-between px-6 pl-16 md:pl-6 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">
          Viewing as{" "}
          <span className="font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-md">
            {role || "User"}
          </span>
        </span>
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
