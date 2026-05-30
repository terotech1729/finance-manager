"use client";

import { useEffect, useState } from "react";
import { addInvestment, deleteInvestment, loadInvestments } from "@/lib/storage";
import type { Investment, InvestmentType } from "@/lib/types";
import { inr, inrExact, newId, todayLocal, localDateToISO } from "@/lib/utils";
import { Icon } from "@/components/Icons";
import { Callout } from "@/components/Callout";

const TYPES: { v: InvestmentType; l: string; icon: string }[] = [
  { v: "smallcase", l: "Smallcase", icon: "📊" },
  { v: "stocks", l: "Stocks (direct)", icon: "📈" },
  { v: "mutual_fund", l: "Mutual Fund", icon: "📑" },
  { v: "bonds", l: "Bonds / G-Sec", icon: "🏦" },
  { v: "crypto", l: "Crypto", icon: "₿" },
  { v: "fd", l: "Fixed Deposit", icon: "🔒" },
  { v: "rd", l: "Recurring Deposit", icon: "🔁" },
  { v: "gold", l: "Gold (digital / physical)", icon: "🪙" },
  { v: "real_estate", l: "Real Estate", icon: "🏠" },
  { v: "other", l: "Other", icon: "•" },
];

const PAYMENT_METHODS = [
  { v: "upi", l: "UPI" },
  { v: "neft", l: "NEFT / Bank transfer" },
  { v: "net_banking", l: "Net banking" },
  { v: "card", l: "Card (rare for investments)" },
];

