/**
 * Option chains for a TradingView symbol (server-only).
 *
 *  - US listings → CBOE's delayed-quotes file: every listed contract with volume, open
 *    interest, IV and greeks, ~15 min delayed. One request per underlying.
 *  - NSE (and any other market TradingView lists options for) → the TradingView options
 *    screener for the contract list, then the quote socket for live volume and `oi`,
 *    which the screener withholds from logged-out sessions.
 *
 * Returns null when the underlying has no listed options.
 */
import type { OptionChain, OptionRow } from "./options";
import { fetchQuotes } from "./tvCandles";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const US_EXCHANGES = new Set(["NASDAQ", "NYSE", "AMEX", "NYSEARCA", "CBOE", "BATS"]);
const CACHE_MS = { us: 60_000, tv: 30_000 };

const cache = new Map<string, { at: number; chain: OptionChain | null }>();

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

type CboeOption = {
  option: string; bid: number; ask: number; last_trade_price: number; change: number;
  volume: number; open_interest: number; iv: number; delta: number; last_trade_time: string | null;
};

async function cboeChain(ticker: string): Promise<OptionChain | null> {
  const root = ticker.replace(/\./g, "");
  const res = await fetch(`https://cdn.cboe.com/api/global/delayed_quotes/options/${encodeURIComponent(root)}.json`, {
    headers: { "User-Agent": UA, Referer: "https://www.cboe.com/", Origin: "https://www.cboe.com", Accept: "application/json" },
    // The file is ~2 MB, over Next's fetch-cache limit — cached in-process instead.
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 403 || res.status === 404) return null;
  if (!res.ok) throw new Error(`CBOE HTTP ${res.status}`);
  const json = (await res.json()) as { timestamp?: string; data?: { current_price?: number; last_trade_time?: string; options?: CboeOption[] } };
  const data = json.data;
  if (!data?.options?.length) return null;

  const re = /^(.+?)(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/;
  const rows: OptionRow[] = [];
  for (const o of data.options) {
    const m = re.exec(o.option);
    // Adjusted contracts after corporate actions trade under a different root (B1VDA);
    // their 100-share assumption doesn't hold, so they're left out.
    if (!m || m[1] !== root) continue;
    rows.push({
      id: o.option,
      t: m[5] as "C" | "P",
      exp: `20${m[2]}-${m[3]}-${m[4]}`,
      k: Number(m[6]) / 1000,
      last: num(o.last_trade_price) || null,
      chg: num(o.change),
      bid: num(o.bid),
      ask: num(o.ask),
      vol: num(o.volume) ?? 0,
      oi: num(o.open_interest) ?? 0,
      iv: num(o.iv) || null,
      delta: num(o.delta),
      mult: 100,
      lastTrade: o.last_trade_time,
    });
  }
  const day = (data.last_trade_time ?? json.timestamp ?? new Date().toISOString()).slice(0, 10);
  return {
    underlying: root,
    source: "CBOE",
    delayNote: "15-min delayed · open interest is as of the previous close",
    currency: "USD",
    spot: num(data.current_price),
    day,
    asOf: json.timestamp ?? new Date().toISOString(),
    rows,
  };
}

async function tvChain(symbol: string): Promise<OptionChain | null> {
  const res = await fetch("https://scanner.tradingview.com/options/scan", {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": UA },
    body: JSON.stringify({
      columns: ["expiration", "strike", "option-type", "iv", "delta", "bid", "ask", "currency"],
      filter: [{ left: "type", operation: "equal", right: "option" }],
      index_filters: [{ name: "underlying_symbol", values: [symbol] }],
      range: [0, 3000],
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`TradingView options HTTP ${res.status}`);
  const json = (await res.json()) as { data?: { s: string; d: unknown[] }[] };
  const list = json.data ?? [];
  if (!list.length) return null;

  const quotes = await fetchQuotes(
    [symbol, ...list.map((x) => x.s)],
    ["lp", "ch", "volume", "oi", "bid", "ask", "pointvalue", "lp_time", "currency_code"],
  );
  const spotQ = quotes.get(symbol) ?? {};
  let currency = String(spotQ.currency_code ?? "");

  const rows: OptionRow[] = [];
  for (const { s, d } of list) {
    const [exp, strike, type, iv, delta, bid, ask, ccy] = d;
    const q = quotes.get(s) ?? {};
    const lot = num(q.pointvalue) ?? 1;
    const oiRaw = q.oi && typeof q.oi === "object" ? num((q.oi as { value?: unknown }).value) : num(q.oi);
    const e = String(exp);
    if (!/^\d{8}$/.test(e) || num(strike) == null) continue;
    if (!currency && typeof ccy === "string") currency = ccy;
    rows.push({
      id: s,
      t: type === "put" ? "P" : "C",
      exp: `${e.slice(0, 4)}-${e.slice(4, 6)}-${e.slice(6, 8)}`,
      k: num(strike)!,
      last: num(q.lp),
      chg: num(q.ch),
      bid: num(q.bid) ?? num(bid),
      ask: num(q.ask) ?? num(ask),
      // The quote feed reports shares; convert to contracts (lots).
      vol: (num(q.volume) ?? 0) / lot,
      oi: (oiRaw ?? 0) / lot,
      iv: num(iv),
      delta: num(delta),
      mult: lot,
      lastTrade: num(q.lp_time) ? new Date(num(q.lp_time)! * 1000).toISOString() : null,
    });
  }
  const lpTime = num(spotQ.lp_time);
  const day = new Date((lpTime ? lpTime * 1000 : Date.now()) + 5.5 * 3600_000).toISOString().slice(0, 10);
  return {
    underlying: symbol,
    source: "TradingView",
    delayNote: "live quotes; some exchanges delayed up to 15 min",
    currency: currency || "INR",
    spot: num(spotQ.lp),
    day,
    asOf: new Date().toISOString(),
    rows,
  };
}

export function isUsSymbol(symbol: string): boolean {
  return US_EXCHANGES.has(symbol.split(":")[0]);
}

/** Key used for snapshots and the watchlist: the bare ticker in the US, the full TV symbol elsewhere. */
export function underlyingKey(symbol: string): string {
  return isUsSymbol(symbol) ? (symbol.split(":")[1] ?? symbol).replace(/\./g, "") : symbol;
}

export async function loadChain(symbol: string): Promise<OptionChain | null> {
  const us = isUsSymbol(symbol);
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < (us ? CACHE_MS.us : CACHE_MS.tv)) return hit.chain;
  const chain = us ? await cboeChain(symbol.split(":")[1] ?? symbol) : await tvChain(symbol);
  if (chain) {
    // A feed can lag a session behind (e.g. over a US holiday); expired contracts would
    // otherwise headline the unusual list.
    const today = new Date().toISOString().slice(0, 10);
    chain.rows = chain.rows.filter((r) => r.exp >= today);
  }
  cache.set(symbol, { at: Date.now(), chain });
  return chain;
}
