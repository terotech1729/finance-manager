/**
 * Overnight stay costing — hotel nights vs sleep-on-transit (overnight bus/train).
 */
import type { JourneyLeg, JourneyPrefs } from "./types";

export type StayAssessment = {
  nights: number;
  costInr: number;
  placeLabel: string;
  note: string;
  /** True when overnight bus/train replaces a hotel night */
  sleepOnTransit: boolean;
};

const HOTEL_PER_NIGHT: Record<string, number> = {
  Rishikesh: 1800,
  Dehradun: 2000,
  Delhi: 2500,
  Mumbai: 2800,
  Pune: 2200,
  Manali: 2200,
  Goa: 2500,
};

function parseLocal(iso: string): Date {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return new Date(iso);
  const [, y, mo, d, h, mi] = m.map(Number) as number[];
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

function midnightsBetween(start: Date, end: Date): number {
  if (end <= start) return 0;
  const firstMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
  let n = 0;
  for (let t = firstMidnight.getTime(); t <= end.getTime(); t += 86400000) n++;
  return n;
}

function hotelRate(city: string, prefs: JourneyPrefs): number {
  return prefs.hotelBudgetPerNight || HOTEL_PER_NIGHT[city] || 2000;
}

/**
 * Assess lodging between journey end and arriveBy, plus long overnight layovers.
 */
export function assessStay(
  legs: JourneyLeg[],
  arriveByIso: string,
  prefs: JourneyPrefs,
  adults: number
): StayAssessment {
  if (!legs.length || !prefs.includeStayCost) {
    return { nights: 0, costInr: 0, placeLabel: "", note: "", sleepOnTransit: false };
  }

  const arriveBy = parseLocal(arriveByIso);
  const last = legs[legs.length - 1];
  const finalArrive = parseLocal(last.arriveAt);

  const sleepOnTransit = legs.some(
    (l) =>
      (l.mode === "bus" || l.mode === "train") &&
      Boolean(l.overnightSleep) &&
      l.sleepOverlapMin >= 180
  );

  // Destination buffer stay (arrive evening before a dawn deadline)
  let destNights = midnightsBetween(finalArrive, arriveBy);
  // If you arrive after midnight on arriveBy day but before deadline, no hotel
  if (finalArrive.toDateString() === arriveBy.toDateString() && finalArrive <= arriveBy) {
    destNights = 0;
  }
  // Overnight transit that lands on arriveBy morning → no hotel
  if (sleepOnTransit && destNights > 0 && finalArrive <= arriveBy) {
    destNights = 0;
  }

  // Intermediate overnight layovers (e.g. evening in Mumbai before morning flight)
  let layoverNights = 0;
  let layoverCity = "";
  for (let i = 0; i < legs.length - 1; i++) {
    const a = parseLocal(legs[i].arriveAt);
    const b = parseLocal(legs[i + 1].departAt);
    const gapHrs = (b.getTime() - a.getTime()) / 3600000;
    const nights = midnightsBetween(a, b);
    if (gapHrs >= 6 && nights >= 1) {
      layoverNights += nights;
      layoverCity = legs[i].to.city;
    }
  }

  if (sleepOnTransit && destNights === 0 && layoverNights === 0) {
    return {
      nights: 0,
      costInr: 0,
      placeLabel: last.to.city,
      note: "Sleep on overnight transit — no hotel night needed",
      sleepOnTransit: true,
    };
  }

  const nights = destNights + layoverNights;
  if (nights <= 0) {
    return { nights: 0, costInr: 0, placeLabel: "", note: "", sleepOnTransit: false };
  }

  const place = destNights > 0 ? last.to.city : layoverCity || last.to.city;
  const perNight = hotelRate(place, prefs);
  const costInr = perNight * nights * adults;
  const bits: string[] = [];
  if (destNights) bits.push(`${destNights} night(s) in ${last.to.city} before your deadline`);
  if (layoverNights) bits.push(`${layoverNights} layover night(s) in ${layoverCity}`);
  bits.push(`~₹${perNight.toLocaleString("en-IN")}/night`);

  return {
    nights,
    costInr,
    placeLabel: place,
    note: bits.join(" · "),
    sleepOnTransit: false,
  };
}
