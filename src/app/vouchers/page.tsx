"use client";
import { Callout } from "@/components/Callout";
import { Icon } from "@/components/Icons";

type Offer = {
  source: string;
  merchant: string;
  discountPct: number;
  notes?: string;
};

const OFFERS: Offer[] = [
  // CRED Dreamplug
  { source: "CRED Dreamplug", merchant: "Domino's", discountPct: 15, notes: "Pay with online card → +5% if SBI Cashback (effective 20%)" },
  { source: "CRED Dreamplug", merchant: "Apollo 24/7", discountPct: 15 },
  { source: "CRED Dreamplug", merchant: "Lenskart", discountPct: 11 },
  { source: "CRED Dreamplug", merchant: "Uber", discountPct: 6.5 },
  { source: "CRED Dreamplug", merchant: "Reliance Trends", discountPct: 6 },
  { source: "CRED Dreamplug", merchant: "Decathlon", discountPct: 5 },
  { source: "CRED Dreamplug", merchant: "Flipkart", discountPct: 4 },
  { source: "CRED Dreamplug", merchant: "Myntra", discountPct: 4 },
  { source: "CRED Dreamplug", merchant: "Zepto", discountPct: 3 },
  { source: "CRED Dreamplug", merchant: "Croma", discountPct: 3 },
  { source: "CRED Dreamplug", merchant: "Amazon Shopping", discountPct: 1.7 },
  // Amazon brand vouchers
  { source: "Amazon Brand Vouchers", merchant: "Mainland China", discountPct: 20, notes: "Stack with Kiwi 5% via ASV = ~25% effective" },
  { source: "Amazon Brand Vouchers", merchant: "PVR INOX", discountPct: 17 },
  { source: "Amazon Brand Vouchers", merchant: "Aldo", discountPct: 12 },
  { source: "Amazon Brand Vouchers", merchant: "Jockey", discountPct: 12 },
  { source: "Amazon Brand Vouchers", merchant: "Lifestyle", discountPct: 5 },
  { source: "Amazon Brand Vouchers", merchant: "Pantaloons", discountPct: 5 },
  { source: "Amazon Brand Vouchers", merchant: "Uber", discountPct: 3 },
  { source: "Amazon Brand Vouchers", merchant: "Google Play", discountPct: 2 },
  // Kiwi (when active)
  { source: "Kiwi (when active)", merchant: "Amazon Shopping", discountPct: 10, notes: "Cap ₹50/txn — periodic offer" },
  { source: "Kiwi (when active)", merchant: "Swiggy", discountPct: 10, notes: "Cap ₹50/txn — periodic offer" },
  { source: "Kiwi (when active)", merchant: "Zepto", discountPct: 10, notes: "Cap ₹50/txn — periodic offer" },
  { source: "Kiwi (when active)", merchant: "Zomato", discountPct: 10, notes: "Cap ₹50/txn — periodic offer" },
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
        <p className="text-fg-muted mt-1">Daily-rotating gift card discounts that stack on top of card rewards. Check daily before any planned spend.</p>
      </div>

      <Callout tone="success" title="🏆 Best stack: Amazon Brand Vouchers via Kiwi (5%) → 10–25% effective">
        Buy <b>Amazon Shopping Voucher</b> (NOT gift card) on Amazon, paying with Kiwi RuPay (Neon = 5% cashback). Use the ASV to buy a brand voucher on Amazon (e.g., Mainland China at 20% off, PVR at 17% off). Net: 5% Kiwi + brand discount = up to 25% effective.
      </Callout>

      <Callout tone="info" title="🏆 Second best: CRED Dreamplug + best online card">
        CRED's Dreamplug section sells discounted brand vouchers daily. Pay with your best online card (HSBC Live+ 10% when eligible, Amex Gold via ShopWise ≈ 4% net, BOB Eterna = 3.75%). Net: Dreamplug discount + card cashback.
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
          <li><b>CRED Dreamplug discounts rotate daily</b> — check the CRED app each morning before any planned spend.</li>
          <li><b>Kiwi merchant offers are time-limited campaigns</b> (e.g., monthly seasonal). Activate in Kiwi rewards section first.</li>
          <li><b>Amazon brand vouchers</b>: pay via Amazon Shopping Voucher (ASV), not Amazon Pay Gift Card — Amazon Pay GCs are excluded from Kiwi 5%.</li>
          <li><b>Voucher expiries</b>: Amazon balance lasts 1 year; brand vouchers often 6 months. Don't hoard, only buy when you have a confirmed spend.</li>
          <li><b>One-time use</b>: most brand vouchers (Domino's, Shoppers Stop) are one-time. Buy the exact amount you need.</li>
        </ul>
      </Callout>
    </div>
  );
}
