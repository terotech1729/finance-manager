"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { HISTORICAL_SPEND, monthLabel, type MonthlySpend } from "@/lib/history";
import { loadTransactions } from "@/lib/storage";
import { useDataVersion } from "@/lib/useLiveData";
import { CARDS, getCardById } from "@/lib/cards";
import { colorFor } from "@/lib/chartColors";
import { inr, inrExact } from "@/lib/utils";
import type { Transaction } from "@/lib/types";

const CARD_IDS = ["amex_gold", "amex_plat_travel", "amex_mrcc", "scapia", "idfc_indigo", "bob_eterna", "yes_kiwi", "sbi_simplyclick", "amazon_pay_icici", "hsbc_live_plus"];

export default function SpendAnalyzerPage() {
  const [mounted, setMounted] = useState(false);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const dataVersion = useDataVersion();
  useEffect(() => { setMounted(true); setTxns(loadTransactions()); }, [dataVersion]);

  // Combine: past months use the authoritative statement seed; months AFTER the seed
  // are auto-derived from your DB-backed logged transactions (card spends only).
  const seedKeys = new Set(HISTORICAL_SPEND.map((m) => m.month));
  const derived: Record<string, Record<string, number>> = {};
  txns.forEach((t) => {
    const ym = t.date.slice(0, 7);
    if (seedKeys.has(ym)) return;
    if (!CARD_IDS.includes(t.cardId)) return; // only on-card spend counts per-card
    derived[ym] = derived[ym] || {};
    derived[ym][t.cardId] = (derived[ym][t.cardId] ?? 0) + t.amount;
  });
  const combined: MonthlySpend[] = [
    ...HISTORICAL_SPEND,
    ...Object.entries(derived).map(([month, byCard]) => ({ month, byCard })),
  ].sort((a, b) => a.month.localeCompare(b.month));

  // Monthly stacked-bar data: { month, <cardId>: amount, ... }
  const monthlyData = combined.map((m) => ({
    month: monthLabel(m.month),
    ...m.byCard,
    total: Object.values(m.byCard).reduce((a, b) => a + b, 0),
  }));

  // Total spend share by card (across all months)
  const byCardTotal: Record<string, number> = {};
  combined.forEach((m) => {
    for (const [cid, amt] of Object.entries(m.byCard)) byCardTotal[cid] = (byCardTotal[cid] ?? 0) + amt;
  });
  const cardShare = CARD_IDS
    .map((cid) => ({ cid, name: getCardById(cid)?.short ?? cid, value: byCardTotal[cid] ?? 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);

  const grandTotal = cardShare.reduce((a, d) => a + d.value, 0);
  const avgMonth = grandTotal / Math.max(1, combined.length);
  const topCard = cardShare[0];
  const monthCount = combined.length;

  // Logged transactions → category breakdown + rewards
  const byCategory: Record<string, number> = {};
  let loggedSpend = 0, loggedReward = 0;
  txns.forEach((t) => { byCategory[t.category] = (byCategory[t.category] ?? 0) + t.amount; loggedSpend += t.amount; loggedReward += t.rewardInr; });
  const categoryData = Object.entries(byCategory).map(([name, value], i) => ({ name, value, i })).sort((a, b) => b.value - a.value).slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Spend Analyzer</h1>
        <p className="text-fg-muted mt-1">How much went on each card per month, where it went, and rewards earned.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-tile"><div className="label">Total card spend ({monthCount} mo)</div><div className="text-2xl font-semibold mt-1">{inr(grandTotal)}</div></div>
        <div className="stat-tile"><div className="label">Avg / month</div><div className="text-2xl font-semibold mt-1">{inr(avgMonth)}</div></div>
        <div className="stat-tile"><div className="label">Top card</div><div className="text-2xl font-semibold mt-1">{topCard?.name ?? "—"}</div><div className="text-xs text-fg-muted mt-1">{topCard ? inr(topCard.value) : ""}</div></div>
        <div className="stat-tile"><div className="label">Logged rewards (live)</div><div className="text-2xl font-semibold mt-1 text-success">{inr(loggedReward)}</div><div className="text-xs text-fg-muted mt-1">{txns.length} txns · {inr(loggedSpend)}</div></div>
      </div>

      {/* Monthly stacked bar */}
      <section className="card-shell p-5">
        <h2 className="font-semibold mb-4">Monthly spend by card</h2>
        {mounted && (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={monthlyData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => `₹${v / 1000}k`} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} formatter={(v, n) => [inrExact(Number(v)), getCardById(String(n))?.short ?? String(n)]} />
              <Legend formatter={(v) => getCardById(String(v))?.short ?? String(v)} wrapperStyle={{ fontSize: 11 }} />
              {CARD_IDS.map((cid) => (
                <Bar key={cid} dataKey={cid} stackId="a" fill={colorFor(cid)} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Card share donut */}
        <section className="card-shell p-5">
          <h2 className="font-semibold mb-4">Spend share by card</h2>
          {mounted && (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={cardShare} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2}>
                  {cardShare.map((d) => <Cell key={d.cid} fill={colorFor(d.cid)} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} formatter={(v) => inrExact(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </section>

        {/* Monthly total trend */}
        <section className="card-shell p-5">
          <h2 className="font-semibold mb-4">Total monthly spend trend</h2>
          {mounted && (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={monthlyData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} formatter={(v) => inrExact(Number(v))} />
                <Line type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

      {/* Logged transactions category breakdown */}
      {txns.length > 0 && (
        <section className="card-shell p-5">
          <h2 className="font-semibold mb-4">Logged spend by category (live transactions)</h2>
          {mounted && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={categoryData} layout="vertical" margin={{ top: 4, right: 16, left: 80, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} width={120} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} formatter={(v) => inrExact(Number(v))} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {categoryData.map((d) => <Cell key={d.name} fill={colorFor("", d.i)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      )}

      <p className="text-xs text-fg-muted">
        Past months (Jan–May 2026) use the statement totals you provided. Months after that are built automatically from your logged transactions (synced in the DB) — so future months need no manual entry. Category & rewards charts use your live logged transactions.
      </p>
    </div>
  );
}
