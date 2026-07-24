"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addTransaction, deleteTransaction, updateTransaction,
  loadState, loadTransactions, saveState,
} from "@/lib/storage";
import { CARDS, getCardById } from "@/lib/cards";
import { ALL_CATEGORIES } from "@/lib/categorize";
import { applyCardSpend, reverseCardSpend } from "@/lib/spendTracking";
import { CARD_COLORS } from "@/lib/chartColors";
import { inr, inrExact, newId, todayLocal, localDateToISO } from "@/lib/utils";
import type { Transaction } from "@/lib/types";
import { Icon } from "@/components/Icons";
import { toast } from "@/components/Toast";

// Payment modes for the manual logger: every card + non-card routes.
const PAYMENT_MODES: { id: string; label: string; isCard: boolean }[] = [
  ...CARDS.map((c) => ({ id: c.id, label: c.short, isCard: true })),
  { id: "upi", label: "UPI (bank / PhonePe / GPay)", isCard: false },
  { id: "amazon_pay_balance", label: "Amazon Pay balance", isCard: false },
  { id: "cash", label: "Cash", isCard: false },
  { id: "other", label: "Other", isCard: false },
];

const modeLabelOf = (id: string) => getCardById(id)?.short ?? PAYMENT_MODES.find((m) => m.id === id)?.label ?? id;
const modeIsCard = (id: string) => !!getCardById(id) || (PAYMENT_MODES.find((m) => m.id === id)?.isCard ?? false);

type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "reward_desc";
const SORTS: { v: SortKey; l: string }[] = [
  { v: "date_desc", l: "Latest first" },
  { v: "date_asc", l: "Oldest first" },
  { v: "amount_desc", l: "Amount: high → low" },
  { v: "amount_asc", l: "Amount: low → high" },
  { v: "reward_desc", l: "Reward: high → low" },
];

type FormValues = { date: string; merchant: string; category: string; amount: string; mode: string; reward: string; notes: string };

