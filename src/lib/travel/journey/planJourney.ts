/**
 * Multi-leg “reach by” planner — expands a route tree (direct + via nearby hubs),
 * prices flight legs, scores cost / duration / sleep, returns ranked itineraries.
 */
import { estimateFlightMarketFare, fetchTravelpayoutsDatedFare } from "../fareDiscover";
import { haversineKm, type TravelPlace } from "../places";
import {
  gatewaysForDestination,
  nearestAirports,
  originCityId,
  placeById,
  resolveJourneyPlace,
  ORIGIN_FEEDER_HUBS,
} from "./graph";
import type {
  JourneyItinerary,
  JourneyLeg,
  JourneyLegMode,
  JourneyPlanInput,
  JourneyPlanResult,
  JourneyPrefs,
} from "./types";

const TRAVELPAYOUTS_FALLBACK_TOKEN = "e451ad62a0e8468732b6e1ada1e58223";

const DEFAULT_PREFS: JourneyPrefs = {
  sleepStartHour: 23,
  sleepEndHour: 6,
  maxDurationHrs: 40,
  costWeight: 0.4,
  timeWeight: 0.3,
  sleepWeight: 0.3,
  avoidOvernightSurface: true,
};

type LegDraft = {
  mode: JourneyLegMode;
  from: TravelPlace;
  to: TravelPlace;
  durationMin: number;
  costInr: number;
  costSource: "live" | "estimated";
  note?: string;
  /** Minutes buffer after this leg before next (connections / airport) */
  bufferAfterMin?: number;
};

type RouteTemplate = {
  label: string;
  tags: string[];
  legs: LegDraft[];
};

function mergePrefs(partial?: Partial<JourneyPrefs>): JourneyPrefs {
  return { ...DEFAULT_PREFS, ...partial };
}

function parseLocalDateTime(iso: string): Date {
  // Treat as local wall clock without TZ shift gymnastics for India planners
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) throw new Error("arriveBy must be YYYY-MM-DDTHH:mm");
  const [, y, mo, d, h, mi] = m.map(Number) as number[];
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

function toLocalISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addMinutes(d: Date, min: number): Date {
  return new Date(d.getTime() + min * 60_000);
}

function dateISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function estimateFlightDurationMin(from: TravelPlace, to: TravelPlace): number {
  const km = haversineKm(from, to);
  // ~12 km/min cruise + fixed taxi/climb/descent
  return Math.round(50 + km / 12 + 35);
}

/** Minutes of travel overlapping the preferred sleep window (may cross midnight). */
export function sleepOverlapMinutes(
  start: Date,
  end: Date,
  sleepStartHour: number,
  sleepEndHour: number
): number {
  if (end <= start) return 0;
  let overlap = 0;
  // Walk day by day covering the interval
  const cursor = new Date(start);
  cursor.setSeconds(0, 0);
  const endMs = end.getTime();
  while (cursor.getTime() < endMs) {
    const dayStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    // Sleep windows for this calendar day:
    // [sleepStart → midnight] and/or [midnight → sleepEnd] depending on window shape
    const windows: [Date, Date][] = [];
    if (sleepStartHour > sleepEndHour) {
      // e.g. 23→06
      windows.push([
        new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), sleepStartHour, 0),
        addMinutes(dayStart, 24 * 60),
      ]);
      windows.push([
        dayStart,
        new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), sleepEndHour, 0),
      ]);
    } else {
      windows.push([
        new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), sleepStartHour, 0),
        new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate(), sleepEndHour, 0),
      ]);
    }
    for (const [ws, we] of windows) {
      const a = Math.max(start.getTime(), ws.getTime());
      const b = Math.min(endMs, we.getTime());
      if (b > a) overlap += (b - a) / 60_000;
    }
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(0, 0, 0, 0);
  }
  return Math.round(overlap);
}

function sleepScoreFromOverlap(overlapMin: number, prefs: JourneyPrefs): number {
  const windowLen =
    prefs.sleepStartHour > prefs.sleepEndHour
      ? (24 - prefs.sleepStartHour + prefs.sleepEndHour) * 60
      : (prefs.sleepEndHour - prefs.sleepStartHour) * 60;
  const ratio = Math.min(1, overlapMin / Math.max(60, windowLen));
  return Math.round(100 * (1 - ratio));
}

