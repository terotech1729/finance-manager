/**
 * Multi-leg “reach by” planner — real timed flights + catalog surface + stay costing.
 *
 * Flights: only Aviasales/Travelpayouts timed offers (departure_at).
 * Surface: curated known services (Deccan Queen, overnight Delhi→Rishikesh, …).
 * Stay: hotel nights when you arrive early; overnight bus can replace hotel.
 */
import { type TravelPlace } from "../places";
import {
  gatewaysForDestination,
  nearestAirports,
  originCityId,
  placeById,
  resolveJourneyPlace,
} from "./graph";
import {
  fetchLiveFlightOffers,
  flightArriveLocal,
  flightDepartLocal,
  diversifyFlightPicks,
  type LiveFlightOffer,
} from "./liveFlights";
import { assessStay, hotelRate } from "./stay";
import {
  feederServicesToHub,
  lastMileServices,
  railToDelhiServices,
  type SurfaceService,
} from "./surfaceCatalog";
import { estimateFlightMarketFare } from "../fareDiscover";
import { haversineKm } from "../places";
import type {
  JourneyItinerary,
  JourneyLeg,
  JourneyPlanInput,
  JourneyPlanResult,
  JourneyPrefs,
  ScheduleSource,
} from "./types";

const TRAVELPAYOUTS_FALLBACK_TOKEN = "e451ad62a0e8468732b6e1ada1e58223";

const DEFAULT_PREFS: JourneyPrefs = {
  sleepStartHour: 23,
  sleepEndHour: 6,
  maxDurationHrs: 48,
  costWeight: 0.4,
  timeWeight: 0.25,
  sleepWeight: 0.35,
  avoidOvernightSurface: true,
  includeStayCost: true,
  allowOvernightAsStay: true,
};

function mergePrefs(partial?: Partial<JourneyPrefs>): JourneyPrefs {
  return { ...DEFAULT_PREFS, ...partial };
}

