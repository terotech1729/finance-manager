"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { addTransaction, deleteTransaction, loadState, loadTransactions, saveState } from "@/lib/storage";
import { CARDS, getCardById } from "@/lib/cards";
import { ALL_CATEGORIES } from "@/lib/categorize";
import { applyCardSpend } from "@/lib/spendTracking";
import { inr, inrExact, newId, todayLocal, localDateToISO } from "@/lib/utils";
import type { Transaction } from "@/lib/types";
import { Icon } from "@/components/Icons";

// Payment modes for the manual logger: every card + non-card routes.
const PAYMENT_MODES: { id: string; label: string; isCard: boolean }[] = [
  ...CARDS.map((c) => ({ id: c.id, label: c.short, isCard: true })),
  { id: "upi", label: "UPI (bank / PhonePe / GPay)", isCard: false },
  { id: "amazon_pay_balance", label: "Amazon Pay balance", isCard: false },
  { id: "cash", label: "Cash", isCard: false },
  { id: "other", label: "Other", isCard: false },
];

type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";
const SORTS: { v: SortKey; l: string }[] = [
  { v: "date_desc", l: "Latest first" },
  { v: "date_asc", l: "Oldest first" },
  { v: "amount_desc", l: "Amount: high → low" },
  { v: "amount_asc", l: "Amount: low → high" },
];

