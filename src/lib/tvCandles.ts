/**
 * OHLC candles from TradingView's chart data socket (server-only).
 *
 * TradingView has no public REST endpoint for price history, but its chart socket
 * serves any symbol the screener lists — NSE, TSE, KRX, HKEX… — without login, which
 * Yahoo/Stooq no longer do reliably from servers. Unauthenticated sessions may be
 * delayed ~15 min on some exchanges; history is unaffected.
 */
import WebSocket from "ws";

export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

const URL = "wss://data.tradingview.com/socket.io/websocket?type=chart";
const TIMEOUT_MS = 12000;

const frame = (m: string, p: unknown[]) => {
  const s = JSON.stringify({ m, p });
  return `~m~${s.length}~m~${s}`;
};

function parseFrames(raw: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < raw.length) {
    const m = /^~m~(\d+)~m~/.exec(raw.slice(i));
    if (!m) break;
    const start = i + m[0].length;
    const len = Number(m[1]);
    out.push(raw.slice(start, start + len));
    i = start + len;
  }
  return out;
}

export type Quote = Record<string, unknown>;

/**
 * Latest quote fields for many symbols over one socket — used for NSE option chains,
 * where the screener lists contracts but only the quote feed carries volume and `oi`.
 * Resolves with whatever arrived by the deadline; symbols that never report are absent.
 */
export function fetchQuotes(symbols: string[], fields: string[], timeoutMs = 10000): Promise<Map<string, Quote>> {
  return new Promise((resolve) => {
    const out = new Map<string, Quote>();
    if (!symbols.length) return resolve(out);
    const ws = new WebSocket(URL, { headers: { Origin: "https://www.tradingview.com" } });
    const qs = `qs_${Math.random().toString(36).slice(2, 14)}`;
    const pending = new Set(symbols);
    let done = false;

    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* already closed */ }
      resolve(out);
    };
    const timer = setTimeout(finish, timeoutMs);

    ws.on("open", () => {
      ws.send(frame("set_auth_token", ["unauthorized_user_token"]));
      ws.send(frame("quote_create_session", [qs]));
      ws.send(frame("quote_set_fields", [qs, ...fields]));
      for (let i = 0; i < symbols.length; i += 200) {
        ws.send(frame("quote_add_symbols", [qs, ...symbols.slice(i, i + 200)]));
      }
    });

    ws.on("message", (data) => {
      for (const msg of parseFrames(data.toString())) {
        if (msg.startsWith("~h~")) {
          ws.send(`~m~${msg.length}~m~${msg}`);
          continue;
        }
        let j: { m?: string; p?: unknown[] };
        try { j = JSON.parse(msg); } catch { continue; }
        if (j.m === "qsd") {
          const d = j.p?.[1] as { n?: string; s?: string; v?: Quote } | undefined;
          if (d?.n && d.s === "ok" && d.v) out.set(d.n, { ...(out.get(d.n) ?? {}), ...d.v });
        } else if (j.m === "quote_completed") {
          pending.delete(String(j.p?.[1]));
          // Field updates trail quote_completed by a moment; give them time to land.
          if (!pending.size) setTimeout(finish, 600);
        }
      }
    });

    ws.on("error", finish);
    ws.on("close", finish);
  });
}

export function fetchCandles(symbol: string, interval: string, bars: number): Promise<Candle[]> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(URL, { headers: { Origin: "https://www.tradingview.com" } });
    const cs = `cs_${Math.random().toString(36).slice(2, 14)}`;
    let candles: Candle[] = [];
    let done = false;

    const finish = (err?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* already closed */ }
      if (err && !candles.length) reject(err);
      else resolve(candles);
    };
    const timer = setTimeout(() => finish(new Error("candle request timed out")), TIMEOUT_MS);

    ws.on("open", () => {
      ws.send(frame("set_auth_token", ["unauthorized_user_token"]));
      ws.send(frame("chart_create_session", [cs, ""]));
      ws.send(frame("resolve_symbol", [cs, "sym_1", `=${JSON.stringify({ symbol, adjustment: "splits", session: "regular" })}`]));
      ws.send(frame("create_series", [cs, "s1", "s1", "sym_1", interval, bars, ""]));
    });

    ws.on("message", (data) => {
      for (const msg of parseFrames(data.toString())) {
        if (msg.startsWith("~h~")) {
          ws.send(`~m~${msg.length}~m~${msg}`);
          continue;
        }
        let j: { m?: string; p?: unknown[] };
        try { j = JSON.parse(msg); } catch { continue; }
        if (j.m === "timescale_update") {
          const series = (j.p?.[1] as Record<string, { s?: { v: number[] }[] }> | undefined)?.s1?.s ?? [];
          candles = series
            .map(({ v }) => ({ time: v[0], open: v[1], high: v[2], low: v[3], close: v[4], volume: v[5] ?? 0 }))
            .filter((c) => [c.open, c.high, c.low, c.close].every(Number.isFinite));
        } else if (j.m === "series_completed") {
          finish();
        } else if (j.m === "symbol_error" || j.m === "series_error" || j.m === "critical_error") {
          finish(new Error(`${j.m}: ${JSON.stringify(j.p?.slice(1) ?? [])}`));
        }
      }
    });

    ws.on("error", (e) => finish(e instanceof Error ? e : new Error(String(e))));
    ws.on("close", () => finish(new Error("socket closed before data arrived")));
  });
}
