/**
 * Movie theatre gift-card sources after CRED dropped PVR / Cinepolis (Aug 2026).
 * Catalog fallbacks + live scrape via /api/movie-gift-cards.
 */

export type MovieBrand = "pvr" | "cinepolis" | "inox" | "bms" | "district";

export type MovieGcSourceId =
  | "woohoo"
  | "gyftr"
  | "magicpin"
  | "amazon"
  | "cred"
  | "zillion";

export type MovieGiftCardOffer = {
  sourceId: MovieGcSourceId;
  sourceLabel: string;
  brand: MovieBrand;
  brandLabel: string;
  /** Discount % off face value */
  pct: number;
  url: string;
  /** live scrape | catalog fallback | marked unavailable */
  status: "live" | "catalog" | "unavailable";
  note?: string;
  promoCode?: string;
  /** Caveats shown in Recommend panel */
  caveats?: string[];
};

export type MovieGiftCardLiveResult = {
  fetchedAt: string;
  offers: MovieGiftCardOffer[];
  errors?: string[];
};

const BRAND_LABEL: Record<MovieBrand, string> = {
  pvr: "PVR",
  cinepolis: "Cinepolis",
  inox: "INOX",
  bms: "BookMyShow",
  district: "District",
};

/** Known-good fallbacks when scrape fails (mid-Aug 2026 research). */
export const MOVIE_GC_CATALOG: Omit<MovieGiftCardOffer, "status">[] = [
  {
    sourceId: "woohoo",
    sourceLabel: "Woohoo",
    brand: "cinepolis",
    brandLabel: "Cinepolis",
    pct: 28,
    url: "https://www.woohoo.in/cinepolis-qc-e-gift-instant-voucher",
    promoCode: "WOOHOO",
    note: "Best Cinepolis replacement for CRED ~28%. Confirm code at checkout.",
  },
  {
    sourceId: "woohoo",
    sourceLabel: "Woohoo",
    brand: "pvr",
    brandLabel: "PVR INOX",
    pct: 25,
    url: "https://www.woohoo.in/pvr-inox-e-gift-instant-voucher",
    note: "Often the top PVR face discount when promo is live.",
  },
  {
    sourceId: "magicpin",
    sourceLabel: "magicpin",
    brand: "pvr",
    brandLabel: "PVR",
    pct: 19,
    url: "https://magicpin.in/india/vouchers/Pvr-Cinemas-vouchers/66872/",
    note: "~19–20% typical.",
    caveats: ["Often excludes PVR Opulent / some INOX properties — check T&Cs"],
  },
  {
    sourceId: "gyftr",
    sourceLabel: "GyFTR",
    brand: "pvr",
    brandLabel: "PVR INOX",
    pct: 16,
    url: "https://www.gyftr.com/pvr",
    note: "Steady public GyFTR rate; redeem on PVR app/web.",
  },
  {
    sourceId: "gyftr",
    sourceLabel: "GyFTR",
    brand: "cinepolis",
    brandLabel: "Cinepolis",
    pct: 14,
    url: "https://www.gyftr.com/cinepolis",
    note: "Steady GyFTR backup for Cinepolis.",
  },
  {
    sourceId: "amazon",
    sourceLabel: "Amazon",
    brand: "pvr",
    brandLabel: "PVR INOX",
    pct: 12,
    url: "https://www.amazon.in/s?k=PVR+INOX+gift+card",
    note: "Pine Labs e-GC; easy but thinner discount.",
  },
  {
    sourceId: "zillion",
    sourceLabel: "Zillion",
    brand: "pvr",
    brandLabel: "PVR",
    pct: 12,
    url: "https://zillionrewards.in/",
    note: "Coin burn / voucher — not a cash buy.",
  },
  {
    sourceId: "cred",
    sourceLabel: "CRED Store",
    brand: "cinepolis",
    brandLabel: "Cinepolis",
    pct: 0,
    url: "https://cred.club/",
    note: "CRED removed Cinepolis GC from Store (Aug 2026).",
  },
  {
    sourceId: "cred",
    sourceLabel: "CRED Store",
    brand: "pvr",
    brandLabel: "PVR",
    pct: 0,
    url: "https://cred.club/",
    note: "CRED removed PVR GC from Store (Aug 2026).",
  },
  {
    sourceId: "cred",
    sourceLabel: "CRED Store",
    brand: "bms",
    brandLabel: "BookMyShow",
    pct: 3.75,
    url: "https://cred.club/",
    note: "Thin BMS GC — prefer chain GCs when theatre known.",
  },
  {
    sourceId: "cred",
    sourceLabel: "CRED Store",
    brand: "district",
    brandLabel: "District",
    pct: 3.75,
    url: "https://cred.club/",
    note: "Thin District GC — prefer chain GCs / BOGO.",
  },
];