export default function TransactionsPage() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [sort, setSort] = useState<SortKey>("date_desc");

  // manual form state
  const [date, setDate] = useState(() => todayLocal());
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("general");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("upi");
  const [reward, setReward] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => { setTxns(loadTransactions()); }, []);

  const onDelete = (id: string) => setTxns(deleteTransaction(id));

  const amt = Number((amount || "0").replace(/[^0-9.]/g, "")) || 0;
  const rwd = Number((reward || "0").replace(/[^0-9.]/g, "")) || 0;
  const modeMeta = PAYMENT_MODES.find((m) => m.id === mode);

  const onManualLog = () => {
    if (!amt) return;
    const t: Transaction = {
      id: newId(),
      date: localDateToISO(date),
      merchant: merchant.trim() || category,
      category,
      amount: amt,
      channel: mode === "upi" ? "upi_normal" : "online",
      cardId: mode,
      path: "manual",
      effectivePct: amt > 0 ? (rwd / amt) * 100 : 0,
      rewardInr: rwd,
      notes: notes.trim() || undefined,
    };
    setTxns(addTransaction(t));
    // A real card payment always counts toward that card's milestone/cycle tracking,
    // so the recommender accounts for it. UPI / cash / Amazon-balance are independent.
    if (modeMeta?.isCard) {
      const next = { ...loadState() };
      applyCardSpend(next, mode, amt, rwd);
      saveState(next);
    }
    // reset
    setMerchant(""); setAmount(""); setReward(""); setNotes("");
    setCategory("general"); setMode("upi"); setDate(todayLocal());
    setShowForm(false);
  };

  const totalSpent = txns.reduce((acc, t) => acc + t.amount, 0);
  const totalReward = txns.reduce((acc, t) => acc + t.rewardInr, 0);
  const effectiveRate = totalSpent > 0 ? (totalReward / totalSpent) * 100 : 0;

  const sortedTxns = [...txns].sort((a, b) => {
    if (sort === "date_desc") return b.date.localeCompare(a.date);
    if (sort === "date_asc") return a.date.localeCompare(b.date);
    if (sort === "amount_desc") return b.amount - a.amount;
    return a.amount - b.amount;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-fg-muted mt-1">Your logged spend history.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowForm((v) => !v)}>
            <Icon.Plus size={16} /> {showForm ? "Cancel" : "Log a transaction"}
          </button>
          <Link href="/recommend" className="btn-primary"><Icon.Zap size={16} /> Recommend a route</Link>
        </div>
      </div>

      {/* Manual log form — record any spend on the actual card/mode you used */}
      {showForm && (
        <div className="card-shell">
          <div className="card-header">
            <div className="font-semibold">Log a transaction manually</div>
            <div className="text-xs text-fg-muted">For spends you made your own way (any card / UPI / cash) — for record-keeping</div>
          </div>
          <div className="card-body space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <div className="label mb-1">Date</div>
                <input type="date" className="input" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div>
                <div className="label mb-1">Merchant</div>
                <input className="input" placeholder="e.g. Amazon, LIC, local store" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
              </div>
              <div>
                <div className="label mb-1">Category</div>
                <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div className="label mb-1">Amount (₹) <span className="text-danger">*</span></div>
                <input className="input" placeholder="e.g. 5000" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" />
              </div>
              <div>
                <div className="label mb-1">Paid with <span className="text-danger">*</span></div>
                <select className="input" value={mode} onChange={(e) => setMode(e.target.value)}>
                  <optgroup label="Credit cards">
                    {PAYMENT_MODES.filter((m) => m.isCard).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </optgroup>
                  <optgroup label="Other">
                    {PAYMENT_MODES.filter((m) => !m.isCard).map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <div className="label mb-1">Reward earned (₹) <span className="text-fg-muted text-[10px] normal-case">(optional)</span></div>
                <input className="input" placeholder="e.g. 50" value={reward} onChange={(e) => setReward(e.target.value)} inputMode="numeric" />
              </div>
              <div className="sm:col-span-3">
                <div className="label mb-1">Notes <span className="text-fg-muted text-[10px] normal-case">(optional)</span></div>
                <input className="input" placeholder="Free text" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <div className="text-xs text-fg-muted">
              {modeMeta?.isCard
                ? `This will count toward ${getCardById(mode)?.short}'s milestone & cycle tracking, so future recommendations account for it.`
                : "UPI / cash / Amazon Pay balance are independent — recorded for history only, with no effect on card milestones."}
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={onManualLog} disabled={!amt}><Icon.Plus size={16} /> Log transaction</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="stat-tile">
          <div className="label">Total spent</div>
          <div className="text-xl font-semibold mt-1">{inr(totalSpent)}</div>
        </div>
        <div className="stat-tile">
          <div className="label">Total rewards earned</div>
          <div className="text-xl font-semibold mt-1 text-success">{inr(totalReward)}</div>
        </div>
        <div className="stat-tile col-span-2 md:col-span-1">
          <div className="label">Effective return</div>
          <div className="text-xl font-semibold mt-1">{effectiveRate.toFixed(2)}%</div>
        </div>
      </div>

      <section>
        <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
          <h2 className="text-xl font-bold">Transaction log ({txns.length})</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-fg-muted">Sort</span>
            <select className="input py-1 text-sm" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </div>
        </div>
        {txns.length === 0 ? (
          <div className="card-shell p-8 text-center text-fg-muted">
            <Icon.Transaction className="mx-auto mb-2 opacity-50" size={32} />
            <div>No transactions logged yet.</div>
            <div className="mt-1 text-sm">Use <b className="text-fg">Recommend</b> (best route) or <b className="text-fg">&ldquo;Log a transaction&rdquo;</b> above (your own way).</div>
          </div>
        ) : (
          <div className="card-shell">
            <table className="w-full text-sm">
              <thead className="text-fg-muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left">Merchant</th>
                  <th className="text-left">Category</th>
                  <th className="text-right">Amount</th>
                  <th className="text-left">Paid with</th>
                  <th className="text-left">Path</th>
                  <th className="text-right">Reward</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {sortedTxns.slice(0, 100).map((t) => {
                  const card = getCardById(t.cardId);
                  const modeLabel = card?.short ?? PAYMENT_MODES.find((m) => m.id === t.cardId)?.label ?? t.cardId;
                  return (
                    <tr key={t.id} className="table-row">
                      <td className="p-3 text-fg-muted">{new Date(t.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</td>
                      <td className="font-medium">{t.merchant}</td>
                      <td className="text-fg-muted">{t.category}</td>
                      <td className="text-right">{inrExact(t.amount)}</td>
                      <td><span className="pill-info">{modeLabel}</span></td>
                      <td><span className="pill-neutral text-xs">{t.path}</span></td>
                      <td className="text-right text-success">{inrExact(t.rewardInr)} <span className="text-xs text-fg-muted">({t.effectivePct.toFixed(1)}%)</span></td>
                      <td className="p-3"><button className="btn-ghost text-xs" onClick={() => onDelete(t.id)}>Delete</button></td>
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
