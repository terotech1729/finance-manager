/**
 * Auto fare discovery for Travel — finds comparable platform fares so the user
 * does not paste sticker prices.
 *
 * Flights (live): Travelpayouts month-matrix calendar (INR), which returns actual
 * dated market fares — not a distance guess.
 * Fallback: calibrated India route model + peak-season multipliers.
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

/**
 * Travelpayouts Data API token.
 * Prefer TRAVELPAYOUTS_TOKEN env. Fallback is the public sample token from
 * Travelpayouts' own flights-api-project (Data API month-matrix works with it).
 */
const TRAVELPAYOUTS_FALLBACK_TOKEN = "e451ad62a0e8468732b6e1ada1e58223";

function daysUntil(dateISO: string, todayISO?: string): number {
  const t0 = todayISO ? new Date(todayISO + "T12:00:00") : new Date();
  const t1 = new Date(dateISO + "T12:00:00");
  return Math.max(0, Math.round((t1.getTime() - t0.getTime()) / 86400000));
}

function leadTimeMultiplier(days: number): number {
  // Domestic India: last-minute expensive; very early bird not always cheap anymore
  if (days <= 3) return 1.75;
  if (days <= 7) return 1.45;
  if (days <= 14) return 1.28;
  if (days <= 28) return 1.12;
  if (days <= 45) return 1.05;
  if (days <= 75) return 1.0;
  return 0.97;
}

function dowMultiplier(dateISO: string): number {
  const d = new Date(dateISO + "T12:00:00").getDay();
  if (d === 5 || d === 0) return 1.1;
  if (d === 6) return 1.06;
  return 1;
}

/** India peak windows (approx) — Diwali / year-end / summer / Holi. */
function peakSeasonMultiplier(dateISO: string): number {
  const [, mm, dd] = dateISO.split("-").map(Number);
  const md = mm * 100 + dd;
  // Diwali cluster ~ mid-Oct to mid-Nov
  if (md >= 1010 && md <= 1115) return 1.55;
  // Christmas / New Year
  if (md >= 1220 || md <= 105) return 1.4;
  // Summer vacation May–mid Jun
  if (md >= 501 && md <= 615) return 1.25;
  // Holi (rough Mar window)
  if (md >= 301 && md <= 325) return 1.2;
  return 1;
}

function cabinMultiplier(cabin?: TravelTripInput["cabin"]): number {
  if (cabin === "business") return 2.8;
  if (cabin === "premium") return 1.5;
  return 1;
}

/**
 * Calibrated India domestic flight market fare (one adult, one-way).
 * Tuned so PNQ–DEL (~1150 km) lands ~₹7–10k in peak, not ~₹3–4k.
 */
export function estimateFlightMarketFare(
  distanceKm: number,
  dateISO: string,
  cabin?: TravelTripInput["cabin"],
  todayISO?: string
): number {
  const d = Math.max(80, distanceKm);
  // Higher base + per-km — matches 2025–26 domestic all-in stickers better
  const base = 2200 + d * 3.4 + Math.sqrt(d) * 45;
  const fare =
    base *
    leadTimeMultiplier(daysUntil(dateISO, todayISO)) *
    dowMultiplier(dateISO) *
    peakSeasonMultiplier(dateISO) *
    cabinMultiplier(cabin);
  return Math.round(fare / 50) * 50;
}

/** IRCTC-ish 3A / CC ballpark for one adult. */
export function estimateTrainMarketFare(distanceKm: number, trainClass?: string): number {
  const d = Math.max(50, distanceKm);
  const cls = (trainClass || "3A").toUpperCase();
  const perKm =
    cls === "1A" || cls === "EA" ? 3.2 : cls === "2A" ? 2.1 : cls === "CC" || cls === "EC" ? 1.7 : cls === "SL" ? 0.55 : 1.35;
  const base = cls === "SL" ? 120 : 280;
  return Math.round((base + d * perKm) / 10) * 10;
}

export function estimateBusMarketFare(distanceKm: number): number {
  const d = Math.max(40, distanceKm);
  return Math.round((80 + d * 1.85) / 10) * 10;
}

type MatrixRow = {
  depart_date?: string;
  return_date?: string;
  value?: number;
  number_of_changes?: number;
  actual?: boolean;
};

/**
 * Live dated fare from Travelpayouts month-matrix (one-way preferred).
 * Returns cheapest INR for that exact depart date when present.
 */
