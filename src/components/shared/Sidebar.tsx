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
} from "lucide-react";

type UserRole = "Admin" | "FieldOfficer" | "Leader" | "Telecaller" | string;

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
          { href: "/bookings", label: "Bookings", icon: FileText },
          { href: "/reports", label: "Reports", icon: BarChart3 },
        ];
      case "FieldOfficer":
        return [
          { href: "/bookings", label: "Bookings", icon: FileText },
          { href: "/farmers", label: "Farmers", icon: Users },
          { href: "/plant-report", label: "Plant Report", icon: Package },
          { href: "/reports", label: "Reports", icon: BarChart3 },
        ];
      case "Leader":
        return [
          { href: "/purchasing", label: "Purchasing", icon: Search },
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
          <div className="flex items-center gap-2.5">
            <div className="bg-green-600 rounded-lg p-1.5">
              <Leaf className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-green-800 tracking-tight">
              AgriTech ERP
            </span>
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

        {/* Footer branding */}
        <div className="p-4 border-t border-green-100">
          <p className="text-[10px] text-gray-400 text-center">
            AgriTech ERP v1.0
          </p>
        </div>
      </div>
    </>
  );
}
