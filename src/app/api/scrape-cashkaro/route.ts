/**
 * Server-side route that triggers the Cashkaro scraper on demand.
 * Vercel Cron can call this on a schedule (configured in vercel.json).
 *
 * NOTE: This is a hobby-tier-friendly endpoint. It scrapes only public
 * store pages and stores results in /tmp (not persistent). For persistent
 * updates, prefer the GitHub Action workflow that commits results to repo.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const TARGETS = [
  { merchant: "Amazon", url: "https://cashkaro.com/stores/amazon" },
  { merchant: "Flipkart", url: "https://cashkaro.com/stores/flipkart" },
  { merchant: "Myntra", url: "https://cashkaro.com/stores/myntra" },
  { merchant: "Cleartrip", url: "https://cashkaro.com/stores/cleartrip" },
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
    await new Promise((r) => setTimeout(r, 1000));
  }
  return NextResponse.json({ scrapedAt: new Date().toISOString(), results: out });
}
