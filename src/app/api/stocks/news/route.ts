/**
 * Latest news for one company, merged from several free feeds so nothing slips through:
 *
 *  - TradingView headlines — tagged to the exact symbol (Reuters, Dow Jones, Benzinga,
 *    CNBC-TV18, MarketBeat…), the most precise source.
 *  - Google News RSS — broadest coverage, incl. regional press (ET, Moneycontrol, Nikkei).
 *  - Bing News RSS — independent index; catches stories Google ranks low.
 *
 * Items are de-duplicated by headline and sorted newest first. Each source is cached
 * for 45 s, so the panel's 60 s poll always sees fresh results without hammering feeds.
 */
import { NextResponse } from "next/server";
import { cleanCompanyName } from "@/lib/stockHeatmap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";
const CACHE_S = 45;
const MAX_ITEMS = 80;

export type NewsItem = {
  title: string;
  url: string;
  source: string;
  published: number;
  feeds: string[];
  urgent?: boolean;
};

const LOCALE: Record<string, { hl: string; gl: string; ceid: string; mkt: string }> = {
  in: { hl: "en-IN", gl: "IN", ceid: "IN:en", mkt: "en-IN" },
  uk: { hl: "en-GB", gl: "GB", ceid: "GB:en", mkt: "en-GB" },
  ca: { hl: "en-CA", gl: "CA", ceid: "CA:en", mkt: "en-CA" },
};
const DEFAULT_LOCALE = { hl: "en-US", gl: "US", ceid: "US:en", mkt: "en-US" };

async function get(url: string, headers: Record<string, string> = {}): Promise<string> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, ...headers },
    next: { revalidate: CACHE_S },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function tag(xml: string, name: string): string {
  const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i").exec(xml);
  return m ? decode(m[1]) : "";
}

function parseRss(xml: string): { title: string; link: string; pubDate: string; source: string }[] {
  return (xml.match(/<item>[\s\S]*?<\/item>/gi) ?? []).map((it) => ({
    title: tag(it, "title"),
    link: tag(it, "link"),
    pubDate: tag(it, "pubDate"),
    source: tag(it, "source") || tag(it, "News:Source"),
  }));
}

async function tradingView(symbol: string): Promise<NewsItem[]> {
  const json = JSON.parse(
    await get(`https://news-headlines.tradingview.com/v2/headlines?client=web&lang=en&symbol=${encodeURIComponent(symbol)}`),
  ) as { items?: { title: string; source?: string; provider?: string; published: number; link?: string; storyPath?: string; urgency?: number }[] };
  return (json.items ?? []).map((i) => ({
    title: i.title,
    url: i.link || `https://www.tradingview.com${i.storyPath ?? ""}`,
    source: i.source || i.provider || "TradingView",
    published: i.published * 1000,
    feeds: ["TradingView"],
    urgent: i.urgency === 1,
  }));
}

async function googleNews(query: string, market: string): Promise<NewsItem[]> {
  const l = LOCALE[market] ?? DEFAULT_LOCALE;
  const q = encodeURIComponent(`${query} when:7d`);
  const xml = await get(`https://news.google.com/rss/search?q=${q}&hl=${l.hl}&gl=${l.gl}&ceid=${l.ceid}`);
  return parseRss(xml).map((r) => {
    const source = r.source || r.title.split(" - ").at(-1) || "Google News";
    const title = r.title.endsWith(` - ${source}`) ? r.title.slice(0, -(source.length + 3)) : r.title;
    return { title, url: r.link, source, published: Date.parse(r.pubDate) || 0, feeds: ["Google News"] };
  });
}

async function bingNews(query: string, market: string): Promise<NewsItem[]> {
  const l = LOCALE[market] ?? DEFAULT_LOCALE;
  const xml = await get(`https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&qft=sortbydate%3d%221%22&setmkt=${l.mkt}`);
  return parseRss(xml).map((r) => {
    let url = r.link;
    try {
      const real = new URL(r.link).searchParams.get("url");
      if (real) url = real;
    } catch { /* keep the redirect link */ }
    return { title: r.title, url, source: r.source || "Bing News", published: Date.parse(r.pubDate) || 0, feeds: ["Bing News"] };
  });
}

const dedupeKey = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 70);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Keyword searches drift (a "Toyota Motor" query returns Nissan stories), so search-engine
 * items must name the company in the headline: its first name word, ticker, or the
 * initials people actually use (Taiwan Semiconductor Manufacturing Co → TSMC).
 */
function relevanceTest(name: string, clean: string, ticker: string): (title: string) => boolean {
  const terms = new Set<string>();
  const first = clean.split(" ")[0];
  if (first && first.length >= 3) terms.add(first);
  if (clean.length >= 3) terms.add(clean);
  if (!/^\d+$/.test(ticker) && ticker.length >= 2) terms.add(ticker.replace(/\..*$/, ""));
  const initials = name.split(/[\s,.]+/).filter((w) => /^[A-Z]/.test(w) && w.length > 1).map((w) => w[0]).join("");
  if (initials.length >= 3) terms.add(initials);
  const re = new RegExp(`\\b(${Array.from(terms).map(escapeRe).join("|")})\\b`, "i");
  return (title) => re.test(title);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") ?? "";
  const name = searchParams.get("name") ?? "";
  const market = searchParams.get("market") ?? "";
  if (!symbol || !name) return NextResponse.json({ error: "symbol and name are required" }, { status: 400 });

  const ticker = symbol.split(":").pop() ?? "";
  const clean = cleanCompanyName(name);
  const query = /^\d+$/.test(ticker)
    ? `"${clean}" (stock OR shares)`
    : `"${clean}" (stock OR shares OR ${ticker})`;

  const sources: [string, Promise<NewsItem[]>][] = [
    ["TradingView", tradingView(symbol)],
    ["Google News", googleNews(query, market)],
    ["Bing News", bingNews(query, market)],
  ];
  const settled = await Promise.allSettled(sources.map(([, p]) => p));

  const relevant = relevanceTest(name, clean, ticker);
  const status: Record<string, { ok: boolean; count: number; error?: string }> = {};
  const merged = new Map<string, NewsItem>();
  settled.forEach((r, k) => {
    const feed = sources[k][0];
    if (r.status === "rejected") {
      status[feed] = { ok: false, count: 0, error: r.reason instanceof Error ? r.reason.message : String(r.reason) };
      return;
    }
    const items = feed === "TradingView" ? r.value : r.value.filter((i) => relevant(i.title));
    status[feed] = { ok: true, count: items.length };
    for (const item of items) {
      if (!item.title || !item.url) continue;
      const key = dedupeKey(item.title);
      const prev = merged.get(key);
      if (!prev) merged.set(key, item);
      else {
        prev.feeds = Array.from(new Set([...prev.feeds, ...item.feeds]));
        if (item.published && (!prev.published || item.published < prev.published)) prev.published = item.published;
        prev.urgent = prev.urgent || item.urgent;
      }
    }
  });

  const items = Array.from(merged.values())
    .sort((a, b) => b.published - a.published)
    .slice(0, MAX_ITEMS);

  return NextResponse.json(
    { asOf: new Date().toISOString(), items, status },
    { headers: { "Cache-Control": `public, s-maxage=${CACHE_S}, stale-while-revalidate=60` } },
  );
}
