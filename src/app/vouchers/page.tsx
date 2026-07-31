"use client";
import { Callout } from "@/components/Callout";
import { Icon } from "@/components/Icons";
import Link from "next/link";

type Offer = {
  source: string;
  merchant: string;
  discountPct: number;
  notes?: string;
};

/**
 * Snapshot discounts — not live-scraped.
 * CRED Store / Amazon brand voucher % rotate in-app; verify before buying.
 */
const OFFERS: Offer[] = [
  // CRED Store = gift-card section in the CRED app (Dreamplug is CRED's legal entity name)
  { source: "CRED Store (gift cards)", merchant: "Domino's", discountPct: 15, notes: "Verify live % in CRED → Store / Gift cards" },
  { source: "CRED Store (gift cards)", merchant: "Apollo 24/7", discountPct: 15 },
  { source: "CRED Store (gift cards)", merchant: "Lenskart", discountPct: 11 },
  { source: "CRED Store (gift cards)", merchant: "Uber", discountPct: 6.5 },
  { source: "CRED Store (gift cards)", merchant: "Reliance Trends", discountPct: 6 },
  { source: "CRED Store (gift cards)", merchant: "Decathlon", discountPct: 5 },
  { source: "CRED Store (gift cards)", merchant: "Flipkart", discountPct: 4 },
  { source: "CRED Store (gift cards)", merchant: "Myntra", discountPct: 4 },
  { source: "CRED Store (gift cards)", merchant: "Zepto", discountPct: 3 },
  { source: "CRED Store (gift cards)", merchant: "Croma", discountPct: 3 },
  { source: "CRED Store (gift cards)", merchant: "Amazon Shopping", discountPct: 1.7 },
  // Amazon brand vouchers
  { source: "Amazon Brand Vouchers", merchant: "Mainland China", discountPct: 20, notes: "Buy brand voucher on Amazon; pay ASV/balance — card earn is separate (see below)" },
  { source: "Amazon Brand Vouchers", merchant: "PVR INOX", discountPct: 17 },
  { source: "Amazon Brand Vouchers", merchant: "Aldo", discountPct: 12 },
  { source: "Amazon Brand Vouchers", merchant: "Jockey", discountPct: 12 },
  { source: "Amazon Brand Vouchers", merchant: "Lifestyle", discountPct: 5 },
  { source: "Amazon Brand Vouchers", merchant: "Pantaloons", discountPct: 5 },
  { source: "Amazon Brand Vouchers", merchant: "Uber", discountPct: 3 },
  { source: "Amazon Brand Vouchers", merchant: "Google Play", discountPct: 2 },
  // Kiwi merchant campaigns (separate from Neon milestone cashback)
  { source: "Kiwi merchant campaigns (when live)", merchant: "Amazon Shopping", discountPct: 10, notes: "Periodic in-app campaign, often ~₹50/txn cap — activate first" },
  { source: "Kiwi merchant campaigns (when live)", merchant: "Swiggy", discountPct: 10, notes: "Periodic campaign — not Neon milestone cashback" },
  { source: "Kiwi merchant campaigns (when live)", merchant: "Zepto", discountPct: 10, notes: "Periodic campaign — not Neon milestone cashback" },
  { source: "Kiwi merchant campaigns (when live)", merchant: "Zomato", discountPct: 10, notes: "Periodic campaign — not Neon milestone cashback" },
  // Scapia Store
  { source: "Scapia Store", merchant: "Travel apparel (50+ brands)", discountPct: 20, notes: "20% back as Scapia Coins, redeemable on travel" },
];