export default function TransactionsPage() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  // filter + sort
  const [sort, setSort] = useState<SortKey>("date_desc");
  const [query, setQuery] = useState("");
  const [fCat, setFCat] = useState("all");
  const [fMode, setFMode] = useState("all");

  useEffect(() => { setTxns(loadTransactions()); }, []);

  const presentCats = useMemo(() => Array.from(new Set(txns.map((t) => t.category))).sort(), [txns]);
  const presentModes = useMemo(() => Array.from(new Set(txns.map((t) => t.cardId))), [txns]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = txns.filter((t) => {
      if (fCat !== "all" && t.category !== fCat) return false;
      if (fMode !== "all" && t.cardId !== fMode) return false;
      if (q && !(`${t.merchant} ${t.category} ${t.notes ?? ""}`.toLowerCase().includes(q))) return false;
      return true;
    });
    return list.sort((a, b) => {
      if (sort === "date_desc") return b.date.localeCompare(a.date) || b.amount - a.amount;
      if (sort === "date_asc") return a.date.localeCompare(b.date);
      if (sort === "amount_desc") return b.amount - a.amount;
      if (sort === "amount_asc") return a.amount - b.amount;
      return b.rewardInr - a.rewardInr;
    });
  }, [txns, query, fCat, fMode, sort]);

  const filtersActive = query.trim() !== "" || fCat !== "all" || fMode !== "all";
  const totalSpent = filtered.reduce((acc, t) => acc + t.amount, 0);
  const totalReward = filtered.reduce((acc, t) => acc + t.rewardInr, 0);
  const effectiveRate = totalSpent > 0 ? (totalReward / totalSpent) * 100 : 0;

  const onCreate = (v: FormValues) => {
    const amt = Number((v.amount || "0").replace(/[^0-9.]/g, "")) || 0;
    const rwd = Number((v.reward || "0").replace(/[^0-9.]/g, "")) || 0;
    if (!amt) return;
    const t: Transaction = {
      id: newId(),
      date: localDateToISO(v.date),
      merchant: v.merchant.trim() || v.category,
      category: v.category,
      amount: amt,
      channel: v.mode === "upi" ? "upi_normal" : "online",
      cardId: v.mode,
      path: "manual",
      effectivePct: amt > 0 ? (rwd / amt) * 100 : 0,
      rewardInr: rwd,
      notes: v.notes.trim() || undefined,
    };
    setTxns(addTransaction(t));
    if (modeIsCard(v.mode)) {
      const next = { ...loadState() };
      applyCardSpend(next, v.mode, amt, rwd, amt > 0 ? (rwd / amt) * 100 : 0);
      saveState(next);
    }
    setAdding(false);
    toast(`Logged ${inrExact(amt)} at ${v.merchant.trim() || v.category}`, "success");
  };

  const onSaveEdit = (v: FormValues) => {
    if (!editing) return;
    const amt = Number((v.amount || "0").replace(/[^0-9.]/g, "")) || 0;
    const rwd = Number((v.reward || "0").replace(/[^0-9.]/g, "")) || 0;
    if (!amt) return;
    // Keep milestone/cycle counters accurate: undo the old card effect, apply the new one.
    const oldWasCard = modeIsCard(editing.cardId);
    const newIsCard = modeIsCard(v.mode);
    if (oldWasCard || newIsCard) {
      const next = { ...loadState() };
      if (oldWasCard) reverseCardSpend(next, editing.cardId, editing.amount, editing.rewardInr, editing.effectivePct);
      if (newIsCard) applyCardSpend(next, v.mode, amt, rwd, amt > 0 ? (rwd / amt) * 100 : 0);
      saveState(next);
    }
    const channel: Transaction["channel"] =
      v.mode === "upi" ? "upi_normal" : v.mode === editing.cardId ? editing.channel : "online";
    setTxns(updateTransaction(editing.id, {
      date: localDateToISO(v.date),
      merchant: v.merchant.trim() || v.category,
      category: v.category,
      amount: amt,
      cardId: v.mode,
      channel,
      effectivePct: amt > 0 ? (rwd / amt) * 100 : 0,
      rewardInr: rwd,
      notes: v.notes.trim() || undefined,
    }));
    setEditing(null);
    toast("Transaction updated", "success");
  };

  const onDelete = (t: Transaction) => {
    if (!confirm(`Delete this ${inrExact(t.amount)} transaction at ${t.merchant}?`)) return;
    if (modeIsCard(t.cardId)) {
      const next = { ...loadState() };
      reverseCardSpend(next, t.cardId, t.amount, t.rewardInr, t.effectivePct);
      saveState(next);
    }
    setTxns(deleteTransaction(t.id));
    if (editing?.id === t.id) setEditing(null);
    toast("Transaction deleted", "info");
  };

  const clearFilters = () => { setQuery(""); setFCat("all"); setFMode("all"); };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="text-fg-muted mt-1">Your logged spend history — edit, filter and review.</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => { setAdding((v) => !v); setEditing(null); }}>
            <Icon.Plus size={16} /> {adding ? "Cancel" : "Log a transaction"}
          </button>
          <Link href="/recommend" className="btn-primary"><Icon.Zap size={16} /> Recommend a route</Link>
        </div>
      </div>

      {/* Add form */}
      {adding && !editing && (
        <TxnForm
          key="new"
          title="Log a transaction manually"
          subtitle="For spends you made your own way (any card / UPI / cash) — for record-keeping"
          submitLabel="Log transaction"
          onSubmit={onCreate}
          onCancel={() => setAdding(false)}
        />
      )}

      {/* Edit form */}
      {editing && (
        <TxnForm
          key={editing.id}
          title="Edit transaction"
          subtitle="Change any field. Card milestone & cycle counters are adjusted automatically."
          submitLabel="Save changes"
          initial={{
            date: editing.date.slice(0, 10),
            merchant: editing.merchant,
            category: editing.category,
            amount: String(editing.amount),
            mode: editing.cardId,
            reward: editing.rewardInr ? String(editing.rewardInr) : "",
            notes: editing.notes ?? "",
          }}
          onSubmit={onSaveEdit}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* Summary tiles (reflect the current filter) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-tile">
          <div className="label">{filtersActive ? "Spent (filtered)" : "Total spent"}</div>
          <div className="text-xl font-semibold mt-1">{inr(totalSpent)}</div>
        </div>
        <div className="stat-tile">
          <div className="label">Rewards earned</div>
          <div className="text-xl font-semibold mt-1 text-success">{inr(totalReward)}</div>
        </div>
        <div className="stat-tile">
          <div className="label">Effective return</div>
          <div className="text-xl font-semibold mt-1">{effectiveRate.toFixed(2)}%</div>
        </div>
        <div className="stat-tile">
          <div className="label">Transactions</div>
          <div className="text-xl font-semibold mt-1">{filtered.length}<span className="text-sm text-fg-muted font-normal"> / {txns.length}</span></div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card-shell p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Icon.Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
            <input
              className="input pl-9"
              placeholder="Search merchant, category, notes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select className="input w-auto" value={fMode} onChange={(e) => setFMode(e.target.value)}>
            <option value="all">All payment methods</option>
            {presentModes.map((m) => <option key={m} value={m}>{modeLabelOf(m)}</option>)}
          </select>
          <select className="input w-auto" value={fCat} onChange={(e) => setFCat(e.target.value)}>
            <option value="all">All categories</option>
            {presentCats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input w-auto" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
          </select>
          {filtersActive && (
            <button className="btn-ghost text-xs" onClick={clearFilters}><Icon.Close size={14} /> Clear</button>
          )}
        </div>
      </div>

      {/* Table */}
      <section>
        {txns.length === 0 ? (
          <div className="card-shell p-8 text-center text-fg-muted">
            <Icon.Transaction className="mx-auto mb-2 opacity-50" size={32} />
            <div>No transactions logged yet.</div>
            <div className="mt-1 text-sm">Use <b className="text-fg">Recommend</b> (best route) or <b className="text-fg">&ldquo;Log a transaction&rdquo;</b> above (your own way).</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card-shell p-8 text-center text-fg-muted">
            <Icon.Filter className="mx-auto mb-2 opacity-50" size={28} />
            <div>No transactions match your filters.</div>
            <button className="btn-secondary mt-3 text-sm" onClick={clearFilters}>Clear filters</button>
          </div>
        ) : (
          <div className="card-shell overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-fg-muted text-xs uppercase tracking-wide border-b border-border">
                <tr>
                  <th className="text-left p-3 font-medium">Date</th>
                  <th className="text-left font-medium">Merchant</th>
                  <th className="text-left font-medium">Category</th>
                  <th className="text-right font-medium">Amount</th>
                  <th className="text-left pl-4 font-medium">Paid with</th>
                  <th className="text-left font-medium">Route</th>
                  <th className="text-right font-medium">Reward</th>
                  <th className="p-3 text-right font-medium">Edit</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((t) => {
                  const color = CARD_COLORS[t.cardId] ?? "#64748b";
                  return (
                    <tr key={t.id} className="table-row hover:bg-bg-chrome/50 transition-colors">
                      <td className="p-3 text-fg-muted whitespace-nowrap">{new Date(t.date).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "2-digit" })}</td>
                      <td className="font-medium max-w-[200px] truncate" title={t.notes ? `${t.merchant} — ${t.notes}` : t.merchant}>{t.merchant}</td>
                      <td className="text-fg-muted">{t.category}</td>
                      <td className="text-right tabular-nums">{inrExact(t.amount)}</td>
                      <td className="pl-4">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                          {modeLabelOf(t.cardId)}
                        </span>
                      </td>
                      <td><span className="pill-neutral text-xs">{t.path}</span></td>
                      <td className="text-right text-success tabular-nums whitespace-nowrap">{inrExact(t.rewardInr)} <span className="text-xs text-fg-muted">({t.effectivePct.toFixed(1)}%)</span></td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <button className="btn-ghost px-2 py-1" title="Edit" onClick={() => { setEditing(t); setAdding(false); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); }}><Icon.Edit size={15} /></button>
                          <button className="btn-ghost px-2 py-1 text-danger" title="Delete" onClick={() => onDelete(t)}><Icon.Trash size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length > 200 && (
              <div className="p-3 text-center text-xs text-fg-muted border-t border-border">Showing first 200 of {filtered.length}. Use filters to narrow down.</div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function TxnForm({ title, subtitle, submitLabel, initial, onSubmit, onCancel }: {
  title: string;
  subtitle: string;
  submitLabel: string;
  initial?: FormValues;
  onSubmit: (v: FormValues) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(initial?.date ?? todayLocal());
  const [merchant, setMerchant] = useState(initial?.merchant ?? "");
  const [category, setCategory] = useState(initial?.category ?? "general");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [mode, setMode] = useState(initial?.mode ?? "upi");
  const [reward, setReward] = useState(initial?.reward ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const amt = Number((amount || "0").replace(/[^0-9.]/g, "")) || 0;
  const isCard = modeIsCard(mode);
  const categoryOptions = (ALL_CATEGORIES as readonly string[]).includes(category) ? ALL_CATEGORIES : [category, ...ALL_CATEGORIES];

  return (
    <div className="card-shell border-accent/40">
      <div className="card-header">
        <div>
          <div className="font-semibold flex items-center gap-2"><Icon.Edit size={15} className="text-accent" /> {title}</div>
          <div className="text-xs text-fg-muted mt-0.5">{subtitle}</div>
        </div>
        <button className="btn-ghost px-2 py-1" onClick={onCancel} title="Close"><Icon.Close size={16} /></button>
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
              {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
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
          {isCard
            ? `Counts toward ${modeLabelOf(mode)}'s milestone & cycle tracking, so future recommendations account for it.`
            : "UPI / cash / Amazon Pay balance are independent — recorded for history only, with no effect on card milestones."}
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={() => onSubmit({ date, merchant, category, amount, mode, reward, notes })} disabled={!amt}>
            <Icon.Plus size={16} /> {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
