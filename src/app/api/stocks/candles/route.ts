/**
 * OHLC candles for the /stock company panel. `range` picks a bar size and count that
 * fill the chart sensibly; responses are cached briefly in-process and at the CDN.
 */
import { NextResponse } from "next/server";
import { fetchCandles, type Candle } from "@/lib/tvCandles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RANGES: Record<string, { interval: string; bars: number; ttl: number }> = {
  "1D": { interval: "5", bars: 120, ttl: 30 },
  "5D": { interval: "15", bars: 160, ttl: 60 },
  "1M": { interval: "60", bars: 180, ttl: 120 },
  "6M": { interval: "D", bars: 130, ttl: 300 },
  "1Y": { interval: "D", bars: 260, ttl: 300 },
  "5Y": { interval: "W", bars: 270, ttl: 900 },
};

const cache = new Map<string, { at: number; candles: Candle[] }>();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") ?? "";
  const range = searchParams.get("range") ?? "6M";
  const cfg = RANGES[range];
  if (!/^[A-Z_]+:[A-Z0-9._\-!]+$/i.test(symbol) || !cfg) {
    return NextResponse.json({ error: "bad symbol or range" }, { status: 400 });
  }

  const key = `${symbol}|${range}`;
  const hit = cache.get(key);
  let candles: Candle[];
  if (hit && Date.now() - hit.at < cfg.ttl * 1000) {
    candles = hit.candles;
  } else {
    try {
      candles = await fetchCandles(symbol, cfg.interval, cfg.bars);
      cache.set(key, { at: Date.now(), candles });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
    }
  }

  return NextResponse.json(
    { symbol, range, interval: cfg.interval, candles },
    { headers: { "Cache-Control": `public, s-maxage=${cfg.ttl}, stale-while-revalidate=${cfg.ttl}` } },
  );
}
