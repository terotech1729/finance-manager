"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MARKETS, PERIODS, fmtPct, fmtUsdCap, heatColor, squarify, tileLabel,
  type HeatStock, type HeatmapPayload, type PeriodKey, type Rect,
} from "@/lib/stockHeatmap";
import { StockPanel, type PanelTab } from "@/components/StockPanel";

type Group = { key: string; label: string; stocks: HeatStock[]; cap: number; chg: number | null };
type Tile = { stock: HeatStock; rect: Rect; group: string };
type GroupBox = { group: Group; rect: Rect; header: boolean };

const GROUP_GAP = 2;
const HEADER_H = 18;

function weightedChange(stocks: HeatStock[], period: PeriodKey): number | null {
  let wSum = 0, cSum = 0;
  for (const s of stocks) {
    const c = s.chg[period];
    if (c == null) continue;
    wSum += s.capUsd; cSum += s.capUsd * c;
  }
  return wSum ? cSum / wSum : null;
}

function layoutGroups(groups: Group[], width: number, height: number): { boxes: GroupBox[]; tiles: Tile[] } {
  const sorted = [...groups].sort((a, b) => b.cap - a.cap);
  const outer = squarify(sorted.map((g) => g.cap), { x: 0, y: 0, w: width, h: height });
  const boxes: GroupBox[] = [];
  const tiles: Tile[] = [];
  sorted.forEach((g, i) => {
    const r = outer[i];
    const inner: Rect = { x: r.x + GROUP_GAP / 2, y: r.y + GROUP_GAP / 2, w: r.w - GROUP_GAP, h: r.h - GROUP_GAP };
    const header = inner.w > 70 && inner.h > 60;
    boxes.push({ group: g, rect: inner, header });
    const body: Rect = header ? { ...inner, y: inner.y + HEADER_H, h: inner.h - HEADER_H } : inner;
    const rects = squarify(g.stocks.map((s) => s.capUsd), body);
    g.stocks.forEach((s, k) => tiles.push({ stock: s, rect: rects[k], group: g.key }));
  });
  return { boxes, tiles };
}

