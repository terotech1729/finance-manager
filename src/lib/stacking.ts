/**
 * Gift-card / voucher "funding layer" and Amazon Pay ICICI one-time welcome coupons.
 *
 * STACKABLE: buy discounted GC (CRED / CheQ / Amazon brand) → [Cashkaro] → shop → pay with GC.
 *
 * Rate precedence:
 *  1. Recommend widget live CRED % (credGiftCardPctOverride) — matching merchant/theatre only
 *  2. Settings giftCardRateOverrides keyed by "STORE:Merchant"
 *  3. Catalog defaults below (stable / typical) — used for ranking without asking
 *
 * Only "volatile" deals or unknown brands require a live % prompt.
 */

export type GiftCardStore = "CRED" | "CheQ" | "ShopWise" | "Brand" | "Woohoo" | "GyFTR" | "magicpin" | "Amazon";

/** How confidently we can rank without asking the user. */
export type GiftCardConfidence = "stable" | "typical" | "volatile";

export type GiftCardDeal = {
  store: GiftCardStore;
  match: RegExp;
  merchantLabel: string;
  discountPct: number;
  coinFunded?: boolean;
  /**
   * stable  = long-standing rates — rank freely
   * typical = usual in-app band — rank freely; optional live override
   * volatile = rotates hard — ask before ranking
   */
  confidence: GiftCardConfidence;
  notes: string;
};

/**
 * Catalog of gift-card discounts we trust enough to rank.
 * Cinema rates rotate — Recommend live-fetches CRED/Woohoo/GyFTR/Amazon at ranking time.
 */
