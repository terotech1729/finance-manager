/**
 * Live-fetch movie gift-card discounts from all sources at recommend time.
 * CRED (via Desidime proxy) · Woohoo · GyFTR · Amazon · magicpin (best-effort).
 * Failed scrapes fall back to catalog — never hard-mark CRED unavailable.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  mergeLiveMovieOffers,
  parseAmazonBrandPct,
  parseDesidimeCinemaPct,
  parseDiscountPctFromHtml,
  type MovieBrand,
  type MovieGcLiveHit,
  type MovieGcSourceId,
} from "@/lib/movieGiftCards";

export const runtime = "nodejs";
export const maxDuration = 30;

type ScrapeTarget = {
  sourceId: MovieGcSourceId;
  brand: MovieBrand;
  url: string;
  kind: "html" | "desidime" | "amazon" | "magicpin";
};

const TARGETS: ScrapeTarget[] = [
  // Direct storefronts
  { sourceId: "gyftr", brand: "pvr", url: "https://www.gyftr.com/pvr", kind: "html" },
  { sourceId: "gyftr", brand: "cinepolis", url: "https://www.gyftr.com/cinepolis", kind: "html" },
  {
    sourceId: "woohoo",
    brand: "cinepolis",
    url: "https://www.woohoo.in/cinepolis-qc-e-gift-instant-voucher",
    kind: "html",
  },
  {
    sourceId: "woohoo",
    brand: "pvr",
    url: "https://www.woohoo.in/pvr-inox-e-gift-instant-voucher",
    kind: "html",
  },
  // Amazon search (brand-scoped Flat N% Off titles)
  {
    sourceId: "amazon",
    brand: "cinepolis",
    url: "https://www.amazon.in/s?k=Cinepolis+eGift+Card",
    kind: "amazon",
  },
  {
    sourceId: "amazon",
    brand: "pvr",
    url: "https://www.amazon.in/s?k=PVR+INOX+gift+card",
    kind: "amazon",
  },
  // magicpin — often JS-heavy; best-effort
  {
    sourceId: "magicpin",
    brand: "pvr",
    url: "https://magicpin.in/india/vouchers/Pvr-Cinemas-vouchers/66872/",
    kind: "magicpin",
  },
  // CRED — app-gated; Desidime deal pages / DOTD posts are the public live signal
  {
    sourceId: "cred",
    brand: "cinepolis",
    url: "https://www.desidime.com/deals/cinepolis-x-cred-gift-card-valid-on-movies-and-f-b",
    kind: "desidime",
  },
  {
    sourceId: "cred",
    brand: "pvr",
    url: "https://www.desidime.com/stores/cred",
    kind: "desidime",
  },
];

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchHtml(url: string): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-IN,en;q=0.9",
      },
      cache: "no-store",
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true, html: await res.text() };
  } catch (e) {
    return {
      ok: false,
      error: (e as Error).name === "AbortError" ? "timeout" : (e as Error).message,
    };
  }
}

function parseHit(t: ScrapeTarget, html: string): MovieGcLiveHit {
  let pct: number | null = null;
  if (t.kind === "desidime") {
    pct = parseDesidimeCinemaPct(html, t.brand);
  } else if (t.kind === "amazon") {
    pct = parseAmazonBrandPct(html, t.brand);
  } else {
    pct = parseDiscountPctFromHtml(html);
  }
  return {
    sourceId: t.sourceId,
    brand: t.brand,
    pct,
    available: pct != null && pct > 0 ? true : undefined,
  };
}

async function scrapeOne(t: ScrapeTarget): Promise<MovieGcLiveHit> {
  const got = await fetchHtml(t.url);
  if (!got.ok) {
    return { sourceId: t.sourceId, brand: t.brand, pct: null, error: got.error };
  }
  return parseHit(t, got.html);
}

/**
 * Extra CRED DOTD pass: latest Desidime "Cred Gift Card Deals of the Day" style
 * posts often list Cinepolis/PVR % even when the dedicated deal slug is stale.
 */
async function scrapeCredDotdExtras(brands: Set<MovieBrand> | null): Promise<MovieGcLiveHit[]> {
  const wantCine = !brands || brands.has("cinepolis");
  const wantPvr = !brands || brands.has("pvr");
  if (!wantCine && !wantPvr) return [];

  // Recent known DOTD slugs + store page already covered; try one more search page.
  const urls = [
    "https://www.desidime.com/deals/cred-gift-card-deals-of-2151428",
    "https://www.desidime.com/deals/cred-gift-card-deals-of-2150092",
  ];
  const hits: MovieGcLiveHit[] = [];
  for (const url of urls) {
    const got = await fetchHtml(url);
    if (!got.ok) continue;
    if (wantCine) {
      const pct = parseDesidimeCinemaPct(got.html, "cinepolis");
      if (pct != null) hits.push({ sourceId: "cred", brand: "cinepolis", pct, available: true });
    }
    if (wantPvr) {
      const pct = parseDesidimeCinemaPct(got.html, "pvr");
      if (pct != null) hits.push({ sourceId: "cred", brand: "pvr", pct, available: true });
    }
    // Prefer newest page that has a cinema hit
    if (hits.length) break;
  }
  return hits;
}

/** Prefer higher live % when multiple CRED hits exist (primary deal page vs DOTD). */
function coalesceHits(hits: MovieGcLiveHit[]): MovieGcLiveHit[] {
  const best = new Map<string, MovieGcLiveHit>();
  for (const h of hits) {
    const key = `${h.sourceId}:${h.brand}`;
    const prev = best.get(key);
    if (!prev) {
      best.set(key, h);
      continue;
    }
    // Keep error notes but prefer a real pct
    const prevPct = prev.pct ?? 0;
    const nextPct = h.pct ?? 0;
    if (nextPct > prevPct) best.set(key, { ...h, error: prev.error || h.error });
    else if (h.error && !prev.error) best.set(key, { ...prev, error: h.error });
  }
  return Array.from(best.values());
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
        ? new Set<MovieBrand>(["pvr"])
        : theatre === "pvr" || theatre === "cinepolis"
          ? new Set<MovieBrand>([theatre])
          : null;

  const targets = brandFilter
    ? TARGETS.filter((t) => brandFilter.has(t.brand))
    : TARGETS.filter((t) => t.brand === "pvr" || t.brand === "cinepolis");

  const [primary, extras] = await Promise.all([
    Promise.all(targets.map(scrapeOne)),
    scrapeCredDotdExtras(brandFilter),
  ]);

  const hits = coalesceHits([...primary, ...extras]);
  const result = mergeLiveMovieOffers(hits, theatre);

  return NextResponse.json(result, {
    headers: {
      // Point-of-recommend freshness — platforms rotate daily/hourly
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
