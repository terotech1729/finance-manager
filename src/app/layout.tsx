import type { Metadata } from "next";
import "./globals.css";
import { Sidebar, MobileNav } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "Credit Card Manager",
  description: "Personal credit-card optimizer with multi-card recommendation engine, milestone tracking, and Cashkaro routing",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-fg">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 min-w-0">
            <MobileNav />
            <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
