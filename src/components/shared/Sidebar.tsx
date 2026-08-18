"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  FileText,
  PhoneCall,
  Search,
  Menu,
  X,
  Leaf,
  BarChart3,
  Package,
  UserPlus,
  Download,
} from "lucide-react";

function InstallAppButton() {
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [isStandalone, setIsStandalone] = React.useState(false);

  React.useEffect(() => {
    // Check if already installed and running as PWA
    if (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone) {
      setIsStandalone(true);
    }

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (isStandalone) return null;

  return (
    <button
      onClick={async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === "accepted") {
            setDeferredPrompt(null);
            setIsStandalone(true);
          }
        } else {
          alert("To install the app, tap 'Share' -> 'Add to Home Screen' (on iOS) or 'Install App' / 'Add to Home screen' from your browser menu (on Android).");
        }
      }}
      className="flex w-auto mx-3 mb-3 items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-150 text-emerald-700 bg-emerald-100 hover:bg-emerald-200"
    >
      <Download className="w-4 h-4 flex-shrink-0" />
      Install App
    </button>
  );
}

type UserRole = "Admin" | "FieldOfficer" | "Dealer" | "Telecaller" | string;

interface SidebarProps {
  role: UserRole;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const getLinks = (role: UserRole) => {
    switch (role) {
      case "Admin":
        return [
          { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
          { href: "/farmers", label: "Farmer Directory", icon: Users },
          { href: "/bookings", label: "New Booking", icon: FileText },
          { href: "/bookings/pesticide", label: "Pesticide Booking", icon: Leaf },
          { href: "/b2b-orders", label: "B2B Orders", icon: Package },
          { href: "/reports", label: "Reports", icon: BarChart3 },
        ];
      case "FieldOfficer":
        return [
          { href: "/bookings", label: "New Booking", icon: FileText },
          { href: "/bookings/pesticide", label: "Pesticide Booking", icon: Leaf },
          { href: "/farmers", label: "Farmers", icon: Users },
          { href: "/plant-report", label: "Plant Report", icon: Package },
          { href: "/reports", label: "Reports", icon: BarChart3 },
        ];
      case "Dealer":
        return [
          { href: "/dealer", label: "Manage Team", icon: UserPlus },
          { href: "/bookings", label: "New Booking", icon: FileText },
          { href: "/bookings/pesticide", label: "Pesticide Booking", icon: Leaf },
          { href: "/purchasing", label: "Purchasing", icon: Search },
          { href: "/b2b-orders", label: "My B2B Orders", icon: Package },
          { href: "/farmers", label: "Farmer Directory", icon: Users },
          { href: "/reports", label: "Reports", icon: BarChart3 },
        ];
      case "SuperDistributor":
        return [
          { href: "/super-distributor", label: "My Network", icon: Users },
          { href: "/farmers", label: "Farmer Directory", icon: Users },
          { href: "/bookings", label: "New Booking", icon: FileText },
          { href: "/bookings/pesticide", label: "Pesticide Booking", icon: Leaf },
          { href: "/b2b-orders", label: "B2B Orders", icon: Package },
          { href: "/reports", label: "Reports", icon: BarChart3 },
          { href: "/plant-reports", label: "Plant Reports", icon: Package },
        ];
      case "Counselor":
        return [
          { href: "/counselor", label: "Dashboard", icon: LayoutDashboard },
          { href: "/plant-reports", label: "Plant Reports", icon: Package },
          { href: "/farmers", label: "Farmer Directory", icon: Users },
        ];
      case "Telecaller":
        return [
          { href: "/telecaller", label: "Follow Ups", icon: PhoneCall },
          { href: "/farmers", label: "Farmer Directory", icon: Users },
        ];
      default:
        return [];
    }
  };

  const links = getLinks(role);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setIsOpen(true)}
        className="md:hidden fixed top-3 left-4 z-40 p-2 bg-white rounded-lg border border-green-100 shadow-sm text-green-700 hover:bg-green-50 transition-colors"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile overlay */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        />
      )}

      {/* Sidebar panel */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-green-100 flex flex-col transform transition-transform duration-200 ease-in-out md:relative md:translate-x-0 h-screen shadow-sm",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo area */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-green-100">
          <div className="flex items-center gap-2">
            <img 
              src="/logo.png" 
              alt="BEP Logo" 
              className="h-10 w-auto object-contain mix-blend-multiply" 
            />
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="md:hidden p-1 text-gray-400 hover:text-gray-700 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role badge */}
        <div className="px-5 py-3 border-b border-green-50">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-green-600/70">
            {role} Portal
          </span>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-3 flex flex-col gap-1 px-3">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive =
              pathname === link.href || pathname.startsWith(link.href + "/");

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-150",
                  isActive
                    ? "bg-green-600 text-white shadow-sm"
                    : "text-gray-600 hover:bg-green-50 hover:text-green-800"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {link.label}
              </Link>
            );
          })}
        </nav>
        
        <InstallAppButton />

        {/* Footer branding */}
        <div className="p-4 border-t border-green-100">
          <p className="text-[10px] text-gray-400 text-center">
            Bio Eagle Petroleum v1.0
          </p>
        </div>
      </div>
    </>
  );
}
