"use client";

import { useEffect, useState } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import Link from "next/link";
import { loadInvestments } from "@/lib/storage";
import { colorFor } from "@/lib/chartColors";
import { monthLabel } from "@/lib/history";
import { inr, inrExact } from "@/lib/utils";
import type { Investment } from "@/lib/types";
import { Icon } from "@/components/Icons";

const TYPE_LABELS: Record<string, string> = {
  smallcase: "Smallcase", stocks: "Stocks", mutual_fund: "Mutual Fund", bonds: "Bonds",
  crypto: "Crypto", fd: "Fixed Deposit", rd: "Recurring Deposit", gold: "Gold", real_estate: "Real Estate", other: "Other",
};

export default function InvestmentAnalyzerPage() {
  const [mounted, setMounted] = useState(false);
  const [items, setItems] = useState<Investment[]>([]);
  useEffect(() => { setMounted(true); setItems(loadInvestments()); }, []);

  const total = items.reduce((a, i) => a + i.amount, 0);

  const byType: Record<string, number> = {};
  items.forEach((i) => { byType[i.type] = (byType[i.type] ?? 0) + i.amount; });
  const typeData = Object.entries(byType).map(([k, v]) => ({ key: k, name: TYPE_LABELS[k] ?? k, value: v })).sort((a, b) => b.value - a.value);

  const byPlatform: Record<string, number> = {};
  items.forEach((i) => { const p = i.platform || "Unspecified"; byPlatform[p] = (byPlatform[p] ?? 0) + i.amount; });
  const platformData = Object.entries(byPlatform).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const byMonth: Record<string, number> = {};
  items.forEach((i) => { const ym = i.date.slice(0, 7); byMonth[ym] = (byMonth[ym] ?? 0) + i.amount; });
  const monthData = Object.entries(byMonth).sort().map(([ym, value]) => ({ month: monthLabel(ym), value }));

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Investment Analyzer</h1>
          <p className="text-fg-muted mt-1">Charts of your asset allocation, deployment over time, and platforms.</p>
        </div>
        <div className="card-shell p-8 text-center text-fg-muted">
          <Icon.Trophy className="mx-auto mb-2 opacity-50" size={32} />
          <div>No investments logged yet.</div>
          <Link href="/investments" className="btn-primary inline-flex mt-4"><Icon.Plus size={16} /> Log an investment</Link>
        </div>
      </div>
    );
  }

  const topType = typeData[0];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Investment Analyzer</h1>
          <p className="text-fg-muted mt-1">Asset allocation, deployment over time, and platform split.</p>
        </div>
        <Link href="/investments" className="btn-secondary"><Icon.Plus size={16} /> Log investment</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="stat-tile"><div className="label">Total invested</div><div className="text-2xl font-semibold mt-1 text-info">{inr(total)}</div><div className="text-xs text-fg-muted mt-1">{items.length} entries</div></div>
        <div className="stat-tile"><div className="label">Largest allocation</div><div className="text-2xl font-semibold mt-1">{topType?.name ?? "—"}</div><div className="text-xs text-fg-muted mt-1">{topType ? `${((topType.value / total) * 100).toFixed(1)}%` : ""}</div></div>
        <div className="stat-tile col-span-2 md:col-span-1"><div className="label">Asset types</div><div className="text-2xl font-semibold mt-1">{typeData.length}</div></div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card-shell p-5">
          <h2 className="font-semibold mb-4">Allocation by asset type</h2>
          {mounted && (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2}>
                  {typeData.map((d, i) => <Cell key={d.key} fill={colorFor("", i)} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} formatter={(v) => inrExact(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="card-shell p-5">
          <h2 className="font-semibold mb-4">Invested per month</h2>
          {mounted && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} formatter={(v) => inrExact(Number(v))} />
                <Bar dataKey="value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

      <section className="card-shell p-5">
        <h2 className="font-semibold mb-4">By platform</h2>
        {mounted && (
          <ResponsiveContainer width="100%" height={Math.max(160, platformData.length * 44)}>
            <BarChart data={platformData} layout="vertical" margin={{ top: 4, right: 16, left: 80, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => `₹${v / 1000}k`} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} width={110} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} formatter={(v) => inrExact(Number(v))} />
              <Bar dataKey="value" fill="#84cc16" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>
    </div>
  );
}
