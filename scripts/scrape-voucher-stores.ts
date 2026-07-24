/**
 * Scrapes daily-rotating voucher store offers from CRED Dreamplug and Kiwi.
 * Runs via GitHub Actions weekly (or daily for these volatile feeds).
 *
 * Output: src/data/voucher-stores.generated.json
 *
 * NOTE: CRED Dreamplug and Kiwi are app-first. Their public web pages are
 * limited; production-grade scraping would need authenticated access. This
 * script is a scaffold — populate with manual rate updates when needed,
 * or extend with cookie-based authenticated fetches if you trust storing
 * session credentials.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";

type VoucherOffer = {
  source: "cred_dreamplug" | "kiwi" | "amazon_brand" | "scapia_store" | "cheq";
  merchant: string;
  faceValue?: number;
  discountPct: number; // % off face value
  notes?: string;
  scrapedAt: string;
};

const TODAY = new Date().toISOString();

// Manually maintained snapshot of typical offers as of May 2026.
// Replace with live scraping when the apps expose public APIs / pages.
const SNAPSHOT: VoucherOffer[] = [
  // CRED Dreamplug — typical daily offers
  { source: "cred_dreamplug", merchant: "Flipkart", discountPct: 4, notes: "Daily rotating; can be 3-6%", scrapedAt: TODAY },
  { source: "cred_dreamplug", merchant: "Myntra", discountPct: 4, scrapedAt: TODAY },
  { source: "cred_dreamplug", merchant: "Amazon Shopping", discountPct: 1.7, scrapedAt: TODAY },
  { source: "cred_dreamplug", merchant: "Uber", discountPct: 6.5, scrapedAt: TODAY },
  { source: "cred_dreamplug", merchant: "Dominos", discountPct: 15, scrapedAt: TODAY },
  { source: "cred_dreamplug", merchant: "Zepto", discountPct: 3, scrapedAt: TODAY },
  { source: "cred_dreamplug", merchant: "Lenskart", discountPct: 11, scrapedAt: TODAY },
  { source: "cred_dreamplug", merchant: "Decathlon", discountPct: 5, scrapedAt: TODAY },
  { source: "cred_dreamplug", merchant: "Croma", discountPct: 3, scrapedAt: TODAY },
  { source: "cred_dreamplug", merchant: "Reliance Trends", discountPct: 6, scrapedAt: TODAY },
  { source: "cred_dreamplug", merchant: "Apollo 24/7", discountPct: 15, scrapedAt: TODAY },
  { source: "cred_dreamplug", merchant: "Blinkit", discountPct: 4, scrapedAt: TODAY },

  // Amazon — native brand voucher discounts (sold on Amazon, paid via ASV)
  { source: "amazon_brand", merchant: "Mainland China", discountPct: 20, scrapedAt: TODAY },
  { source: "amazon_brand", merchant: "PVR INOX", discountPct: 17, scrapedAt: TODAY },
  { source: "amazon_brand", merchant: "Lifestyle", discountPct: 5, scrapedAt: TODAY },
  { source: "amazon_brand", merchant: "Pantaloons", discountPct: 5, scrapedAt: TODAY },
  { source: "amazon_brand", merchant: "Aldo", discountPct: 12, scrapedAt: TODAY },
  { source: "amazon_brand", merchant: "Jockey", discountPct: 12, scrapedAt: TODAY },
  { source: "amazon_brand", merchant: "Google Play", discountPct: 2, scrapedAt: TODAY },
  { source: "amazon_brand", merchant: "Uber", discountPct: 3, scrapedAt: TODAY },

  // Kiwi merchant offers (typically capped ₹50/txn, time-limited)
  { source: "kiwi", merchant: "Amazon Shopping (when active)", discountPct: 10, notes: "Cap ₹50/txn", scrapedAt: TODAY },
  { source: "kiwi", merchant: "Swiggy (when active)", discountPct: 10, notes: "Cap ₹50/txn", scrapedAt: TODAY },
  { source: "kiwi", merchant: "Zepto (when active)", discountPct: 10, notes: "Cap ₹50/txn", scrapedAt: TODAY },
  { source: "kiwi", merchant: "Zomato (when active)", discountPct: 10, notes: "Cap ₹50/txn", scrapedAt: TODAY },

  // Scapia Store (always-on)
  { source: "scapia_store", merchant: "Travel apparel (50+ brands)", discountPct: 20, notes: "20% back as Scapia Coins on Scapia Store purchases", scrapedAt: TODAY },
];

function main() {
  const out = { snapshotAt: TODAY, offers: SNAPSHOT };
  const target = join(process.cwd(), "src", "data", "voucher-stores.generated.json");
  writeFileSync(target, JSON.stringify(out, null, 2));
  console.log(`Wrote ${SNAPSHOT.length} offers to ${target}`);
  console.log(`\nTop discounts (≥10%):`);
  SNAPSHOT.filter((o) => o.discountPct >= 10).forEach((o) => {
    console.log(`  - ${o.source}: ${o.merchant} = ${o.discountPct}% off ${o.notes ? `(${o.notes})` : ""}`);
  });
}

main();
