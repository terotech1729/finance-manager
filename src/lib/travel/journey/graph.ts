/**
 * Hub + gateway graph for multi-leg India journeys.
 * Destinations map to nearby flight/rail gateways; origins expand to local hubs.
 */
import { TRAVEL_PLACES, haversineKm, resolvePlace, type TravelPlace } from "../places";

/** Major flight hubs we consider as connection nodes. */
export const FLIGHT_HUB_CODES = ["BOM", "DEL", "BLR", "HYD", "MAA", "AMD", "CCU", "PNQ"] as const;

/** City id → preferred gateways (airports / stations / cities for last-mile). */
export type DestinationGateways = {
  airports: string[]; // place ids
  stations: string[];
  /** Typical last-mile ground from gateway city → destination (min, ₹ est.) */
  lastMile: { fromPlaceId: string; mode: "cab" | "bus"; durationMin: number; costInr: number; note: string }[];
};

export const DESTINATION_GATEWAYS: Record<string, DestinationGateways> = {
  "city-rsh": {
    airports: ["apt-ded", "apt-del"],
    stations: ["stn-ndls", "stn-nzm"],
    lastMile: [
      {
        fromPlaceId: "apt-ded",
        mode: "bus",
        durationMin: 70,
        costInr: 400,
        note: "Bus / shared cab Dehradun airport → Rishikesh (~1 hr)",
      },
      {
        fromPlaceId: "apt-ded",
        mode: "cab",
        durationMin: 75,
        costInr: 1800,
        note: "Private cab Dehradun airport → Rishikesh (~45–60 km)",
      },
      {
        fromPlaceId: "apt-del",
        mode: "cab",
        durationMin: 360,
        costInr: 5500,
        note: "Cab Delhi airport → Rishikesh (~6 hrs) — long last mile",
      },
      {
        fromPlaceId: "city-del",
        mode: "bus",
        durationMin: 420,
        costInr: 900,
        note: "Overnight/day bus Delhi → Rishikesh",
      },
    ],
  },
  "city-man": {
    airports: ["apt-ixc", "apt-del"],
    stations: ["stn-ndls"],
    lastMile: [
      { fromPlaceId: "apt-ixc", mode: "cab", durationMin: 420, costInr: 4500, note: "Cab Chandigarh → Manali" },
      { fromPlaceId: "apt-del", mode: "bus", durationMin: 720, costInr: 1500, note: "Bus Delhi → Manali" },
    ],
  },
  "city-goa": {
    airports: ["apt-goi"],
    stations: ["stn-mao"],
    lastMile: [
      { fromPlaceId: "apt-goi", mode: "cab", durationMin: 60, costInr: 1200, note: "Airport → North/South Goa" },
    ],
  },
};

/** Nearby mega-hubs for a home city — used as “fly from cheaper airport” nodes. */
export const ORIGIN_FEEDER_HUBS: Record<string, { hubAirportId: string; surface: { mode: "cab" | "train" | "bus"; durationMin: number; costInr: number; note: string }[] }[]> = {
  "city-pnq": [
    {
      hubAirportId: "apt-bom",
      surface: [
        { mode: "cab", durationMin: 210, costInr: 3200, note: "Cab Pune → BOM (3–4 hrs)" },
        { mode: "train", durationMin: 210, costInr: 450, note: "Intercity/Deccan Queen style Pune → Mumbai" },
        { mode: "bus", durationMin: 240, costInr: 600, note: "Pune → Mumbai bus" },
      ],
    },
  ],
  "apt-pnq": [
    {
      hubAirportId: "apt-bom",
      surface: [
        { mode: "cab", durationMin: 210, costInr: 3200, note: "Cab Pune → BOM" },
        { mode: "train", durationMin: 210, costInr: 450, note: "Train Pune → Mumbai" },
      ],
    },
  ],
};

export function placeById(id: string): TravelPlace | undefined {
  return TRAVEL_PLACES.find((p) => p.id === id);
}

export function airportByCode(code: string): TravelPlace | undefined {
  return TRAVEL_PLACES.find((p) => p.kind === "airport" && p.code === code);
}

/** Resolve user origin/destination to a city-level place when possible. */
export function resolveJourneyPlace(input: string): TravelPlace | null {
  const raw = input.trim();
  if (!raw) return null;
  const byId = placeById(raw);
  if (byId) return byId;
  // Prefer city matches for journey planning
  for (const mode of ["bus", "flight", "train"] as const) {
    const p = resolvePlace(raw, mode);
    if (p) {
      if (p.kind === "city") return p;
      const city = TRAVEL_PLACES.find((x) => x.kind === "city" && x.city === p.city);
      return city ?? p;
    }
  }
  return null;
}

export function nearestAirports(place: TravelPlace, limit = 4): TravelPlace[] {
  return TRAVEL_PLACES.filter((p) => p.kind === "airport")
    .map((p) => ({ p, d: haversineKm(place, p) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.p);
}

export function gatewaysForDestination(dest: TravelPlace): DestinationGateways {
  const mapped = DESTINATION_GATEWAYS[dest.id];
  if (mapped) return mapped;
  const near = nearestAirports(dest, 3);
  return {
    airports: near.map((a) => a.id),
    stations: [],
    lastMile: near.slice(0, 1).map((a) => ({
      fromPlaceId: a.id,
      mode: "cab" as const,
      durationMin: Math.max(40, Math.round(haversineKm(a, dest) * 2.2)),
      costInr: Math.max(400, Math.round(haversineKm(a, dest) * 28)),
      note: `Cab ${a.city} airport → ${dest.city}`,
    })),
  };
}

export function originCityId(origin: TravelPlace): string {
  if (origin.kind === "city") return origin.id;
  const city = TRAVEL_PLACES.find((p) => p.kind === "city" && p.city === origin.city);
  return city?.id ?? origin.id;
}
