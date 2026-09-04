import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { AuthGate } from "@/components/AuthGate";
import { Toaster } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Personal Finance Manager",
  description: "Personal finance manager: multi-card recommendation engine, milestone tracking, Cashkaro/gift-card routing, and investment log",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Finance",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0d10" },
    { media: "(prefers-color-scheme: light)", color: "#0b0d10" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full overflow-x-hidden">
      <body className="min-h-full min-h-[100dvh] bg-bg text-fg overflow-x-hidden antialiased">
        <AuthGate>
          <div className="flex min-h-[100dvh] w-full max-w-[100vw]">
            <Sidebar />
            <div className="flex-1 min-w-0 flex flex-col w-full">
              <MobileNav />
              <TopBar />
              <main className="flex-1 w-full max-w-6xl mx-auto px-3 sm:px-8 py-4 sm:py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
                {children}
              </main>
            </div>
          </div>
          <Toaster />
        </AuthGate>
      </body>
    </html>
  );
}
