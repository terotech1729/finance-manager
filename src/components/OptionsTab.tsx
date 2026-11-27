"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  daysToExpiry, fmtExpiry, fmtInt, fmtMoney, premium,
  type Accumulation, type ExpirySummary, type Flagged, type OptionRow,
} from "@/lib/options";
import type { HeatStock } from "@/lib/stockHeatmap";

type ChainResponse = {
  available: boolean;
  underlying: string;
  source: string;
  delayNote: string;
  currency: string;
  spot: number | null;
  day: string;
  asOf: string;
  expiries: ExpirySummary[];
  expiry: string;
  unusual: Flagged[];
  rows: OptionRow[];
};

type HistoryResponse = { days: string[]; top: Accumulation[]; pinned: Accumulation[]; error?: string };
type Pin = { id: string; t: "C" | "P"; exp: string; k: number };

const POLL_MS = 60_000;
const pinKey = (symbol: string) => `jarvis.options.pins.${symbol}`;

function loadPins(symbol: string): Pin[] {
  try { return JSON.parse(localStorage.getItem(pinKey(symbol)) ?? "[]") as Pin[]; } catch { return []; }
}

const contractLabel = (c: { t?: "C" | "P"; type?: "C" | "P"; k?: number; strike?: number; exp?: string; expiry?: string }) => {
  const t = c.t ?? c.type;
  const k = c.k ?? c.strike;
  const exp = c.exp ?? c.expiry ?? "";
  return `${k} ${t === "C" ? "Call" : "Put"} · ${fmtExpiry(exp)}`;
};

