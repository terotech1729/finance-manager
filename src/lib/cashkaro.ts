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
  { merchant: "Nykaa", rate: "5–8%", minRate: 5, maxRate: 8, zone: "reliable", notes: "Cashkaro → BOB Eterna 5× (or Live+ 10% if shopping MCC and under accel cap)." },
  { merchant: "BookMyShow", rate: "5–10%", minRate: 5, maxRate: 10, zone: "reliable" },
  { merchant: "Lenskart", rate: "5–10%", minRate: 5, maxRate: 10, zone: "reliable" },
  { merchant: "boAt", rate: "5–10%", minRate: 5, maxRate: 10, zone: "reliable" },
  { merchant: "Mamaearth", rate: "5–10%", minRate: 5, maxRate: 10, zone: "reliable" },
  { merchant: "Meesho", rate: "varies", minRate: 1, maxRate: 8, zone: "reliable" },
  { merchant: "Zomato", rate: "3–5%", minRate: 3, maxRate: 5, zone: "reliable" },
  { merchant: "Booking.com", rate: "3–6%", minRate: 3, maxRate: 6, zone: "reliable", notes: "Hotels. Stack with BOB 5× travel when booking through Cashkaro." },
  { merchant: "Agoda", rate: "flat 7%", minRate: 7, maxRate: 7, zone: "reliable", notes: "Jul 2026: Flat 7% Cashkaro on Agoda hotel bookings. Stack with BOB 5×." },
  { merchant: "MakeMyTrip", category: "Hotels", rate: "flat ₹140", minRate: 0, maxRate: 0, flatInr: 140, zone: "reliable", notes: "Domestic hotels over ₹1,000 → flat ₹140 Cashkaro (check live)." },
  { merchant: "MakeMyTrip", category: "Flights", rate: "flat ~₹90", minRate: 0, maxRate: 0, flatInr: 90, zone: "try", notes: "Domestic flights Cashkaro often flat ₹ — verify on store page." },
  { merchant: "EaseMyTrip", rate: "2–4%", minRate: 2, maxRate: 4, zone: "reliable" },
  { merchant: "Yatra", rate: "1–3%", minRate: 1, maxRate: 3, zone: "reliable" },
  { merchant: "Cleartrip", category: "Hotels", rate: "flat ₹180", minRate: 0, maxRate: 0, flatInr: 180, zone: "try", notes: "Domestic hotels — flat ₹180 Cashkaro typical; verify live." },
  { merchant: "Cleartrip", category: "Flights", rate: "flat ₹45", minRate: 0, maxRate: 0, flatInr: 45, zone: "try", notes: "Flights — flat ₹45 Cashkaro typical; verify live." },
  { merchant: "RedBus", rate: "try", minRate: 1, maxRate: 3, zone: "try", notes: "Bus bookings — verify Cashkaro store; Amazon bus often simpler at 2% AP ICICI." },

  // Try anyway (less reliable but worst case = direct)
  { merchant: "Amazon", category: "Beauty / Apparel / Luxury / Bags / Shoes", rate: "5%", minRate: 5, maxRate: 5, zone: "try" },
  { merchant: "Amazon", category: "Sports / Baby", rate: "3.5%", minRate: 3.5, maxRate: 3.5, zone: "try" },
  { merchant: "Amazon", category: "Kitchen / Home / Grocery", rate: "2.5%", minRate: 2.5, maxRate: 2.5, zone: "try" },
  { merchant: "Amazon", category: "Electronics", rate: "~1%", minRate: 1, maxRate: 1, zone: "shopwise" },
  { merchant: "Amazon", category: "Recharge / Bills", rate: "flat ₹1.5", minRate: 0, maxRate: 0, flatInr: 1.5, zone: "try", notes: "Amazon recharge/bills Cashkaro link pays a flat ₹1.5 — stacks on top of card + welcome." },
  { merchant: "Amazon", category: "Travel", rate: "n/a (card earn is the win)", minRate: 0, maxRate: 0, zone: "na", notes: "Book flights/hotels/bus/train on Amazon → pay Amazon Pay ICICI (5%/3% flights&hotels; ~2% bus/train). Cashkaro Amazon travel tracking is weak." },

  // Not on Cashkaro
  { merchant: "IndiGo", rate: "n/a (not on Cashkaro)", minRate: 0, maxRate: 0, zone: "na" },
  { merchant: "Swiggy", rate: "n/a (not on Cashkaro)", minRate: 0, maxRate: 0, zone: "na" },
];