function parseLocalDateTime(iso: string): Date {
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

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function codeLabel(p: TravelPlace): string {
  return p.code || p.city.slice(0, 3).toUpperCase();
}

function pathLabel(legs: { from: TravelPlace; to: TravelPlace; mode: string }[]): string {
  if (!legs.length) return "";
  const transport = legs.filter((l) => l.mode !== "hotel");
  if (!transport.length) return "";
  const parts = [codeLabel(transport[0].from)];
  for (const leg of transport) parts.push(codeLabel(leg.to));
  return parts.join(" → ");
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
  const cursor = new Date(start);
  cursor.setSeconds(0, 0);
  const endMs = end.getTime();
  while (cursor.getTime() < endMs) {
    const dayStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    const windows: [Date, Date][] = [];
    if (sleepStartHour > sleepEndHour) {
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

function sleepScoreFromOverlap(
  wreckingOverlapMin: number,
  prefs: JourneyPrefs,
  sleepOnTransit: boolean
): number {
  const windowLen =
    prefs.sleepStartHour > prefs.sleepEndHour
      ? (24 - prefs.sleepStartHour + prefs.sleepEndHour) * 60
      : (prefs.sleepEndHour - prefs.sleepStartHour) * 60;
  const ratio = Math.min(1, wreckingOverlapMin / Math.max(60, windowLen));
  let score = Math.round(100 * (1 - ratio));
  if (sleepOnTransit) score = Math.max(score, 72); // slept on bus/train — not hotel, but intentional
  return score;
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

function onDateAt(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m, 0, 0);
}

function scheduleSurfaceOnDay(
  svc: SurfaceService,
  day: Date,
  from: TravelPlace,
  to: TravelPlace
): { depart: Date; arrive: Date } {
  if (svc.mode === "cab" && svc.id.includes("flex")) {
    // caller sets absolute times
    const depart = day;
    return { depart, arrive: addMinutes(depart, svc.durationMin) };
  }
  const depart = onDateAt(day, svc.departLocal);
  let arrive = onDateAt(day, svc.arriveLocal);
  if (svc.arrivesNextDay || arrive <= depart) arrive = addMinutes(arrive, 24 * 60);
  return { depart, arrive };
}

function makeLeg(opts: {
  id: string;
  mode: JourneyLeg["mode"];
  from: TravelPlace;
  to: TravelPlace;
  depart: Date;
  arrive: Date;
  costInr: number;
  costSource: "live" | "estimated";
  scheduleSource: ScheduleSource;
  note?: string;
  carrier?: string;
  overnightSleep?: boolean;
  prefs: JourneyPrefs;
}): JourneyLeg {
  const sleep = sleepOverlapMinutes(
    opts.depart,
    opts.arrive,
    opts.prefs.sleepStartHour,
    opts.prefs.sleepEndHour
  );
  return {
    id: opts.id,
    mode: opts.mode,
    from: opts.from,
    to: opts.to,
    departAt: toLocalISO(opts.depart),
    arriveAt: toLocalISO(opts.arrive),
    durationMin: Math.round((opts.arrive.getTime() - opts.depart.getTime()) / 60_000),
    costInr: opts.costInr,
    costSource: opts.costSource,
    scheduleSource: opts.scheduleSource,
    note: opts.note,
    carrier: opts.carrier,
    sleepOverlapMin: sleep,
    overnightSleep: opts.overnightSleep,
  };
}

function fillFeederBeforeFlight(opts: {
  origin: TravelPlace;
  hub: TravelPlace;
  flightDep: Date;
  adults: number;
  prefs: JourneyPrefs;
  preferModes?: Array<"train" | "bus" | "cab">;
  /** Return up to N feeders (same-day + day-before) so both appear in the tree. */
  maxFeeders?: number;
}): JourneyLeg[] {
  const cityId = originCityId(opts.origin);
  const services = feederServicesToHub(cityId, opts.hub.id);
  if (!services.length) return [];

  const airportBufferMin = 150;
  const needArriveHubBy = addMinutes(opts.flightDep, -airportBufferMin);
  const hubCity = opts.hub.city || "Mumbai";
  const maxFeeders = opts.maxFeeders ?? 1;

  type Cand = { svc: SurfaceService; depart: Date; arrive: Date; score: number; sameDay: boolean };
  const cands: Cand[] = [];

  for (const svc of services) {
    if (opts.preferModes && !opts.preferModes.includes(svc.mode as "train" | "bus" | "cab")) continue;

    if (svc.mode === "cab" && svc.id.includes("flex")) {
      const arrive = needArriveHubBy;
      const depart = addMinutes(arrive, -svc.durationMin);
      if (depart.getTime() > Date.now() - 86400000 * 400) {
        cands.push({
          svc,
          depart,
          arrive,
          score: svc.costInr * opts.adults + 200,
          sameDay: depart.toDateString() === opts.flightDep.toDateString(),
        });
      }
      continue;
    }

    for (const dayOffset of [0, -1]) {
      const day = addDays(opts.flightDep, dayOffset);
      const { depart, arrive } = scheduleSurfaceOnDay(
        svc,
        day,
        placeById(svc.fromPlaceId) || opts.origin,
        placeById(svc.toPlaceId) || opts.hub
      );
      if (arrive.getTime() > needArriveHubBy.getTime()) continue;
      const slackMin = (needArriveHubBy.getTime() - arrive.getTime()) / 60_000;
      if (slackMin > 18 * 60) continue;
      const gapHrs = (opts.flightDep.getTime() - arrive.getTime()) / 3_600_000;
      const crossesMidnight =
        arrive.toDateString() !== opts.flightDep.toDateString() && gapHrs >= 5;
      const layoverPenalty = crossesMidnight
        ? hotelRate(hubCity, opts.prefs) * Math.max(1, Math.ceil(opts.adults / 2)) * 1.4
        : 0;
      const score = svc.costInr * opts.adults + slackMin * 0.2 + layoverPenalty;
      cands.push({
        svc,
        depart,
        arrive,
        score,
        sameDay: arrive.toDateString() === opts.flightDep.toDateString(),
      });
    }
  }

  if (!cands.length) return [];
  cands.sort((a, b) => a.score - b.score);

  const picked: Cand[] = [];
  const take = (c: Cand | undefined) => {
    if (!c || picked.length >= maxFeeders) return;
    if (picked.some((p) => p.svc.id === c.svc.id && p.depart.getTime() === c.depart.getTime())) return;
    picked.push(c);
  };
  take(cands[0]);
  take(cands.find((c) => c.sameDay && c !== cands[0]));
  take(cands.find((c) => !c.sameDay && !picked.includes(c)));
  for (const c of cands) take(c);

  return picked.map((best) => {
    const from = placeById(best.svc.fromPlaceId) || opts.origin;
    const to = placeById(best.svc.toPlaceId) || opts.hub;
    return makeLeg({
      id: `feeder-${best.svc.id}-${dateISO(best.depart)}`,
      mode: best.svc.mode,
      from,
      to,
      depart: best.depart,
      arrive: best.arrive,
      costInr: best.svc.costInr * opts.adults,
      costSource: "estimated",
      scheduleSource: best.svc.mode === "cab" ? "estimated" : "catalog",
      note: best.svc.note,
      carrier: best.svc.name,
      overnightSleep: best.svc.overnightSleep,
      prefs: opts.prefs,
    });
  });
}

function fillLastMile(opts: {
  fromPlaceId: string;
  dest: TravelPlace;
  after: Date;
  adults: number;
  prefs: JourneyPrefs;
}): JourneyLeg | null {
  const services = lastMileServices(opts.fromPlaceId, opts.dest.id);
  const fallbackDur =
    opts.fromPlaceId === "apt-ded" ? 70 : opts.fromPlaceId === "apt-del" ? 360 : 90;
  const fallbackCost =
    opts.fromPlaceId === "apt-ded" ? 400 : opts.fromPlaceId === "apt-del" ? 5500 : 1200;

  if (services.length) {
    // Prefer cheapest transferable option (bus/shared before private cab when short hop).
    const sorted = [...services].sort((a, b) => a.costInr - b.costInr || a.durationMin - b.durationMin);
    const pick =
      sorted.find((s) => s.mode === "bus" && s.durationMin <= 120) ||
      sorted.find((s) => s.departLocal === "00:00" || s.id.includes("flex")) ||
      sorted[0];
    const depart = addMinutes(opts.after, 30); // baggage / exit
    const arrive = addMinutes(depart, pick.durationMin);
    const from = placeById(pick.fromPlaceId) || placeById(opts.fromPlaceId)!;
    return makeLeg({
      id: `lm-${pick.id}`,
      mode: pick.mode,
      from,
      to: opts.dest,
      depart,
      arrive,
      costInr: pick.costInr * opts.adults,
      costSource: "estimated",
      scheduleSource: pick.mode === "cab" ? "estimated" : "catalog",
      note: pick.note,
      carrier: pick.name,
      prefs: opts.prefs,
    });
  }

  const from = placeById(opts.fromPlaceId);
  if (!from) return null;
  const depart = addMinutes(opts.after, 30);
  return makeLeg({
    id: `lm-${opts.fromPlaceId}`,
    mode: opts.fromPlaceId === "apt-ded" ? "bus" : "cab",
    from,
    to: opts.dest,
    depart,
    arrive: addMinutes(depart, fallbackDur),
    costInr: fallbackCost * opts.adults,
    costSource: "estimated",
    scheduleSource: "estimated",
    note: `Transfer ${from.city} → ${opts.dest.city}`,
    prefs: opts.prefs,
  });
}

function flightLegFromOffer(
  offer: LiveFlightOffer,
  from: TravelPlace,
  to: TravelPlace,
  adults: number,
  prefs: JourneyPrefs
): JourneyLeg {
  const depart = flightDepartLocal(offer);
  const arrive = flightArriveLocal(offer);
  return makeLeg({
    id: `flt-${offer.airline}${offer.flightNumber}-${offer.departureAt.slice(0, 10)}`,
    mode: "flight",
    from,
    to,
    depart,
    arrive,
    costInr: offer.fareInr * adults,
    costSource: "live",
    scheduleSource: "live",
    note: `Live market: ${offer.airline} ${offer.flightNumber}${
      offer.transfers ? ` · ${offer.transfers} stop(s)` : " · nonstop"
    }`,
    carrier: `${offer.airline} ${offer.flightNumber}`.trim(),
    prefs,
  });
}

function buildItineraryFromLegs(
  id: string,
  label: string,
  tags: string[],
  legs: JourneyLeg[],
  arriveBy: Date,
  arriveByIso: string,
  prefs: JourneyPrefs,
  adults: number
): JourneyItinerary | null {
  if (!legs.length) return null;
  const finalArrive = parseLocalDateTime(legs[legs.length - 1].arriveAt);
  if (finalArrive.getTime() > arriveBy.getTime() + 5 * 60_000) return null;

  const transportCostInr = legs.reduce((s, l) => s + l.costInr, 0);
  const stay = assessStay(legs, arriveByIso, prefs, adults);

  // Wrecking sleep = overlap on legs that are NOT intentional overnight sleep
  let wrecking = 0;
  let totalOverlap = 0;
  for (const leg of legs) {
    totalOverlap += leg.sleepOverlapMin;
    if (!(leg.overnightSleep && prefs.allowOvernightAsStay)) {
      wrecking += leg.sleepOverlapMin;
    }
  }
  const sleep = sleepScoreFromOverlap(wrecking, prefs, stay.sleepOnTransit);

  const totalCostInr = transportCostInr + stay.costInr;
  const departAt = legs[0].departAt;
  const arriveAt = legs[legs.length - 1].arriveAt;
  const totalDurationMin = Math.round(
    (parseLocalDateTime(arriveAt).getTime() - parseLocalDateTime(departAt).getTime()) / 60_000
  );
  if (totalDurationMin > prefs.maxDurationHrs * 60) return null;

  const timed = legs.filter((l) => l.mode !== "hotel");
  const real = timed.filter((l) => l.scheduleSource === "live" || l.scheduleSource === "catalog");
  const realityPct = timed.length ? Math.round((100 * real.length) / timed.length) : 0;

  const why: string[] = [];
  const warnings: string[] = [];

  if (stay.sleepOnTransit) {
    why.push("Overnight transit doubles as stay — no hotel night");
  } else if (stay.nights > 0) {
    why.push(`Includes stay: ${stay.note}`);
    warnings.push(`Stay ~₹${stay.costInr.toLocaleString("en-IN")} added to all-in (not just tickets)`);
  }

  if (sleep >= 80) why.push("Protects your night sleep window");
  else if (sleep < 45 && !stay.sleepOnTransit)
    warnings.push("Heavy overlap with your sleep hours (23:00–06:00)");

  const liveFlights = legs.filter((l) => l.mode === "flight" && l.scheduleSource === "live").length;
  if (liveFlights) why.push(`${liveFlights} flight(s) from live market timetable`);
  if (legs.some((l) => l.scheduleSource === "catalog"))
    why.push("Surface legs use known catalog services — confirm IRCTC/RedBus for that date");

  if (tags.includes("via-hub") && legs.some((l) => l.mode === "train")) {
    why.push("Uses Pune↔Mumbai surface to access a bigger flight market");
  }

  if (realityPct < 50) {
    warnings.push("Fewer than half of timed legs are verified live/catalog — treat as provisional");
  }

  // Soft-penalize invented cab-only feeders without catalog train when avoid overnight
  if (prefs.avoidOvernightSurface && legs.some((l) => l.overnightSleep && !prefs.allowOvernightAsStay)) {
    warnings.push("Includes overnight surface travel");
  }

  return {
    id,
    label,
    pathLabel: pathLabel(legs),
    legs,
    transportCostInr,
    stayCostInr: stay.costInr,
    stayNights: stay.nights,
    stayNote: stay.note || undefined,
    totalCostInr,
    totalDurationMin,
    departAt,
    arriveAt,
    sleepScore: sleep,
    sleepOverlapMin: totalOverlap,
    score: 0,
    why,
    warnings,
    tags: [...tags, stay.sleepOnTransit ? "sleep-on-transit" : stay.nights > 0 ? "includes-stay" : "no-stay"],
    realityPct,
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
    // Prefer verified schedules
    score *= 0.85 + 0.15 * (it.realityPct / 100);
    if (it.tags.includes("overnight") && prefs.avoidOvernightSurface && !it.tags.includes("sleep-on-transit")) {
      score *= 0.75;
    }
    // Slight boost when overnight bus kills hotel cost
    if (it.tags.includes("sleep-on-transit") && prefs.includeStayCost) score *= 1.05;
    // Mild comfort nudge for DED + hotel (short last mile) — diversity still guarantees it surfaces
    if (it.tags.includes("DED") && it.tags.includes("includes-stay") && it.sleepScore >= 70) {
      score *= 1.03;
    }
    it.score = Math.round(score * 10) / 10;
  }

  return items.sort((a, b) => b.score - a.score || a.totalCostInr - b.totalCostInr);
}

/** Keep overall rank, but force the best option per destination gateway into the top slate. */
function ensureGatewayDiversity(ranked: JourneyItinerary[], limit: number): JourneyItinerary[] {
  if (ranked.length <= 1) return ranked;
  const gateways = ["DED", "DEL", "IXC", "GOI"];
  const out: JourneyItinerary[] = [];
  const used = new Set<string>();

  const push = (it: JourneyItinerary | undefined) => {
    if (!it || used.has(it.id) || out.length >= limit) return;
    out.push(it);
    used.add(it.id);
  };

  // Always keep overall #1
  push(ranked[0]);

  // Then best of each gateway not already present
  for (const g of gateways) {
    if (out.some((i) => i.tags.includes(g))) continue;
    push(ranked.find((i) => i.tags.includes(g)));
  }

  for (const it of ranked) push(it);
  return out;
}

function airportByCode(code: string): TravelPlace | undefined {
  return placeById(
    ({
      PNQ: "apt-pnq",
      BOM: "apt-bom",
      DEL: "apt-del",
      DED: "apt-ded",
      BLR: "apt-blr",
      HYD: "apt-hyd",
      MAA: "apt-maa",
      CCU: "apt-ccu",
      GOI: "apt-goi",
      IXC: "apt-ixc",
    } as Record<string, string>)[code]
  );
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
  const flightCache = new Map<string, LiveFlightOffer[]>();

  const originApt = homeAirport(origin);
  const gates = gatewaysForDestination(destination);
  const cityId = originCityId(origin);

  const destAirports = gates.airports
    .map((id) => placeById(id))
    .filter((p): p is TravelPlace => Boolean(p && p.code));

  // Search live flights: arriveBy day + prior days (wider for thin gateways like DED)
  const windowEnd = dateISO(arriveBy);
  const thinDest = destAirports.some((a) => a.code === "DED" || a.code === "IXC");
  const windowStart = dateISO(addDays(arriveBy, thinDest ? -4 : -3));

  const itineraries: JourneyItinerary[] = [];
  let idx = 0;

  async function offers(oCode: string, dCode: string) {
    const list = await fetchLiveFlightOffers(oCode, dCode, windowStart, windowEnd, token, flightCache);
    return diversifyFlightPicks(list, thinDest || dCode === "DED" ? 14 : 12);
  }

  /** Merge estimated templates when live cache is empty OR too thin for schedule choice. */
  function withEstimatedFallback(
    live: LiveFlightOffer[],
    from: TravelPlace,
    to: TravelPlace,
    templates: { depHour: number; depMin: number; durationMin: number; airline: string; label: string }[]
  ): LiveFlightOffer[] {
    const needFallback = live.length === 0 || (thinDest && live.length < 3);
    if (!needFallback) return live;
    const est = estimatedOffers(from, to, templates);
    if (!est.length) return live;
    if (!live.length) {
      warnings.push(
        `No live ${from.code}→${to.code} in window — using estimated morning/afternoon templates (confirm on airline sites).`
      );
    } else {
      warnings.push(
        `Sparse live ${from.code}→${to.code} (${live.length}) — added estimated extras for schedule coverage.`
      );
    }
    // Prefer live; keep estimates that land in different hour buckets
    const hours = new Set(live.map((f) => Number(f.departureAt.slice(11, 13))));
    const extras = est.filter((f) => !hours.has(Number(f.departureAt.slice(11, 13))));
    return diversifyFlightPicks([...live, ...extras], 14);
  }

  /** Provisional timed legs when live cache is empty for thin ODs (still ranked lower via realityPct). */
  function estimatedOffers(
    from: TravelPlace,
    to: TravelPlace,
    templates: { depHour: number; depMin: number; durationMin: number; airline: string; label: string }[]
  ): LiveFlightOffer[] {
    if (!from.code || !to.code) return [];
    const dist = haversineKm(from, to);
    const out: LiveFlightOffer[] = [];
    for (let dayOff = -4; dayOff <= 0; dayOff++) {
      const day = addDays(arriveBy, dayOff);
      const dayIso = dateISO(day);
      if (dayIso < windowStart || dayIso > windowEnd) continue;
      for (const t of templates) {
        const fare = estimateFlightMarketFare(dist, dayIso, undefined, input.today);
        const pad = (n: number) => String(n).padStart(2, "0");
        out.push({
          origin: from.code!,
          destination: to.code!,
          originAirport: from.code!,
          destinationAirport: to.code!,
          departureAt: `${dayIso}T${pad(t.depHour)}:${pad(t.depMin)}:00+05:30`,
          durationMin: t.durationMin,
          fareInr: fare,
          airline: t.airline,
          flightNumber: t.label,
          transfers: 0,
        });
      }
    }
    return out;
  }

  // —— Direct: home airport → dest gateway airport (live) + last mile ——
  if (originApt?.code) {
    for (const destApt of destAirports) {
      let list = await offers(originApt.code!, destApt.code!);
      if (destApt.code === "DED" || destApt.code === "IXC") {
        list = withEstimatedFallback(list, originApt, destApt, [
          { depHour: 8, depMin: 45, durationMin: 155, airline: "6E", label: "est-am" },
          { depHour: 14, depMin: 30, durationMin: 160, airline: "AI", label: "est-pm" },
        ]);
      }
      for (const offer of list) {
        if (offer.transfers > 1) continue;
        const isEst = String(offer.flightNumber).startsWith("est-");
        const flt = flightLegFromOffer(offer, originApt, destApt, adults, prefs);
        if (isEst) {
          flt.scheduleSource = "estimated";
          flt.costSource = "estimated";
          flt.note = `Estimated typical ${originApt.code}→${destApt.code} — confirm live inventory`;
        }
        const lm = fillLastMile({
          fromPlaceId: destApt.id,
          dest: destination,
          after: flightArriveLocal(offer),
          adults,
          prefs,
        });
        if (!lm) continue;
        const it = buildItineraryFromLegs(
          `j-${idx++}`,
          `${isEst ? "Estimated" : "Direct"} ${offer.airline} ${offer.flightNumber} ${originApt.code}→${destApt.code}`,
          ["direct", "flight", destApt.code!, isEst ? "estimated-flight" : "live-flight"],
          [flt, lm],
          arriveBy,
          input.arriveBy,
          prefs,
          adults
        );
        if (it) itineraries.push(it);
      }
    }
  }

  // —— Via BOM (or other feeder hubs): catalog surface + live hub→dest flight ——
  const hub = placeById("apt-bom");
  if (hub?.code && (cityId === "city-pnq" || origin.city === "Pune")) {
    for (const destApt of destAirports) {
      let list = await offers(hub.code!, destApt.code!);
      if (destApt.code === "DED") {
        list = withEstimatedFallback(list, hub, destApt, [
          { depHour: 8, depMin: 40, durationMin: 140, airline: "6E", label: "est-am" },
          { depHour: 15, depMin: 10, durationMin: 145, airline: "6E", label: "est-pm" },
        ]);
      }
      for (const offer of list) {
        if (offer.transfers > 1) continue;
        const isEst = String(offer.flightNumber).startsWith("est-");
        const feeders = fillFeederBeforeFlight({
          origin,
          hub,
          flightDep: flightDepartLocal(offer),
          adults,
          prefs,
          maxFeeders: 2,
        });
        if (!feeders.length) continue;
        for (const feeder of feeders) {
          if (parseLocalDateTime(feeder.arriveAt) > addMinutes(flightDepartLocal(offer), -120)) continue;
          const flt = flightLegFromOffer(offer, hub, destApt, adults, prefs);
          if (isEst) {
            flt.scheduleSource = "estimated";
            flt.costSource = "estimated";
            flt.note = `Estimated typical BOM→${destApt.code} — confirm live inventory`;
          }
          const lm = fillLastMile({
            fromPlaceId: destApt.id,
            dest: destination,
            after: flightArriveLocal(offer),
            adults,
            prefs,
          });
          if (!lm) continue;
          const it = buildItineraryFromLegs(
            `j-${idx++}`,
            `Via Mumbai · ${feeder.carrier || feeder.mode} + ${offer.airline} ${offer.flightNumber} BOM→${destApt.code}`,
            ["via-hub", "BOM", feeder.mode, destApt.code!, isEst ? "estimated-flight" : "live-flight"],
            [feeder, flt, lm],
            arriveBy,
            input.arriveBy,
            prefs,
            adults
          );
          if (it) itineraries.push(it);
        }
      }
    }
  }

  // —— Fly to Delhi (live) + overnight/day catalog bus to destination (hotel substitute) ——
  if (prefs.allowOvernightAsStay && destination.id === "city-rsh") {
    const delApt = placeById("apt-del");
    const delCity = placeById("city-del");
    if (delApt?.code && delCity) {
      const flightOrigins: TravelPlace[] = [];
      if (originApt) flightOrigins.push(originApt);
      if (hub && hub.id !== originApt?.id) flightOrigins.push(hub);

      for (const fOrig of flightOrigins) {
        if (!fOrig.code) continue;
        const list = await offers(fOrig.code, delApt.code);
        for (const offer of list) {
          if (offer.transfers > 1) continue;
          const feederLegs: JourneyLeg[] = [];
          if (fOrig.id === "apt-bom" && cityId === "city-pnq") {
            const feeders = fillFeederBeforeFlight({
              origin,
              hub: fOrig,
              flightDep: flightDepartLocal(offer),
              adults,
              prefs,
              maxFeeders: 1,
            });
            if (!feeders.length) continue;
            const feeder = feeders[0];
            if (parseLocalDateTime(feeder.arriveAt) > addMinutes(flightDepartLocal(offer), -120)) continue;
            feederLegs.push(feeder);
          } else if (fOrig.id !== originApt?.id) {
            continue;
          }

          const land = flightArriveLocal(offer);
          const busServices = lastMileServices("city-del", "city-rsh").filter(
            (s) => s.overnightSleep || s.id === "del-rsh-day"
          );

          for (const bus of busServices) {
            if (bus.overnightSleep && !prefs.allowOvernightAsStay) continue;
            const earliestBus = addMinutes(land, 150);
            for (const dayOff of [0, 1]) {
              const day = addDays(land, dayOff);
              const { depart, arrive } = scheduleSurfaceOnDay(bus, day, delCity, destination);
              if (depart < earliestBus) continue;
              if (arrive > arriveBy) continue;
              if ((depart.getTime() - land.getTime()) / 3600000 > 10) continue;

              const busLeg = makeLeg({
                id: `bus-${bus.id}-${dateISO(depart)}`,
                mode: bus.mode,
                from: delCity,
                to: destination,
                depart,
                arrive,
                costInr: bus.costInr * adults,
                costSource: "estimated",
                scheduleSource: "catalog",
                note: bus.note,
                carrier: bus.name,
                overnightSleep: bus.overnightSleep,
                prefs,
              });

              const tags = [
                "via-delhi",
                "overnight-bus",
                "DEL",
                fOrig.code || fOrig.id,
                bus.overnightSleep ? "sleep-on-transit" : "day-bus",
                "live-flight",
              ];
              const label = bus.overnightSleep
                ? `${fOrig.code}→DEL live + overnight bus (sleep on board)`
                : `${fOrig.code}→DEL live + day bus to Rishikesh`;

              const it = buildItineraryFromLegs(
                `j-${idx++}`,
                label,
                tags,
                [...feederLegs, flightLegFromOffer(offer, fOrig, delApt, adults, prefs), busLeg],
                arriveBy,
                input.arriveBy,
                prefs,
                adults
              );
              if (it) itineraries.push(it);
            }
          }
        }
      }
    }
  }

  // —— Rail to Delhi + catalog bus to Rishikesh (no flight) ——
  if (destination.id === "city-rsh" && prefs.allowOvernightAsStay) {
    const delCity = placeById("city-del");
    const trains = railToDelhiServices(cityId);
    if (delCity && trains.length) {
      const buses = lastMileServices("city-del", "city-rsh").filter(
        (s) => s.overnightSleep || s.id === "del-rsh-day"
      );
      for (const dayOff of [-3, -2, -1, 0]) {
        const day = addDays(arriveBy, dayOff);
        if (dateISO(day) < windowStart) continue;
        for (const train of trains) {
          const from = placeById(train.fromPlaceId) || origin;
          const toStn = placeById(train.toPlaceId) || delCity;
          const { depart, arrive } = scheduleSurfaceOnDay(train, day, from, toStn);
          if (arrive > arriveBy) continue;
          const trainLeg = makeLeg({
            id: `rail-${train.id}-${dateISO(depart)}`,
            mode: train.mode,
            from,
            to: toStn,
            depart,
            arrive,
            costInr: train.costInr * adults,
            costSource: "estimated",
            scheduleSource: "catalog",
            note: train.note,
            carrier: train.name,
            overnightSleep: train.overnightSleep,
            prefs,
          });
          for (const bus of buses) {
            if (bus.overnightSleep && !prefs.allowOvernightAsStay) continue;
            const earliestBus = addMinutes(arrive, 90); // station → ISBT
            for (const busDayOff of [0, 1]) {
              const busDay = addDays(arrive, busDayOff);
              const sched = scheduleSurfaceOnDay(bus, busDay, delCity, destination);
              if (sched.depart < earliestBus) continue;
              if (sched.arrive > arriveBy) continue;
              if ((sched.depart.getTime() - arrive.getTime()) / 3600000 > 12) continue;
              const busLeg = makeLeg({
                id: `bus-${bus.id}-${dateISO(sched.depart)}`,
                mode: bus.mode,
                from: delCity,
                to: destination,
                depart: sched.depart,
                arrive: sched.arrive,
                costInr: bus.costInr * adults,
                costSource: "estimated",
                scheduleSource: "catalog",
                note: bus.note,
                carrier: bus.name,
                overnightSleep: bus.overnightSleep,
                prefs,
              });
              const it = buildItineraryFromLegs(
                `j-${idx++}`,
                `Train ${train.name} → Delhi + ${bus.overnightSleep ? "overnight" : "day"} bus`,
                [
                  "via-delhi",
                  "rail",
                  "DEL",
                  bus.overnightSleep ? "sleep-on-transit" : "day-bus",
                  "catalog-surface",
                ],
                [trainLeg, busLeg],
                arriveBy,
                input.arriveBy,
                prefs,
                adults
              );
              if (it) itineraries.push(it);
            }
          }
        }
      }
    }
  }

  // Deduplicate similar paths+carrier+day (collapse near-identical rail+bus variants)
  const seen = new Set<string>();
  const unique: JourneyItinerary[] = [];
  for (const it of itineraries) {
    const railish = it.tags.includes("rail");
    const key = railish
      ? `${it.tags.filter((t) => t !== it.id).join("|")}|${it.legs.map((l) => l.carrier).join(">")}|${it.arriveAt.slice(0, 10)}|${Math.round(it.totalCostInr / 200)}`
      : `${it.pathLabel}|${it.legs.map((l) => l.carrier || l.mode).join(">")}|${it.arriveAt.slice(0, 10)}|${Math.round(it.totalCostInr / 300)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(it);
  }

  // Prefer at most 3 rail variants in the final slate so flights aren't crowded out
  const rail = unique.filter((i) => i.tags.includes("rail"));
  const nonRail = unique.filter((i) => !i.tags.includes("rail"));
  const railKept = rankItineraries(rail, prefs).slice(0, 3);
  const merged = [...nonRail, ...railKept];
  const ranked = ensureGatewayDiversity(rankItineraries(merged, prefs), 13);
  const best = ranked[0] ?? null;
  const alternatives = ranked.slice(1, 12);

  if (!best) {
    warnings.push(
      `No verified itinerary found for ${windowStart}→${windowEnd}. Live flight cache only returns recently searched market tickets — try a date within ~2–3 weeks, or use Book trip to search platforms.`
    );
  } else {
    warnings.push(
      "Flights use live market departure times (Travelpayouts/Aviasales cache). Trains/buses use known catalog timetables — confirm IRCTC/RedBus seat availability for your date. All-in includes hotel nights when you arrive early."
    );
  }

  const summary = best
    ? `${origin.city} → ${destination.city} by ${input.arriveBy.replace("T", " ")} · best ${best.pathLabel} · all-in ₹${best.totalCostInr.toLocaleString("en-IN")} (transport ₹${best.transportCostInr.toLocaleString("en-IN")}${best.stayCostInr ? ` + stay ₹${best.stayCostInr.toLocaleString("en-IN")}` : ""}) · sleep ${best.sleepScore}/100 · reality ${best.realityPct}%`
    : `No verified route ${origin.city} → ${destination.city} by ${input.arriveBy}`;

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
