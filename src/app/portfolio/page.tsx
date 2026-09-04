"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import Link from "next/link";
import { loadHoldings, holdingInvested, holdingValue, holdingHasValue } from "@/lib/storage";
import { useDataVersion } from "@/lib/useLiveData";
import { colorFor } from "@/lib/chartColors";
import { monthLabel } from "@/lib/history";
import { inr, inrExact } from "@/lib/utils";
import { typeLabel, typeIcon } from "@/lib/investmentTypes";
import type { Holding } from "@/lib/types";
import { Icon } from "@/components/Icons";

export default function InvestmentAnalyzerPage() {
  const [mounted, setMounted] = useState(false);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const dataVersion = useDataVersion();
  useEffect(() => { setMounted(true); setHoldings(loadHoldings()); }, [dataVersion]);

  const data = useMemo(() => {
    // Real estate is leveraged + illiquid, so we report it in its own section.
    const liquid = holdings.filter((h) => h.type !== "real_estate");
    const reList = holdings.filter((h) => h.type === "real_estate");

    const reRows = reList.map((h) => {
      const down = holdingInvested(h);
      const propertyValue = h.realEstate?.propertyValue ?? down;
      const loan = h.realEstate?.loanAmount ?? 0;
      return { h, down, propertyValue, loan, equity: propertyValue - loan, emi: h.realEstate?.emi ?? 0 };
    });
    const reTotals = reRows.reduce(
      (a, r) => ({ value: a.value + r.propertyValue, loan: a.loan + r.loan, equity: a.equity + r.equity, down: a.down + r.down, emi: a.emi + r.emi }),
      { value: 0, loan: 0, equity: 0, down: 0, emi: 0 }
    );

    const rows = liquid.map((h) => {
      const invested = holdingInvested(h);
      const value = holdingValue(h);
      return { h, invested, value, abs: value - invested, hasValue: holdingHasValue(h) };
    });
    const totalInvested = rows.reduce((a, r) => a + r.invested, 0);
    const totalValue = rows.reduce((a, r) => a + r.value, 0);

    const byTypeMap: Record<string, { invested: number; value: number }> = {};
    rows.forEach((r) => {
      const k = r.h.type;
      byTypeMap[k] = byTypeMap[k] ?? { invested: 0, value: 0 };
      byTypeMap[k].invested += r.invested;
      byTypeMap[k].value += r.value;
    });
    const typeData = Object.entries(byTypeMap)
      .map(([k, v]) => ({ key: k, name: typeLabel(k), value: v.value, invested: v.invested }))
      .sort((a, b) => b.value - a.value);

    const byPlatform: Record<string, number> = {};
    rows.forEach((r) => { const p = r.h.platform || "Unspecified"; byPlatform[p] = (byPlatform[p] ?? 0) + r.value; });
    const platformData = Object.entries(byPlatform).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const byMonth: Record<string, number> = {};
    liquid.forEach((h) => (h.contributions ?? []).forEach((c) => {
      const ym = c.date.slice(0, 7); byMonth[ym] = (byMonth[ym] ?? 0) + c.amount;
    }));
    const monthData = Object.entries(byMonth).sort().map(([ym, value]) => ({ month: monthLabel(ym), value }));

    const topHoldings = [...rows].sort((a, b) => b.value - a.value);
    const anyValues = rows.some((r) => r.hasValue);

    return {
      liquidCount: liquid.length,
      rows, totalInvested, totalValue, abs: totalValue - totalInvested,
      pct: totalInvested > 0 ? ((totalValue - totalInvested) / totalInvested) * 100 : 0,
      typeData, platformData, monthData, topHoldings, anyValues,
      reRows, reTotals,
    };
  }, [holdings]);

  if (holdings.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">Investment Analyzer</h1>
          <p className="text-fg-muted mt-1">Allocation, deployment over time, and gains across your holdings.</p>
        </div>
        <div className="card-shell p-8 text-center text-fg-muted">
          <Icon.Trophy className="mx-auto mb-2 opacity-50" size={32} />
          <div>No holdings yet.</div>
          <Link href="/investments" className="btn-primary inline-flex mt-4"><Icon.Plus size={16} /> Add a holding</Link>
        </div>
      </div>
    );
  }

  const top = data.typeData[0];

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Investment Analyzer</h1>
          <p className="text-fg-muted mt-1">Allocation, gains, deployment over time, and platform split.</p>
        </div>
        <Link href="/investments" className="btn-secondary"><Icon.Plus size={16} /> Manage holdings</Link>
      </div>

      {/* ===== Investments (excludes real estate) ===== */}
      {data.liquidCount > 0 && (
      <>
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-tile"><div className="label">Invested (deployed)</div><div className="text-2xl font-semibold mt-1 text-info">{inr(data.totalInvested)}</div><div className="text-xs text-fg-muted mt-1">{data.liquidCount} holding{data.liquidCount === 1 ? "" : "s"}</div></div>
        <div className="stat-tile"><div className="label">Largest sleeve</div><div className="text-2xl font-semibold mt-1">{top?.name ?? "—"}</div><div className="text-xs text-fg-muted mt-1">{top ? `${((top.value / Math.max(data.totalValue, 1)) * 100).toFixed(1)}%` : ""}</div></div>
        {data.anyValues ? (
          <>
            <div className="stat-tile"><div className="label">Current value</div><div className="text-2xl font-semibold mt-1">{inr(data.totalValue)}</div></div>
            <div className="stat-tile">
              <div className="label">Unrealized P/L</div>
              <div className={`text-2xl font-semibold mt-1 ${data.abs >= 0 ? "text-success" : "text-danger"}`}>{data.abs >= 0 ? "+" : "−"}{inr(Math.abs(data.abs))}</div>
              <div className={`text-xs mt-1 ${data.abs >= 0 ? "text-success" : "text-danger"}`}>{data.abs >= 0 ? "+" : "−"}{Math.abs(data.pct).toFixed(2)}%</div>
            </div>
          </>
        ) : (
          <div className="stat-tile col-span-2">
            <div className="label">Gains (optional)</div>
            <div className="text-sm text-fg-muted mt-2 leading-snug">P/L appears once you enter current values on the <Link href="/investments" className="underline text-info">Investments</Link> page (“Update values”). No platform integration needed.</div>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card-shell p-5">
          <h2 className="font-semibold mb-4">Allocation by asset type</h2>
          {mounted && (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={data.typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2}>
                  {data.typeData.map((d, i) => <Cell key={d.key} fill={colorFor("", i)} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} formatter={(v) => inrExact(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="card-shell p-5">
          <h2 className="font-semibold mb-4">{data.anyValues ? "Invested vs current value, by type" : "Invested by type"}</h2>
          {mounted && (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.typeData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} interval={0} angle={-12} textAnchor="end" height={50} />
                <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} formatter={(v) => inrExact(Number(v))} />
                {data.anyValues && <Legend wrapperStyle={{ fontSize: 11 }} />}
                <Bar dataKey="invested" name="Invested" fill={data.anyValues ? "#64748b" : "#0ea5e9"} radius={[4, 4, 0, 0]} />
                {data.anyValues && <Bar dataKey="value" name="Current value" fill="#0ea5e9" radius={[4, 4, 0, 0]} />}
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>
      </div>

      <section className="card-shell p-5">
        <h2 className="font-semibold mb-4">Contributions per month</h2>
        {mounted && data.monthData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.monthData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="month" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => `₹${v / 1000}k`} />
              <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} formatter={(v) => inrExact(Number(v))} />
              <Bar dataKey="value" name="Contributed" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <div className="text-xs text-fg-muted">No dated contributions yet.</div>}
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="card-shell p-5">
          <h2 className="font-semibold mb-4">By platform</h2>
          {mounted && (
            <ResponsiveContainer width="100%" height={Math.max(160, data.platformData.length * 44)}>
              <BarChart data={data.platformData} layout="vertical" margin={{ top: 4, right: 16, left: 80, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" tick={{ fill: "#94a3b8", fontSize: 12 }} tickFormatter={(v) => `₹${v / 1000}k`} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} width={110} />
                <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #334155", borderRadius: 8 }} formatter={(v) => inrExact(Number(v))} />
                <Bar dataKey="value" fill="#84cc16" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </section>

        <section className="card-shell p-5">
          <h2 className="font-semibold mb-4">Top holdings</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-fg-muted text-[10px] uppercase tracking-wide">
                <tr><th className="text-left py-1">Holding</th><th className="text-right">Invested</th><th className="text-right">Value</th><th className="text-right">P/L</th></tr>
              </thead>
              <tbody>
                {data.topHoldings.map((r) => (
                  <tr key={r.h.id} className="border-t border-border/60">
                    <td className="py-2 pr-2"><span className="mr-1">{typeIcon(r.h.type)}</span>{r.h.name}</td>
                    <td className="text-right text-fg-muted">{inrExact(r.invested)}</td>
                    <td className="text-right font-medium">{inrExact(r.value)}</td>
                    <td className={`text-right ${r.abs >= 0 ? "text-success" : "text-danger"}`}>
                      {r.hasValue ? `${r.abs >= 0 ? "+" : "−"}${(r.invested > 0 ? Math.abs(r.abs / r.invested * 100) : 0).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      </>
      )}

      {/* ===== Real estate (own section: leveraged + illiquid) ===== */}
      {data.reRows.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏠</span>
            <h2 className="text-lg font-bold">Real estate</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="stat-tile"><div className="label">Property value</div><div className="text-2xl font-semibold mt-1">{inr(data.reTotals.value)}</div></div>
            <div className="stat-tile"><div className="label">Outstanding loan</div><div className="text-2xl font-semibold mt-1 text-danger">{inr(data.reTotals.loan)}</div></div>
            <div className="stat-tile"><div className="label">Net equity</div><div className="text-2xl font-semibold mt-1 text-success">{inr(data.reTotals.equity)}</div><div className="text-xs text-fg-muted mt-1">value − loan</div></div>
            <div className="stat-tile"><div className="label">EMI / month</div><div className="text-2xl font-semibold mt-1">{inr(data.reTotals.emi)}</div></div>
          </div>

          <div className="card-shell overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-fg-muted text-[10px] uppercase tracking-wide">
                <tr>
                  <th className="text-left p-3">Property</th>
                  <th className="text-right">Value</th>
                  <th className="text-right">Down pmt</th>
                  <th className="text-right">Loan</th>
                  <th className="text-right">Equity</th>
                  <th className="text-right">EMI</th>
                  <th className="text-right">Rate</th>
                  <th className="text-right p-3">Tenure</th>
                </tr>
              </thead>
              <tbody>
                {data.reRows.map((r) => (
                  <tr key={r.h.id} className="table-row">
                    <td className="p-3 font-medium">{r.h.name}{r.h.realEstate?.lender ? <span className="text-fg-muted font-normal"> · {r.h.realEstate.lender}</span> : ""}</td>
                    <td className="text-right">{inrExact(r.propertyValue)}</td>
                    <td className="text-right text-fg-muted">{inrExact(r.down)}</td>
                    <td className="text-right text-danger">{inrExact(r.loan)}</td>
                    <td className="text-right font-medium text-success">{inrExact(r.equity)}</td>
                    <td className="text-right">{r.emi ? inrExact(r.emi) : "—"}</td>
                    <td className="text-right text-fg-muted">{r.h.realEstate?.interestRate != null ? `${r.h.realEstate.interestRate}%` : "—"}</td>
                    <td className="text-right p-3 text-fg-muted">{r.h.realEstate?.tenureMonths != null ? `${Math.round(r.h.realEstate.tenureMonths / 12)}y` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-fg-muted">Net equity = current property value − outstanding loan. Update property value anytime via “Update values” on the Investments page.</p>
        </section>
      )}
    </div>
  );
}