export default function VoucherStorePage() {
  const grouped: Record<string, Offer[]> = {};
  OFFERS.forEach((o) => {
    if (!grouped[o.source]) grouped[o.source] = [];
    grouped[o.source].push(o);
  });
  Object.values(grouped).forEach((arr) => arr.sort((a, b) => b.discountPct - a.discountPct));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Voucher Stores</h1>
        <p className="text-fg-muted mt-1 max-w-2xl text-sm leading-relaxed">
          Reference snapshot of gift-card / brand-voucher discounts.{" "}
          <b>Recommend does not use these snapshot % for ranking</b> — it asks you for the live CRED/CheQ %
          before comparing gift-card stacks. CashKaro rates refresh daily via scrape.
        </p>
      </div>

      <Callout tone="warning" title="Kiwi Neon is not “5% on every txn”">
        <ul className="list-disc pl-4 space-y-1.5">
          <li>
            <b>Instant:</b> Neon UPI scan &amp; pay earns <b>2%</b> as Kiwis (online redirect usually ~0.5%). Without Neon it’s 1.5% UPI.
          </li>
          <li>
            <b>Milestones:</b> At ₹50k / ₹1L / ₹1.5L eligible cycle spend you get a <b>one-time top-up</b> (extra Kiwis)
            so that year’s eligible spend is topped toward ~3% / ~4% / ~5% <em>effective</em> — credited later
            (typically end of next month), not 5% on each purchase as you pay.
          </li>
          <li>
            So “buy ASV with Kiwi for 5% + brand voucher 20% = 25%” on this page was wrong. Instant stack is closer to
            <b> brand discount + 2% UPI</b> (if it’s truly Kiwi UPI), with milestone chips only if/when you hit Neon thresholds.
          </li>
        </ul>
      </Callout>

      <Callout tone="success" title="Useful stack (corrected): Amazon brand vouchers">
        Buy the <b>brand voucher</b> on Amazon (Mainland China, PVR, etc.) using Amazon Shopping Voucher / balance when that fits.
        Fund ASV with whatever card/route <Link href="/recommend" className="text-accent hover:underline">Recommend</Link> ranks —
        do <b>not</b> assume Kiwi Neon pays 5% on that funding txn. Prefer Amazon Pay ICICI / Live+ / BOB when those beat Kiwi’s instant 2%.
      </Callout>

      <Callout tone="info" title="CRED Store = gift cards in the CRED app">
        “Dreamplug” is CRED’s company name. In the app, discounted brand GCs live under <b>CRED Store / Gift cards</b>
        (the section with Domino&apos;s, Lenskart, PVR, etc.). Pay with your best online card for that brand
        (Live+ 10% when eligible, ShopWise Amex ~4% net, BOB 3.75%). Enter the live % in Recommend when ranking movies/shopping.
      </Callout>

      {Object.entries(grouped).map(([source, offers]) => (
        <section key={source}>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Icon.Sparkles size={18} /> {source}
          </h2>
          <div className="card-shell">
            <table className="w-full text-sm">
              <thead className="text-fg-muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left p-3">Merchant</th>
                  <th className="text-right">Discount</th>
                  <th className="text-left p-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {offers.map((o, i) => (
                  <tr key={i} className="table-row">
                    <td className="p-3 font-medium">{o.merchant}</td>
                    <td className="text-right">
                      <span className={o.discountPct >= 10 ? "pill-success" : o.discountPct >= 5 ? "pill-info" : "pill-neutral"}>
                        {o.discountPct}% off
                      </span>
                    </td>
                    <td className="p-3 text-fg-muted text-xs">{o.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <Callout tone="warning" title="Keep in mind">
        <ul className="list-disc pl-4 space-y-1">
          <li><b>CRED Store discounts rotate</b> — check the CRED app before any planned spend; this table is a snapshot.</li>
          <li><b>Kiwi merchant 10% campaigns</b> are separate time-limited offers in Kiwi rewards — not the Neon milestone top-up.</li>
          <li><b>Amazon brand vouchers</b>: ASV vs Amazon Pay Gift Card rules vary; confirm Kiwi/Amazon exclusions before funding.</li>
          <li><b>Voucher expiries</b>: Amazon balance often ~1 year; brand vouchers often ~6 months. Buy for confirmed spend only.</li>
          <li><b>One-time use</b>: most brand vouchers are one-time — buy the amount you need.</li>
        </ul>
      </Callout>
    </div>
  );
}