export async function fetchTravelpayoutsDatedFare(
  originCode: string,
  destCode: string,
  dateISO: string,
  token: string
): Promise<number | null> {
  const month = `${dateISO.slice(0, 7)}-01`;
  const url = new URL("https://api.travelpayouts.com/v2/prices/month-matrix");
  url.searchParams.set("currency", "inr");
  url.searchParams.set("origin", originCode);
  url.searchParams.set("destination", destCode);
  url.searchParams.set("month", month);
  url.searchParams.set("show_to_affiliates", "true");
  url.searchParams.set("token", token);

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: MatrixRow[]; success?: boolean };
  const rows = json.data ?? [];
  if (!rows.length) return null;

  const oneWay = rows.filter((r) => r.depart_date === dateISO && (!r.return_date || r.return_date === ""));
  const pool = oneWay.length ? oneWay : rows.filter((r) => r.depart_date === dateISO);
  const priced = pool
    .map((r) => r.value)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 500);
  if (!priced.length) {
    // Nearest date within ±3 days in the matrix
    const target = new Date(dateISO + "T12:00:00").getTime();
    let best: { value: number; dist: number } | null = null;
    for (const r of rows) {
      if (!r.depart_date || r.value == null || r.value <= 500) continue;
      if (r.return_date) continue;
      const dist = Math.abs(new Date(r.depart_date + "T12:00:00").getTime() - target);
      if (dist > 3 * 86400000) continue;
      if (!best || dist < best.dist || (dist === best.dist && r.value < best.value)) {
        best = { value: r.value, dist };
      }
    }
    return best ? Math.round(best.value) : null;
  }
  return Math.round(Math.min(...priced));
}

function roundFare(n: number): number {
  return Math.max(100, Math.round(n / 10) * 10);
}

function iataCode(place: TravelPlace): string | undefined {
  if (place.code && /^[A-Z]{3}$/i.test(place.code)) return place.code.toUpperCase();
  return resolvePlace(place.city, "flight")?.code?.toUpperCase();
}

/**
 * Discover fares for a trip. Flights prefer live Travelpayouts month-matrix.
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
    const token =
      opts?.travelpayoutsToken || process.env.TRAVELPAYOUTS_TOKEN || TRAVELPAYOUTS_FALLBACK_TOKEN;
    const oCode = iataCode(origin);
    const dCode = iataCode(destination);
    if (oCode && dCode) {
      try {
        const live = await fetchTravelpayoutsDatedFare(oCode, dCode, trip.date, token);
        if (live && live > 500) {
          marketFareInr = live;
          marketSource = "travelpayouts";
          warnings.push(
            `Live market fare ₹${live.toLocaleString("en-IN")} from flight calendar for ${oCode}→${dCode} on ${trip.date}. Airline-direct (e.g. IndiGo app) can be higher than the cheapest aggregator fare — confirm sticker at checkout.`
          );
        } else {
          marketFareInr = estimateFlightMarketFare(distanceKm, trip.date, trip.cabin, trip.today);
          warnings.push("Live calendar had no hit for that date — using peak-aware route estimate.");
        }
      } catch {
        marketFareInr = estimateFlightMarketFare(distanceKm, trip.date, trip.cabin, trip.today);
        warnings.push("Live fare lookup failed — using peak-aware route estimate.");
      }
    } else {
      marketFareInr = estimateFlightMarketFare(distanceKm, trip.date, trip.cabin, trip.today);
      warnings.push("Could not resolve airport codes — using route estimate.");
    }
  } else if (trip.mode === "train") {
    marketFareInr = estimateTrainMarketFare(distanceKm, trip.trainClass);
    warnings.push("Train inventory is shared — we estimate IRCTC fare and rank checkout rails + payment stacks.");
  } else {
    marketFareInr = estimateBusMarketFare(distanceKm);
    warnings.push("Bus fares vary by operator — estimate uses route distance; confirm on RedBus / Amazon at checkout.");
  }

  // Optional single market override from user (Advanced)
  if (trip.baseFareInr && trip.baseFareInr > 0) {
    marketFareInr = trip.baseFareInr;
    marketSource = "model";
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
      note:
        marketSource === "travelpayouts"
          ? pct || bias
            ? `Live market ₹${roundFare(marketFareInr * pax).toLocaleString("en-IN")} ± platform bias`
            : `Live market ₹${roundFare(marketFareInr * pax).toLocaleString("en-IN")}`
          : "Estimated",
      deepLink,
    });
    fares[platform.id] = fareInr;
  }

  const oLabel = origin.code ? `${origin.city} (${origin.code})` : origin.city;
  const dLabel = destination.code ? `${destination.city} (${destination.code})` : destination.city;
  const srcLabel = marketSource === "travelpayouts" ? "live calendar" : "estimate";

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
    summary: `${oLabel} → ${dLabel} · ${trip.date} · ${pax} pax · ~${distanceKm} km · ${srcLabel} ₹${(marketFareInr * pax).toLocaleString("en-IN")}`,
  };
}