function codeLabel(p: TravelPlace): string {
  return p.code || p.city.slice(0, 3).toUpperCase();
}

function pathLabel(legs: { from: TravelPlace; to: TravelPlace }[]): string {
  if (!legs.length) return "";
  const parts = [codeLabel(legs[0].from)];
  for (const leg of legs) parts.push(codeLabel(leg.to));
  return parts.join(" → ");
}

type FareCache = Map<string, { fare: number; source: "live" | "estimated" }>;

async function flightFare(
  from: TravelPlace,
  to: TravelPlace,
  date: string,
  today: string | undefined,
  cache: FareCache,
  token: string
): Promise<{ fare: number; source: "live" | "estimated" }> {
  const o = from.code?.toUpperCase();
  const d = to.code?.toUpperCase();
  const key = `${o || from.id}-${d || to.id}-${date}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let fare: number;
  let source: "live" | "estimated" = "estimated";
  const km = haversineKm(from, to);
  if (o && d && /^[A-Z]{3}$/.test(o) && /^[A-Z]{3}$/.test(d)) {
    try {
      const live = await fetchTravelpayoutsDatedFare(o, d, date, token);
      if (live && live > 500) {
        fare = live;
        source = "live";
      } else {
        fare = estimateFlightMarketFare(km, date, "economy", today);
      }
    } catch {
      fare = estimateFlightMarketFare(km, date, "economy", today);
    }
  } else {
    fare = estimateFlightMarketFare(km, date, "economy", today);
  }
  const out = { fare, source };
  cache.set(key, out);
  return out;
}

const TRAVEL_AIRPORT_BY_CITY: Record<string, string> = {
  pune: "apt-pnq",
  mumbai: "apt-bom",
  delhi: "apt-del",
  bengaluru: "apt-blr",
  bangalore: "apt-blr",
  hyderabad: "apt-hyd",
  chennai: "apt-maa",
  kolkata: "apt-ccu",
  goa: "apt-goi",
  dehradun: "apt-ded",
  chandigarh: "apt-ixc",
};

function homeAirport(origin: TravelPlace): TravelPlace | null {
  if (origin.kind === "airport") return origin;
  const mapped = TRAVEL_AIRPORT_BY_CITY[origin.city.toLowerCase()];
  if (mapped) return placeById(mapped) ?? null;
  return nearestAirports(origin, 1)[0] ?? null;
}

function buildTemplates(origin: TravelPlace, dest: TravelPlace): RouteTemplate[] {
  const templates: RouteTemplate[] = [];
  const gates = gatewaysForDestination(dest);
  const originApt = homeAirport(origin);
  const cityId = originCityId(origin);
  const feeders = ORIGIN_FEEDER_HUBS[cityId] || ORIGIN_FEEDER_HUBS[origin.id] || [];

  for (const aptId of gates.airports) {
    const destApt = placeById(aptId);
    if (!destApt) continue;
    const lastMiles = gates.lastMile.filter((lm) => lm.fromPlaceId === aptId);
    const lmList =
      lastMiles.length > 0
        ? lastMiles
        : [
            {
              fromPlaceId: aptId,
              mode: "cab" as const,
              durationMin: Math.max(40, Math.round(haversineKm(destApt, dest) * 2.2)),
              costInr: Math.max(400, Math.round(haversineKm(destApt, dest) * 28)),
              note: `Transfer ${destApt.city} → ${dest.city}`,
            },
          ];

    for (const lm of lmList) {
      const lmTo = dest;
      const lmFrom = placeById(lm.fromPlaceId) ?? destApt;

      // Direct flight from home airport
      if (originApt && originApt.id !== destApt.id) {
        templates.push({
          label: `Direct flight ${codeLabel(originApt)} → ${codeLabel(destApt)}`,
          tags: ["direct", "flight", destApt.code || destApt.id],
          legs: [
            {
              mode: "flight",
              from: originApt,
              to: destApt,
              durationMin: estimateFlightDurationMin(originApt, destApt),
              costInr: 0, // filled later
              costSource: "estimated",
              note: `Flight ${codeLabel(originApt)} → ${codeLabel(destApt)}`,
              bufferAfterMin: 45,
            },
            {
              mode: lm.mode,
              from: lmFrom,
              to: lmTo,
              durationMin: lm.durationMin,
              costInr: lm.costInr,
              costSource: "estimated",
              note: lm.note,
              bufferAfterMin: 0,
            },
          ],
        });
      }

      // Via feeder hubs (e.g. Pune → Mumbai surface → fly)
      for (const feeder of feeders) {
        const hub = placeById(feeder.hubAirportId);
        if (!hub || hub.id === destApt.id) continue;
        for (const surface of feeder.surface) {
          if (surface.mode === "cab" && lm.durationMin > 300) {
            // skip expensive cab + long last-mile combos later via scoring
          }
          templates.push({
            label: `Via ${hub.city}: ${surface.mode} then ${codeLabel(hub)} → ${codeLabel(destApt)}`,
            tags: ["via-hub", hub.code || hub.id, surface.mode, destApt.code || destApt.id],
            legs: [
              {
                mode: surface.mode,
                from: origin.kind === "city" ? origin : placeById(cityId) || origin,
                to: hub,
                durationMin: surface.durationMin,
                costInr: surface.costInr,
                costSource: "estimated",
                note: surface.note,
                bufferAfterMin: 150, // reach airport + check-in
              },
              {
                mode: "flight",
                from: hub,
                to: destApt,
                durationMin: estimateFlightDurationMin(hub, destApt),
                costInr: 0,
                costSource: "estimated",
                note: `Flight ${codeLabel(hub)} → ${codeLabel(destApt)}`,
                bufferAfterMin: 45,
              },
              {
                mode: lm.mode,
                from: lmFrom,
                to: lmTo,
                durationMin: lm.durationMin,
                costInr: lm.costInr,
                costSource: "estimated",
                note: lm.note,
                bufferAfterMin: 0,
              },
            ],
          });
        }
      }
    }
  }

  // Long overnight surface to Delhi then last-mile (when Delhi is a gateway)
  const delCity = placeById("city-del");
  const delLast = gates.lastMile.find((x) => x.fromPlaceId === "city-del" || x.fromPlaceId === "apt-del");
  if (delCity && delLast && originApt) {
    const km = haversineKm(origin, delCity);
    if (km > 800) {
      templates.push({
        label: "Overnight train toward Delhi + ground to destination",
        tags: ["overnight", "train", "surface"],
        legs: [
          {
            mode: "train",
            from: placeById("stn-pune") && origin.city === "Pune" ? placeById("stn-pune")! : origin,
            to: placeById("stn-ndls") || delCity,
            durationMin: Math.round(km / 55) * 60, // ~55 km/h average
            costInr: Math.round(280 + km * 1.35),
            costSource: "estimated",
            note: "Long-distance train (3A ballpark)",
            bufferAfterMin: 90,
          },
          {
            mode: delLast.mode,
            from: placeById(delLast.fromPlaceId) || delCity,
            to: dest,
            durationMin: delLast.durationMin,
            costInr: delLast.costInr,
            costSource: "estimated",
            note: delLast.note,
          },
        ],
      });
    }
  }

  return templates;
}

/** Schedule legs so the last leg ends at targetArrive (working backwards). */
function scheduleLegs(drafts: LegDraft[], targetArrive: Date): JourneyLeg[] {
  const legs: JourneyLeg[] = [];
  let cursor = new Date(targetArrive);
  for (let i = drafts.length - 1; i >= 0; i--) {
    const d = drafts[i];
    const arriveAt = new Date(cursor);
    const departAt = addMinutes(arriveAt, -d.durationMin);
    legs.unshift({
      id: `leg-${i}`,
      mode: d.mode,
      from: d.from,
      to: d.to,
      departAt: toLocalISO(departAt),
      arriveAt: toLocalISO(arriveAt),
      durationMin: d.durationMin,
      costInr: d.costInr,
      costSource: d.costSource,
      note: d.note,
      sleepOverlapMin: 0, // filled after
    });
    const buffer = d.bufferAfterMin ?? 0;
    // Move cursor to start of this leg, then subtract connection buffer for previous leg end
    cursor = addMinutes(departAt, -buffer);
  }
  return legs;
}

function fillSleepOnLegs(legs: JourneyLeg[], prefs: JourneyPrefs): number {
  let total = 0;
  for (const leg of legs) {
    const o = sleepOverlapMinutes(
      parseLocalDateTime(leg.departAt),
      parseLocalDateTime(leg.arriveAt),
      prefs.sleepStartHour,
      prefs.sleepEndHour
    );
    leg.sleepOverlapMin = o;
    total += o;
  }
  return total;
}

function buildItinerary(
  id: string,
  template: RouteTemplate,
  legs: JourneyLeg[],
  prefs: JourneyPrefs,
  variantTag: string
): JourneyItinerary | null {
  if (!legs.length) return null;
  const sleepOverlapMin = fillSleepOnLegs(legs, prefs);
  const totalCostInr = legs.reduce((s, l) => s + l.costInr, 0);
  const departAt = legs[0].departAt;
  const arriveAt = legs[legs.length - 1].arriveAt;
  const totalDurationMin = Math.round(
    (parseLocalDateTime(arriveAt).getTime() - parseLocalDateTime(departAt).getTime()) / 60_000
  );
  if (totalDurationMin > prefs.maxDurationHrs * 60) return null;

  const overnightSurface = legs.some(
    (l) =>
      (l.mode === "train" || l.mode === "bus" || l.mode === "cab") &&
      l.sleepOverlapMin >= 180
  );
  if (prefs.avoidOvernightSurface && overnightSurface && template.tags.includes("overnight")) {
    // keep but warn heavily via score
  }

  const sleep = sleepScoreFromOverlap(sleepOverlapMin, prefs);
  const why: string[] = [];
  const warnings: string[] = [];

  if (sleep >= 80) why.push("Protects your night sleep window");
  else if (sleep < 40) warnings.push("Heavy overlap with your sleep hours (23:00–06:00)");

  const liveLegs = legs.filter((l) => l.costSource === "live").length;
  if (liveLegs) why.push(`${liveLegs} flight leg${liveLegs > 1 ? "s" : ""} priced from live calendar`);
  else why.push("Fares mostly estimated — confirm stickers before booking");

  const cheapestSurface = template.tags.includes("via-hub") && legs.some((l) => l.mode === "train");
  if (cheapestSurface) why.push("Uses cheap Pune↔Mumbai surface to access a bigger flight market");

  if (overnightSurface) warnings.push("Includes overnight surface travel");

  return {
    id,
    label: `${template.label} · ${variantTag}`,
    pathLabel: pathLabel(legs),
    legs,
    totalCostInr,
    totalDurationMin,
    departAt,
    arriveAt,
    sleepScore: sleep,
    sleepOverlapMin,
    score: 0,
    why,
    warnings,
    tags: [...template.tags, variantTag],
  };
}

function rankItineraries(items: JourneyItinerary[], prefs: JourneyPrefs): JourneyItinerary[] {
  if (!items.length) return [];
  const costs = items.map((i) => i.totalCostInr);
  const durs = items.map((i) => i.totalDurationMin);
  const minC = Math.min(...costs);
  const maxC = Math.max(...costs);
  const minD = Math.min(...durs);
  const maxD = Math.max(...durs);

  const norm = (v: number, lo: number, hi: number, invert: boolean) => {
    if (hi <= lo) return 1;
    const t = (v - lo) / (hi - lo);
    return invert ? 1 - t : t;
  };

  for (const it of items) {
    const costN = norm(it.totalCostInr, minC, maxC, true);
    const timeN = norm(it.totalDurationMin, minD, maxD, true);
    const sleepN = it.sleepScore / 100;
    let score =
      100 *
      (prefs.costWeight * costN + prefs.timeWeight * timeN + prefs.sleepWeight * sleepN);
    if (it.tags.includes("overnight") && prefs.avoidOvernightSurface) score *= 0.72;
    // Prefer arriving with sleep intact slightly more when costs are close
    it.score = Math.round(score * 10) / 10;
  }

  return items.sort((a, b) => b.score - a.score || a.totalCostInr - b.totalCostInr);
}

async function priceTemplateFlights(
  template: RouteTemplate,
  flightDate: string,
  today: string | undefined,
  cache: FareCache,
  token: string,
  adults: number
): Promise<LegDraft[]> {
  const priced: LegDraft[] = [];
  for (const leg of template.legs) {
    if (leg.mode === "flight") {
      const { fare, source } = await flightFare(leg.from, leg.to, flightDate, today, cache, token);
      priced.push({
        ...leg,
        costInr: fare * adults,
        costSource: source,
      });
    } else {
      priced.push({ ...leg, costInr: leg.costInr * adults });
    }
  }
  return priced;
}

/** Main flight depart date for a backwards-scheduled itinerary (first flight leg). */
function flightDateFromSchedule(legs: JourneyLeg[]): string {
  const flight = legs.find((l) => l.mode === "flight");
  if (flight) return flight.departAt.slice(0, 10);
  return legs[0]?.departAt.slice(0, 10) || dateISO(new Date());
}

export async function planJourney(
  input: JourneyPlanInput,
  opts?: { travelpayoutsToken?: string }
): Promise<JourneyPlanResult> {
  const prefs = mergePrefs(input.prefs);
  const warnings: string[] = [];
  const origin = resolveJourneyPlace(input.origin || "Pune");
  const destination = resolveJourneyPlace(input.destination);

  if (!origin) throw new Error("Could not resolve origin — try Pune or a city name.");
  if (!destination) throw new Error("Could not resolve destination — try Rishikesh, Manali, etc.");
  if (origin.id === destination.id) throw new Error("Origin and destination are the same.");

  const arriveBy = parseLocalDateTime(input.arriveBy);
  const adults = Math.max(1, input.adults || 1);
  const token =
    opts?.travelpayoutsToken || process.env.TRAVELPAYOUTS_TOKEN || TRAVELPAYOUTS_FALLBACK_TOKEN;
  const cache: FareCache = new Map();

  const templates = buildTemplates(origin, destination);
  if (!templates.length) {
    return {
      origin,
      destination,
      arriveBy: input.arriveBy,
      prefs,
      best: null,
      alternatives: [],
      summary: `No route tree for ${origin.city} → ${destination.city}`,
      warnings: ["No gateway mapping for this destination yet."],
    };
  }

  // Target arrivals: tight deadline + comfort (evening before)
  const comfort = new Date(arriveBy);
  comfort.setDate(comfort.getDate() - 1);
  comfort.setHours(20, 0, 0, 0);
  const targets: { tag: string; at: Date }[] = [{ tag: "arrive-by", at: arriveBy }];
  if (comfort.getTime() < arriveBy.getTime() - 3 * 3600_000) {
    targets.push({ tag: "day-before-evening", at: comfort });
  }

  const itineraries: JourneyItinerary[] = [];
  let idx = 0;

  // Deduplicate similar path+variant
  const seen = new Set<string>();

  for (const template of templates) {
    for (const target of targets) {
      // First pass: schedule with placeholder flight cost to know flight date
      const rough = scheduleLegs(template.legs, target.at);
      if (!rough.length) continue;
      const fDate = flightDateFromSchedule(rough);

      // Re-price flights for that date, then re-schedule (duration unchanged)
      const pricedLegs = await priceTemplateFlights(
        template,
        fDate,
        input.today,
        cache,
        token,
        adults
      );
      const scheduled = scheduleLegs(pricedLegs, target.at);
      const it = buildItinerary(`j-${idx++}`, template, scheduled, prefs, target.tag);
      if (!it) continue;

      // Must arrive on or before arriveBy
      if (parseLocalDateTime(it.arriveAt).getTime() > arriveBy.getTime() + 5 * 60_000) continue;

      const dedupeKey = `${it.pathLabel}|${it.tags.filter((t) => t !== "arrive-by" && t !== "day-before-evening").join(",")}|${Math.round(it.totalCostInr / 200)}`;
      if (seen.has(dedupeKey) && target.tag === "arrive-by") continue;
      seen.add(dedupeKey);

      itineraries.push(it);
    }
  }

  const ranked = rankItineraries(itineraries, prefs);
  const best = ranked[0] ?? null;
  const alternatives = ranked.slice(1, 12);

  if (!best) {
    warnings.push("No itinerary could meet that arrive-by time with the current graph.");
  } else {
    warnings.push(
      "Route tree explores direct flights and nearby-hub combos (e.g. Pune→Mumbai then fly). Times are planned backwards from your deadline — confirm real schedules."
    );
  }

  const summary = best
    ? `${origin.city} → ${destination.city} by ${input.arriveBy.replace("T", " ")} · best ${best.pathLabel} · ~₹${best.totalCostInr.toLocaleString("en-IN")} · sleep ${best.sleepScore}/100`
    : `No viable route ${origin.city} → ${destination.city} by ${input.arriveBy}`;

  return {
    origin,
    destination,
    arriveBy: input.arriveBy,
    prefs,
    best,
    alternatives,
    summary,
    warnings,
  };
}
