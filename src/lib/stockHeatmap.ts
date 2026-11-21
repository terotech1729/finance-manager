/**
 * Global stock heatmap — shared types, market list, squarified treemap layout and the
 * red/green colour scale. Data comes from `/api/stocks/heatmap`, which proxies
 * TradingView's public screener.
 */

export type PeriodKey = "d" | "w" | "m" | "ytd" | "y";

export const PERIODS: { key: PeriodKey; label: string; scale: number }[] = [
  // `scale` is the % move that renders at full colour intensity for that period.
  { key: "d", label: "1D", scale: 3 },
  { key: "w", label: "1W", scale: 6 },
  { key: "m", label: "1M", scale: 10 },
  { key: "ytd", label: "YTD", scale: 30 },
  { key: "y", label: "1Y", scale: 40 },
];

export type MarketDef = {
  id: string;
  label: string;
  /** TradingView screener market slug. */
  tv: string;
  limit: number;
};

export const MARKETS: MarketDef[] = [
  { id: "us", label: "USA", tv: "america", limit: 90 },
  { id: "in", label: "India", tv: "india", limit: 50 },
  { id: "jp", label: "Japan", tv: "japan", limit: 40 },
  { id: "cn", label: "China", tv: "china", limit: 40 },
  { id: "hk", label: "Hong Kong", tv: "hongkong", limit: 40 },
  { id: "tw", label: "Taiwan", tv: "taiwan", limit: 30 },
  { id: "kr", label: "Korea", tv: "korea", limit: 30 },
  { id: "uk", label: "UK", tv: "uk", limit: 30 },
  { id: "de", label: "Germany", tv: "germany", limit: 30 },
  { id: "fr", label: "France", tv: "france", limit: 30 },
  { id: "ca", label: "Canada", tv: "canada", limit: 30 },
];

export type HeatStock = {
  symbol: string;
  ticker: string;
  name: string;
  logo: string | null;
  sector: string;
  price: number | null;
  currency: string;
  capUsd: number;
  chg: Record<PeriodKey, number | null>;
};

export type HeatMarket = {
  id: string;
  label: string;
  stocks: HeatStock[];
  error?: string;
};

export type HeatmapPayload = {
  asOf: string;
  markets: HeatMarket[];
};

export type Rect = { x: number; y: number; w: number; h: number };

/**
 * Squarified treemap (Bruls, Huizing & van Wijk). `values` must be sorted descending;
 * returns one rect per value in the same order.
 */
export function squarify(values: number[], rect: Rect): Rect[] {
  const out: Rect[] = new Array(values.length);
  const total = values.reduce((a, v) => a + Math.max(v, 0), 0);
  if (!total || rect.w <= 0 || rect.h <= 0) {
    return values.map(() => ({ x: rect.x, y: rect.y, w: 0, h: 0 }));
  }
  const scale = (rect.w * rect.h) / total;
  const areas = values.map((v) => Math.max(v, 0) * scale);

  let { x, y, w, h } = rect;
  let row: number[] = [];
  let rowStart = 0;
  let i = 0;

  const worst = (r: number[], side: number) => {
    let s = 0, max = 0, min = Infinity;
    for (const a of r) { s += a; if (a > max) max = a; if (a < min) min = a; }
    if (!s || !min) return Infinity;
    const s2 = s * s, side2 = side * side;
    return Math.max((side2 * max) / s2, s2 / (side2 * min));
  };

  const place = () => {
    const s = row.reduce((a, b) => a + b, 0);
    if (w >= h) {
      const colW = h ? s / h : 0;
      let cy = y;
      row.forEach((a, k) => {
        const ih = colW ? a / colW : 0;
        out[rowStart + k] = { x, y: cy, w: colW, h: ih };
        cy += ih;
      });
      x += colW; w -= colW;
    } else {
      const rowH = w ? s / w : 0;
      let cx = x;
      row.forEach((a, k) => {
        const iw = rowH ? a / rowH : 0;
        out[rowStart + k] = { x: cx, y, w: iw, h: rowH };
        cx += iw;
      });
      y += rowH; h -= rowH;
    }
    rowStart += row.length;
    row = [];
  };

  while (i < areas.length) {
    const side = Math.min(w, h);
    const a = areas[i];
    if (!row.length || worst([...row, a], side) <= worst(row, side)) {
      row.push(a);
      i++;
    } else {
      place();
    }
  }
  if (row.length) place();
  return out;
}

const NEUTRAL = [65, 69, 84];
const GREEN = [48, 204, 90];
const RED = [246, 53, 56];

/** TradingView/Finviz-style diverging scale: grey at 0, saturating at ±`scale` %. */
export function heatColor(pct: number | null, scale: number): string {
  if (pct == null || !Number.isFinite(pct)) return "rgb(42,46,57)";
  const t = Math.min(Math.abs(pct) / scale, 1);
  const eased = Math.sqrt(t);
  const to = pct >= 0 ? GREEN : RED;
  const c = NEUTRAL.map((n, k) => Math.round(n + (to[k] - n) * eased));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function fmtPct(pct: number | null): string {
  if (pct == null || !Number.isFinite(pct)) return "—";
  return `${pct > 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

export function fmtUsdCap(v: number): string {
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${Math.round(v)}`;
}

/** Company name without legal suffixes — "Apple Inc." → "Apple". */
export function cleanCompanyName(name: string): string {
  return name
    .replace(/\b(Co\.?,?|Ltd\.?|Limited|Corp\.?|Corporation|Inc\.?|Incorporated|Holdings?|Group|Class [A-Z]|plc|PLC|S\.A\.|N\.V\.|AG|SE)\b/g, "")
    .replace(/[,.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Numeric exchange codes (Asia) mean nothing on a tile, so fall back to a short name. */
export function tileLabel(s: HeatStock): string {
  if (!/^\d+$/.test(s.ticker)) return s.ticker;
  return cleanCompanyName(s.name)
    .split(" ")
    .filter((w) => !/^(and|of|the|&)$/i.test(w))
    .slice(0, 2)
    .join(" ");
}
