/**
 * Live timed flight offers from Travelpayouts Aviasales v3 prices_for_dates.
 * Only returns flights that appear in the market cache (real departure_at).
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

async function fetchMonth(
  origin: string,
  destination: string,
  month: string,
  token: string
): Promise<LiveFlightOffer[]> {
  const url = new URL("https://api.travelpayouts.com/aviasales/v3/prices_for_dates");
  url.searchParams.set("origin", origin);
  url.searchParams.set("destination", destination);
  url.searchParams.set("departure_at", month);
  url.searchParams.set("one_way", "true");
  url.searchParams.set("currency", "inr");
  url.searchParams.set("limit", "30");
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

/**
 * Live timed offers for origin→dest on dates in [fromDate, toDate] inclusive.
 * Uses month queries (exact-day cache is often empty).
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
  // also cover if range crosses a third month
  let cursor = fromDate;
  for (let i = 0; i < 40 && cursor <= toDate; i++) {
    months.add(monthKey(cursor));
    cursor = addDaysISO(cursor, 1);
  }

  const all: LiveFlightOffer[] = [];
  for (const month of months) {
    const key = `${o}-${d}-${month}`;
    let batch = cache.get(key);
    if (!batch) {
      try {
        batch = await fetchMonth(o, d, month, token);
      } catch {
        batch = [];
      }
      cache.set(key, batch);
    }
    all.push(...batch);
  }

  const from = fromDate;
  const to = toDate;
  return all
    .filter((f) => {
      const day = f.departureAt.slice(0, 10);
      return day >= from && day <= to;
    })
    .sort((a, b) => a.fareInr - b.fareInr || a.departureAt.localeCompare(b.departureAt));
}