function Sparkline({ values, className = "" }: { values: number[]; className?: string }) {
  if (values.length < 2) return null;
  const min = Math.min(...values), max = Math.max(...values);
  const w = 80, h = 22;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * (h - 2) - 1}`).join(" ");
  return (
    <svg width={w} height={h} className={className}>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function OptionsTab({ stock }: { stock: HeatStock }) {
  const [data, setData] = useState<ChainResponse | null>(null);
  const [expiry, setExpiry] = useState<string | null>(null);
  const expiryRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [side, setSide] = useState<"all" | "C" | "P">("all");
  const [near, setNear] = useState(true);
  const [showAll, setShowAll] = useState(false);

  const [watching, setWatching] = useState<boolean | null>(null);
  const [storeStatus, setStoreStatus] = useState<string>("");
  const [watchBusy, setWatchBusy] = useState(false);
  const [watchMsg, setWatchMsg] = useState("");
  const [history, setHistory] = useState<HistoryResponse | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);

  useEffect(() => { setPins(loadPins(stock.symbol)); }, [stock.symbol]);

  const togglePin = (p: Pin) => {
    setPins((prev) => {
      const next = prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p];
      localStorage.setItem(pinKey(stock.symbol), JSON.stringify(next));
      return next;
    });
  };

  const loadChain = useCallback(async (exp: string | null, quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const qs = new URLSearchParams({ symbol: stock.symbol });
      if (exp) qs.set("expiry", exp);
      const res = await fetch(`/api/options/chain?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json);
      if (json.available) { setExpiry(json.expiry); expiryRef.current = json.expiry; }
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [stock.symbol]);

  useEffect(() => {
    loadChain(null);
    const id = setInterval(() => { if (!document.hidden) loadChain(expiryRef.current, true); }, POLL_MS);
    return () => clearInterval(id);
  }, [loadChain]);

  const selectExpiry = (exp: string) => {
    setExpiry(exp);
    expiryRef.current = exp;
    loadChain(exp);
  };

  const loadWatch = useCallback(async () => {
    try {
      const res = await fetch("/api/options/watch");
      const json = await res.json();
      setStoreStatus(json.error ? `error: ${json.error}` : json.status);
      setWatching((json.watch as { symbol: string }[]).some((w) => w.symbol === stock.symbol));
    } catch {
      setWatching(false);
    }
  }, [stock.symbol]);

  useEffect(() => { loadWatch(); }, [loadWatch]);

  const pinIds = pins.map((p) => p.id).join(",");
  const loadHistory = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ symbol: stock.symbol, days: "30", contracts: pinIds });
      const res = await fetch(`/api/options/history?${qs}`);
      setHistory(await res.json());
    } catch {
      setHistory(null);
    }
  }, [stock.symbol, pinIds]);

  useEffect(() => { if (watching) loadHistory(); }, [watching, loadHistory]);

  const toggleWatch = async () => {
    setWatchBusy(true);
    setWatchMsg("");
    try {
      const res = watching
        ? await fetch(`/api/options/watch?symbol=${encodeURIComponent(stock.symbol)}`, { method: "DELETE" })
        : await fetch("/api/options/watch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ symbol: stock.symbol, label: stock.name }),
          });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      if (!watching) setWatchMsg(`Saved today's snapshot (${fmtInt(json.stored)} contracts). Updated every trading day.`);
      await loadWatch();
    } catch (e) {
      setWatchMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setWatchBusy(false);
    }
  };

  const totals = useMemo(() => {
    const e = data?.expiries ?? [];
    const callVol = e.reduce((a, x) => a + x.callVol, 0);
    const putVol = e.reduce((a, x) => a + x.putVol, 0);
    const callOi = e.reduce((a, x) => a + x.callOi, 0);
    const putOi = e.reduce((a, x) => a + x.putOi, 0);
    return { callVol, putVol, callOi, putOi, pcVol: callVol ? putVol / callVol : null, pcOi: callOi ? putOi / callOi : null };
  }, [data]);

  const ladder = useMemo(() => {
    if (!data?.rows) return [];
    const byStrike = new Map<number, { k: number; c?: OptionRow; p?: OptionRow }>();
    for (const r of data.rows) {
      const s = byStrike.get(r.k) ?? { k: r.k };
      if (r.t === "C") s.c = r; else s.p = r;
      byStrike.set(r.k, s);
    }
    let list = Array.from(byStrike.values()).sort((a, b) => a.k - b.k);
    if (near && data.spot) list = list.filter((s) => Math.abs(s.k - data.spot!) / data.spot! <= 0.25);
    return list;
  }, [data, near]);

  const maxVol = useMemo(() => Math.max(1, ...(data?.rows ?? []).map((r) => r.vol)), [data]);

  if (loading && !data) return <div className="p-4 text-sm text-fg-muted">Loading option chain…</div>;
  if (error && !data) return <div className="p-4 text-sm text-danger">Couldn&apos;t load options: {error}</div>;
  if (!data?.available) {
    return <div className="p-4 text-sm text-fg-muted">No listed options found for {stock.symbol}. Options data covers US stocks (CBOE) and NSE F&amp;O stocks.</div>;
  }

  const ccy = data.currency;
  const unusual = data.unusual.filter((u) => side === "all" || u.t === side);
  const isPinned = (id: string) => pins.some((p) => p.id === id);
  const pinBtn = (r: { id: string; t: "C" | "P"; exp: string; k: number }) => (
    <button
      onClick={(e) => { e.stopPropagation(); togglePin({ id: r.id, t: r.t, exp: r.exp, k: r.k }); }}
      className={`text-sm leading-none ${isPinned(r.id) ? "text-warning" : "text-fg-subtle hover:text-warning"}`}
      title={isPinned(r.id) ? "Unpin" : "Pin to follow this contract day by day"}
    >
      {isPinned(r.id) ? "★" : "☆"}
    </button>
  );

  return (
    <div className="p-3 sm:p-4 space-y-5 text-xs">
      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-fg-muted">
          <span>Source: <span className="text-fg">{data.source}</span> · {data.delayNote}</span>
          <span>Trading day {data.day}</span>
          {loading && <span className="text-fg-subtle">refreshing…</span>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono">
          {[
            ["Call volume", fmtInt(totals.callVol), "text-success"],
            ["Put volume", fmtInt(totals.putVol), "text-danger"],
            ["Put/Call (vol)", totals.pcVol?.toFixed(2) ?? "—", ""],
            ["Put/Call (OI)", totals.pcOi?.toFixed(2) ?? "—", ""],
          ].map(([label, v, cls]) => (
            <div key={label} className="rounded-sm bg-bg/60 px-2 py-1.5">
              <div className="text-fg-subtle font-sans">{label}</div>
              <div className={`text-sm ${cls}`}>{v}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-2">
          <div className="flex-1 min-w-[200px] text-fg-muted">
            {watching
              ? "Tracking: the full chain is saved after every close, so open-interest build-up shows below."
              : "Track to save this chain after every close — that's how you spot someone building a position over days."}
          </div>
          <button
            onClick={toggleWatch}
            disabled={watchBusy || watching === null || (storeStatus !== "ok" && !watching)}
            className={`px-2.5 py-1 rounded-md border ${watching ? "border-warning text-warning" : "border-accent text-accent"} disabled:opacity-50`}
            title={storeStatus && storeStatus !== "ok" ? `Storage: ${storeStatus}` : undefined}
          >
            {watchBusy ? "Saving…" : watching ? "Tracking ✓ — stop" : "Track daily"}
          </button>
          {watchMsg && <div className="w-full text-fg-muted">{watchMsg}</div>}
          {storeStatus && storeStatus !== "ok" && (
            <div className="w-full text-warning">Daily tracking unavailable: {storeStatus === "unconfigured" ? "Supabase isn't configured" : storeStatus === "read-only" ? "SUPABASE_SERVICE_ROLE_KEY isn't set" : storeStatus}</div>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className="text-sm font-semibold text-fg">Unusual activity today</h3>
          <span className="text-fg-subtle">all expiries · biggest money first</span>
          <div className="ml-auto flex rounded-md border border-border overflow-hidden">
            {(["all", "C", "P"] as const).map((s) => (
              <button key={s} onClick={() => setSide(s)} className={`px-2 py-0.5 ${side === s ? "bg-accent/15 text-accent" : "text-fg-muted"}`}>
                {s === "all" ? "All" : s === "C" ? "Calls" : "Puts"}
              </button>
            ))}
          </div>
        </div>
        {!unusual.length ? (
          <div className="text-fg-muted">Nothing unusual in this session yet.</div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full min-w-[560px] font-mono">
              <thead className="text-fg-subtle text-left">
                <tr>
                  <th className="px-1 py-1 font-normal" />
                  <th className="px-1 py-1 font-normal font-sans">Contract</th>
                  <th className="px-1 py-1 font-normal text-right">Volume</th>
                  <th className="px-1 py-1 font-normal text-right">Open int.</th>
                  <th className="px-1 py-1 font-normal text-right">Vol/OI</th>
                  <th className="px-1 py-1 font-normal text-right">Premium</th>
                  <th className="px-1 py-1 font-normal text-right">Last</th>
                  <th className="px-1 py-1 font-normal text-right">OTM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(showAll ? unusual : unusual.slice(0, 10)).map((u) => (
                  <tr key={u.id} className="align-top">
                    <td className="px-1 py-1.5">{pinBtn(u)}</td>
                    <td className="px-1 py-1.5 font-sans">
                      <div className={u.t === "C" ? "text-success" : "text-danger"}>{contractLabel(u)} <span className="text-fg-subtle">({u.dte}d)</span></div>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {u.reasons.map((r) => (
                          <span key={r} className={`px-1 rounded-sm ${r === "paid at ask" ? "bg-success/15 text-success" : r === "volume > open interest" ? "bg-warning/15 text-warning" : "bg-accent/10 text-accent"}`}>{r}</span>
                        ))}
                        {u.side === "bid" && <span className="px-1 rounded-sm bg-danger/15 text-danger">hit at bid</span>}
                      </div>
                    </td>
                    <td className="px-1 py-1.5 text-right text-fg">{fmtInt(u.vol)}</td>
                    <td className="px-1 py-1.5 text-right">{fmtInt(u.oi)}</td>
                    <td className={`px-1 py-1.5 text-right ${u.volOi > 1 ? "text-warning" : ""}`}>{Number.isFinite(u.volOi) ? `${u.volOi.toFixed(1)}×` : "new"}</td>
                    <td className="px-1 py-1.5 text-right text-fg">{fmtMoney(u.premium, ccy)}</td>
                    <td className="px-1 py-1.5 text-right">{u.last?.toFixed(2) ?? "—"}</td>
                    <td className="px-1 py-1.5 text-right">{u.otm == null ? "—" : `${u.otm.toFixed(1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {unusual.length > 10 && (
              <button onClick={() => setShowAll((s) => !s)} className="mt-1 px-1 text-accent hover:underline">
                {showAll ? "Show top 10" : `Show all ${unusual.length}`}
              </button>
            )}
          </div>
        )}
        <p className="mt-1.5 text-fg-subtle">
          Public data shows totals per contract, not who traded. &quot;Paid at ask&quot; means the last trade printed near the ask (a buyer paying up);
          volume above open interest suggests new positions opened today. Either could be a hedge or one leg of a spread.
        </p>
      </section>

      {watching && (
        <section>
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="text-sm font-semibold text-fg">Positions being built</h3>
            <span className="text-fg-subtle">largest open-interest growth · {history?.days.length ?? 0} trading days saved</span>
            <button onClick={loadHistory} className="ml-auto text-accent hover:underline">Refresh</button>
          </div>
          {history?.error ? (
            <div className="text-warning">{history.error}</div>
          ) : !history || history.days.length < 2 ? (
            <div className="text-fg-muted">History starts {history?.days[0] ?? "today"}. Open-interest build-up appears after the next trading day&apos;s snapshot.</div>
          ) : !history.top.length ? (
            <div className="text-fg-muted">No contract has grown its open interest across the saved days.</div>
          ) : (
            <ul className="divide-y divide-border">
              {history.top.slice(0, 15).map((a) => (
                <li key={a.contract} className="py-1.5 flex items-center gap-2">
                  {pinBtn({ id: a.contract, t: a.type, exp: a.expiry, k: a.strike })}
                  <div className="min-w-0 flex-1">
                    <div className={a.type === "C" ? "text-success" : "text-danger"}>{contractLabel(a)} <span className="text-fg-subtle">({daysToExpiry(a.expiry)}d)</span></div>
                    <div className="text-fg-subtle font-mono">OI {fmtInt(a.oiStart)} → {fmtInt(a.oiEnd)} over {a.days} days · {fmtInt(a.totalVolume)} traded</div>
                  </div>
                  <Sparkline values={a.series.map((p) => p.oi)} className={a.type === "C" ? "text-success" : "text-danger"} />
                  <span className="font-mono text-warning w-20 text-right">+{fmtInt(a.oiChange)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {pins.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-fg mb-1.5">Pinned contracts</h3>
          <div className="space-y-3">
            {pins.map((p) => {
              const hist = history?.pinned.find((h) => h.contract === p.id);
              const today = data.unusual.find((u) => u.id === p.id) ?? data.rows.find((r) => r.id === p.id);
              return (
                <div key={p.id} className="rounded-md border border-border p-2">
                  <div className="flex items-center gap-2">
                    {pinBtn(p)}
                    <span className={p.t === "C" ? "text-success" : "text-danger"}>{contractLabel(p)}</span>
                    <span className="text-fg-subtle">({daysToExpiry(p.exp)}d)</span>
                    {today && (
                      <span className="ml-auto font-mono text-fg-muted">
                        today vol {fmtInt(today.vol)} · OI {fmtInt(today.oi)} · {fmtMoney(premium(today), ccy)}
                      </span>
                    )}
                  </div>
                  {hist && hist.series.length > 1 ? (
                    <div className="h-32 mt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={hist.series} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                          <CartesianGrid stroke="#14283E" vertical={false} />
                          <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#7B93AD" }} tickFormatter={(d: string) => d.slice(5)} />
                          <YAxis yAxisId="oi" tick={{ fontSize: 10, fill: "#7B93AD" }} width={48} tickFormatter={(v: number) => fmtInt(v)} />
                          <YAxis yAxisId="vol" orientation="right" hide />
                          <Tooltip contentStyle={{ background: "#0A1322", border: "1px solid #1E3C5A", fontSize: 11 }} formatter={(v) => fmtInt(Number(v))} />
                          <Bar yAxisId="vol" dataKey="volume" name="Volume" fill="#00CFFF55" />
                          <Line yAxisId="oi" dataKey="oi" name="Open interest" stroke="#FFB454" dot={false} strokeWidth={2} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="mt-1 text-fg-subtle">
                      {watching ? "Day-by-day chart appears once two trading days are saved." : "Turn on “Track daily” to build this contract's day-by-day history."}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center gap-2 mb-1.5">
          <h3 className="text-sm font-semibold text-fg">Option chain</h3>
          <label className="ml-auto flex items-center gap-1 text-fg-muted">
            <input type="checkbox" checked={near} onChange={(e) => setNear(e.target.checked)} /> strikes within ±25%
          </label>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1.5 -mx-1 px-1">
          {data.expiries.map((e) => (
            <button
              key={e.exp}
              onClick={() => selectExpiry(e.exp)}
              className={`shrink-0 px-2 py-1 rounded-md border text-left ${e.exp === expiry ? "border-accent text-accent" : "border-border text-fg-muted hover:text-fg"}`}
            >
              <div>{fmtExpiry(e.exp)} <span className="text-fg-subtle">{e.dte}d</span></div>
              <div className="font-mono text-[10px] text-fg-subtle">vol {fmtInt(e.callVol + e.putVol)}</div>
            </button>
          ))}
        </div>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[520px] font-mono">
            <thead className="text-fg-subtle">
              <tr>
                <th colSpan={4} className="py-1 font-normal text-success">Calls</th>
                <th className="py-1 font-normal">Strike</th>
                <th colSpan={4} className="py-1 font-normal text-danger">Puts</th>
              </tr>
              <tr className="text-[10px]">
                {["OI", "Vol", "IV", "Last"].map((h) => <th key={`c${h}`} className="px-1 font-normal text-right">{h}</th>)}
                <th />
                {["Last", "IV", "Vol", "OI"].map((h) => <th key={`p${h}`} className="px-1 font-normal text-right">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {ladder.map(({ k, c, p }, i) => {
                const spot = data.spot ?? 0;
                const atm = i > 0 && ladder[i - 1].k < spot && k >= spot;
                const cell = (r: OptionRow | undefined, field: "oi" | "vol" | "iv" | "last") => {
                  if (!r) return "—";
                  if (field === "iv") return r.iv != null ? `${(r.iv * 100).toFixed(0)}%` : "—";
                  if (field === "last") return r.last?.toFixed(2) ?? "—";
                  return r[field] ? fmtInt(r[field]) : "—";
                };
                const volBg = (r?: OptionRow) =>
                  r && r.vol ? { background: `linear-gradient(to left, ${r.t === "C" ? "#00E6A8" : "#FF3C3C"}${Math.round(Math.min(r.vol / maxVol, 1) * 80).toString(16).padStart(2, "0")} ${Math.min(r.vol / maxVol, 1) * 100}%, transparent 0)` } : undefined;
                const hot = (r?: OptionRow) => (r && r.vol > 0 && r.vol > r.oi ? "text-warning" : "");
                return (
                  <tr key={k} className={`${atm ? "border-t-2 border-accent" : "border-t border-border/50"}`}>
                    <td className={`px-1 py-0.5 text-right ${spot && k < spot ? "bg-success/5" : ""}`}>{cell(c, "oi")}</td>
                    <td className={`px-1 py-0.5 text-right ${hot(c)}`} style={volBg(c)}>{cell(c, "vol")}</td>
                    <td className="px-1 py-0.5 text-right text-fg-muted">{cell(c, "iv")}</td>
                    <td className="px-1 py-0.5 text-right">{cell(c, "last")}</td>
                    <td className="px-1 py-0.5 text-center text-fg font-semibold">
                      <span className="inline-flex items-center gap-1">
                        {c && pinBtn(c)}{k}{p && pinBtn(p)}
                      </span>
                    </td>
                    <td className="px-1 py-0.5 text-right">{cell(p, "last")}</td>
                    <td className="px-1 py-0.5 text-right text-fg-muted">{cell(p, "iv")}</td>
                    <td className={`px-1 py-0.5 text-right ${hot(p)}`} style={volBg(p)}>{cell(p, "vol")}</td>
                    <td className={`px-1 py-0.5 text-right ${spot && k > spot ? "bg-danger/5" : ""}`}>{cell(p, "oi")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-fg-subtle">
          Spot {data.spot?.toLocaleString("en-US") ?? "—"} (cyan line). Amber volume = traded more than existing open interest. Shaded = in the money.
          Volume and open interest are in contracts{ccy === "INR" ? " (lots)" : " (100 shares each)"}.
        </p>
      </section>
    </div>
  );
}
