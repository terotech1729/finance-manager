/**
 * Packs a destination guide into an actual day-by-day plan.
 *
 * The packer groups attractions by zone so a day doesn't criss-cross the map, honours
 * sunrise/sunset timing, and trims by priority when the trip is shorter than the place
 * deserves. Arrival and departure days get whatever hours the journey actually leaves.
 */
import { haversineKm, TRAVEL_PLACES, type TravelPlace } from "../places";
import {
  DESTINATION_GUIDES,
  MONTH_NAMES,
  SLOT_ORDER,
  guideFor,
  monthRangeLabel,
  type Attraction,
  type AttractionKind,
  type DayTrip,
  type DestinationGuide,
  type TimeSlot,
} from "./guides";

export type ItineraryBlock = {
  slot: TimeSlot;
  /** Minutes past local midnight, already de-conflicted against the rest of the day. */
  startMin: number;
  label: string;
  detail?: string;
  minutes: number;
  costInr: number;
  kind: AttractionKind | "travel" | "meal";
};

export type ItineraryDay = {
  index: number;
  date: string;
  title: string;
  blocks: ItineraryBlock[];
  notes: string[];
  /** Per-adult entry/activity cost for the day. */
  costInr: number;
};

export type TripPlan = {
  destination: TravelPlace;
  nights: number;
  days: ItineraryDay[];
  /** "curated" means real attraction data; "generic" is an honest skeleton. */
  coverage: "curated" | "generic";
  vibe: string | null;
  seasonNote: string | null;
  localTransport: string | null;
  /** Per-adult on-ground total: entries plus a daily food/local-transport allowance. */
  estOnGroundInr: number;
  eat: string[];
  tips: string[];
  warnings: string[];
  /** Named but unscheduled — what you'd add with another day. */
  didntFit: string[];
};

export type BuildItineraryInput = {
  destination: TravelPlace;
  nights: number;
  adults?: number;
  /** ISO date of arrival, e.g. "2026-09-24". */
  startDate: string;
  /** "HH:MM" local arrival time — decides how much of day 1 survives. */
  arriveTime?: string;
  /** "HH:MM" local departure time on the last day. */
  departTime?: string;
};

/** A full sightseeing day, in minutes. Anything more and you're describing a forced march. */
const FULL_DAY_MIN = 480;
const DAY_STARTS_AT = 9 * 60;
const DAY_ENDS_AT = 19 * 60;
const DAY_WINDOW_OPENS = 5 * 60;
const DAY_WINDOW_CLOSES = 22 * 60;
/** Checking in and dropping bags before anything else happens. */
const CHECKIN_MIN = 45;

/** When a slot nominally begins. */
const SLOT_NOMINAL: Record<TimeSlot, number> = {
  sunrise: 5 * 60 + 30,
  morning: 9 * 60,
  midday: 12 * 60 + 30,
  afternoon: 14 * 60 + 30,
  sunset: 17 * 60,
  evening: 19 * 60 + 30,
};

/**
 * The latest a slot can still start and mean anything. A "sunrise point" scheduled for
 * 4pm is worse than no plan at all, so anything past its latest start is pushed to
 * another day rather than silently reslotted.
 */
const SLOT_LATEST_START: Record<TimeSlot, number> = {
  sunrise: 7 * 60,
  morning: 11 * 60 + 30,
  midday: 14 * 60,
  afternoon: 16 * 60 + 30,
  sunset: 18 * 60 + 30,
  evening: 21 * 60,
};

