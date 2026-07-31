/**
 * Scrapes Cashkaro merchant store pages for current cashback rates.
 * Runs via GitHub Actions daily OR via /api/scrape-cashkaro Vercel Cron (daily 02:00 UTC).
 *
 * Output: src/data/cashkaro-rates.generated.json
 * The runtime imports from src/lib/cashkaro.ts which can be regenerated from this.
 *
 * Note: Cashkaro doesn't expose an API. We fetch the public store pages and parse.
 * If page structure changes, adjust the regex/cheerio selectors below.
 */

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import * as cheerio from "cheerio";

const TARGETS = [
  { merchant: "Amazon", url: "https://cashkaro.com/stores/amazon" },
  { merchant: "Flipkart", url: "https://cashkaro.com/stores/flipkart" },
  { merchant: "Myntra", url: "https://cashkaro.com/stores/myntra" },
  { merchant: "Ajio", url: "https://cashkaro.com/stores/ajio" },
  { merchant: "Tata CLiQ", url: "https://cashkaro.com/stores/tata-cliq" },
  { merchant: "Nykaa", url: "https://cashkaro.com/stores/nykaa" },
  { merchant: "BookMyShow", url: "https://cashkaro.com/stores/bookmyshow" },
  { merchant: "Lenskart", url: "https://cashkaro.com/stores/lenskart" },
  { merchant: "boAt", url: "https://cashkaro.com/stores/boat" },
  { merchant: "Mamaearth", url: "https://cashkaro.com/stores/mamaearth" },
  { merchant: "Meesho", url: "https://cashkaro.com/stores/meesho" },
  { merchant: "Zomato", url: "https://cashkaro.com/stores/zomato" },
  { merchant: "Booking.com", url: "https://cashkaro.com/stores/bookingcom" },
  { merchant: "Agoda", url: "https://cashkaro.com/stores/agoda" },
  { merchant: "MakeMyTrip", url: "https://cashkaro.com/stores/makemytrip" },
  { merchant: "EaseMyTrip", url: "https://cashkaro.com/stores/easemytrip" },
  { merchant: "Cleartrip", url: "https://cashkaro.com/stores/cleartrip" },
  { merchant: "Yatra", url: "https://cashkaro.com/stores/yatra" },
];

type Out = {
  merchant: string;
  url: string;
  scrapedAt: string;
  topRate?: string;
  rateRows?: { category: string; rate: string }[];
  raw?: string;
};

async function scrapeOne(t: { merchant: string; url: string }): Promise<Out> {
  const out: Out = { merchant: t.merchant, url: t.url, scrapedAt: new Date().toISOString() };
  try {
    const res = await fetch(t.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; CCM-CashkaroScraper/1.0; personal-use)",
      },
    });
    if (!res.ok) {
      out.raw = `HTTP ${res.status}`;
      return out;
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    // Strategy: look for percentage strings in headings / hero blocks
    const heroText = $("h1, h2, .store-banner, .cashback-banner").text();
    const topMatch = heroText.match(/(?:Upto?\s*)?(\d+(?:\.\d+)?)\s*%\s*(?:Cashback|Rewards|Off)/i);
    if (topMatch) out.topRate = topMatch[0];
    // Strategy: look for rate-rows tables
    const rows: { category: string; rate: string }[] = [];
    $("table tr, .cashback-rates-row, [class*='cashback']").each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      const m = text.match(/(.*?)(\d+(?:\.\d+)?)\s*%(.*)/);
      if (m && m[1].length < 80 && m[1].length > 2) {
        rows.push({ category: m[1].trim(), rate: `${m[2]}%${m[3].slice(0, 40)}` });
      }
    });
    if (rows.length > 0) out.rateRows = rows.slice(0, 30);
  } catch (e) {
    out.raw = `Error: ${(e as Error).message}`;
  }
  return out;
}

async function main() {
  console.log(`Scraping ${TARGETS.length} Cashkaro pages…`);
  const results: Out[] = [];
  for (const t of TARGETS) {
    process.stdout.write(`  ${t.merchant}… `);
    const r = await scrapeOne(t);
    results.push(r);
    console.log(r.topRate ?? r.raw ?? "(no rate parsed)");
    await new Promise((r) => setTimeout(r, 1500)); // polite delay
  }
  const out = { scrapedAt: new Date().toISOString(), results };
  const target = join(process.cwd(), "src", "data", "cashkaro-rates.generated.json");
  writeFileSync(target, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${results.length} merchants to ${target}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
