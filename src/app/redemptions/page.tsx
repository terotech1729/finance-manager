"use client";

import { REDEMPTIONS } from "@/lib/redemptions";
import { Callout } from "@/components/Callout";

function inrP(n: number): string {
  return `₹${n.toFixed(2)}`;
}

export default function RedemptionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Redemption values</h1>
        <p className="text-fg-muted mt-1">Points aren&apos;t worth a fixed amount — value depends on how you redeem. These ranges drive the &ldquo;worst → best&rdquo; return shown in recommendations.</p>
      </div>

      <Callout tone="info" title="How this affects recommendations">
        For points-based cards (Amex MR, IndiGo BluChips, SBI RP), the effective return % is shown as a <b>range</b>: worst-case (cash/lowest) → best-case (sweet-spot redemption). The headline number uses the <b>typical</b> value. Cashable currencies (Kiwi, BOB) have a fixed value, so no range.
      </Callout>

      <div className="space-y-4">
        {REDEMPTIONS.map((r) => (
          <div key={r.currency} className="card-shell">
            <div className="card-header">
              <div className="font-semibold">{r.currency}</div>
              <div className="text-sm">
                <span className="text-fg-muted">{inrP(r.worst)}</span>
                <span className="text-fg-muted mx-1">→</span>
                <span className="font-semibold">{inrP(r.typical)}</span>
                <span className="text-fg-muted mx-1">→</span>
                <span className="text-success font-semibold">{inrP(r.best)}</span>
                <span className="text-fg-muted text-xs ml-1">/ unit</span>
              </div>
            </div>
            <div className="card-body">
              <table className="w-full text-sm">
                <thead className="text-fg-muted text-xs uppercase tracking-wide">
                  <tr><th className="text-left pb-2">Redemption</th><th className="text-right pb-2">₹ / unit</th><th className="text-left pb-2 pl-4">Notes</th></tr>
                </thead>
                <tbody>
                  {r.how.map((h, i) => (
                    <tr key={i} className="table-row">
                      <td className="py-1.5 font-medium">{h.label}</td>
                      <td className="py-1.5 text-right">{inrP(h.value)}</td>
                      <td className="py-1.5 pl-4 text-fg-muted">{h.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-fg-muted">
        Transfer-partner sweet spots (esp. Amex MR → airlines) change with award availability — verify live before a big redemption. Values researched May 2026.
      </p>
    </div>
  );
}
