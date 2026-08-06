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
  type LiveFlightOffer,
} from "./liveFlights";
import { assessStay } from "./stay";
import {
  feederServicesToHub,
  lastMileServices,
  type SurfaceService,
} from "./surfaceCatalog";
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
}): JourneyLeg | null {
  const cityId = originCityId(opts.origin);
  const services = feederServicesToHub(cityId, opts.hub.id);
  if (!services.length) return null;

  const airportBufferMin = 150;
  const needArriveHubBy = addMinutes(opts.flightDep, -airportBufferMin);

  type Cand = { svc: SurfaceService; depart: Date; arrive: Date; score: number };
  const cands: Cand[] = [];

  for (const svc of services) {
    if (opts.preferModes && !opts.preferModes.includes(svc.mode as "train" | "bus" | "cab")) continue;

    if (svc.mode === "cab" && svc.id.includes("flex")) {
      const arrive = needArriveHubBy;
      const depart = addMinutes(arrive, -svc.durationMin);
      if (depart.getTime() > Date.now() - 86400000 * 400) {
        cands.push({ svc, depart, arrive, score: svc.costInr + 800 }); // cab pricier
      }
      continue;
    }

    // Try same calendar day as flight, and day before
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
      if (slackMin > 14 * 60) continue; // too early — would need Mumbai hotel (handled separately if gap large)
      const score = svc.costInr + slackMin * 0.5;
      cands.push({ svc, depart, arrive, score });
    }
  }

  if (!cands.length) return null;
  cands.sort((a, b) => a.score - b.score);
  const best = cands[0];
  const from = placeById(best.svc.fromPlaceId) || opts.origin;
  const to = placeById(best.svc.toPlaceId) || opts.hub;
  return makeLeg({
    id: `feeder-${best.svc.id}`,
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
    opts.fromPlaceId === "apt-ded" ? 75 : opts.fromPlaceId === "apt-del" ? 360 : 90;
  const fallbackCost =
    opts.fromPlaceId === "apt-ded" ? 1800 : opts.fromPlaceId === "apt-del" ? 5500 : 1200;

  if (services.length) {
    // Prefer cab right after landing (flexible)
    const cab = services.find((s) => s.mode === "cab") || services[0];
    const depart = addMinutes(opts.after, 30); // baggage / exit
    const arrive = addMinutes(depart, cab.durationMin);
    const from = placeById(cab.fromPlaceId) || placeById(opts.fromPlaceId)!;
    return makeLeg({
      id: `lm-${cab.id}`,
      mode: cab.mode,
      from,
      to: opts.dest,
      depart,
      arrive,
      costInr: cab.costInr * opts.adults,
      costSource: "estimated",
      scheduleSource: cab.mode === "cab" ? "estimated" : "catalog",
      note: cab.note,
      carrier: cab.name,
      prefs: opts.prefs,
    });
  }

  const from = placeById(opts.fromPlaceId);
  if (!from) return null;
  const depart = addMinutes(opts.after, 30);
  return makeLeg({
    id: `lm-${opts.fromPlaceId}`,
    mode: "cab",
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
    it.score = Math.round(score * 10) / 10;
  }

  return items.sort((a, b) => b.score - a.score || a.totalCostInr - b.totalCostInr);
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

  // Search live flights in a window: 2 days before arriveBy through arriveBy day
  const windowEnd = dateISO(arriveBy);
  const windowStart = dateISO(addDays(arriveBy, -2));

  const destAirports = gates.airports
    .map((id) => placeById(id))
    .filter((p): p is TravelPlace => Boolean(p && p.code));

  const itineraries: JourneyItinerary[] = [];
  let idx = 0;

  async function offers(oCode: string, dCode: string) {
    return fetchLiveFlightOffers(oCode, dCode, windowStart, windowEnd, token, flightCache);
  }

  // —— Direct: home airport → dest gateway airport (live) + last mile ——
  if (originApt?.code) {
    for (const destApt of destAirports) {
      const list = await offers(originApt.code!, destApt.code!);
      for (const offer of list.slice(0, 8)) {
        if (offer.transfers > 1) continue;
        const flt = flightLegFromOffer(offer, originApt, destApt, adults, prefs);
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
          `Direct ${offer.airline} ${offer.flightNumber} ${originApt.code}→${destApt.code}`,
          ["direct", "flight", destApt.code!, "live-flight"],
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
      const list = await offers(hub.code!, destApt.code!);
      for (const offer of list.slice(0, 8)) {
        if (offer.transfers > 1) continue;
        const feeder = fillFeederBeforeFlight({
          origin,
          hub,
          flightDep: flightDepartLocal(offer),
          adults,
          prefs,
        });
        if (!feeder) continue;
        const flt = flightLegFromOffer(offer, hub, destApt, adults, prefs);
        // Ensure feeder arrives before flight with buffer
        if (parseLocalDateTime(feeder.arriveAt) > addMinutes(flightDepartLocal(offer), -120)) continue;
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
          `Via Mumbai · ${feeder.carrier || feeder.mode} + ${offer.airline} ${offer.flightNumber}`,
          ["via-hub", "BOM", feeder.mode, destApt.code!, "live-flight"],
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
        for (const offer of list.slice(0, 6)) {
          const legs: JourneyLeg[] = [];
          // Optional feeder if flying from BOM via Pune
          if (fOrig.id === "apt-bom" && cityId === "city-pnq") {
            const feeder = fillFeederBeforeFlight({
              origin,
              hub: fOrig,
              flightDep: flightDepartLocal(offer),
              adults,
              prefs,
            });
            if (!feeder) continue;
            if (parseLocalDateTime(feeder.arriveAt) > addMinutes(flightDepartLocal(offer), -120))
              continue;
            legs.push(feeder);
          } else if (fOrig.id !== originApt?.id) {
            continue;
          }

          legs.push(flightLegFromOffer(offer, fOrig, delApt, adults, prefs));

          // Airport → city buffer before bus
          const land = flightArriveLocal(offer);
          const busServices = lastMileServices("city-del", "city-rsh").filter(
            (s) => s.overnightSleep || s.id === "del-rsh-day"
          );

          for (const bus of busServices) {
            if (bus.overnightSleep && !prefs.allowOvernightAsStay) continue;
            // Bus must depart after landing + 2.5h (airport→ISBT)
            const earliestBus = addMinutes(land, 150);
            // Try bus on landing day and next day
            for (const dayOff of [0, 1]) {
              const day = addDays(land, dayOff);
              const { depart, arrive } = scheduleSurfaceOnDay(bus, day, delCity, destination);
              if (depart < earliestBus) continue;
              if (arrive > arriveBy) continue;
              // Don't wait more than ~10h for the bus
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
                [...legs, busLeg],
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

  // Deduplicate similar paths+carrier+day
  const seen = new Set<string>();
  const unique: JourneyItinerary[] = [];
  for (const it of itineraries) {
    const key = `${it.pathLabel}|${it.legs.map((l) => l.carrier || l.mode).join(">")}|${it.arriveAt.slice(0, 10)}|${Math.round(it.totalCostInr / 300)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(it);
  }

  const ranked = rankItineraries(unique, prefs);
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
