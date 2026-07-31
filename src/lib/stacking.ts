/**
 * Gift-card / voucher "funding layer" and Amazon Pay ICICI one-time welcome coupons.
 *
 * These are STACKABLE layers the recommender tries on top of card + Cashkaro:
 *   buy a discounted gift card (CRED / CheQ / ShopWise / brand store)
 *   → [click through Cashkaro] → shop at the merchant → pay with the gift card.
 *
 * NOTE: CRED/CheQ gift-card rates are app-dynamic and login-gated, so the values
 * below are typical/representative defaults. Verify the live rate in-app before
 * relying on a specific number. Update these as offers change.
 *
 * Rate precedence:
 *  1. Recommend widget live CRED % (credGiftCardPctOverride) — scoped to the
 *     selected theatre / matching merchant deal only
 *  2. Settings giftCardRateOverrides keyed by "STORE:Merchant"
 *  3. Defaults in GIFT_CARD_DEALS below
 */

export type GiftCardStore = "CRED" | "CheQ" | "ShopWise" | "Brand";

export type GiftCardDeal = {
  store: GiftCardStore;
  match: RegExp;
  merchantLabel: string;
  discountPct: number; // typical % off face value
  coinFunded?: boolean; // uses CRED coins / CheQ chips to boost discount
  notes: string;
};

/**
 * Representative gift-card discounts. Ranges seen in-app:
 *  - CRED store: 2–6% on popular brands (higher with "coins" boosts on select drops)
 *  - CheQ store: 1–5% (chips can add a little)
 *  - ShopWise (Amex Reward Multiplier): not a discount but 5× MR (handled separately as 5.8%)
 *  - Brand stores (Amazon Pay, Flipkart Gift, Myntra): occasional 2–5% drops
 */
export const GIFT_CARD_DEALS: GiftCardDeal[] = [
  { store: "CRED", match: /amazon/i, merchantLabel: "Amazon", discountPct: 2, coinFunded: true, notes: "CRED store Amazon Pay GC; coins can boost on select drops." },
  { store: "CRED", match: /flipkart/i, merchantLabel: "Flipkart", discountPct: 3, coinFunded: true, notes: "CRED Flipkart GC drops 2–5%." },
  { store: "CRED", match: /myntra/i, merchantLabel: "Myntra", discountPct: 5, coinFunded: true, notes: "Myntra GC often 5% on CRED." },
  { store: "CRED", match: /ajio/i, merchantLabel: "AJIO", discountPct: 5, coinFunded: true, notes: "AJIO GC ~5% on CRED." },
  { store: "CRED", match: /nykaa/i, merchantLabel: "Nykaa", discountPct: 4, coinFunded: true, notes: "Nykaa GC ~3–5%." },
  { store: "CRED", match: /tata\s*cliq|tatacliq/i, merchantLabel: "Tata CLiQ", discountPct: 4, coinFunded: true, notes: "" },
  { store: "CRED", match: /cleartrip/i, merchantLabel: "Cleartrip", discountPct: 3, coinFunded: true, notes: "Travel GC on CRED, occasional." },
  { store: "CRED", match: /\bswiggy\b/i, merchantLabel: "Swiggy", discountPct: 3, coinFunded: true, notes: "Swiggy money/GC on CRED." },
  { store: "CRED", match: /\bzomato\b/i, merchantLabel: "Zomato", discountPct: 3, coinFunded: true, notes: "" },
  { store: "CRED", match: /bookmyshow|\bbms\b/i, merchantLabel: "BookMyShow", discountPct: 3.75, coinFunded: true, notes: "BMS GC ~3.75%; custom amount OK. Prefer PVR/Cinepolis chain GCs when you know the theatre." },
  { store: "CRED", match: /\bdistrict\b/i, merchantLabel: "District", discountPct: 3.75, coinFunded: true, notes: "District GC ~3.75%; custom amount OK. Prefer chain GCs (Cinepolis/PVR) when booking those theatres." },
  { store: "CRED", match: /\bpvr\b/i, merchantLabel: "PVR", discountPct: 24, coinFunded: true, notes: "CRED Store PVR GC — typically ~24%; custom denomination available. Often beats District BOGO (₹250 cap) on larger bookings." },
  { store: "CRED", match: /\bcinepolis\b/i, merchantLabel: "Cinepolis", discountPct: 28, coinFunded: true, notes: "CRED Store Cinepolis GC — typically ~28%; custom denomination available. Usually the best movie stack vs BOGO on multi-ticket bookings." },
  { store: "CRED", match: /\binox\b/i, merchantLabel: "INOX", discountPct: 24, coinFunded: true, notes: "INOX / PVR INOX GC on CRED — treat like PVR (~24%); verify live %." },
  { store: "CRED", match: /reliance\s*digital|croma|vijay\s*sales/i, merchantLabel: "Electronics store", discountPct: 2, coinFunded: true, notes: "Electronics GC ~2%." },
  { store: "CheQ", match: /amazon/i, merchantLabel: "Amazon", discountPct: 2, coinFunded: true, notes: "CheQ chips can add a small boost." },
  { store: "CheQ", match: /flipkart/i, merchantLabel: "Flipkart", discountPct: 3, coinFunded: true, notes: "" },
  { store: "CheQ", match: /myntra/i, merchantLabel: "Myntra", discountPct: 4, coinFunded: true, notes: "" },
];

