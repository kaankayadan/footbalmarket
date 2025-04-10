import { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { SessionProvider } from "@/components/auth/session-provider";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Football Prediction Market",
  description: "A platform for football fans to trade match outcomes with virtual coins",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          <div className="min-h-screen flex flex-col">
            <Navbar />
            <div className="flex-1 container mx-auto px-4 py-6">
              {children}
            </div>
          </div>
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
