import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { PWARegister } from "@/components/shared/PWARegister";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Bio Eagle Petroleum Pvt Ltd — Agricultural Division",
  description:
    "Manage your cooperative, track crops, register farmers, and empower field operations with Bio Eagle Petroleum Pvt Ltd.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Bio Eagle Petroleum Pvt Ltd",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#16a34a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

import NextTopLoader from 'nextjs-toploader';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icon-512.png" />
        <link rel="apple-touch-icon" href="/icon-512.png" />
      </head>
      <body suppressHydrationWarning>
        <NextTopLoader color="#16a34a" showSpinner={false} />
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
