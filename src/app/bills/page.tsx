"use client";

import { useEffect, useState } from "react";
import { addTransaction, loadState, loadTransactions, saveState, type AppState } from "@/lib/storage";
import { CARDS } from "@/lib/cards";
import { HISTORICAL_SPEND } from "@/lib/history";
import { applyCardSpend } from "@/lib/spendTracking";
import { inr, inrExact, newId, todayLocal, localDateToISO } from "@/lib/utils";
import type { Transaction } from "@/lib/types";
import { Icon } from "@/components/Icons";
import { Callout } from "@/components/Callout";

// Only cards you actually hold/use for billing.
const BILL_CARDS = CARDS.filter((c) => c.status === "active");

function monthLabelFull(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export default function BillsPage() {
  const [state, setState] = useState<AppState | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [month, setMonth] = useState(() => todayLocal().slice(0, 7));
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    setState(loadState());
    setTxns(loadTransactions());
  }, []);

  if (!state) return <div className="text-fg-muted">Loading…</div>;

  const seedForMonth = HISTORICAL_SPEND.find((m) => m.month === month)?.byCard ?? {};

  const loggedSum = (cardId: string) =>
    txns.filter((t) => t.cardId === cardId && t.date.slice(0, 7) === month).reduce((a, t) => a + t.amount, 0);

  const billKey = (cardId: string) => `${cardId}:${month}`;
  const getBill = (cardId: string) => state.bills[billKey(cardId)];
  const billValue = (cardId: string): string => {
    if (drafts[billKey(cardId)] !== undefined) return drafts[billKey(cardId)];
    const saved = getBill(cardId)?.billAmount;
    if (saved != null) return String(saved);
    const seed = seedForMonth[cardId];
    return seed != null && seed > 0 ? String(seed) : "";
  };

  const update = (next: AppState) => { setState(next); saveState(next); };

  const setBillAmount = (cardId: string, raw: string) => {
    setDrafts((d) => ({ ...d, [billKey(cardId)]: raw }));
    const n = Number(raw.replace(/[^0-9.]/g, "")) || 0;
    const next = { ...state, bills: { ...state.bills, [billKey(cardId)]: { billAmount: n, paid: getBill(cardId)?.paid ?? false } } };
    update(next);
  };

  const setPaid = (cardId: string, paid: boolean) => {
    const cur = getBill(cardId);
    const amt = cur?.billAmount ?? (Number(billValue(cardId).replace(/[^0-9.]/g, "")) || 0);
    update({ ...state, bills: { ...state.bills, [billKey(cardId)]: { billAmount: amt, paid } } });
  };

  const addDiffAsMisc = (cardId: string, diff: number) => {
    const t: Transaction = {
      id: newId(),
      date: localDateToISO(`${month}-15`),
      merchant: "Unlogged spend (reconciliation)",
      category: "miscellaneous",
      amount: diff,
      channel: "online",
      cardId,
      path: "manual",
      effectivePct: 0,
      rewardInr: 0,
      notes: `Auto-added to reconcile ${monthLabelFull(month)} statement`,
    };
    setTxns(addTransaction(t));
    const next = { ...loadState() };
    applyCardSpend(next, cardId, diff, 0);
    update(next);
  };

  // Summary
  let totalBilled = 0, totalPaid = 0, unpaid = 0, anyBill = 0;
  BILL_CARDS.forEach((c) => {
    const b = getBill(c.id);
    const amt = b?.billAmount ?? (seedForMonth[c.id] ?? 0);
    if (amt > 0) { anyBill++; totalBilled += amt; if (b?.paid) totalPaid += amt; else unpaid++; }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Bill tracker</h1>
          <p className="text-fg-muted mt-1">Record each card&apos;s statement bill and tick it off when you repay. Reconcile any unlogged spend.</p>
        </div>
        <div>
          <div className="label mb-1">Statement month</div>
          <input type="month" className="input" value={month} max={todayLocal().slice(0, 7)} onChange={(e) => { setMonth(e.target.value); setDrafts({}); }} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="stat-tile"><div className="label">Total billed ({monthLabelFull(month)})</div><div className="text-2xl font-semibold mt-1">{inr(totalBilled)}</div></div>
        <div className="stat-tile"><div className="label">Paid</div><div className="text-2xl font-semibold mt-1 text-success">{inr(totalPaid)}</div></div>
        <div className="stat-tile col-span-2 md:col-span-1"><div className="label">Unpaid cards</div><div className="text-2xl font-semibold mt-1 text-warning">{unpaid}</div></div>
      </div>

      <div className="card-shell">
        <table className="w-full text-sm">
          <thead className="text-fg-muted text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left p-3">Card</th>
              <th className="text-right">Logged</th>
              <th className="text-right">Statement bill</th>
              <th className="text-left p-3">Reconcile</th>
              <th className="text-center p-3">Paid</th>
            </tr>
          </thead>
          <tbody>
            {BILL_CARDS.map((c) => {
              const logged = loggedSum(c.id);
              const billStr = billValue(c.id);
              const bill = Number(billStr.replace(/[^0-9.]/g, "")) || 0;
              const diff = bill - logged;
              const b = getBill(c.id);
              return (
                <tr key={c.id} className="table-row align-middle">
                  <td className="p-3 font-medium">{c.short}</td>
                  <td className="text-right text-fg-muted">{inrExact(logged)}</td>
                  <td className="text-right">
                    <input
                      className="input w-28 text-right"
                      inputMode="numeric"
                      placeholder="₹"
                      value={billStr}
                      onChange={(e) => setBillAmount(c.id, e.target.value)}
                    />
                  </td>
                  <td className="p-3">
                    {bill > 0 && diff > 1 ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-warning">{inrExact(diff)} unlogged</span>
                        <button className="btn-ghost text-xs" onClick={() => addDiffAsMisc(c.id, diff)}>+ add as misc</button>
                      </div>
                    ) : bill > 0 && diff < -1 ? (
                      <span className="text-xs text-fg-muted">Logged exceeds bill by {inrExact(-diff)}</span>
                    ) : bill > 0 ? (
                      <span className="text-xs text-success">Reconciled ✓</span>
                    ) : (
                      <span className="text-xs text-fg-muted">—</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <input type="checkbox" checked={b?.paid ?? false} onChange={(e) => setPaid(c.id, e.target.checked)} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Callout tone="info" title="How reconciliation works">
        <b>Logged</b> = sum of transactions you recorded for that card this month. <b>Statement bill</b> = the actual amount you enter. If the bill is higher (you didn&apos;t log everything), click <b>&ldquo;+ add as misc&rdquo;</b> — it adds the difference as a miscellaneous transaction (and counts toward that card&apos;s milestone tracking), so your logs match the statement. Tick <b>Paid</b> when you&apos;ve repaid. For past months (Jan–May), the statement bill is pre-filled from the totals you gave me.
      </Callout>
    </div>
  );
}
