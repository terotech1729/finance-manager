import type { CashkaroRate } from "./types";

// Cashkaro rates as of 2026-05-30 (manually compiled).
// The /api/scrape-cashkaro endpoint refreshes these from Cashkaro store pages.
// In production, this file is overwritten by the scraper.

export const CASHKARO_RATES: readonly CashkaroRate[] = [
  // Reliable trackers
  { merchant: "Flipkart", category: "Fashion / Lifestyle", rate: "5.2%", minRate: 5.2, maxRate: 5.2, zone: "reliable" },
  { merchant: "Flipkart", category: "Furniture / Office", rate: "0.65%", minRate: 0.65, maxRate: 0.65, zone: "shopwise" },
  { merchant: "Myntra", rate: "5–7%", minRate: 5, maxRate: 7, zone: "reliable" },
  { merchant: "Ajio", rate: "5–7%", minRate: 5, maxRate: 7, zone: "reliable" },
  { merchant: "Tata CLiQ", rate: "3–6%", minRate: 3, maxRate: 6, zone: "reliable" },
  { merchant: "Nykaa", rate: "5–8%", minRate: 5, maxRate: 8, zone: "reliable", notes: "If using BLCK 5%-off coupon: try anyway, BLCK fallback = 10%" },
  { merchant: "BookMyShow", rate: "5–10%", minRate: 5, maxRate: 10, zone: "reliable" },
  { merchant: "Lenskart", rate: "5–10%", minRate: 5, maxRate: 10, zone: "reliable" },
  { merchant: "boAt", rate: "5–10%", minRate: 5, maxRate: 10, zone: "reliable" },
  { merchant: "Mamaearth", rate: "5–10%", minRate: 5, maxRate: 10, zone: "reliable" },
  { merchant: "Meesho", rate: "varies", minRate: 1, maxRate: 8, zone: "reliable" },
  { merchant: "Zomato", rate: "3–5%", minRate: 3, maxRate: 5, zone: "reliable" },
  { merchant: "Booking.com", rate: "3–6%", minRate: 3, maxRate: 6, zone: "reliable" },
  { merchant: "Agoda", rate: "3–6%", minRate: 3, maxRate: 6, zone: "reliable" },
  { merchant: "MakeMyTrip", rate: "2–4%", minRate: 2, maxRate: 4, zone: "reliable" },
  { merchant: "EaseMyTrip", rate: "2–4%", minRate: 2, maxRate: 4, zone: "reliable" },

  // Try anyway (less reliable but worst case = direct)
  { merchant: "Amazon", category: "Beauty / Apparel / Luxury / Bags / Shoes", rate: "5%", minRate: 5, maxRate: 5, zone: "try" },
  { merchant: "Amazon", category: "Sports / Baby", rate: "3.5%", minRate: 3.5, maxRate: 3.5, zone: "try" },
  { merchant: "Amazon", category: "Kitchen / Home / Grocery", rate: "2.5%", minRate: 2.5, maxRate: 2.5, zone: "try" },
  { merchant: "Amazon", category: "Electronics", rate: "~1%", minRate: 1, maxRate: 1, zone: "shopwise" },
  { merchant: "Amazon", category: "Recharge / Bills", rate: "flat ₹1.5", minRate: 0, maxRate: 0, flatInr: 1.5, zone: "try", notes: "Amazon recharge/bills Cashkaro link pays a flat ₹1.5 — stacks on top of card + welcome." },
  { merchant: "Cleartrip", category: "Hotels", rate: "3–5%", minRate: 3, maxRate: 5, zone: "try", notes: "Try Cashkaro even with BLCK HDFCCC coupon. Fallback to BLCK 24% if Cashkaro fails." },
  { merchant: "Cleartrip", category: "Flights", rate: "1–3%", minRate: 1, maxRate: 3, zone: "try", notes: "Try Cashkaro even with BLCK HDFCCC coupon. Fallback to BLCK 11% if Cashkaro fails." },
  { merchant: "Yatra", rate: "1–3%", minRate: 1, maxRate: 3, zone: "reliable" },

  // Not on Cashkaro
  { merchant: "IndiGo", rate: "n/a (not on Cashkaro)", minRate: 0, maxRate: 0, zone: "na" },
  { merchant: "Swiggy", rate: "n/a (not on Cashkaro)", minRate: 0, maxRate: 0, zone: "na" },
];

export function findCashkaro(merchant: string, category?: string): CashkaroRate | undefined {
  const lower = merchant.toLowerCase();
  const matches = CASHKARO_RATES.filter((r) => r.merchant.toLowerCase() === lower);
  if (matches.length === 0) return undefined;
  if (category) {
    const exact = matches.find((r) => r.category && category.toLowerCase().includes(r.category.toLowerCase().split(" ")[0]));
    if (exact) return exact;
  }
  return matches[0];
}
