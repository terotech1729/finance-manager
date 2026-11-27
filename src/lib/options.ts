/**
 * Option-chain types and the "unusual activity" rules shared by the API, the daily
 * snapshot job and the Options tab. Client-safe — no server imports.
 *
 * Public feeds show aggregate volume and open interest per contract, not who traded.
 * "Bought" vs "sold" is inferred from where the last trade printed against bid/ask,
 * and "new position" from volume exceeding yesterday's open interest — both are
 * signals, not proof.
 */

export type OptType = "C" | "P";

export type OptionRow = {
  /** OCC id (US) or TradingView symbol (NSE). */
  id: string;
  t: OptType;
  /** Expiry, YYYY-MM-DD. */
  exp: string;
  k: number;
  last: number | null;
  chg: number | null;
  bid: number | null;
  ask: number | null;
  /** Contracts traded in the session. */
  vol: number;
  /** Open contracts as of the session (US: prior close; NSE: live). */
  oi: number;
  iv: number | null;
  delta: number | null;
  /** Shares per contract — 100 in the US, the lot size on NSE. */
  mult: number;
  lastTrade?: string | null;
};

export type OptionChain = {
  underlying: string;
  source: string;
  delayNote: string;
  currency: string;
  spot: number | null;
  /** Trading day the figures belong to, YYYY-MM-DD. */
  day: string;
  asOf: string;
  rows: OptionRow[];
};

export type SnapshotRow = {
  day: string;
  underlying: string;
  contract: string;
  type: OptType;
  expiry: string;
  strike: number;
  volume: number;
  oi: number;
  last: number | null;
  iv: number | null;
};

export type HistoryPoint = { day: string; volume: number; oi: number; last: number | null };

export type Accumulation = {
  contract: string;
  type: OptType;
  expiry: string;
  strike: number;
  oiStart: number;
  oiEnd: number;
  oiChange: number;
  totalVolume: number;
  days: number;
  series: HistoryPoint[];
};

export const premium = (r: Pick<OptionRow, "last" | "vol" | "mult">) => (r.last ?? 0) * r.vol * r.mult;

export function daysToExpiry(exp: string, now = Date.now()): number {
  const end = Date.parse(`${exp}T23:59:59Z`);
  return Math.max(0, Math.ceil((end - now) / 86_400_000));
}

/** Where the last print sat in the spread — near the ask reads as a buyer paying up. */
export function sideGuess(r: Pick<OptionRow, "last" | "bid" | "ask">): "ask" | "bid" | "mid" | null {
  const { last, bid, ask } = r;
  if (last == null || bid == null || ask == null || ask <= 0 || ask < bid) return null;
  const spread = ask - bid;
  if (spread <= 0) return last >= ask ? "ask" : last <= bid ? "bid" : "mid";
  if (last >= ask - spread * 0.25) return "ask";
  if (last <= bid + spread * 0.25) return "bid";
  return "mid";
}

/** % the strike sits out of the money (negative = in the money). */
export function otmPct(r: Pick<OptionRow, "t" | "k">, spot: number | null): number | null {
  if (!spot) return null;
  return r.t === "C" ? ((r.k - spot) / spot) * 100 : ((spot - r.k) / spot) * 100;
}

export type Flagged = OptionRow & {
  premium: number;
  volOi: number;
  dte: number;
  otm: number | null;
  side: ReturnType<typeof sideGuess>;
  reasons: string[];
};

/** Thresholds in the chain's own currency. */
export function thresholds(currency: string) {
  return currency === "INR"
    ? { minVol: 200, bigPremium: 1e7, minPremium: 2e6 }
    : { minVol: 500, bigPremium: 1e6, minPremium: 2.5e5 };
}

/**
 * Contracts with outsized activity today, largest money first. A row qualifies when it
 * traded at least `minVol` contracts and either opened more than existed (vol > OI),
 * or moved a large premium — the patterns flow trackers alert on.
 */
export function flagUnusual(chain: OptionChain, now = Date.now()): Flagged[] {
  const th = thresholds(chain.currency);
  const out: Flagged[] = [];
  for (const r of chain.rows) {
    if (r.vol < th.minVol) continue;
    const p = premium(r);
    if (p < th.minPremium) continue;
    const volOi = r.oi > 0 ? r.vol / r.oi : r.vol > 0 ? Infinity : 0;
    const dte = daysToExpiry(r.exp, now);
    const otm = otmPct(r, chain.spot);
    const side = sideGuess(r);
    const reasons: string[] = [];
    if (volOi > 1) reasons.push("volume > open interest");
    if (p >= th.bigPremium) reasons.push("large premium");
    if (dte <= 14 && otm != null && otm > 5) reasons.push("short-dated OTM");
    if (side === "ask") reasons.push("paid at ask");
    if (!reasons.some((x) => x === "volume > open interest" || x === "large premium")) continue;
    out.push({ ...r, premium: p, volOi, dte, otm, side, reasons });
  }
  return out.sort((a, b) => b.premium - a.premium);
}

export type ExpirySummary = { exp: string; dte: number; callVol: number; putVol: number; callOi: number; putOi: number };

export function summariseExpiries(rows: OptionRow[], now = Date.now()): ExpirySummary[] {
  const m = new Map<string, ExpirySummary>();
  for (const r of rows) {
    const s = m.get(r.exp) ?? { exp: r.exp, dte: daysToExpiry(r.exp, now), callVol: 0, putVol: 0, callOi: 0, putOi: 0 };
    if (r.t === "C") { s.callVol += r.vol; s.callOi += r.oi; } else { s.putVol += r.vol; s.putOi += r.oi; }
    m.set(r.exp, s);
  }
  return Array.from(m.values()).sort((a, b) => a.exp.localeCompare(b.exp));
}

export function fmtMoney(v: number, currency: string): string {
  if (currency === "INR") {
    if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
    if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
    return `₹${Math.round(v).toLocaleString("en-IN")}`;
  }
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

export const fmtInt = (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString("en-US") : "∞");

export function fmtExpiry(exp: string): string {
  const d = new Date(`${exp}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit", timeZone: "UTC" });
}

/** Snapshot the contracts worth keeping — skips dust so a year of history stays small. */
export function snapshotRows(chain: OptionChain): SnapshotRow[] {
  const min = chain.currency === "INR" ? 50 : 100;
  return chain.rows
    .filter((r) => r.oi >= min || r.vol >= min)
    .map((r) => ({
      day: chain.day,
      underlying: chain.underlying,
      contract: r.id,
      type: r.t,
      expiry: r.exp,
      strike: r.k,
      volume: Math.round(r.vol),
      oi: Math.round(r.oi),
      last: r.last,
      iv: r.iv,
    }));
}
