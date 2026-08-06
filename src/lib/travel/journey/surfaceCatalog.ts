/**
 * Curated India surface services with typical real timetables.
 * Used only when we cannot invent times — catalog = known daily-ish services.
 * Always confirm on IRCTC / RedBus for the travel date.
 */
import type { JourneyLegMode } from "./types";

export type SurfaceService = {
  id: string;
  mode: Extract<JourneyLegMode, "train" | "bus" | "cab">;
  fromPlaceId: string;
  toPlaceId: string;
  /** HH:mm local */
  departLocal: string;
  /** HH:mm local (may be next day) */
  arriveLocal: string;
  /** true if arriveLocal is next calendar day */
  arrivesNextDay?: boolean;
  durationMin: number;
  costInr: number;
  name: string;
  note: string;
  /** Prefer as intentional overnight sleep substitute */
  overnightSleep?: boolean;
};

export const SURFACE_CATALOG: SurfaceService[] = [
  // —— Pune ↔ Mumbai ——
  {
    id: "pnq-bom-deccan-queen",
    mode: "train",
    fromPlaceId: "stn-pune",
    toPlaceId: "stn-cstm",
    departLocal: "15:15",
    arriveLocal: "18:25",
    durationMin: 190,
    costInr: 505,
    name: "Deccan Queen",
    note: "Pune→CSMT Deccan Queen (typical daily). Confirm IRCTC.",
  },
  {
    id: "pnq-bom-indrayani",
    mode: "train",
    fromPlaceId: "stn-pune",
    toPlaceId: "stn-cstm",
    departLocal: "05:55",
    arriveLocal: "09:05",
    durationMin: 190,
    costInr: 420,
    name: "Indrayani Express",
    note: "Pune→CSMT morning Intercity-style (typical). Confirm IRCTC.",
  },
  {
    id: "pnq-bom-intercity-eve",
    mode: "train",
    fromPlaceId: "stn-pune",
    toPlaceId: "stn-cstm",
    departLocal: "17:55",
    arriveLocal: "21:05",
    durationMin: 190,
    costInr: 420,
    name: "Intercity (eve)",
    note: "Pune→Mumbai evening Intercity (typical). Confirm IRCTC.",
  },
  {
    id: "pnq-bom-cab-flex",
    mode: "cab",
    fromPlaceId: "city-pnq",
    toPlaceId: "apt-bom",
    departLocal: "00:00", // flexible — scheduled relative to flight
    arriveLocal: "03:30",
    durationMin: 210,
    costInr: 3200,
    name: "Cab Pune→BOM",
    note: "Door-to-door cab (~3–3.5 hrs). Flexible timing.",
  },
  {
    id: "pnq-bom-bus-day",
    mode: "bus",
    fromPlaceId: "city-pnq",
    toPlaceId: "city-bom",
    departLocal: "08:00",
    arriveLocal: "12:00",
    durationMin: 240,
    costInr: 600,
    name: "Pune→Mumbai day bus",
    note: "Typical day Volvo/semi — confirm RedBus.",
  },

  // —— Delhi → Rishikesh overnight (hotel substitute) ——
  {
    id: "del-rsh-ovn-2100",
    mode: "bus",
    fromPlaceId: "city-del",
    toPlaceId: "city-rsh",
    departLocal: "21:00",
    arriveLocal: "04:45",
    arrivesNextDay: true,
    durationMin: 465,
    costInr: 1000,
    name: "Overnight Volvo Delhi→Rishikesh (21:00)",
    note: "Earlier overnight — better for ~5am deadlines. Confirm RedBus drop point.",
    overnightSleep: true,
  },
  {
    id: "del-rsh-ovn-2200",
    mode: "bus",
    fromPlaceId: "city-del",
    toPlaceId: "city-rsh",
    departLocal: "22:00",
    arriveLocal: "05:30",
    arrivesNextDay: true,
    durationMin: 450,
    costInr: 950,
    name: "Overnight Volvo Delhi→Rishikesh",
    note: "Typical overnight AC bus; sleep on board, often drops near Rishikesh. Confirm RedBus.",
    overnightSleep: true,
  },
  {
    id: "del-rsh-ovn-2300",
    mode: "bus",
    fromPlaceId: "city-del",
    toPlaceId: "city-rsh",
    departLocal: "23:00",
    arriveLocal: "06:30",
    arrivesNextDay: true,
    durationMin: 450,
    costInr: 900,
    name: "Overnight bus Delhi→Rishikesh (23:00)",
    note: "Typical late overnight. Confirm RedBus for seat + drop point.",
    overnightSleep: true,
  },
  {
    id: "del-rsh-day",
    mode: "bus",
    fromPlaceId: "city-del",
    toPlaceId: "city-rsh",
    departLocal: "09:00",
    arriveLocal: "16:00",
    durationMin: 420,
    costInr: 800,
    name: "Day bus Delhi→Rishikesh",
    note: "Day Volvo typical. Confirm RedBus.",
  },

  // —— Dehradun → Rishikesh ——
  {
    id: "ded-rsh-cab",
    mode: "cab",
    fromPlaceId: "apt-ded",
    toPlaceId: "city-rsh",
    departLocal: "00:00",
    arriveLocal: "01:15",
    durationMin: 75,
    costInr: 1800,
    name: "Cab DED→Rishikesh",
    note: "Airport cab ~45–60 km / ~1–1.5 hrs.",
  },
];

export function catalogByCorridor(fromPlaceId: string, toPlaceId: string): SurfaceService[] {
  return SURFACE_CATALOG.filter((s) => s.fromPlaceId === fromPlaceId && s.toPlaceId === toPlaceId);
}

/** Services that can feed into a hub airport city. */
export function feederServicesToHub(originCityId: string, hubAirportId: string): SurfaceService[] {
  if (originCityId === "city-pnq" && hubAirportId === "apt-bom") {
    return SURFACE_CATALOG.filter((s) =>
      ["pnq-bom-deccan-queen", "pnq-bom-indrayani", "pnq-bom-intercity-eve", "pnq-bom-cab-flex", "pnq-bom-bus-day"].includes(
        s.id
      )
    );
  }
  return [];
}

export function lastMileServices(fromPlaceId: string, destPlaceId: string): SurfaceService[] {
  return SURFACE_CATALOG.filter((s) => s.fromPlaceId === fromPlaceId && s.toPlaceId === destPlaceId);
}