function parseHhMm(v: string | undefined, fallback: number): number {
  if (!v) return fallback;
  const m = v.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return fallback;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Local date arithmetic. Going via toISOString shifts IST dates back a day. */
function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatClock(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function monthOf(iso: string): number {
  return Number(iso.slice(5, 7));
}

function priorityOf(a: Attraction): number {
  return a.priority ?? 2;
}

function slotRank(slot: TimeSlot | undefined): number {
  return slot ? SLOT_ORDER.indexOf(slot) : SLOT_ORDER.indexOf("midday");
}

/**
 * Order attractions so the day plan is worth reading: unmissable things first, and within
 * a priority band keep zones together so consecutive picks are near each other.
 */
function orderForPacking(attractions: Attraction[]): Attraction[] {
  const byZone = new Map<string, Attraction[]>();
  for (const a of attractions) {
    const z = a.zone ?? "";
    if (!byZone.has(z)) byZone.set(z, []);
    byZone.get(z)!.push(a);
  }
  // Zones that hold a must-see come first, then by how much there is to do there.
  const zones = [...byZone.entries()].sort((x, y) => {
    const bestX = Math.min(...x[1].map(priorityOf));
    const bestY = Math.min(...y[1].map(priorityOf));
    if (bestX !== bestY) return bestX - bestY;
    return y[1].length - x[1].length;
  });
  return zones.flatMap(([, list]) =>
    [...list].sort((a, b) => priorityOf(a) - priorityOf(b) || slotRank(a.slot) - slotRank(b.slot))
  );
}

function dayTitle(blocks: ItineraryBlock[], zones: string[], fallback: string): string {
  if (zones.length === 1 && zones[0]) return zones[0];
  const anchor = blocks.find((b) => b.kind !== "travel" && b.kind !== "meal");
  return anchor ? anchor.label : fallback;
}

/**
 * Walk a real clock through the day's picks. Anything that can no longer start within its
 * slot is handed back so a later day can use it, which is why this returns both lists.
 */
function scheduleDay(
  picks: Attraction[],
  windowStart: number,
  windowEnd: number
): { blocks: ItineraryBlock[]; rejected: Attraction[] } {
  const ordered = [...picks].sort((a, b) => slotRank(a.slot) - slotRank(b.slot));
  const blocks: ItineraryBlock[] = [];
  const rejected: Attraction[] = [];
  let clock = windowStart;
  // A day that only starts in the evening has no lunch to break for.
  let lunched = windowStart > 12 * 60 + 30;

  for (const a of ordered) {
    const slot = a.slot ?? "morning";
    let start = Math.max(clock, SLOT_NOMINAL[slot]);

    // Slip a lunch break in before the first thing that runs past early afternoon. If the
    // morning already ran long there's no lunch hour left to protect, so let it go.
    if (!lunched && start >= 13 * 60 && blocks.length > 0 && start + a.minutes <= windowEnd) {
      const lunchStart = Math.max(clock, 12 * 60 + 30);
      if (lunchStart > 14 * 60) {
        lunched = true;
      } else if (lunchStart + 60 <= start) {
        blocks.push({ slot: "midday", startMin: lunchStart, label: "Lunch break", minutes: 60, costInr: 0, kind: "meal" });
      } else {
        blocks.push({ slot: "midday", startMin: clock, label: "Lunch break", minutes: 60, costInr: 0, kind: "meal" });
        clock += 60;
        start = Math.max(clock, SLOT_NOMINAL[slot]);
      }
      lunched = true;
    }

    if (start > SLOT_LATEST_START[slot] || start + a.minutes > windowEnd) {
      rejected.push(a);
      continue;
    }
    blocks.push({
      slot,
      startMin: start,
      label: a.name,
      detail: a.note,
      minutes: a.minutes,
      costInr: a.costInr ?? 0,
      kind: a.kind,
    });
    // A little slack between stops for getting there and eating.
    clock = start + a.minutes + 20;
  }

  return { blocks: blocks.sort((x, y) => x.startMin - y.startMin), rejected };
}

/**
 * Generic skeleton for a destination we have no guide for. Deliberately vague about
 * specifics — inventing attraction names for 400 towns would produce confident nonsense —
 * but still shaped like a usable plan, and it names real neighbours for day trips.
 */
function genericAttractions(dest: TravelPlace): Attraction[] {
  const near = nearbyGuidedPlaces(dest, 3);
  const base: Attraction[] = [
    {
      name: `Orient yourself in ${dest.city}`,
      kind: "sight",
      minutes: 150,
      zone: "Town centre",
      slot: "morning",
      priority: 1,
      note: "Main bazaar, the older quarter and whatever the central landmark is — ask your host what's actually worth the time.",
    },
    {
      name: "Principal temple / fort / landmark",
      kind: "sight",
      minutes: 120,
      zone: "Town centre",
      slot: "morning",
      priority: 1,
    },
    {
      name: "Local market & street food",
      kind: "market",
      minutes: 120,
      zone: "Town centre",
      slot: "evening",
      priority: 2,
    },
    {
      name: "Best nearby viewpoint at sunset",
      kind: "viewpoint",
      minutes: 120,
      zone: "Outskirts",
      slot: "sunset",
      priority: 1,
    },
    {
      name: "Lake / river / green space on the edge of town",
      kind: "nature",
      minutes: 150,
      zone: "Outskirts",
      slot: "afternoon",
      priority: 2,
    },
    {
      name: "Regional museum or heritage house",
      kind: "museum",
      minutes: 90,
      zone: "Town centre",
      priority: 3,
    },
  ];
  for (const n of near) {
    base.push({
      name: `Day trip to ${n.place.city}`,
      kind: "sight",
      minutes: 360,
      zone: `Around ${dest.city}`,
      slot: "morning",
      priority: 3,
      note: `About ${Math.round(n.km)} km away — ${n.guide.vibe}`,
    });
  }
  return base;
}

/** Guided destinations close enough to suggest as a day trip. */
function nearbyGuidedPlaces(dest: TravelPlace, limit: number) {
  return DESTINATION_GUIDES.map((guide) => {
    const place = TRAVEL_PLACES.find((p) => p.id === guide.placeId);
    return place && place.id !== dest.id ? { guide, place, km: haversineKm(dest, place) } : null;
  })
    .filter((x): x is { guide: DestinationGuide; place: TravelPlace; km: number } => !!x && x.km < 130)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

function seasonNote(guide: DestinationGuide, startDate: string): string | null {
  const m = monthOf(startDate);
  const best = monthRangeLabel(guide.bestMonths);
  if (guide.avoidMonths?.includes(m)) {
    return `${MONTH_NAMES[m - 1]} is a month to avoid here. ${guide.avoidNote ?? ""} Best window is ${best}.`.trim();
  }
  if (guide.bestMonths.includes(m)) return `${MONTH_NAMES[m - 1]} is in the good window (${best}).`;
  return `${MONTH_NAMES[m - 1]} is shoulder season — workable, but the sweet spot is ${best}.`;
}

export function buildItinerary(input: BuildItineraryInput): TripPlan {
  const { destination, startDate } = input;
  const nights = Math.max(0, Math.min(21, Math.round(input.nights)));
  const adults = Math.max(1, input.adults ?? 1);
  const guide = guideFor(destination.id);
  const coverage: "curated" | "generic" = guide ? "curated" : "generic";

  const warnings: string[] = [];
  const totalDays = nights + 1;

  // How much of the first and last day the journey actually leaves you.
  const arriveMin = parseHhMm(input.arriveTime, DAY_STARTS_AT);
  const departMin = parseHhMm(input.departTime, DAY_ENDS_AT);
  const firstDayBudget = Math.max(0, Math.min(FULL_DAY_MIN, DAY_ENDS_AT - Math.max(arriveMin, DAY_STARTS_AT)));
  const lastDayBudget =
    totalDays === 1
      ? Math.max(0, Math.min(firstDayBudget, departMin - Math.max(arriveMin, DAY_STARTS_AT)))
      : Math.max(0, Math.min(FULL_DAY_MIN, departMin - DAY_STARTS_AT));

  const attractions = guide ? [...guide.attractions] : genericAttractions(destination);
  const dayTrips: DayTrip[] = guide?.dayTrips ?? [];

  if (guide && nights < guide.minNights) {
    warnings.push(
      `${destination.city} really wants ${guide.minNights}${guide.idealNights > guide.minNights ? `–${guide.idealNights}` : ""} nights; at ${nights} you'll be cutting the best of it.`
    );
  }

  const ordered = orderForPacking(attractions);
  const queue = [...ordered];
  const days: ItineraryDay[] = [];
  const usedDayTrips: DayTrip[] = [];
  const tripPool = [...dayTrips];

  for (let i = 0; i < totalDays; i++) {
    const isFirst = i === 0;
    const isLast = i === totalDays - 1;
    let budget = FULL_DAY_MIN;
    if (isFirst) budget = Math.min(budget, firstDayBudget);
    if (isLast) budget = Math.min(budget, lastDayBudget);

    const date = addDaysIso(startDate, i);
    const notes: string[] = [];
    const zones = new Set<string>();

    // The hours the day can actually occupy, as distinct from how many of them you'd
    // want to spend sightseeing.
    const windowStart = isFirst ? Math.max(DAY_WINDOW_OPENS, arriveMin + CHECKIN_MIN) : DAY_WINDOW_OPENS;
    const windowEnd = isLast && totalDays > 1 ? Math.min(DAY_WINDOW_CLOSES, departMin) : DAY_WINDOW_CLOSES;

    if (isFirst) {
      notes.push(
        budget <= 0
          ? "You arrive too late to do anything — treat today as travel and check-in only."
          : `Arrive around ${formatClock(arriveMin)}, check in, then about ${Math.round(budget / 60)} usable hours.`
      );
    }
    if (isLast && totalDays > 1) {
      notes.push(`Checkout day — everything here has to finish by ${formatClock(departMin)}.`);
    }

    // A middle day with nothing but a long day trip left is a better day than three
    // leftovers, so spend day trips once the headline attractions are gone.
    const wantsDayTrip =
      !isFirst && !isLast && tripPool.length > 0 && queue.filter((a) => priorityOf(a) <= 2).length === 0;

    let blocks: ItineraryBlock[] = [];

    const tripStart = Math.max(windowStart, SLOT_NOMINAL.morning);
    // Some listed "day trips" (Lachung from Gangtok) are really overnights. Take the first
    // one that genuinely fits the day and leave oversized ones in the not-scheduled list
    // with their note, rather than drawing a block that runs past midnight.
    const tripIdx = tripPool.findIndex((t) => tripStart + Math.round(t.hours * 60) <= windowEnd);

    if (wantsDayTrip && tripIdx !== -1) {
      const [trip] = tripPool.splice(tripIdx, 1);
      usedDayTrips.push(trip);
      blocks = [
        {
          slot: "morning",
          startMin: tripStart,
          label: `Day trip — ${trip.name}`,
          detail: trip.note,
          minutes: Math.round(trip.hours * 60),
          costInr: trip.costInr ?? 0,
          kind: "travel",
        },
      ];
      zones.add(trip.name);
    } else {
      const picks: Attraction[] = [];
      // Things that can't work today but might tomorrow — a sunrise point when you landed
      // at 4pm. Held aside so the day keeps filling instead of ending early.
      const deferred: Attraction[] = [];
      let remaining = budget;
      let currentZone: string | null = null;
      let guard = 0;
      while (remaining > 0 && queue.length > 0 && guard++ < 60) {
        // Prefer staying in the zone we already started, then fall back to anything that fits.
        let idx = queue.findIndex((a) => (a.zone ?? "") === currentZone && a.minutes <= remaining);
        if (idx === -1) idx = queue.findIndex((a) => a.minutes <= remaining);
        if (idx === -1) break;
        const [picked] = queue.splice(idx, 1);
        // Only keep the pick if the whole day still schedules cleanly with it added.
        if (scheduleDay([...picks, picked], windowStart, windowEnd).rejected.length > 0) {
          deferred.push(picked);
          continue;
        }
        picks.push(picked);
        if (picked.zone) zones.add(picked.zone);
        currentZone = picked.zone ?? currentZone;
        remaining -= picked.minutes;
      }
      blocks = scheduleDay(picks, windowStart, windowEnd).blocks;
      queue.unshift(...deferred);
    }

    const costInr = blocks.reduce((s, b) => s + b.costInr, 0);
    days.push({
      index: i + 1,
      date,
      title: blocks.length === 0 ? (isFirst ? "Arrival" : "Departure") : dayTitle(blocks, [...zones], isLast ? "Departure" : "Free day"),
      blocks,
      notes,
      costInr,
    });
  }

  const entries = days.reduce((s, d) => s + d.costInr, 0);
  const daily = guide?.dailyBudgetInr ?? 1500;
  const estOnGroundInr = Math.round((entries + daily * totalDays) * adults);

  const didntFit = [...queue.map((a) => a.name), ...tripPool.map((d) => `Day trip — ${d.name}`)];

  if (coverage === "generic") {
    warnings.push(
      `No curated guide for ${destination.city} yet, so this is a shaped outline rather than named sights — the routing, nights and seasonality above are still real.`
    );
  }

  return {
    destination,
    nights,
    days,
    coverage,
    vibe: guide?.vibe ?? null,
    seasonNote: guide ? seasonNote(guide, startDate) : null,
    localTransport: guide?.localTransport ?? null,
    estOnGroundInr,
    eat: guide?.eat ?? [],
    tips: guide?.tips ?? [],
    warnings,
    didntFit,
  };
}

/** Suggested nights for a destination, for prefilling the form. */
export function suggestedNights(placeId: string): number {
  return guideFor(placeId)?.idealNights ?? 2;
}