export default function StockHeatmapPage() {
  const [data, setData] = useState<HeatmapPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<PeriodKey>("d");
  const [enabled, setEnabled] = useState<Set<string>>(() => new Set(MARKETS.map((m) => m.id)));
  const [drill, setDrill] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [hover, setHover] = useState<{ stock: HeatStock; x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<{ stock: HeatStock; market: string } | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/stocks/heatmap");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData((await res.json()) as HeatmapPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const deepLink = useRef<string | null | undefined>(undefined);
  const deepTab = useRef<PanelTab>("overview");
  if (deepLink.current === undefined && typeof window !== "undefined") {
    const qs = new URLSearchParams(window.location.search);
    deepLink.current = qs.get("s");
    if (qs.get("tab") === "options") deepTab.current = "options";
  }

  const setUrlTab = (t: PanelTab) => {
    const url = new URL(window.location.href);
    if (t === "options") url.searchParams.set("tab", "options");
    else url.searchParams.delete("tab");
    window.history.replaceState(null, "", url);
  };

  useEffect(() => {
    const want = deepLink.current;
    if (!data || !want) return;
    deepLink.current = null;
    for (const m of data.markets) {
      const s = m.stocks.find((x) => x.symbol === want);
      if (s) { setSelected({ stock: s, market: m.id }); break; }
    }
  }, [data]);

  useEffect(() => {
    if (deepLink.current) return;
    const url = new URL(window.location.href);
    if (selected) url.searchParams.set("s", selected.stock.symbol);
    else { url.searchParams.delete("s"); url.searchParams.delete("tab"); }
    window.history.replaceState(null, "", url);
  }, [selected]);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [full]);

  useEffect(() => {
    if (!full && !selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (selected) setSelected(null);
      else setFull(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [full, selected]);

  const scale = PERIODS.find((p) => p.key === period)!.scale;

  const groups: Group[] = useMemo(() => {
    if (!data) return [];
    const mk = (key: string, label: string, stocks: HeatStock[]): Group => ({
      key, label, stocks, cap: stocks.reduce((a, s) => a + s.capUsd, 0), chg: weightedChange(stocks, period),
    });
    if (drill) {
      const m = data.markets.find((x) => x.id === drill);
      if (!m) return [];
      const bySector = new Map<string, HeatStock[]>();
      for (const s of m.stocks) bySector.set(s.sector, [...(bySector.get(s.sector) ?? []), s]);
      return Array.from(bySector, ([sector, stocks]) => mk(sector, sector, stocks));
    }
    return data.markets
      .filter((m) => enabled.has(m.id) && m.stocks.length)
      .map((m) => mk(m.id, m.label, m.stocks));
  }, [data, drill, enabled, period]);

  const { boxes, tiles } = useMemo(
    () => (size.w && size.h ? layoutGroups(groups, size.w, size.h) : { boxes: [], tiles: [] }),
    [groups, size],
  );

  const failed = data?.markets.filter((m) => m.error) ?? [];
  const drillLabel = drill ? data?.markets.find((m) => m.id === drill)?.label : null;

  const toggleMarket = (id: string) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { if (next.size > 1) next.delete(id); } else next.add(id);
      return next;
    });
  };

  const onTilePointer = (e: React.PointerEvent, stock: HeatStock) => {
    if (e.pointerType !== "mouse") return;
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    setHover({ stock, x: e.clientX - box.left, y: e.clientY - box.top });
  };

  return (
    <div className={full ? "fixed inset-0 z-50 bg-bg flex flex-col p-2 sm:p-3 gap-2" : "flex flex-col gap-3"}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="mr-auto min-w-0">
          <h1 className="page-title flex items-center gap-2">
            {drillLabel ? (
              <>
                <button onClick={() => setDrill(null)} className="text-fg-muted hover:text-accent">Global markets</button>
                <span className="text-fg-subtle">/</span>
                <span>{drillLabel}</span>
              </>
            ) : (
              "Global markets"
            )}
          </h1>
          <p className="text-xs text-fg-muted">
            Tile size = market cap (USD) · colour = % change
            {data && ` · updated ${new Date(data.asOf).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
          </p>
        </div>

        <div className="flex rounded-md border border-border overflow-hidden">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-2.5 py-1 text-xs font-mono ${period === p.key ? "bg-accent/15 text-accent" : "text-fg-muted hover:text-fg"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-2.5 py-1 text-xs rounded-md border border-border text-fg-muted hover:text-fg disabled:opacity-50"
        >
          {loading ? "Loading…" : "Refresh"}
        </button>
        <button
          onClick={() => setFull((f) => !f)}
          className="px-2.5 py-1 text-xs rounded-md border border-border text-fg-muted hover:text-fg"
        >
          {full ? "Exit full screen" : "Full screen"}
        </button>
      </div>

      {!drill && (
        <div className="flex flex-wrap gap-1.5">
          {MARKETS.map((m) => {
            const on = enabled.has(m.id);
            const stocks = data?.markets.find((x) => x.id === m.id)?.stocks ?? [];
            const chg = weightedChange(stocks, period);
            return (
              <button
                key={m.id}
                onClick={() => toggleMarket(m.id)}
                className={`px-2 py-0.5 text-xs rounded-md border ${on ? "border-border-strong text-fg" : "border-border text-fg-subtle line-through"}`}
              >
                {m.label}
                {stocks.length > 0 && (
                  <span className={`ml-1 font-mono ${chg == null ? "" : chg >= 0 ? "text-success" : "text-danger"}`}>
                    {fmtPct(chg)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {error && <div className="text-sm text-danger">Couldn&apos;t load market data: {error}</div>}
      {failed.length > 0 && (
        <div className="text-xs text-warning">Unavailable right now: {failed.map((m) => m.label).join(", ")}</div>
      )}

      <div
        ref={boxRef}
        className={`relative w-full overflow-hidden rounded-md bg-[#1a1d26] select-none ${full ? "flex-1" : "h-[72vh] min-h-[420px]"}`}
        onPointerLeave={() => setHover(null)}
      >
        {loading && !data && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-fg-muted">Loading markets…</div>
        )}

        {tiles.map(({ stock, rect, group }) => {
          const w = rect.w - 1, h = rect.h - 1;
          if (w <= 0 || h <= 0) return null;
          const pct = stock.chg[period];
          const label = tileLabel(stock);
          const fs = Math.max(8, Math.min(26, w / Math.max(label.length * 0.62, 2.5), h / 3.2));
          const showLabel = w > 26 && h > 16;
          const showPct = w > 34 && h > 30;
          const showLogo = stock.logo && w > 56 && h > 70;
          return (
            <div
              key={stock.symbol}
              className="absolute flex flex-col items-center justify-center text-center text-white overflow-hidden leading-tight cursor-pointer hover:brightness-125"
              style={{ left: rect.x, top: rect.y, width: w, height: h, background: heatColor(pct, scale) }}
              onPointerMove={(e) => onTilePointer(e, stock)}
              onClick={() => { setHover(null); setSelected({ stock, market: drill ?? group }); }}
            >
              {showLogo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://s3-symbol-logo.tradingview.com/${stock.logo}.svg`}
                  alt=""
                  className="rounded-full mb-1"
                  style={{ width: Math.min(32, fs * 1.4), height: Math.min(32, fs * 1.4) }}
                  loading="lazy"
                />
              )}
              {showLabel && <span className="font-semibold truncate max-w-full px-0.5" style={{ fontSize: fs }}>{label}</span>}
              {showPct && <span className="font-mono opacity-90" style={{ fontSize: Math.max(8, fs * 0.6) }}>{fmtPct(pct)}</span>}
            </div>
          );
        })}

        {boxes.map(({ group, rect, header }) =>
          header ? (
            <button
              key={group.key}
              onClick={() => !drill && setDrill(group.key)}
              className={`absolute flex items-center gap-1.5 px-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/90 bg-black/40 truncate ${drill ? "cursor-default" : "hover:bg-black/60"}`}
              style={{ left: rect.x, top: rect.y, width: rect.w, height: HEADER_H }}
              title={drill ? group.label : `Open ${group.label} by sector`}
            >
              <span className="truncate">{group.label}</span>
              <span className={`font-mono normal-case ${group.chg == null ? "" : group.chg >= 0 ? "text-[#5ee08a]" : "text-[#ff7b7b]"}`}>
                {fmtPct(group.chg)}
              </span>
              <span className="ml-auto font-mono normal-case text-white/60">{fmtUsdCap(group.cap)}</span>
            </button>
          ) : null,
        )}

        {hover && (
          <div
            className="pointer-events-none absolute z-10 w-60 rounded-md border border-border-strong bg-bg-elevated/95 p-2.5 text-xs shadow-hud"
            style={{
              left: Math.min(hover.x + 12, Math.max(size.w - 248, 0)),
              top: hover.y + 160 > size.h ? Math.max(hover.y - 150, 0) : hover.y + 12,
            }}
          >
            <div className="font-semibold text-fg truncate">{hover.stock.name}</div>
            <div className="text-fg-muted font-mono">{hover.stock.symbol} · {hover.stock.sector}</div>
            <div className="mt-1.5 flex justify-between text-fg">
              <span>{hover.stock.price != null ? `${hover.stock.price.toLocaleString("en-IN")} ${hover.stock.currency}` : "—"}</span>
              <span className="font-mono">{fmtUsdCap(hover.stock.capUsd)}</span>
            </div>
            <div className="mt-1.5 grid grid-cols-5 gap-1 text-center font-mono">
              {PERIODS.map((p) => {
                const v = hover.stock.chg[p.key];
                return (
                  <div key={p.key}>
                    <div className="text-fg-subtle">{p.label}</div>
                    <div className={v == null ? "text-fg-muted" : v >= 0 ? "text-success" : "text-danger"}>
                      {v == null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}`}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 text-[11px] font-mono text-fg-muted">
        {[-1, -2 / 3, -1 / 3, 0, 1 / 3, 2 / 3, 1].map((f) => (
          <div key={f} className="flex items-center gap-1">
            <span className="inline-block w-7 h-3 rounded-sm" style={{ background: heatColor(f * scale, scale) }} />
            <span>{f === 0 ? "0%" : `${f > 0 ? "+" : ""}${Math.round(f * scale)}%`}</span>
          </div>
        ))}
        <span className="ml-auto hidden sm:inline text-fg-subtle">
          Click a stock for chart &amp; news · {drill ? "grouped by sector" : "click a market header to see it by sector"} · data: TradingView
        </span>
      </div>

      {selected && (
        <StockPanel
          key={selected.stock.symbol}
          stock={selected.stock}
          market={selected.market}
          onClose={() => { deepTab.current = "overview"; setSelected(null); }}
          initialTab={deepTab.current}
          onTabChange={setUrlTab}
        />
      )}
    </div>
  );
}
