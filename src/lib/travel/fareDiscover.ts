/**
 * Auto fare discovery for Travel — finds comparable platform fares so the user
 * does not paste sticker prices.
 *
 * Live source (optional): Travelpayouts Data API via TRAVELPAYOUTS_TOKEN.
 * Fallback: calibrated India route model (distance + lead time + DOW) + platform biases.
 */
import { platformsForMode } from "./platforms";
import { haversineKm, resolvePlace, type TravelPlace } from "./places";
import type { TravelMode, TravelTripInput } from "./types";

export type FareQuoteSource = "live" | "estimated";

export type FareQuote = {
  platformId: string;
  fareInr: number;
  source: FareQuoteSource;
  note?: string;
  deepLink?: string;
};

export type FareDiscoveryResult = {
  mode: TravelMode;
  origin: TravelPlace;
  destination: TravelPlace;
  marketFareInr: number;
  marketSource: "travelpayouts" | "model";
  distanceKm: number;
  quotes: FareQuote[];
  /** platformId → fare for rankTravel */
  fares: Record<string, number>;
  warnings: string[];
  summary: string;
};

function daysUntil(dateISO: string, todayISO?: string): number {
  const t0 = todayISO ? new Date(todayISO + "T12:00:00") : new Date();
  const t1 = new Date(dateISO + "T12:00:00");
  return Math.max(0, Math.round((t1.getTime() - t0.getTime()) / 86400000));
}

function leadTimeMultiplier(days: number): number {
  if (days <= 3) return 1.55;
  if (days <= 7) return 1.35;
  if (days <= 14) return 1.18;
  if (days <= 28) return 1.05;
  if (days <= 60) return 0.98;
  return 0.94;
}

function dowMultiplier(dateISO: string): number {
  const d = new Date(dateISO + "T12:00:00").getDay();
  // Fri/Sun often pricier for domestic India
  if (d === 5 || d === 0) return 1.08;
  if (d === 6) return 1.04;
  return 1;
}

function cabinMultiplier(cabin?: TravelTripInput["cabin"]): number {
  if (cabin === "business") return 2.6;
  if (cabin === "premium") return 1.45;
  return 1;
}

/** Calibrated India domestic flight market fare (one adult, one-way). */
export function estimateFlightMarketFare(
  distanceKm: number,
  dateISO: string,
  cabin?: TravelTripInput["cabin"],
  todayISO?: string
): number {
  const d = Math.max(80, distanceKm);
  // Base: ~₹2.1/km with floor, diminishing returns on long haul
  const base = 900 + d * 2.05 + Math.sqrt(d) * 28;
  const fare = base * leadTimeMultiplier(daysUntil(dateISO, todayISO)) * dowMultiplier(dateISO) * cabinMultiplier(cabin);
  return Math.round(fare / 50) * 50;
}

/** IRCTC-ish 3A / CC ballpark for one adult. */
export function estimateTrainMarketFare(distanceKm: number, trainClass?: string): number {
  const d = Math.max(50, distanceKm);
  const cls = (trainClass || "3A").toUpperCase();
  const perKm =
    cls === "1A" || cls === "EA" ? 3.2 : cls === "2A" ? 2.1 : cls === "CC" || cls === "EC" ? 1.7 : cls === "SL" ? 0.55 : 1.35; // 3A default
  const base = cls === "SL" ? 120 : 280;
  return Math.round((base + d * perKm) / 10) * 10;
}

export function estimateBusMarketFare(distanceKm: number): number {
  const d = Math.max(40, distanceKm);
  // Semi-sleeper / Volvo-ish average
  return Math.round((80 + d * 1.85) / 10) * 10;
}

async function fetchTravelpayoutsCheap(
  originCode: string,
  destCode: string,
  dateISO: string,
  token: string
): Promise<number | null> {
  const month = dateISO.slice(0, 7); // YYYY-MM
  const url = new URL("https://api.travelpayouts.com/v1/prices/cheap");
  url.searchParams.set("origin", originCode);
  url.searchParams.set("destination", destCode);
  url.searchParams.set("depart_date", month);
  url.searchParams.set("currency", "inr");
  url.searchParams.set("token", token);

  const res = await fetch(url.toString(), { next: { revalidate: 0 } });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    data?: Record<string, Record<string, { price?: number; departure_at?: string }>>;
  };
  const bucket = json.data?.[destCode] ?? json.data?.[Object.keys(json.data || {})[0] || ""];
  if (!bucket) return null;

  // Prefer departure closest to requested date
  const target = new Date(dateISO + "T12:00:00").getTime();
  let best: { price: number; dist: number } | null = null;
  for (const row of Object.values(bucket)) {
    const price = row.price;
    if (price == null || !Number.isFinite(price) || price <= 0) continue;
    const dep = row.departure_at ? new Date(row.departure_at).getTime() : target;
    const dist = Math.abs(dep - target);
    if (!best || dist < best.dist || (dist === best.dist && price < best.price)) {
      best = { price, dist };
    }
  }
  return best ? Math.round(best.price) : null;
}

