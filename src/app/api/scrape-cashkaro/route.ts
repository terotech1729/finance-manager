/**
 * Server-side route that triggers the Cashkaro scraper on demand.
 * Vercel Cron calls this daily (see vercel.json).
 *
 * NOTE: Hobby-tier friendly — scrapes public store pages. Persistent updates
 * prefer the GitHub Action that commits src/data/cashkaro-rates.generated.json.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const TARGETS = [
  { merchant: "Amazon", url: "https://cashkaro.com/stores/amazon" },
  { merchant: "Flipkart", url: "https://cashkaro.com/stores/flipkart" },
  { merchant: "Myntra", url: "https://cashkaro.com/stores/myntra" },
  { merchant: "Ajio", url: "https://cashkaro.com/stores/ajio" },
  { merchant: "Tata CLiQ", url: "https://cashkaro.com/stores/tata-cliq" },
  { merchant: "Nykaa", url: "https://cashkaro.com/stores/nykaa" },
  { merchant: "BookMyShow", url: "https://cashkaro.com/stores/bookmyshow" },
  { merchant: "Lenskart", url: "https://cashkaro.com/stores/lenskart" },
  { merchant: "boAt", url: "https://cashkaro.com/stores/boat" },
  { merchant: "Mamaearth", url: "https://cashkaro.com/stores/mamaearth" },
  { merchant: "Meesho", url: "https://cashkaro.com/stores/meesho" },
  { merchant: "Zomato", url: "https://cashkaro.com/stores/zomato" },
  { merchant: "Booking.com", url: "https://cashkaro.com/stores/bookingcom" },
  { merchant: "Agoda", url: "https://cashkaro.com/stores/agoda" },
  { merchant: "MakeMyTrip", url: "https://cashkaro.com/stores/makemytrip" },
  { merchant: "EaseMyTrip", url: "https://cashkaro.com/stores/easemytrip" },
  { merchant: "Cleartrip", url: "https://cashkaro.com/stores/cleartrip" },
  { merchant: "Yatra", url: "https://cashkaro.com/stores/yatra" },
];

export async function GET() {
  const out: { merchant: string; topRate?: string; error?: string }[] = [];
  for (const t of TARGETS) {
    try {
      const res = await fetch(t.url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; CCM/1.0)" },
        next: { revalidate: 0 },
      });
      const html = await res.text();
      const m = html.match(/Upto?\s*(\d+(?:\.\d+)?)\s*%\s*(?:Cashback|Rewards|Off)/i);
      out.push({ merchant: t.merchant, topRate: m ? m[0] : undefined });
    } catch (e) {
      out.push({ merchant: t.merchant, error: (e as Error).message });
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  return NextResponse.json({ scrapedAt: new Date().toISOString(), results: out });
}
