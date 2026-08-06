/** Multi-leg “reach by” journey planner types. */

import type { TravelMode } from "../types";
import type { TravelPlace } from "../places";

export type JourneyLegMode = TravelMode | "cab" | "metro";

export type JourneyLeg = {
  id: string;
  mode: JourneyLegMode;
  from: TravelPlace;
  to: TravelPlace;
  /** Local depart ISO datetime */
  departAt: string;
  /** Local arrive ISO datetime */
  arriveAt: string;
  durationMin: number;
  /** Estimated all-in ₹ for this leg (1 adult) */
  costInr: number;
  costSource: "live" | "estimated";
  note?: string;
  /** Minutes overlapping preferred sleep window */
  sleepOverlapMin: number;
};

export type JourneyItinerary = {
  id: string;
  label: string;
  /** Short path like PNQ → BOM → DED → Rishikesh */
  pathLabel: string;
  legs: JourneyLeg[];
  totalCostInr: number;
  totalDurationMin: number;
  departAt: string;
  arriveAt: string;
  /** 0 = wrecks sleep, 100 = fully protects sleep window */
  sleepScore: number;
  sleepOverlapMin: number;
  /** Composite rank score (higher = better) */
  score: number;
  why: string[];
  warnings: string[];
  /** Tree node tags for UI */
  tags: string[];
};

export type JourneyPrefs = {
  /** Prefer not to travel during this local window (default 23:00–06:00) */
  sleepStartHour: number; // 23
  sleepEndHour: number; // 6
  /** Soft cap on total door-to-door hours */
  maxDurationHrs: number;
  /** Weight 0–1: higher = prefer cheaper */
  costWeight: number;
  /** Weight 0–1: higher = prefer faster */
  timeWeight: number;
  /** Weight 0–1: higher = protect sleep */
  sleepWeight: number;
  /** Avoid overnight trains/buses when true */
  avoidOvernightSurface: boolean;
};

export type JourneyPlanInput = {
  /** Home / start city place id or free text (default Pune) */
  origin: string;
  /** Destination city (e.g. Rishikesh) */
  destination: string;
  /** Must arrive by this local datetime ISO (YYYY-MM-DDTHH:mm) */
  arriveBy: string;
  adults?: number;
  prefs?: Partial<JourneyPrefs>;
  today?: string;
};

export type JourneyPlanResult = {
  origin: TravelPlace;
  destination: TravelPlace;
  arriveBy: string;
  prefs: JourneyPrefs;
  best: JourneyItinerary | null;
  alternatives: JourneyItinerary[];
  summary: string;
  warnings: string[];
};
