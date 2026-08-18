/**
 * Movie theatre gift-card sources across CRED / Woohoo / GyFTR / magicpin / Amazon.
 * Catalog = fallback when scrape fails; live = /api/movie-gift-cards at recommend time.
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

export type MovieGcLiveHit = {
  sourceId: MovieGcSourceId;
  brand: MovieBrand;
  pct: number | null;
  available?: boolean;
  error?: string;
};

const BRAND_LABEL: Record<MovieBrand, string> = {
  pvr: "PVR",
  cinepolis: "Cinepolis",
  inox: "INOX",
  bms: "BookMyShow",
  district: "District",
};

/** Known-good fallbacks when scrape fails (Aug 2026 — rates rotate daily). */
export const MOVIE_GC_CATALOG: Omit<MovieGiftCardOffer, "status">[] = [
  {
    sourceId: "cred",
    sourceLabel: "CRED Store",
    brand: "cinepolis",
    brandLabel: "Cinepolis",
    pct: 26,
    url: "https://cred.club/",
    note: "CRED Store rotates daily — live-checked via Desidime + catalog.",
  },
  {
    sourceId: "woohoo",
    sourceLabel: "Woohoo",
    brand: "cinepolis",
    brandLabel: "Cinepolis",
    pct: 28,
    url: "https://www.woohoo.in/cinepolis-qc-e-gift-instant-voucher",
    promoCode: "WOOHOO",
    note: "Often ~28% with code WOOHOO; confirm at checkout.",
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
    sourceId: "cred",
    sourceLabel: "CRED Store",
    brand: "pvr",
    brandLabel: "PVR",
    pct: 25,
    url: "https://cred.club/",
    note: "CRED PVR rotates — confirm in app; live via Desidime when posted.",
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
    brand: "cinepolis",
    brandLabel: "Cinepolis",
    pct: 12,
    url: "https://www.amazon.in/s?k=Cinepolis+eGift+Card",
    note: "Amazon e-GC; usually thinner than CRED/Woohoo.",
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
      status: "catalog" as const,
    })
  );
}

/** Rank buyable offers (pct > 0) best-first. */
export function rankMovieOffers(offers: MovieGiftCardOffer[]): MovieGiftCardOffer[] {
  return [...offers]
    .filter((o) => o.pct > 0 && o.status !== "unavailable")
    .sort((a, b) => b.pct - a.pct || a.sourceLabel.localeCompare(b.sourceLabel));
}

function clampPct(n: number): number | null {
  if (!Number.isFinite(n) || n <= 0 || n >= 90) return null;
  return n;
}

/** Generic % parsers for GyFTR / Woohoo title+body HTML. */
export function parseDiscountPctFromHtml(html: string): number | null {
  const title = html.match(/<title[^>]*>([^<]+)/i)?.[1] ?? "";
  const titleHit =
    title.match(/Flat\s+(\d+(?:\.\d+)?)\s*%/i) ||
    title.match(/Get\s+(\d+(?:\.\d+)?)\s*%\s*off/i) ||
    title.match(/(\d+(?:\.\d+)?)\s*%\s*off/i);
  if (titleHit) {
    const n = clampPct(Number(titleHit[1]));
    if (n != null) return n;
  }

  const patterns = [
    /DISCOUNT\s*\((\d+(?:\.\d+)?)%\)/i,
    /Flat\s+(\d+(?:\.\d+)?)\s*%\s*Off/i,
    /Get\s+(\d+(?:\.\d+)?)\s*%\s*off/i,
    /(\d+(?:\.\d+)?)\s*%\s*(?:off|discount|OFF)/i,
    /upto?\s+(\d+(?:\.\d+)?)\s*%\s*off/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) {
      const n = clampPct(Number(m[1]));
      if (n != null) return n;
    }
  }
  return null;
}

/**
 * Desidime deal pages show face discount as (28%) near ₹pay / ₹face.
 * Also parses "Cinepolis 2K Gift Card at 29% Discount" from CRED DOTD posts.
 */
export function parseDesidimeCinemaPct(html: string, brand: MovieBrand): number | null {
  const brandRe =
    brand === "cinepolis"
      ? /cinepolis/i
      : brand === "pvr" || brand === "inox"
        ? /pvr|inox/i
        : null;
  if (!brandRe) return null;

  // DOTD list style
  const list =
    brand === "cinepolis"
      ? html.match(/Cinepolis[^<\n]{0,80}?at\s+(\d+(?:\.\d+)?)%\s*Discount/i)
      : html.match(/Pvr(?:\s*Inox)?[^<\n]{0,80}?at\s+(\d+(?:\.\d+)?)%\s*Discount/i);
  if (list) {
    const n = clampPct(Number(list[1]));
    if (n != null) return n;
  }

  // Dedicated deal page: prefer (N%) when brand appears in title/og
  const titled = /cinepolis|pvr/i.test(html.match(/<title[^>]*>([^<]+)/i)?.[1] ?? "");
  if (titled && brandRe.test(html.match(/<title[^>]*>([^<]+)/i)?.[1] ?? "")) {
    const paren = html.match(/\((\d+(?:\.\d+)?)%\)/);
    if (paren) {
      const n = clampPct(Number(paren[1]));
      if (n != null) return n;
    }
  }

  // Fallback: first (N%) within ~200 chars of brand mention
  const idx = html.search(brandRe);
  if (idx >= 0) {
    const window = html.slice(idx, idx + 400);
    const paren = window.match(/\((\d+(?:\.\d+)?)%\)/);
    if (paren) {
      const n = clampPct(Number(paren[1]));
      if (n != null) return n;
    }
  }
  return null;
}

/**
 * Amazon search: prefer "Brand | Flat N% Off" / "Brand Gift card | Flat N% Off"
 * in alt / aria-label / title — ignore unrelated "Save 26%" widgets.
 */
export function parseAmazonBrandPct(html: string, brand: MovieBrand): number | null {
  const brandPat =
    brand === "cinepolis"
      ? /cin[eé]polis/i
      : brand === "pvr" || brand === "inox"
        ? /pvr(?:\s*inox)?|inox/i
        : null;
  if (!brandPat) return null;

  const hits: number[] = [];
  const re =
    /(?:alt|aria-label|title)="([^"]{10,200})"|>([^<]{10,160}Flat\s+\d+(?:\.\d+)?%\s*Off[^<]{0,40})</gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const text = (m[1] || m[2] || "").replace(/\s+/g, " ");
    if (!brandPat.test(text)) continue;
    const pct = text.match(/Flat\s+(\d+(?:\.\d+)?)\s*%/i) || text.match(/(\d+(?:\.\d+)?)\s*%\s*Off/i);
    if (!pct) continue;
    const n = clampPct(Number(pct[1]));
    if (n != null) hits.push(n);
  }
  if (!hits.length) return null;
  // Prefer the strongest brand-titled listing (Amazon often shows multiple face %).
  return Math.max(...hits);
}

/** Merge live scrape hits onto catalog rows. Failed scrapes keep catalog %. */
export function mergeLiveMovieOffers(
  liveHits: MovieGcLiveHit[],
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
    // Only mark unavailable when scrape explicitly says so — never on timeout/miss.
    if (hit.available === false) {
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