export const GIFT_CARD_DEALS: GiftCardDeal[] = [
  // Cinema — CRED back in rotation (Aug 2026); still confirm live %
  { store: "CRED", match: /\bcinepolis\b/i, merchantLabel: "Cinepolis", discountPct: 26, coinFunded: true, confidence: "volatile", notes: "CRED Cinepolis rotates (often ~26–29%); live-fetched at recommend." },
  { store: "CRED", match: /\bpvr\b|\binox\b/i, merchantLabel: "PVR", discountPct: 25, coinFunded: true, confidence: "volatile", notes: "CRED PVR rotates; live-fetched when Desidime/DOTD posts it." },
  { store: "Woohoo", match: /\bcinepolis\b/i, merchantLabel: "Cinepolis", discountPct: 28, confidence: "typical", notes: "Woohoo Cinepolis GC — often ~28% with code WOOHOO; confirm live." },
  { store: "Woohoo", match: /\bpvr\b|\binox\b/i, merchantLabel: "PVR INOX", discountPct: 25, confidence: "typical", notes: "Woohoo PVR INOX — often ~25% when promo live." },
  { store: "magicpin", match: /\bpvr\b/i, merchantLabel: "PVR", discountPct: 19, confidence: "typical", notes: "magicpin PVR ~19–20%; may exclude Opulent / some INOX." },
  { store: "GyFTR", match: /\bpvr\b|\binox\b/i, merchantLabel: "PVR INOX", discountPct: 16, confidence: "stable", notes: "GyFTR public PVR INOX ~16%." },
  { store: "GyFTR", match: /\bcinepolis\b/i, merchantLabel: "Cinepolis", discountPct: 14, confidence: "stable", notes: "GyFTR Cinepolis ~14%." },
  { store: "Amazon", match: /\bcinepolis\b/i, merchantLabel: "Cinepolis", discountPct: 12, confidence: "typical", notes: "Amazon Cinepolis e-GC — usually thinner than CRED/Woohoo." },
  { store: "Amazon", match: /\bpvr\b|\binox\b/i, merchantLabel: "PVR INOX", discountPct: 12, confidence: "typical", notes: "Amazon Pine Labs PVR INOX e-GC ~12%." },
  // CRED — thin BMS/District
  { store: "CRED", match: /bookmyshow|\bbms\b/i, merchantLabel: "BookMyShow", discountPct: 3.75, coinFunded: true, confidence: "typical", notes: "BMS GC ~3.75%; prefer chain GCs when theatre known." },
  { store: "CRED", match: /\bdistrict\b/i, merchantLabel: "District", discountPct: 3.75, coinFunded: true, confidence: "typical", notes: "District GC ~3.75%." },
  // CRED — shopping / food (typical band)
  { store: "CRED", match: /amazon/i, merchantLabel: "Amazon", discountPct: 2, coinFunded: true, confidence: "typical", notes: "CRED Amazon Pay GC ~2%." },
  { store: "CRED", match: /flipkart/i, merchantLabel: "Flipkart", discountPct: 3, coinFunded: true, confidence: "typical", notes: "Flipkart GC usually 2–5%." },
  { store: "CRED", match: /myntra/i, merchantLabel: "Myntra", discountPct: 5, coinFunded: true, confidence: "typical", notes: "Myntra GC often ~5%." },
  { store: "CRED", match: /ajio/i, merchantLabel: "AJIO", discountPct: 5, coinFunded: true, confidence: "typical", notes: "AJIO GC ~5%." },
  { store: "CRED", match: /nykaa/i, merchantLabel: "Nykaa", discountPct: 4, coinFunded: true, confidence: "typical", notes: "Nykaa GC ~3–5%." },
  { store: "CRED", match: /tata\s*cliq|tatacliq/i, merchantLabel: "Tata CLiQ", discountPct: 4, coinFunded: true, confidence: "typical", notes: "" },
  { store: "CRED", match: /cleartrip/i, merchantLabel: "Cleartrip", discountPct: 3, coinFunded: true, confidence: "typical", notes: "Travel GC, occasional." },
  // Swiggy / Zomato GCs are often absent in CRED/CheQ — don't catalog-rank them.
  { store: "CRED", match: /lenskart/i, merchantLabel: "Lenskart", discountPct: 11, coinFunded: true, confidence: "typical", notes: "Often ~11% on CRED; override if live differs." },
  { store: "CRED", match: /decathlon/i, merchantLabel: "Decathlon", discountPct: 5, coinFunded: true, confidence: "typical", notes: "" },
  { store: "CRED", match: /croma|reliance\s*digital|vijay\s*sales/i, merchantLabel: "Electronics store", discountPct: 2, coinFunded: true, confidence: "typical", notes: "Electronics GC ~2%." },
  { store: "CRED", match: /zepto/i, merchantLabel: "Zepto", discountPct: 3, coinFunded: true, confidence: "typical", notes: "" },
  // CRED — volatile (ask before ranking)
  { store: "CRED", match: /domino/i, merchantLabel: "Domino's", discountPct: 15, coinFunded: true, confidence: "volatile", notes: "Food GCs rotate — confirm live %." },
  { store: "CRED", match: /uber/i, merchantLabel: "Uber", discountPct: 6.5, coinFunded: true, confidence: "volatile", notes: "Uber GC % moves — confirm live." },
  { store: "CRED", match: /apollo/i, merchantLabel: "Apollo 24/7", discountPct: 15, coinFunded: true, confidence: "volatile", notes: "Rotates — confirm live %." },
  // CheQ
  { store: "CheQ", match: /amazon/i, merchantLabel: "Amazon", discountPct: 2, coinFunded: true, confidence: "typical", notes: "CheQ chips can add a small boost." },
  { store: "CheQ", match: /flipkart/i, merchantLabel: "Flipkart", discountPct: 3, coinFunded: true, confidence: "typical", notes: "" },
  { store: "CheQ", match: /myntra/i, merchantLabel: "Myntra", discountPct: 4, coinFunded: true, confidence: "typical", notes: "" },
  // Amazon brand vouchers
  { store: "Brand", match: /mainland\s*china/i, merchantLabel: "Mainland China", discountPct: 20, confidence: "typical", notes: "Amazon brand voucher." },
  { store: "Brand", match: /pvr|inox/i, merchantLabel: "PVR INOX (Amazon)", discountPct: 12, confidence: "typical", notes: "Amazon brand voucher for PVR/INOX (~12% live)." },
  { store: "Brand", match: /\baldo\b/i, merchantLabel: "Aldo", discountPct: 12, confidence: "typical", notes: "Amazon brand voucher." },
  { store: "Brand", match: /jockey/i, merchantLabel: "Jockey", discountPct: 12, confidence: "typical", notes: "Amazon brand voucher." },
  { store: "Brand", match: /lifestyle/i, merchantLabel: "Lifestyle", discountPct: 5, confidence: "typical", notes: "Amazon brand voucher." },
  { store: "Brand", match: /pantaloons/i, merchantLabel: "Pantaloons", discountPct: 5, confidence: "typical", notes: "Amazon brand voucher." },
];

export function giftCardKey(d: { store: GiftCardStore; merchantLabel: string }): string {
  return `${d.store}:${d.merchantLabel}`;
}

/**
 * % to use for ranking.
 * live → Settings → catalog (stable/typical). Volatile needs live/Settings.
 */
export function rankingGiftCardPct(
  deal: GiftCardDeal,
  overrides: Record<string, number> = {},
  credLivePct?: number,
  credLiveApplies = true
): { pct: number; source: "live" | "settings" | "catalog" } | null {
  if (deal.store === "CRED" && credLiveApplies && credLivePct != null && credLivePct > 0) {
    return { pct: credLivePct, source: "live" };
  }
  const ov = overrides[giftCardKey(deal)];
  if (ov != null && Number.isFinite(ov) && ov > 0) return { pct: ov, source: "settings" };
  if (deal.confidence === "volatile") return null;
  if (deal.discountPct > 0) return { pct: deal.discountPct, source: "catalog" };
  return null;
}