function roundFare(n: number): number {
  return Math.max(100, Math.round(n / 10) * 10);
}

/**
 * Discover fares for a trip. Prefer live Travelpayouts for flights when token is set.
 */
export async function discoverFares(
  trip: TravelTripInput,
  opts?: { travelpayoutsToken?: string }
): Promise<FareDiscoveryResult> {
  const warnings: string[] = [];
  const origin = resolvePlace(trip.origin, trip.mode);
  const destination = resolvePlace(trip.destination, trip.mode);

  if (!origin || !destination) {
    throw new Error("Pick origin and destination from the suggestions.");
  }
  if (origin.city.toLowerCase() === destination.city.toLowerCase() && trip.mode !== "bus") {
    throw new Error("Origin and destination look the same — pick a different city.");
  }

  const distanceKm = Math.round(haversineKm(origin, destination));
  let marketFareInr: number;
  let marketSource: FareDiscoveryResult["marketSource"] = "model";

  if (trip.mode === "flight") {
    const token = opts?.travelpayoutsToken || process.env.TRAVELPAYOUTS_TOKEN || "";
    const oCode = origin.code || resolvePlace(origin.city, "flight")?.code;
    const dCode = destination.code || resolvePlace(destination.city, "flight")?.code;
    if (token && oCode && dCode) {
      try {
        const live = await fetchTravelpayoutsCheap(oCode, dCode, trip.date, token);
        if (live && live > 500) {
          marketFareInr = live;
          marketSource = "travelpayouts";
        } else {
          marketFareInr = estimateFlightMarketFare(distanceKm, trip.date, trip.cabin, trip.today);
          warnings.push("Live flight calendar had no hit for that month — using route estimate.");
        }
      } catch {
        marketFareInr = estimateFlightMarketFare(distanceKm, trip.date, trip.cabin, trip.today);
        warnings.push("Live fare lookup failed — using route estimate.");
      }
    } else {
      marketFareInr = estimateFlightMarketFare(distanceKm, trip.date, trip.cabin, trip.today);
      if (!token) {
        warnings.push(
          "Showing route-calibrated market fares (add TRAVELPAYOUTS_TOKEN for live calendar prices). Always confirm sticker price at checkout."
        );
      }
    }
  } else if (trip.mode === "train") {
    marketFareInr = estimateTrainMarketFare(distanceKm, trip.trainClass);
    warnings.push("Train inventory is shared — we estimate IRCTC fare and rank checkout rails + payment stacks.");
  } else {
    marketFareInr = estimateBusMarketFare(distanceKm);
    warnings.push("Bus fares vary by operator — estimate uses route distance; confirm on RedBus / Amazon at checkout.");
  }

  // Optional single market override from user (not per-platform paste)
  if (trip.baseFareInr && trip.baseFareInr > 0) {
    marketFareInr = trip.baseFareInr;
    warnings.push("Using your market-fare override for ranking.");
  }

  const platforms = platformsForMode(trip.mode);
  const pax = Math.max(1, trip.adults + (trip.children ?? 0));
  const quotes: FareQuote[] = [];
  const fares: Record<string, number> = {};

  for (const platform of platforms) {
    const bias = platform.fareBiasInr ?? 0;
    const pct = platform.fareBiasPct ?? 0;
    const perAdult = roundFare(marketFareInr * (1 + pct) + bias);
    const fareInr = perAdult * pax;
    const deepLink = platform.buildSearchUrl?.({
      origin,
      destination,
      date: trip.date,
      returnDate: trip.returnDate,
      adults: trip.adults,
      children: trip.children ?? 0,
      cabin: trip.cabin,
    });
    quotes.push({
      platformId: platform.id,
      fareInr,
      source: marketSource === "travelpayouts" ? "live" : "estimated",
      note: bias || pct ? `Market ${roundFare(marketFareInr * pax)} ± platform bias` : undefined,
      deepLink,
    });
    fares[platform.id] = fareInr;
  }

  const oLabel = origin.code ? `${origin.city} (${origin.code})` : origin.city;
  const dLabel = destination.code ? `${destination.city} (${destination.code})` : destination.city;

  return {
    mode: trip.mode,
    origin,
    destination,
    marketFareInr: marketFareInr * pax,
    marketSource,
    distanceKm,
    quotes,
    fares,
    warnings,
    summary: `${oLabel} → ${dLabel} · ${trip.date} · ${pax} pax · ~${distanceKm} km · market ~₹${(marketFareInr * pax).toLocaleString("en-IN")}`,
  };
}