/** Stable key for a deal, used for live-rate overrides in Settings. */
export function giftCardKey(d: { store: GiftCardStore; merchantLabel: string }): string {
  return `${d.store}:${d.merchantLabel}`;
}

export function findGiftCardDeals(
  merchant: string,
  category: string,
  overrides: Record<string, number> = {}
): GiftCardDeal[] {
  const text = `${merchant} ${category}`;
  // best deal per store (after applying any live-rate overrides)
  const byStore = new Map<GiftCardStore, GiftCardDeal>();
  for (const raw of GIFT_CARD_DEALS) {
    if (!raw.match.test(text)) continue;
    const ov = overrides[giftCardKey(raw)];
    const d: GiftCardDeal = ov != null && Number.isFinite(ov) ? { ...raw, discountPct: ov } : raw;
    const existing = byStore.get(d.store);
    if (!existing || d.discountPct > existing.discountPct) byStore.set(d.store, d);
  }
  return Array.from(byStore.values()).filter((d) => d.discountPct > 0).sort((a, b) => b.discountPct - a.discountPct);
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
  match: RegExp; // tested against category + merchant
  pctBack: number; // % cashback
  capInr: number; // max cashback
};

/**
 * Typical Amazon Pay ICICI welcome coupons (one-time, per category, ~30–60 day window).
 * These vary by cohort — confirm the exact set in Amazon app → Amazon Pay ICICI → Offers.
 */
export const AMAZON_WELCOME_OFFERS: WelcomeOffer[] = [
  { id: "amz_shop", label: "100% up to ₹200 on first Amazon order", match: /amazon/i, pctBack: 100, capInr: 200 },
  { id: "amz_broadband", label: "25% up to ₹550 on first broadband bill", match: /broadband/i, pctBack: 25, capInr: 550 },
  { id: "amz_postpaid", label: "25% up to ₹500 on first postpaid bill", match: /postpaid/i, pctBack: 25, capInr: 500 },
  { id: "amz_dth", label: "25% up to ₹250 on first DTH recharge", match: /\bdth\b|\btv\b|tata\s*sky|dish\s*tv/i, pctBack: 25, capInr: 250 },
  { id: "amz_gas", label: "10% up to ₹250 on first gas booking", match: /\bgas\b/i, pctBack: 10, capInr: 250 },
  { id: "amz_elec", label: "20% up to ₹100 on first electricity bill", match: /electric/i, pctBack: 20, capInr: 100 },
  { id: "amz_prepaid", label: "50% up to ₹50 on first prepaid recharge", match: /mobile|recharge|prepaid/i, pctBack: 50, capInr: 50 },
];

/** Returns the first unclaimed welcome offer matching the expense, if any. */
export function findWelcomeOffer(merchant: string, category: string, claimedIds: string[]): WelcomeOffer | null {
  const text = `${merchant} ${category}`;
  for (const o of AMAZON_WELCOME_OFFERS) {
    if (claimedIds.includes(o.id)) continue;
    if (o.match.test(text)) return o;
  }
  return null;
}
