import type { TravelMode, TravelOffer, TravelPlatform } from "./types";

/**
 * Bank Instant Discount / platform coupons that reduce fare before card earn.
 * Volatile offers should be confirmed live (or overridden in the Travel UI).
 */
export const TRAVEL_OFFERS: readonly TravelOffer[] = [
  // —— Flights ——
  {
    id: "amazon_flight_prime_note",
    mode: "flight",
    platformIds: ["amazon_flight"],
    label: "Amazon Pay ICICI Prime earn (card stack — not Instant Discount)",
    discountPct: 0,
    cardId: "amazon_pay_icici",
    confidence: "stable",
    notes: "Earn is modeled via Recommend (5% Prime). No separate Instant Discount here.",
  },
  {
    id: "amex_mmt_rm",
    mode: "flight",
    platformIds: ["mmt_flight"],
    label: "Amex Reward Multiplier on MMT (portal earn)",
    discountPct: 0,
    cardId: "amex_gold",
    confidence: "typical",
    confirmLive: true,
    notes: "Must start from Amex RM / ShopWise → MMT. Modeled as ~5.8% earn in Recommend.",
  },
  {
    id: "sbi_cleartrip_partner",
    mode: "flight",
    platformIds: ["cleartrip_flight"],
    label: "SBI SimplyCLICK 10× Cleartrip partner",
    discountPct: 0,
    cardId: "sbi_simplyclick",
    confidence: "typical",
    notes: "Partner earn ≈ 2.5% — Recommend stacks this with Cashkaro when relevant.",
  },
  {
    id: "flight_bank_id_volatile",
    mode: ["flight"],
    platformIds: ["cleartrip_flight", "mmt_flight", "easemytrip_flight", "amazon_flight"],
    label: "Bank Instant Discount (live — enter ₹ if shown)",
    discountFlatInr: 0,
    confidence: "volatile",
    confirmLive: true,
    notes: "MMT/Cleartrip/Amazon often show card Instant Discounts at checkout. Enter the live ₹ in Travel overrides.",
  },

  // —— Trains ——
  {
    id: "amazon_train_2pct",
    mode: "train",
    platformIds: ["amazon_train"],
    label: "Amazon Pay ICICI ~2% on Amazon trains",
    discountPct: 0,
    cardId: "amazon_pay_icici",
    confidence: "typical",
    notes: "Earn via Recommend. Watch Amazon convenience fees vs IRCTC.",
  },
  {
    id: "irctc_no_amex",
    mode: "train",
    platformIds: ["irctc", "railone", "confirmtkt"],
    label: "IRCTC rails — prefer Visa/MC / UPI (Amex often declines)",
    discountPct: 0,
    confidence: "stable",
    notes: "Not a discount — ranking still attaches If Amex not accepted when Amex wins.",
  },

  // —— Buses ——
  {
    id: "amazon_bus_2pct",
    mode: "bus",
    platformIds: ["amazon_bus"],
    label: "Amazon Pay ICICI ~2% on Amazon bus",
    discountPct: 0,
    cardId: "amazon_pay_icici",
    confidence: "typical",
  },
  {
    id: "bus_bank_id_volatile",
    mode: "bus",
    platformIds: ["redbus", "abhibus", "amazon_bus"],
    label: "Bus platform Instant Discount (live — enter ₹)",
    discountFlatInr: 0,
    confidence: "volatile",
    confirmLive: true,
    notes: "RedBus / AbhiBus sometimes show bank offers at pay — enter live Instant Discount ₹.",
  },
];

function modesOf(o: TravelOffer): TravelMode[] {
  return Array.isArray(o.mode) ? o.mode : [o.mode];
}

export function offersForPlatform(platform: TravelPlatform, today?: string): TravelOffer[] {
  const todayMs = today ? new Date(today).getTime() : Date.now();
  return TRAVEL_OFFERS.filter((o) => {
    if (!modesOf(o).includes(platform.mode)) return false;
    if (o.platformIds.length && !o.platformIds.includes(platform.id)) return false;
    if (o.validUntil) {
      const end = new Date(o.validUntil).getTime();
      if (Number.isFinite(end) && todayMs > end) return false;
    }
    return true;
  });
}

/** Instant Discount ₹ for an offer given fare (+ optional live override). */
export function offerDiscountInr(
  offer: TravelOffer,
  fareInr: number,
  overrideInr?: number
): number {
  if (overrideInr != null && Number.isFinite(overrideInr) && overrideInr >= 0) {
    return Math.min(overrideInr, fareInr);
  }
  if (offer.confidence === "volatile" && (offer.discountFlatInr == null || offer.discountFlatInr <= 0) && !offer.discountPct) {
    return 0; // need live entry
  }
  if (offer.minFareInr != null && fareInr < offer.minFareInr) return 0;
  let d = 0;
  if (offer.discountPct && offer.discountPct > 0) d += (fareInr * offer.discountPct) / 100;
  if (offer.discountFlatInr && offer.discountFlatInr > 0) d += offer.discountFlatInr;
  if (offer.discountCapInr != null) d = Math.min(d, offer.discountCapInr);
  return Math.min(Math.max(0, d), fareInr);
}
