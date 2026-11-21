"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import { PERIODS, fmtPct, fmtUsdCap, type HeatStock } from "@/lib/stockHeatmap";
import type { Candle } from "@/lib/tvCandles";
import type { NewsItem } from "@/app/api/stocks/news/route";

const RANGES = ["1D", "5D", "1M", "6M", "1Y", "5Y"] as const;
type Range = (typeof RANGES)[number];
const FEEDS = ["TradingView", "Google News", "Bing News"] as const;
const POLL_MS = 60_000;
const UP = "#089981";
const DOWN = "#f23645";

function ago(ts: number, now: number): string {
  if (!ts) return "";
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function StockPanel({ stock, market, onClose }: { stock: HeatStock; market: string; onClose: () => void }) {
  const [range, setRange] = useState<Range>("6M");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [candleErr, setCandleErr] = useState("");
  const [candleLoading, setCandleLoading] = useState(false);

  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsStatus, setNewsStatus] = useState<Record<string, { ok: boolean; count: number; error?: string }>>({});
  const [newsAt, setNewsAt] = useState(0);
  const [newsLoading, setNewsLoading] = useState(false);
  const [feed, setFeed] = useState<string>("All");
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string> | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const chartEl = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volSeries = useRef<ISeriesApi<"Histogram"> | null>(null);

  const loadCandles = useCallback(async (r: Range, quiet = false) => {
    if (!quiet) setCandleLoading(true);
    try {
      const res = await fetch(`/api/stocks/candles?symbol=${encodeURIComponent(stock.symbol)}&range=${r}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setCandles(json.candles);
      setCandleErr("");
    } catch (e) {
      setCandleErr(e instanceof Error ? e.message : String(e));
    } finally {
      setCandleLoading(false);
    }
  }, [stock.symbol]);

  const loadNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      const qs = new URLSearchParams({ symbol: stock.symbol, name: stock.name, market });
      const res = await fetch(`/api/stocks/news?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      const items: NewsItem[] = json.items;
      if (seen.current) {
        const prev = seen.current;
        setFresh(new Set(items.filter((i) => !prev.has(i.url)).map((i) => i.url)));
      }
      seen.current = new Set(items.map((i) => i.url));
      setNews(items);
      setNewsStatus(json.status ?? {});
      setNewsAt(Date.now());
    } catch {
      // keep the last good list on a failed poll
    } finally {
      setNewsLoading(false);
    }
  }, [stock.symbol, stock.name, market]);

  useEffect(() => {
    seen.current = null;
    setNews([]);
    setFresh(new Set());
    loadNews();
    const id = setInterval(() => { if (!document.hidden) loadNews(); }, POLL_MS);
    return () => clearInterval(id);
  }, [loadNews]);

  useEffect(() => {
    loadCandles(range);
    if (range !== "1D" && range !== "5D") return;
    const id = setInterval(() => { if (!document.hidden) loadCandles(range, true); }, POLL_MS);
    return () => clearInterval(id);
  }, [range, loadCandles]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let disposed = false;
    (async () => {
      const lc = await import("lightweight-charts");
      if (disposed || !chartEl.current) return;
      const c = lc.createChart(chartEl.current, {
        autoSize: true,
        layout: { background: { type: lc.ColorType.Solid, color: "transparent" }, textColor: "#7B93AD", fontSize: 11 },
        grid: { vertLines: { color: "#14283E55" }, horzLines: { color: "#14283E55" } },
        rightPriceScale: { borderColor: "#1E3C5A" },
        timeScale: { borderColor: "#1E3C5A", timeVisible: true, secondsVisible: false },
        crosshair: { mode: lc.CrosshairMode.Normal },
      });
      candleSeries.current = c.addSeries(lc.CandlestickSeries, {
        upColor: UP, downColor: DOWN, wickUpColor: UP, wickDownColor: DOWN, borderVisible: false,
      });
      candleSeries.current.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.25 } });
      volSeries.current = c.addSeries(lc.HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "" });
      volSeries.current.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
      chart.current = c;
      setCandles((x) => [...x]);
    })();
    return () => {
      disposed = true;
      chart.current?.remove();
      chart.current = null;
      candleSeries.current = null;
      volSeries.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleSeries.current || !volSeries.current) return;
    // lightweight-charts renders timestamps as UTC; shift so the axis reads in local time.
    const off = -new Date().getTimezoneOffset() * 60;
    candleSeries.current.setData(candles.map((c) => ({
      time: (c.time + off) as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close,
    })));
    volSeries.current.setData(candles.map((c) => ({
      time: (c.time + off) as UTCTimestamp, value: c.volume, color: c.close >= c.open ? `${UP}66` : `${DOWN}66`,
    })));
    chart.current?.timeScale().fitContent();
  }, [candles]);

  const last = candles.at(-1);
  const price = last?.close ?? stock.price;
  const rangeChg = candles.length > 1 ? ((candles.at(-1)!.close - candles[0].open) / candles[0].open) * 100 : null;
  const shown = feed === "All" ? news : news.filter((n) => n.feeds.includes(feed));

  return (
    <>
      <div className="fixed inset-0 z-[55] bg-black/50" onClick={onClose} />
      <aside className="fixed inset-y-0 right-0 z-[60] w-full sm:w-[620px] bg-bg-elevated border-l border-border-strong shadow-hud-strong flex flex-col animate-rise">
        <header className="flex items-start gap-3 p-3 sm:p-4 border-b border-border">
          {stock.logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`https://s3-symbol-logo.tradingview.com/${stock.logo}.svg`} alt="" className="w-10 h-10 rounded-full shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-fg truncate">{stock.name}</div>
            <div className="text-xs text-fg-muted font-mono truncate">{stock.symbol} · {stock.sector} · {fmtUsdCap(stock.capUsd)}</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-semibold text-fg font-mono">
                {price != null ? price.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : "—"}
              </span>
              <span className="text-xs text-fg-muted">{stock.currency}</span>
              <span className={`text-sm font-mono ${(stock.chg.d ?? 0) >= 0 ? "text-success" : "text-danger"}`}>{fmtPct(stock.chg.d)} today</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <button onClick={onClose} className="px-2 py-0.5 text-xs rounded-md border border-border text-fg-muted hover:text-fg">Close</button>
            <a
              href={`https://www.tradingview.com/symbols/${stock.symbol.replace(":", "-")}/`}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-accent hover:underline"
            >
              TradingView ↗
            </a>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <section className="p-3 sm:p-4 border-b border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex rounded-md border border-border overflow-hidden">
                {RANGES.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRange(r)}
                    className={`px-2 py-0.5 text-xs font-mono ${range === r ? "bg-accent/15 text-accent" : "text-fg-muted hover:text-fg"}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              {rangeChg != null && (
                <span className={`text-xs font-mono ${rangeChg >= 0 ? "text-success" : "text-danger"}`}>{fmtPct(rangeChg)} over {range}</span>
              )}
              {candleLoading && <span className="text-xs text-fg-subtle">loading…</span>}
            </div>
            <div className="relative h-64 sm:h-72">
              <div ref={chartEl} className="absolute inset-0" />
              {candleErr && !candles.length && (
                <div className="absolute inset-0 flex items-center justify-center text-xs text-danger">Chart unavailable: {candleErr}</div>
              )}
            </div>
            <div className="mt-2 grid grid-cols-5 gap-1 text-center font-mono text-xs">
              {PERIODS.map((p) => {
                const v = stock.chg[p.key];
                return (
                  <div key={p.key} className="rounded-sm bg-bg/60 py-1">
                    <div className="text-fg-subtle">{p.label}</div>
                    <div className={v == null ? "text-fg-muted" : v >= 0 ? "text-success" : "text-danger"}>{fmtPct(v)}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-sm font-semibold text-fg">Latest news</h2>
              <span className="flex items-center gap-1 text-[11px] text-success">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                live · every 60s
              </span>
              <span className="ml-auto text-[11px] text-fg-subtle">
                {newsLoading ? "checking…" : newsAt ? `checked ${ago(newsAt, now)}` : ""}
              </span>
              <button onClick={loadNews} className="text-[11px] text-accent hover:underline">Refresh</button>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {["All", ...FEEDS].map((f) => {
                const st = newsStatus[f];
                const count = f === "All" ? news.length : news.filter((n) => n.feeds.includes(f)).length;
                return (
                  <button
                    key={f}
                    onClick={() => setFeed(f)}
                    title={st && !st.ok ? `Unavailable: ${st.error}` : undefined}
                    className={`px-2 py-0.5 text-[11px] rounded-md border ${feed === f ? "border-accent text-accent" : "border-border text-fg-muted hover:text-fg"} ${st && !st.ok ? "opacity-50 line-through" : ""}`}
                  >
                    {f} <span className="font-mono">{count}</span>
                  </button>
                );
              })}
            </div>

            {!news.length && (
              <div className="text-xs text-fg-muted">{newsLoading ? "Fetching news from all sources…" : "No recent news found."}</div>
            )}

            <ul className="divide-y divide-border">
              {shown.map((n) => {
                const recent = n.published && now - n.published < 60 * 60 * 1000;
                return (
                  <li key={n.url} className={`py-2.5 ${fresh.has(n.url) ? "bg-accent/5 -mx-2 px-2 rounded-sm" : ""}`}>
                    <a href={n.url} target="_blank" rel="noreferrer" className="block group">
                      <div className="flex items-center gap-1.5 text-[11px] text-fg-muted">
                        {n.urgent && <span className="px-1 rounded-sm bg-danger/20 text-danger font-semibold">BREAKING</span>}
                        {recent && <span className="px-1 rounded-sm bg-success/15 text-success font-semibold">NEW</span>}
                        <span className="font-medium text-fg-muted truncate">{n.source}</span>
                        <span className="text-fg-subtle" title={n.published ? new Date(n.published).toLocaleString("en-IN") : ""}>
                          · {ago(n.published, now)}
                        </span>
                        <span className="ml-auto text-fg-subtle hidden sm:inline">{n.feeds.join(" + ")}</span>
                      </div>
                      <div className="mt-0.5 text-sm text-fg group-hover:text-accent leading-snug">{n.title}</div>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </aside>
    </>
  );
}