export default function InvestmentsPage() {
  const [items, setItems] = useState<Investment[]>([]);
  const [type, setType] = useState<InvestmentType>("stocks");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState("");
  const [platform, setPlatform] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"upi" | "neft" | "net_banking" | "card">("upi");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(() => todayLocal());

  useEffect(() => { setItems(loadInvestments()); }, []);

  const amt = Number((amount || "0").replace(/[^0-9.]/g, "")) || 0;

  const onLog = () => {
    if (!amt) return;
    const inv: Investment = {
      id: newId(),
      date: localDateToISO(date),
      type,
      amount: amt,
      asset: asset || undefined,
      platform: platform || undefined,
      paymentMethod,
      notes: notes || undefined,
    };
    setItems(addInvestment(inv));
    setAmount("");
    setAsset("");
    setPlatform("");
    setNotes("");
    setDate(todayLocal());
  };

  const onDelete = (id: string) => setItems(deleteInvestment(id));

  // Aggregations
  const totalInvested = items.reduce((acc, i) => acc + i.amount, 0);
  const byType: Record<string, number> = {};
  items.forEach((i) => {
    byType[i.type] = (byType[i.type] ?? 0) + i.amount;
  });
  const sortedByType = Object.entries(byType).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Investments</h1>
          <p className="text-fg-muted mt-1">Log every investment to track total deployed capital and asset allocation over time.</p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-tile">
          <div className="label">Total invested (logged)</div>
          <div className="text-2xl font-semibold mt-1 text-info">{inr(totalInvested)}</div>
          <div className="text-xs text-fg-muted mt-1">{items.length} entries</div>
        </div>
        {sortedByType.slice(0, 3).map(([t, amt]) => {
          const cfg = TYPES.find((x) => x.v === t);
          return (
            <div key={t} className="stat-tile">
              <div className="label">{cfg?.l ?? t}</div>
              <div className="text-2xl font-semibold mt-1">{inr(amt)}</div>
              <div className="text-xs text-fg-muted mt-1">{((amt / Math.max(totalInvested, 1)) * 100).toFixed(1)}% of portfolio</div>
            </div>
          );
        })}
      </div>

      {/* Log new investment */}
      <div className="card-shell bg-gradient-to-br from-info/5 via-bg-elevated to-bg-elevated border-info/30">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <Icon.Sparkles className="text-info" />
            <div>
              <div className="font-semibold">Log a new investment</div>
              <div className="text-xs text-fg-muted">Track deployed capital separately from credit-card spends</div>
            </div>
          </div>
        </div>
        <div className="card-body space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <div className="label mb-1">1. Type <span className="text-danger">*</span></div>
              <select className="input" value={type} onChange={(e) => setType(e.target.value as InvestmentType)}>
                {TYPES.map((t) => <option key={t.v} value={t.v}>{t.icon} {t.l}</option>)}
              </select>
            </div>
            <div>
              <div className="label mb-1">2. Amount (₹) <span className="text-danger">*</span></div>
              <input className="input" placeholder="e.g. 25000" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" />
            </div>
            <div>
              <div className="label mb-1">3. Payment method</div>
              <select className="input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}>
                {PAYMENT_METHODS.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
              </select>
            </div>
            <div>
              <div className="label mb-1">Date</div>
              <input type="date" className="input" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <div className="label mb-1">Asset name <span className="text-fg-muted text-[10px] normal-case">(optional)</span></div>
              <input className="input" placeholder="e.g. Reliance Industries / Smallcase: All Weather" value={asset} onChange={(e) => setAsset(e.target.value)} />
            </div>
            <div>
              <div className="label mb-1">Platform <span className="text-fg-muted text-[10px] normal-case">(optional)</span></div>
              <input className="input" placeholder="e.g. Zerodha, Groww, Coin DCX" value={platform} onChange={(e) => setPlatform(e.target.value)} />
            </div>
            <div>
              <div className="label mb-1">Notes</div>
              <input className="input" placeholder="Free text" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-secondary" onClick={() => { setAmount(""); setAsset(""); setPlatform(""); setNotes(""); }}>Clear</button>
            <button className="btn-primary" onClick={onLog} disabled={!amt}>
              <Icon.Plus size={16} /> Log investment
            </button>
          </div>
        </div>
      </div>

      <Callout tone="info" title="Note on credit-card payments for investments">
        SEBI prohibits credit-card payment for direct stock / mutual fund investments. UPI from your bank account is the standard route. Some brokers may allow CC for wallet top-up but charge a 1% fee that wipes any reward. <b>Always pay investments via UPI or NEFT.</b>
      </Callout>

      {/* Allocation table */}
      {sortedByType.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-3">Asset allocation</h2>
          <div className="card-shell">
            <table className="w-full text-sm">
              <thead className="text-fg-muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left p-3">Type</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right p-3">% of portfolio</th>
                </tr>
              </thead>
              <tbody>
                {sortedByType.map(([t, amt]) => {
                  const cfg = TYPES.find((x) => x.v === t);
                  return (
                    <tr key={t} className="table-row">
                      <td className="p-3 font-medium">{cfg?.icon} {cfg?.l ?? t}</td>
                      <td className="text-right">{inrExact(amt)}</td>
                      <td className="text-right p-3">{((amt / Math.max(totalInvested, 1)) * 100).toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Investment log */}
      <section>
        <h2 className="text-lg font-bold mb-3">Investment log ({items.length})</h2>
        {items.length === 0 ? (
          <div className="card-shell p-8 text-center text-fg-muted">
            <Icon.Trophy className="mx-auto mb-2 opacity-50" size={32} />
            No investments logged yet. Use the form above to start tracking.
          </div>
        ) : (
          <div className="card-shell">
            <table className="w-full text-sm">
              <thead className="text-fg-muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left">Type</th>
                  <th className="text-left">Asset</th>
                  <th className="text-left">Platform</th>
                  <th className="text-left">Method</th>
                  <th className="text-right">Amount</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => {
                  const cfg = TYPES.find((x) => x.v === i.type);
                  return (
                    <tr key={i.id} className="table-row">
                      <td className="p-3 text-fg-muted">{new Date(i.date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "2-digit" })}</td>
                      <td>{cfg?.icon} {cfg?.l ?? i.type}</td>
                      <td className="text-fg-muted">{i.asset ?? "—"}</td>
                      <td className="text-fg-muted">{i.platform ?? "—"}</td>
                      <td className="text-fg-muted text-xs uppercase">{i.paymentMethod ?? "—"}</td>
                      <td className="text-right font-medium">{inrExact(i.amount)}</td>
                      <td className="p-3"><button className="btn-ghost text-xs" onClick={() => onDelete(i.id)}>Delete</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
