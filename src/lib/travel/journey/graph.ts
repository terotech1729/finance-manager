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

/**
 * Compact gateway spec. Hill and island destinations are where the generic
 * straight-line estimate is worst — Pantnagar to Nainital is 39 km as the crow flies but
 * 70 km of switchbacks — so the ones people actually search carry measured road times.
 */
function gw(
  airports: string[],
  stations: string[],
  lastMile: [from: string, mode: "cab" | "bus", durationMin: number, costInr: number, note: string][]
): DestinationGateways {
  return {
    airports,
    stations,
    lastMile: lastMile.map(([fromPlaceId, mode, durationMin, costInr, note]) => ({
      fromPlaceId,
      mode,
      durationMin,
      costInr,
      note,
    })),
  };
}

export const DESTINATION_GATEWAYS: Record<string, DestinationGateways> = {
  // —— Uttarakhand ——
  "dst-nainital": gw(
    ["apt-pgh", "apt-ded", "apt-del"],
    ["stn-ktgn", "stn-ndls"],
    [
      ["stn-ktgn", "cab", 75, 1400, "Cab Kathgodam railhead → Nainital (35 km of ghat road)"],
      ["stn-ktgn", "bus", 105, 120, "State bus / shared jeep Kathgodam → Nainital"],
      ["apt-pgh", "cab", 120, 2300, "Cab Pantnagar airport → Nainital (~70 km, 2 hrs)"],
      ["apt-del", "cab", 420, 7000, "Cab Delhi → Nainital (~320 km) — long haul"],
    ]
  ),
  "dst-bhimtal": gw(["apt-pgh"], ["stn-ktgn"], [["stn-ktgn", "cab", 55, 1100, "Cab Kathgodam → Bhimtal (~22 km)"]]),
  "dst-mukteshwar": gw(["apt-pgh"], ["stn-ktgn"], [["stn-ktgn", "cab", 135, 2400, "Cab Kathgodam → Mukteshwar (~65 km)"]]),
  "dst-almora": gw(["apt-pgh"], ["stn-ktgn"], [["stn-ktgn", "cab", 150, 2400, "Cab Kathgodam → Almora (~85 km)"]]),
  "dst-ranikhet": gw(["apt-pgh"], ["stn-ktgn"], [["stn-ktgn", "cab", 150, 2400, "Cab Kathgodam → Ranikhet (~80 km)"]]),
  "dst-kausani": gw(["apt-pgh"], ["stn-ktgn"], [["stn-ktgn", "cab", 210, 3200, "Cab Kathgodam → Kausani (~115 km)"]]),
  "dst-corbett": gw(
    ["apt-pgh", "apt-del"],
    ["stn-rmr", "stn-ndls"],
    [
      ["stn-rmr", "cab", 20, 400, "Ramnagar railhead → Corbett resorts / Dhikala gate"],
      ["apt-pgh", "cab", 135, 2600, "Cab Pantnagar → Ramnagar (~85 km)"],
      ["apt-del", "cab", 330, 6000, "Cab Delhi → Ramnagar (~245 km)"],
    ]
  ),
  "dst-mussoorie": gw(
    ["apt-ded", "apt-del"],
    ["stn-ddn", "stn-hw"],
    [
      ["apt-ded", "cab", 90, 1800, "Cab Jolly Grant airport → Mussoorie (~60 km)"],
      ["stn-ddn", "cab", 60, 1300, "Cab Dehradun station → Mussoorie (~35 km of ghat)"],
      ["stn-ddn", "bus", 90, 100, "State bus Dehradun → Mussoorie"],
    ]
  ),
  "dst-haridwar": gw(["apt-ded"], ["stn-hw"], [["apt-ded", "cab", 60, 1400, "Cab Jolly Grant → Haridwar (~35 km)"]]),
  "dst-auli": gw(
    ["apt-ded"],
    ["stn-ynrk", "stn-hw"],
    [
      ["stn-ynrk", "cab", 540, 7500, "Cab Rishikesh → Joshimath/Auli (~250 km, full day on NH7)"],
      ["apt-ded", "cab", 570, 8500, "Cab Dehradun → Auli — start at dawn, hill road closes after dark"],
    ]
  ),
  "dst-joshimath": gw(["apt-ded"], ["stn-ynrk"], [["stn-ynrk", "cab", 510, 7000, "Cab Rishikesh → Joshimath (~250 km)"]]),
  "dst-chopta": gw(["apt-ded"], ["stn-ynrk"], [["stn-ynrk", "cab", 390, 5500, "Cab Rishikesh → Chopta (~165 km)"]]),

  // —— Himachal ——
  "dst-mcleodganj": gw(
    ["apt-dhm", "apt-ixc"],
    [],
    [
      ["apt-dhm", "cab", 45, 900, "Cab Gaggal airport → McLeodganj (~20 km)"],
      ["apt-ixc", "cab", 300, 5000, "Cab Chandigarh → McLeodganj (~250 km)"],
    ]
  ),
  "dst-dharamshala": gw(["apt-dhm", "apt-ixc"], [], [["apt-dhm", "cab", 35, 800, "Cab Gaggal airport → Dharamshala (~15 km)"]]),
  "dst-kasol": gw(
    ["apt-kuu", "apt-ixc"],
    [],
    [
      ["apt-kuu", "cab", 60, 1200, "Cab Bhuntar airport → Kasol (~30 km up Parvati valley)"],
      ["apt-ixc", "cab", 480, 7000, "Cab Chandigarh → Kasol (~280 km)"],
    ]
  ),
  "dst-birbilling": gw(["apt-dhm"], [], [["apt-dhm", "cab", 90, 1800, "Cab Gaggal → Bir (~65 km)"]]),
  "dst-kaza": gw(
    ["apt-kuu", "apt-slv"],
    [],
    [
      ["apt-kuu", "cab", 540, 9000, "Cab Bhuntar → Kaza over Kunzum La (~200 km) — summer only, Jun–Oct"],
      ["apt-slv", "cab", 780, 12000, "Cab Shimla → Kaza via Kinnaur (~420 km, 2 days) — the all-season route"],
    ]
  ),
  "dst-tirthan": gw(["apt-kuu"], [], [["apt-kuu", "cab", 120, 2200, "Cab Bhuntar → Jibhi / Tirthan (~60 km)"]]),

  // —— Kashmir & Ladakh ——
  "dst-gulmarg": gw(["apt-sxr"], [], [["apt-sxr", "cab", 105, 2000, "Cab Srinagar airport → Gulmarg (~50 km)"]]),
  "dst-pahalgam": gw(["apt-sxr"], [], [["apt-sxr", "cab", 150, 2500, "Cab Srinagar airport → Pahalgam (~90 km)"]]),
  "dst-leh": gw(["apt-ixl"], [], [["apt-ixl", "cab", 20, 500, "Leh airport → town (~8 km)"]]),
  "dst-nubra": gw(["apt-ixl"], [], [["apt-ixl", "cab", 300, 6000, "Cab Leh → Nubra over Khardung La (~120 km) — acclimatise in Leh first"]]),
  "dst-pangong": gw(["apt-ixl"], [], [["apt-ixl", "cab", 300, 6500, "Cab Leh → Pangong Tso (~220 km) — inner-line permit needed"]]),

  // —— North-East & Sikkim ——
  "dst-darjeeling": gw(
    ["apt-ixb"],
    ["stn-njp"],
    [
      ["stn-njp", "cab", 180, 2200, "Shared/private cab NJP → Darjeeling (~70 km of hill road)"],
      ["apt-ixb", "cab", 195, 2600, "Cab Bagdogra → Darjeeling (~70 km)"],
    ]
  ),
  "dst-gangtok": gw(
    ["apt-pyg", "apt-ixb"],
    ["stn-njp"],
    [
      ["apt-pyg", "cab", 60, 1200, "Cab Pakyong airport → Gangtok (~30 km)"],
      ["stn-njp", "cab", 240, 3000, "Shared cab NJP → Gangtok (~115 km)"],
      ["apt-ixb", "cab", 270, 3500, "Cab Bagdogra → Gangtok (~125 km)"],
    ]
  ),
  "dst-pelling": gw(["apt-ixb"], ["stn-njp"], [["stn-njp", "cab", 300, 4000, "Cab NJP → Pelling (~130 km)"]]),
  "dst-shillong": gw(["apt-shl", "apt-gau"], [], [
    ["apt-shl", "cab", 60, 1500, "Cab Umroi airport → Shillong (~35 km)"],
    ["apt-gau", "cab", 180, 2800, "Cab Guwahati → Shillong (~100 km on NH6)"],
  ]),
  "dst-cherrapunji": gw(["apt-shl", "apt-gau"], [], [["apt-gau", "cab", 270, 4000, "Cab Guwahati → Sohra/Cherrapunji (~150 km)"]]),
  "dst-kaziranga": gw(["apt-jrh", "apt-gau"], [], [
    ["apt-jrh", "cab", 150, 2500, "Cab Jorhat → Kaziranga (~95 km)"],
    ["apt-gau", "cab", 300, 4500, "Cab Guwahati → Kaziranga (~195 km)"],
  ]),
  "dst-tawang": gw(["apt-tez"], [], [["apt-tez", "cab", 720, 12000, "Cab Tezpur → Tawang (~320 km over Sela Pass) — 2 days, halt at Dirang/Bomdila"]]),

  // —— South & west ——
  "dst-munnar": gw(["apt-cok", "apt-ixm"], ["stn-ers"], [
    ["apt-cok", "cab", 210, 3200, "Cab Kochi airport → Munnar (~110 km of ghat)"],
    ["stn-ers", "cab", 240, 3400, "Cab Ernakulam → Munnar (~130 km)"],
  ]),
  "dst-alleppey": gw(["apt-cok"], ["stn-alld"], [["apt-cok", "cab", 90, 1800, "Cab Kochi airport → Alappuzha (~55 km)"]]),
  "dst-thekkady": gw(["apt-cok", "apt-ixm"], [], [["apt-cok", "cab", 240, 3800, "Cab Kochi → Thekkady/Kumily (~150 km)"]]),
  "dst-wayanad": gw(["apt-ccj", "apt-cnn"], [], [
    ["apt-ccj", "cab", 165, 2800, "Cab Kozhikode → Kalpetta (~95 km via Thamarassery ghat)"],
    ["apt-cnn", "cab", 120, 2200, "Cab Kannur airport → Wayanad (~65 km)"],
  ]),
  "dst-varkala": gw(["apt-trv"], ["stn-tvc"], [["apt-trv", "cab", 75, 1500, "Cab Trivandrum airport → Varkala (~55 km)"]]),
  "dst-coorg": gw(["apt-myq", "apt-ixe", "apt-blr"], ["stn-mys"], [
    ["stn-mys", "cab", 180, 2800, "Cab Mysuru → Madikeri (~120 km)"],
    ["apt-blr", "cab", 360, 6000, "Cab Bengaluru → Madikeri (~265 km)"],
  ]),
  "dst-chikmagalur": gw(["apt-myq", "apt-blr"], [], [["apt-blr", "cab", 330, 5500, "Cab Bengaluru → Chikmagalur (~245 km)"]]),
  "dst-hampi": gw(["apt-hbx", "apt-blr"], ["stn-hpt"], [
    ["stn-hpt", "cab", 30, 500, "Auto/cab Hosapete railhead → Hampi (~13 km)"],
    ["apt-hbx", "cab", 210, 3500, "Cab Hubballi airport → Hampi (~145 km)"],
  ]),
  "dst-gokarna": gw(["apt-ixe", "apt-goi"], [], [["apt-goi", "cab", 210, 3500, "Cab Goa → Gokarna (~145 km)"]]),
  "dst-kodaikanal": gw(["apt-ixm", "apt-cjb"], ["stn-mdu"], [
    ["apt-ixm", "cab", 210, 3000, "Cab Madurai airport → Kodaikanal (~120 km of ghat)"],
  ]),
  "dst-mountabu": gw(["apt-udi"], ["stn-abr"], [
    ["stn-abr", "cab", 60, 900, "Cab Abu Road railhead → Mount Abu (~28 km)"],
    ["apt-udi", "cab", 210, 3500, "Cab Udaipur → Mount Abu (~165 km)"],
  ]),
  "dst-rannofkutch": gw(["apt-bhj"], [], [["apt-bhj", "cab", 105, 2500, "Cab Bhuj → Dhordo / Tent City (~85 km)"]]),
  "dst-mahabaleshwar": gw(["apt-pnq", "apt-bom"], [], [
    ["apt-pnq", "cab", 210, 3000, "Cab Pune → Mahabaleshwar (~120 km)"],
    ["apt-bom", "cab", 330, 5000, "Cab Mumbai → Mahabaleshwar (~260 km)"],
  ]),
  "dst-havelock": gw(["apt-ixz"], [], [["apt-ixz", "bus", 150, 1300, "Ferry Port Blair → Swaraj Dweep (~2 hrs) — book the morning sailing"]]),

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
  // Search every mode at once. Restricting to one mode hides the answer and lets a bad
  // fuzzy match in another mode win — "patnagar" found Jamshedpur because Pantnagar is
  // flight-only and so wasn't a candidate.
  const hit = resolvePlace(raw, "any");
  if (!hit) return null;
  if (hit.kind === "city") return hit;
  // A gateway matched. Prefer the town it serves so the planner adds the last mile,
  // but keep the gateway itself when no town of that name exists.
  const city = TRAVEL_PLACES.find((x) => x.kind === "city" && x.city === hit.city);
  return city ?? hit;
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