/** Lookup helper for Settings / movie brands. */
export function resolvedGiftCardPct(
  store: GiftCardStore,
  merchantLabel: string,
  overrides: Record<string, number> = {},
  credLivePct?: number
): number | null {
  if (store === "CRED" && credLivePct != null && credLivePct > 0) return credLivePct;
  const ov = overrides[giftCardKey({ store, merchantLabel })];
  if (ov != null && Number.isFinite(ov) && ov > 0) return ov;
  const deal = GIFT_CARD_DEALS.find((d) => d.store === store && d.merchantLabel === merchantLabel);
  if (deal && deal.confidence !== "volatile") return deal.discountPct;
  return null;
}

/** Shopping/movie-ish query with no catalog match → ask for live %. */
export function isUnknownGiftCardBrand(merchant: string, category: string): boolean {
  const t = `${merchant} ${category}`;
  if (!/online|fashion|electronics|shopping|apparel|movie|cinema|bookmyshow|pvr|cinepolis|gift/i.test(t)) {
    return false;
  }
  return !GIFT_CARD_DEALS.some((d) => d.match.test(t));
}

export function findGiftCardDeals(
  merchant: string,
  category: string,
  overrides: Record<string, number> = {}
): GiftCardDeal[] {
  const text = `${merchant} ${category}`;
  // Prefer best deal overall (not only one per store) so CRED cinema isn't dropped for CheQ.
  const matched: GiftCardDeal[] = [];
  for (const raw of GIFT_CARD_DEALS) {
    if (!raw.match.test(text)) continue;
    const ov = overrides[giftCardKey(raw)];
    const d: GiftCardDeal = ov != null && Number.isFinite(ov) ? { ...raw, discountPct: ov } : raw;
    matched.push(d);
  }
  // Dedup by store+label
  const byKey = new Map<string, GiftCardDeal>();
  for (const d of matched) {
    const k = giftCardKey(d);
    const prev = byKey.get(k);
    if (!prev || d.discountPct > prev.discountPct) byKey.set(k, d);
  }
  return Array.from(byKey.values()).filter((d) => d.discountPct > 0).sort((a, b) => b.discountPct - a.discountPct);
}

/** Unique (store, merchant) deals for the Settings live-rate editor. */
export function uniqueGiftCardDeals(): { key: string; store: GiftCardStore; merchantLabel: string; defaultPct: number }[] {
  const seen = new Map<string, { key: string; store: GiftCardStore; merchantLabel: string; defaultPct: number }>();
  for (const d of GIFT_CARD_DEALS) {
    const key = giftCardKey(d);
    if (!seen.has(key)) seen.set(key, { key, store: d.store, merchantLabel: d.merchantLabel, defaultPct: d.discountPct });
  }
  return Array.from(seen.values());
}

/* ---------------- Amazon Pay ICICI one-time welcome coupons ---------------- */

export type WelcomeOffer = {
  id: string;
  label: string;
  match: RegExp;
  pctBack: number;
  capInr: number;
};

export const AMAZON_WELCOME_OFFERS: WelcomeOffer[] = [
  { id: "amz_shop", label: "100% up to ₹200 on first Amazon order", match: /amazon/i, pctBack: 100, capInr: 200 },
  { id: "amz_broadband", label: "25% up to ₹550 on first broadband bill", match: /broadband/i, pctBack: 25, capInr: 550 },
  { id: "amz_postpaid", label: "25% up to ₹500 on first postpaid bill", match: /postpaid/i, pctBack: 25, capInr: 500 },
  { id: "amz_dth", label: "25% up to ₹250 on first DTH recharge", match: /\bdth\b|\btv\b|tata\s*sky|dish\s*tv/i, pctBack: 25, capInr: 250 },
  { id: "amz_gas", label: "10% up to ₹250 on first gas booking", match: /\bgas\b/i, pctBack: 10, capInr: 250 },
  { id: "amz_elec", label: "20% up to ₹100 on first electricity bill", match: /electric/i, pctBack: 20, capInr: 100 },
  { id: "amz_prepaid", label: "50% up to ₹50 on first prepaid recharge", match: /mobile|recharge|prepaid/i, pctBack: 50, capInr: 50 },
];

export function findWelcomeOffer(merchant: string, category: string, claimedIds: string[]): WelcomeOffer | null {
  const text = `${merchant} ${category}`;
  for (const o of AMAZON_WELCOME_OFFERS) {
    if (claimedIds.includes(o.id)) continue;
    if (o.match.test(text)) return o;
  }
  return null;
}
