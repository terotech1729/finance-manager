"use client";
import { CASHKARO_RATES } from "@/lib/cashkaro";
import { Callout } from "@/components/Callout";
import { Icon } from "@/components/Icons";

export default function CashkaroPage() {
  const groups = {
    reliable: CASHKARO_RATES.filter((r) => r.zone === "reliable"),
    try: CASHKARO_RATES.filter((r) => r.zone === "try"),
    shopwise: CASHKARO_RATES.filter((r) => r.zone === "shopwise"),
    na: CASHKARO_RATES.filter((r) => r.zone === "na"),
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Icon.Sparkles /> Cashkaro Routes
        </h1>
        <p className="text-fg-muted mt-1">Always-try policy: worst case = direct card rewards (no loss); best case = bonus cashback.</p>
      </div>

      <Callout tone="info" title="Universal workflow">
        1) Open Cashkaro app first, search merchant. 2) Empty merchant cart. 3) Click through Cashkaro (fresh tab). 4) Add items, apply best coupon (bank coupon if higher). 5) Pay with credit card directly (no wallet, no Amazon Pay voucher, no EMI). 6) Screenshot order ID. 7) T+30 days, file ticket if missing.
      </Callout>

      <section>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-success">
          <span className="pill-success">RELIABLE</span> Stack with confidence
        </h2>
        <div className="card-shell">
          <table className="w-full text-sm">
            <thead className="text-fg-muted text-xs uppercase tracking-wide">
              <tr><th className="text-left p-3">Merchant</th><th className="text-left">Category</th><th className="text-right p-3">Cashkaro Rate</th></tr>
            </thead>
            <tbody>
              {groups.reliable.map((r, i) => (
                <tr key={i} className="table-row">
                  <td className="p-3 font-medium">{r.merchant}</td>
                  <td className="text-fg-muted">{r.category ?? "—"}</td>
                  <td className="text-right p-3 font-semibold text-success">{r.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-info">
          <span className="pill-info">TRY ANYWAY</span> Tracking less reliable, no loss to try
        </h2>
        <div className="card-shell">
          <table className="w-full text-sm">
            <thead className="text-fg-muted text-xs uppercase tracking-wide">
              <tr><th className="text-left p-3">Merchant</th><th className="text-left">Category</th><th className="text-left">Notes</th></tr>
            </thead>
            <tbody>
              {groups.try.map((r, i) => (
                <tr key={i} className="table-row">
                  <td className="p-3 font-medium">{r.merchant}</td>
                  <td>{r.category ?? "—"}</td>
                  <td className="text-fg-muted text-xs">{r.notes ?? `${r.rate} rate`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2 text-warning">
          <span className="pill-warning">SHOPWISE EDGE</span> Cashkaro rate too low — Amex Reward Multiplier wins on EV
        </h2>
        <div className="card-shell">
          <table className="w-full text-sm">
            <thead className="text-fg-muted text-xs uppercase tracking-wide">
              <tr><th className="text-left p-3">Merchant</th><th className="text-left">Category</th><th className="text-right p-3">Cashkaro Rate</th></tr>
            </thead>
            <tbody>
              {groups.shopwise.map((r, i) => (
                <tr key={i} className="table-row">
                  <td className="p-3 font-medium">{r.merchant}</td>
                  <td className="text-fg-muted">{r.category ?? "—"}</td>
                  <td className="text-right p-3">{r.rate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Callout tone="warning" title="Tracking killers (avoid)">
        Non-listed coupons, ad blockers, multiple coupon-site tabs, wallet round-trip payments, gift voucher payment for the order, EMI conversion at checkout, seller/Amazon Business accounts. Any of these → Cashkaro pays ₹0 (but card rewards still apply).
      </Callout>
    </div>
  );
}
