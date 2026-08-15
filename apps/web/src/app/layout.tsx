import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@repo/ui/components/sonner";
import { TooltipProvider } from "@repo/ui/components/tooltip";
import { cn } from "@repo/ui/lib/utils";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AuthHeader } from "@/features/auth/components/auth-header";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Qanat",
  description:
    "Inter-institutional settlement: inbound policy stays private; the chain learns only valid or invalid.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", inter.variable)}>
      <body className="antialiased">
        <ClerkProvider>
          <TooltipProvider>
            <AuthHeader />
            {children}
            <Toaster />
          </TooltipProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