export function brandLabelOf(brand: MovieBrand): string {
  return BRAND_LABEL[brand];
}

/** Map Recommend theatre picker → brands that apply. */
export function brandsForTheatre(
  theatre: MovieBrand | "other" | "" | undefined
): MovieBrand[] {
  if (!theatre || theatre === "other") return ["cinepolis", "pvr", "bms", "district"];
  if (theatre === "inox") return ["pvr", "inox"];
  return [theatre];
}

export function catalogOffersForTheatre(
  theatre: MovieBrand | "other" | "" | undefined
): MovieGiftCardOffer[] {
  const brands = new Set(brandsForTheatre(theatre));
  // inox shares pvr GCs
  if (brands.has("inox")) brands.add("pvr");
  return MOVIE_GC_CATALOG.filter((o) => brands.has(o.brand) || (o.brand === "pvr" && brands.has("inox"))).map(
    (o) => ({
      ...o,
      status: o.sourceId === "cred" && o.pct <= 0 ? ("unavailable" as const) : ("catalog" as const),
    })
  );
}

/** Rank buyable offers (pct > 0) best-first. */
export function rankMovieOffers(offers: MovieGiftCardOffer[]): MovieGiftCardOffer[] {
  return [...offers]
    .filter((o) => o.pct > 0 && o.status !== "unavailable")
    .sort((a, b) => b.pct - a.pct || a.sourceLabel.localeCompare(b.sourceLabel));
}

export function parseDiscountPctFromHtml(html: string): number | null {
  const patterns = [
    /DISCOUNT\s*\((\d+(?:\.\d+)?)%\)/i,
    /(\d+(?:\.\d+)?)\s*%\s*(?:off|discount|OFF)/i,
    /Flat\s+(\d+(?:\.\d+)?)\s*%\s*Off/i,
    /Get\s+(\d+(?:\.\d+)?)\s*%\s*off/i,
    /upto?\s+(\d+(?:\.\d+)?)\s*%\s*off/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      const n = Number(m[1]);
      if (Number.isFinite(n) && n > 0 && n < 90) return n;
    }
  }
  return null;
}

/** Merge live scrape hits onto catalog rows. */
export function mergeLiveMovieOffers(
  liveHits: { sourceId: MovieGcSourceId; brand: MovieBrand; pct: number | null; available?: boolean; error?: string }[],
  theatre?: MovieBrand | "other" | ""
): MovieGiftCardLiveResult {
  const base = catalogOffersForTheatre(theatre);
  const byKey = new Map(base.map((o) => [`${o.sourceId}:${o.brand}`, o]));
  const errors: string[] = [];

  for (const hit of liveHits) {
    const key = `${hit.sourceId}:${hit.brand}`;
    const row = byKey.get(key);
    if (hit.error) errors.push(`${hit.sourceId}/${hit.brand}: ${hit.error}`);
    if (!row) continue;
    if (hit.available === false || (hit.sourceId === "cred" && (hit.pct == null || hit.pct <= 0))) {
      byKey.set(key, {
        ...row,
        pct: 0,
        status: "unavailable",
        note: row.note || "Not listed / unavailable on live check",
      });
      continue;
    }
    if (hit.pct != null && hit.pct > 0) {
      byKey.set(key, { ...row, pct: hit.pct, status: "live" });
    }
  }

  return {
    fetchedAt: new Date().toISOString(),
    offers: Array.from(byKey.values()).sort((a, b) => {
      if (a.status === "unavailable" && b.status !== "unavailable") return 1;
      if (b.status === "unavailable" && a.status !== "unavailable") return -1;
      return b.pct - a.pct;
    }),
    errors: errors.length ? errors : undefined,
  };
}
