/**
 * Largest stocks per market with their USD market cap and % change over several
 * periods, for the /stock heatmap.
 *
 * Source is TradingView's public screener (no key). Market caps arrive in each
 * company's reporting currency, so they're converted to USD with TradingView's own FX
 * quotes — otherwise a yen or won market cap would dwarf everything else. A market that
 * fails is returned with an `error` rather than failing the whole map.
 */
import { NextResponse } from "next/server";
import { MARKETS, type HeatMarket, type HeatStock, type HeatmapPayload, type MarketDef } from "@/lib/stockHeatmap";

export const runtime = "nodejs";
export const revalidate = 300;

const SCAN = "https://scanner.tradingview.com";
const COLUMNS = [
  "name", "description", "logoid", "close", "currency", "fundamental_currency_code",
  "market_cap_basic", "sector", "change", "Perf.W", "Perf.1M", "Perf.YTD", "Perf.Y",
] as const;

/** Units of currency per 1 USD; used only if the live FX request fails. */
const FALLBACK_FX: Record<string, number> = {
  USD: 1, INR: 92.6, JPY: 158, CNY: 7.2, HKD: 7.84, TWD: 33, KRW: 1350,
  GBP: 0.79, EUR: 0.92, CAD: 1.39,
};

type ScanRow = { s: string; d: unknown[] };

async function scan(market: string, body: unknown): Promise<ScanRow[]> {
  const res = await fetch(`${SCAN}/${market}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`${market}: HTTP ${res.status}`);
  const json = (await res.json()) as { data?: ScanRow[] };
  return json.data ?? [];
}

async function loadFx(): Promise<Record<string, number>> {
  const ccys = Object.keys(FALLBACK_FX).filter((c) => c !== "USD");
  const fx: Record<string, number> = { ...FALLBACK_FX };
  try {
    const rows = await scan("forex", {
      columns: ["close"],
      symbols: { tickers: ccys.map((c) => `FX_IDC:USD${c}`) },
    });
    for (const r of rows) {
      const ccy = r.s.replace("FX_IDC:USD", "");
      const v = Number(r.d[0]);
      if (Number.isFinite(v) && v > 0) fx[ccy] = v;
    }
  } catch {
    // fall back to static rates — sizing tolerates a few % of FX drift
  }
  return fx;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

async function loadMarket(m: MarketDef, fx: Record<string, number>): Promise<HeatMarket> {
  try {
    const rows = await scan(m.tv, {
      columns: COLUMNS,
      filter: [
        { left: "market_cap_basic", operation: "nempty" },
        { left: "type", operation: "equal", right: "stock" },
        { left: "is_primary", operation: "equal", right: true },
      ],
      sort: { sortBy: "market_cap_basic", sortOrder: "desc" },
      range: [0, m.limit],
    });
    const stocks: HeatStock[] = [];
    for (const { s, d } of rows) {
      const [ticker, name, logoid, close, currency, fundCcy, cap, sector, d1, w1, m1, ytd, y1] = d;
      const rate = fx[String(fundCcy)] ?? fx[String(currency)];
      const capLocal = num(cap);
      if (!rate || !capLocal) continue;
      stocks.push({
        symbol: s,
        ticker: String(ticker),
        name: String(name),
        logo: typeof logoid === "string" && logoid ? logoid : null,
        sector: typeof sector === "string" && sector ? sector : "Other",
        price: num(close),
        currency: String(currency ?? ""),
        capUsd: capLocal / rate,
        chg: { d: num(d1), w: num(w1), m: num(m1), ytd: num(ytd), y: num(y1) },
      });
    }
    stocks.sort((a, b) => b.capUsd - a.capUsd);
    return { id: m.id, label: m.label, stocks };
  } catch (e) {
    return { id: m.id, label: m.label, stocks: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export async function GET() {
  const fx = await loadFx();
  const markets = await Promise.all(MARKETS.map((m) => loadMarket(m, fx)));
  const payload: HeatmapPayload = { asOf: new Date().toISOString(), markets };
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
