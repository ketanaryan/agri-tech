import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "AgriTech ERP — Agricultural Management Platform",
  description:
    "Manage your cooperative, track crops, register farmers, and empower field operations with AgriTech ERP.",
};

import NextTopLoader from 'nextjs-toploader';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <NextTopLoader color="#16a34a" showSpinner={false} />
        {children}
      </body>
    </html>
  );
}
