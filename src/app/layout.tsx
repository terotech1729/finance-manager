import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { Sidebar, MobileNav } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { AuthGate } from "@/components/AuthGate";
import { Toaster } from "@/components/Toast";

/**
 * Self-hosted at build time by next/font, so the portal renders identically on every
 * machine instead of inheriting the OS default. `display: "swap"` keeps first paint fast;
 * the fallback metrics are close enough to Plex that the swap doesn't shift layout.
 */
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Jarvis",
  description: "Jarvis — a personal assistant for money, travel, notes and investments: card routing, milestone tracking, lounge and reward ledgers, trip planning and net worth in one place.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Jarvis",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#060c18" },
    { media: "(prefers-color-scheme: light)", color: "#060c18" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full overflow-x-hidden ${plexSans.variable} ${plexMono.variable}`}>
      <body className="min-h-full min-h-[100dvh] bg-bg text-fg overflow-x-hidden antialiased font-sans">
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