/** Common nicknames / typos → canonical Cashkaro merchant name. */
const MERCHANT_ALIASES: { pattern: RegExp; canonical: string }[] = [
  { pattern: /\bbook\s*my\s*show\b|\bbms\b/i, canonical: "BookMyShow" },
  { pattern: /\bflipkart\b|\bfk\b/i, canonical: "Flipkart" },
  { pattern: /\bmyntra\b/i, canonical: "Myntra" },
  { pattern: /\bajio\b/i, canonical: "Ajio" },
  { pattern: /\bnykaa\b/i, canonical: "Nykaa" },
  { pattern: /\btata\s*cliq\b|\btatacliq\b/i, canonical: "Tata CLiQ" },
  { pattern: /\bzomato\b/i, canonical: "Zomato" },
  { pattern: /\bcleartrip\b/i, canonical: "Cleartrip" },
  { pattern: /\bmakemytrip\b|\bmmt\b/i, canonical: "MakeMyTrip" },
  { pattern: /\beasemytrip\b/i, canonical: "EaseMyTrip" },
  { pattern: /\bbooking\.com\b/i, canonical: "Booking.com" },
  { pattern: /\bagoda\b/i, canonical: "Agoda" },
  { pattern: /\byatra\b/i, canonical: "Yatra" },
  { pattern: /\bredbus\b|\bred\s*bus\b/i, canonical: "RedBus" },
  { pattern: /\blenskart\b/i, canonical: "Lenskart" },
  { pattern: /\bboat\b/i, canonical: "boAt" },
  { pattern: /\bmamaearth\b/i, canonical: "Mamaearth" },
  { pattern: /\bmeesho\b/i, canonical: "Meesho" },
  { pattern: /\bamazon\b/i, canonical: "Amazon" },
  { pattern: /\bindigo\b/i, canonical: "IndiGo" },
  { pattern: /\bswiggy\b/i, canonical: "Swiggy" },
];

/** Resolve free-text merchant ("bms tickets") to a Cashkaro table name. */
export function resolveCashkaroMerchant(merchant: string): string {
  const raw = (merchant || "").trim();
  if (!raw) return raw;
  const lower = raw.toLowerCase();
  // Exact table hit first
  const exact = CASHKARO_RATES.find((r) => r.merchant.toLowerCase() === lower);
  if (exact) return exact.merchant;
  for (const a of MERCHANT_ALIASES) {
    if (a.pattern.test(raw)) return a.canonical;
  }
  // Substring against known merchants (longest first)
  const names = [...new Set(CASHKARO_RATES.map((r) => r.merchant))].sort((a, b) => b.length - a.length);
  for (const name of names) {
    if (lower.includes(name.toLowerCase())) return name;
  }
  return raw;
}

export function findCashkaro(merchant: string, category?: string): CashkaroRate | undefined {
  const resolved = resolveCashkaroMerchant(merchant);
  const lower = resolved.toLowerCase();
  const matches = CASHKARO_RATES.filter((r) => r.merchant.toLowerCase() === lower);
  if (matches.length === 0) return undefined;
  if (category) {
    const exact = matches.find((r) => r.category && category.toLowerCase().includes(r.category.toLowerCase().split(" ")[0]));
    if (exact) return exact;
  }
  return matches[0];
}
