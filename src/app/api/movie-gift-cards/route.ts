/**
 * Live-fetch movie gift-card discounts (GyFTR / Woohoo) + catalog fallbacks.
 * CRED PVR/Cinepolis treated as unavailable unless scrape finds them (unlikely).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  mergeLiveMovieOffers,
  parseDiscountPctFromHtml,
  type MovieBrand,
  type MovieGcSourceId,
} from "@/lib/movieGiftCards";

export const runtime = "nodejs";
export const maxDuration = 30;

type ScrapeTarget = {
  sourceId: MovieGcSourceId;
  brand: MovieBrand;
  url: string;
};

const TARGETS: ScrapeTarget[] = [
  { sourceId: "gyftr", brand: "pvr", url: "https://www.gyftr.com/pvr" },
  { sourceId: "gyftr", brand: "cinepolis", url: "https://www.gyftr.com/cinepolis" },
  { sourceId: "woohoo", brand: "cinepolis", url: "https://www.woohoo.in/cinepolis-qc-e-gift-instant-voucher" },
  { sourceId: "woohoo", brand: "pvr", url: "https://www.woohoo.in/pvr-inox-e-gift-instant-voucher" },
];

async function scrapeOne(t: ScrapeTarget): Promise<{
  sourceId: MovieGcSourceId;
  brand: MovieBrand;
  pct: number | null;
  available?: boolean;
  error?: string;
}> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(t.url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      next: { revalidate: 0 },
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { sourceId: t.sourceId, brand: t.brand, pct: null, error: `HTTP ${res.status}` };
    }
    const html = await res.text();
    const pct = parseDiscountPctFromHtml(html);
    // Woohoo sometimes hides % behind JS — title/meta may still say Flat 28% Off
    return { sourceId: t.sourceId, brand: t.brand, pct, available: pct != null && pct > 0 };
  } catch (e) {
    return {
      sourceId: t.sourceId,
      brand: t.brand,
      pct: null,
      error: (e as Error).name === "AbortError" ? "timeout" : (e as Error).message,
    };
  }
}

export async function GET(req: NextRequest) {
  const theatreRaw = (req.nextUrl.searchParams.get("theatre") || "other").toLowerCase();
  const theatre = (
    ["pvr", "cinepolis", "inox", "bms", "district", "other"].includes(theatreRaw)
      ? theatreRaw
      : "other"
  ) as MovieBrand | "other";

  const brandFilter =
    theatre === "other"
      ? null
      : theatre === "inox"
        ? new Set<MovieBrand>(["pvr", "cinepolis"]) // still scrape both; filter in merge
        : theatre === "pvr" || theatre === "cinepolis"
          ? new Set<MovieBrand>([theatre])
          : null;

  const targets = brandFilter
    ? TARGETS.filter((t) => brandFilter.has(t.brand) || (theatre === "pvr" && t.brand === "pvr"))
    : TARGETS;

  const hits = await Promise.all(targets.map(scrapeOne));

  // Mark CRED cinema as unavailable (confirmed Aug 2026 removal) unless we somehow scrape it later.
  hits.push(
    { sourceId: "cred", brand: "pvr", pct: 0, available: false },
    { sourceId: "cred", brand: "cinepolis", pct: 0, available: false }
  );

  const result = mergeLiveMovieOffers(hits, theatre);
  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
