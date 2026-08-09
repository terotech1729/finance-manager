/**
 * Live timed flight offers from Travelpayouts Aviasales v3 prices_for_dates.
 * Only returns flights that appear in the market cache (real departure_at).
 *
 * Fetch strategy:
 *  - Month query (broad, cheap fares)
 *  - Per-day query inside the planner window (schedule diversity — month+price
 *    alone often returns only 1 cheap row for thin ODs like BOM→DED)
 */
export type LiveFlightOffer = {
  origin: string;
  destination: string;
  originAirport: string;
  destinationAirport: string;
  /** ISO with offset, e.g. 2026-08-10T08:40:00+05:30 */
  departureAt: string;
  durationMin: number;
  fareInr: number;
  airline: string;
  flightNumber: string;
  transfers: number;
  link?: string;
};

type ApiRow = {
  origin?: string;
  destination?: string;
  origin_airport?: string;
  destination_airport?: string;
  departure_at?: string;
  duration?: number;
  duration_to?: number;
  price?: number;
  airline?: string;
  flight_number?: string | number;
  transfers?: number;
  link?: string;
};

function monthKey(dateISO: string): string {
  return dateISO.slice(0, 7);
}

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO + "T12:00:00");
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysInRange(fromDate: string, toDate: string): string[] {
  const out: string[] = [];
  let cursor = fromDate;
  for (let i = 0; i < 14 && cursor <= toDate; i++) {
    out.push(cursor);
    cursor = addDaysISO(cursor, 1);
  }
  return out;
}

function parseOffer(row: ApiRow): LiveFlightOffer | null {
  if (!row.departure_at || row.price == null || row.price < 500) return null;
  const origin = (row.origin || row.origin_airport || "").toUpperCase();
  const destination = (row.destination || row.destination_airport || "").toUpperCase();
  if (!origin || !destination) return null;
  const durationMin = row.duration_to || row.duration || 0;
  if (durationMin < 30) return null;
  return {
    origin,
    destination,
    originAirport: (row.origin_airport || origin).toUpperCase(),
    destinationAirport: (row.destination_airport || destination).toUpperCase(),
    departureAt: row.departure_at,
    durationMin,
    fareInr: Math.round(row.price),
    airline: (row.airline || "?").toUpperCase(),
    flightNumber: String(row.flight_number ?? ""),
    transfers: row.transfers ?? 0,
    link: row.link,
  };
}

/** Local wall-clock Date from API ISO (keeps India offset wall time). */
export function flightDepartLocal(offer: LiveFlightOffer): Date {
  const m = offer.departureAt.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
  );
  if (!m) return new Date(offer.departureAt);
  const [, y, mo, d, h, mi, s] = m;
  return new Date(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    Number(s || 0),
    0
  );
}

export function flightArriveLocal(offer: LiveFlightOffer): Date {
  return new Date(flightDepartLocal(offer).getTime() + offer.durationMin * 60_000);
}

async function fetchPricesForDates(
  origin: string,
  destination: string,
  departureAt: string,
  token: string,
  limit: number
): Promise<LiveFlightOffer[]> {
  const url = new URL("https://api.travelpayouts.com/aviasales/v3/prices_for_dates");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("departure_at", departureAt);
  url.searchParams.set("one_way", "true");
  url.searchParams.set("currency", "inr");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("sorting", "price");
  url.searchParams.set("unique", "false");
  url.searchParams.set("token", token);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { data?: ApiRow[]; success?: boolean };
  const rows = Array.isArray(json.data) ? json.data : [];
  return rows.map(parseOffer).filter((x): x is LiveFlightOffer => Boolean(x));
}

function offerKey(f: LiveFlightOffer): string {
  return `${f.airline}${f.flightNumber}|${f.departureAt}|${f.fareInr}|${f.transfers}`;
}

/**
 * Prefer schedule diversity over pure cheapest: keep cheapest + earliest/latest
 * useful departures + nonstops when present.
 */
export function diversifyFlightPicks(offers: LiveFlightOffer[], max = 12): LiveFlightOffer[] {
  if (offers.length <= max) return offers;
  const picked = new Map<string, LiveFlightOffer>();
  const take = (f: LiveFlightOffer | undefined) => {
    if (!f || picked.size >= max) return;
    picked.set(offerKey(f), f);
  };

  const byPrice = [...offers].sort((a, b) => a.fareInr - b.fareInr || a.departureAt.localeCompare(b.departureAt));
  const byDepart = [...offers].sort((a, b) => a.departureAt.localeCompare(b.departureAt));
  const nonstop = byPrice.filter((f) => f.transfers === 0);

  for (const f of byPrice.slice(0, 4)) take(f);
  for (const f of nonstop.slice(0, 4)) take(f);
  take(byDepart[0]);
  take(byDepart[byDepart.length - 1]);
  // Mid-day and evening buckets
  for (const f of byDepart) {
    const hour = Number(f.departureAt.slice(11, 13));
    if (hour >= 6 && hour < 12) take(f);
    if (hour >= 12 && hour < 18) take(f);
    if (hour >= 18) take(f);
    if (picked.size >= max) break;
  }
  for (const f of byPrice) {
    take(f);
    if (picked.size >= max) break;
  }
  return [...picked.values()].sort((a, b) => a.fareInr - b.fareInr || a.departureAt.localeCompare(b.departureAt));
}

/**
 * Live timed offers for origin→dest on dates in [fromDate, toDate] inclusive.
 * Combines month cache + per-day queries so thin ODs aren't stuck with one cheap row.
 */
export async function fetchLiveFlightOffers(
  origin: string,
  destination: string,
  fromDate: string,
  toDate: string,
  token: string,
  cache: Map<string, LiveFlightOffer[]>
): Promise<LiveFlightOffer[]> {
  const o = origin.toUpperCase();
  const d = destination.toUpperCase();
  const months = new Set<string>([monthKey(fromDate), monthKey(toDate)]);
  const days = daysInRange(fromDate, toDate);
  for (const day of days) months.add(monthKey(day));

  const all: LiveFlightOffer[] = [];
  const seen = new Set<string>();
  const pushBatch = (batch: LiveFlightOffer[]) => {
    for (const f of batch) {
      const k = offerKey(f);
      if (seen.has(k)) continue;
      seen.add(k);
      all.push(f);
    }
  };

  // 1) Month queries — broad fare coverage
  for (const month of months) {
    const key = `${o}-${d}-M-${month}`;
    let batch = cache.get(key);
    if (!batch) {
      try {
        batch = await fetchPricesForDates(o, d, month, token, 100);
      } catch {
        batch = [];
      }
      cache.set(key, batch);
    }
    pushBatch(batch);
  }

  // 2) Per-day queries — schedule diversity for the planner window
  await Promise.all(
    days.map(async (day) => {
      const key = `${o}-${d}-D-${day}`;
      let batch = cache.get(key);
      if (!batch) {
        try {
          batch = await fetchPricesForDates(o, d, day, token, 30);
        } catch {
          batch = [];
        }
        cache.set(key, batch);
      }
      pushBatch(batch);
    })
  );

  return all
    .filter((f) => {
      const day = f.departureAt.slice(0, 10);
      return day >= fromDate && day <= toDate;
    })
    .sort((a, b) => a.fareInr - b.fareInr || a.departureAt.localeCompare(b.departureAt));
}
