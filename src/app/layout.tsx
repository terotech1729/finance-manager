import type { Metadata } from "next";
import "./globals.css";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import { AuthGate } from "@/components/AuthGate";
import { Toaster } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Personal Finance Manager",
  description: "Personal finance manager: multi-card recommendation engine, milestone tracking, Cashkaro/gift-card routing, and investment log",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-fg">
        <AuthGate>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 min-w-0">
              <MobileNav />
              <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6">{children}</main>
            </div>
          </div>
          <Toaster />
        </AuthGate>
      </body>
    </html>
  );
}
