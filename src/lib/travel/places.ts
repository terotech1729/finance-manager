/**
 * Curated India places for Travel typeahead (airports / stations / cities).
 * No third-party autocomplete dependency — fast, offline, mode-aware.
 */
import type { TravelMode } from "./types";

export type PlaceKind = "airport" | "station" | "city";

export type TravelPlace = {
  id: string;
  name: string;
  /** IATA / railway code when known */
  code?: string;
  city: string;
  state?: string;
  kind: PlaceKind;
  modes: TravelMode[];
  lat: number;
  lng: number;
  aliases?: string[];
};

function p(
  id: string,
  name: string,
  code: string | undefined,
  city: string,
  state: string | undefined,
  kind: PlaceKind,
  modes: TravelMode[],
  lat: number,
  lng: number,
  aliases?: string[]
): TravelPlace {
  return { id, name, code, city, state, kind, modes, lat, lng, aliases };
}

/** Major Indian airports + metro cities + busy rail hubs. */
export const TRAVEL_PLACES: readonly TravelPlace[] = [
  // —— Airports (also usable as flight origin/dest city codes) ——
  p("apt-blr", "Kempegowda International", "BLR", "Bengaluru", "KA", "airport", ["flight"], 13.1989, 77.7068, ["bangalore", "bengaluru airport"]),
  p("apt-del", "Indira Gandhi International", "DEL", "Delhi", "DL", "airport", ["flight"], 28.5562, 77.1, ["new delhi", "igi"]),
  p("apt-bom", "Chhatrapati Shivaji Maharaj", "BOM", "Mumbai", "MH", "airport", ["flight"], 19.0896, 72.8656, ["bombay"]),
  p("apt-maa", "Chennai International", "MAA", "Chennai", "TN", "airport", ["flight"], 12.9941, 80.1709, ["madras"]),
  p("apt-hyd", "Rajiv Gandhi International", "HYD", "Hyderabad", "TS", "airport", ["flight"], 17.2403, 78.4294),
  p("apt-ccu", "Netaji Subhas Chandra Bose", "CCU", "Kolkata", "WB", "airport", ["flight"], 22.6547, 88.4467, ["calcutta"]),
  p("apt-pnq", "Pune Airport", "PNQ", "Pune", "MH", "airport", ["flight"], 18.5822, 73.9197),
  p("apt-goi", "Goa Mopa / Dabolim", "GOI", "Goa", "GA", "airport", ["flight"], 15.3808, 73.8314, ["mopa", "dabolim", "goa airport"]),
  p("apt-cok", "Cochin International", "COK", "Kochi", "KL", "airport", ["flight"], 10.152, 76.4019, ["cochin", "ernakulam"]),
  p("apt-trv", "Trivandrum International", "TRV", "Thiruvananthapuram", "KL", "airport", ["flight"], 8.4821, 76.9201, ["trivandrum"]),
  p("apt-amd", "Sardar Vallabhbhai Patel", "AMD", "Ahmedabad", "GJ", "airport", ["flight"], 23.0772, 72.6347),
  p("apt-jai", "Jaipur International", "JAI", "Jaipur", "RJ", "airport", ["flight"], 26.8242, 75.8122),
  p("apt-lko", "Chaudhary Charan Singh", "LKO", "Lucknow", "UP", "airport", ["flight"], 26.7606, 80.8893),
  p("apt-pat", "Jay Prakash Narayan", "PAT", "Patna", "BR", "airport", ["flight"], 25.5913, 85.088),
  p("apt-bbi", "Biju Patnaik", "BBI", "Bhubaneswar", "OD", "airport", ["flight"], 20.2444, 85.8178),
  p("apt-gau", "Lokpriya Gopinath Bordoloi", "GAU", "Guwahati", "AS", "airport", ["flight"], 26.1061, 91.5859),
  p("apt-ixc", "Chandigarh Airport", "IXC", "Chandigarh", "CH", "airport", ["flight"], 30.6735, 76.7885),
  p("apt-ixb", "Bagdogra", "IXB", "Bagdogra", "WB", "airport", ["flight"], 26.6812, 88.3286, ["siliguri"]),
  p("apt-ixm", "Madurai Airport", "IXM", "Madurai", "TN", "airport", ["flight"], 9.8345, 78.0934),
  p("apt-trz", "Tiruchirappalli", "TRZ", "Tiruchirappalli", "TN", "airport", ["flight"], 10.7654, 78.7097, ["trichy"]),
  p("apt-cjb", "Coimbatore International", "CJB", "Coimbatore", "TN", "airport", ["flight"], 11.0297, 77.0434),
  p("apt-ixe", "Mangaluru Airport", "IXE", "Mangaluru", "KA", "airport", ["flight"], 12.9613, 74.8901, ["mangalore"]),
  p("apt-vtz", "Visakhapatnam", "VTZ", "Visakhapatnam", "AP", "airport", ["flight"], 17.7212, 83.2245, ["vizag"]),
  p("apt-nag", "Nagpur Airport", "NAG", "Nagpur", "MH", "airport", ["flight"], 21.0922, 79.0472),
  p("apt-idr", "Devi Ahilya Bai", "IDR", "Indore", "MP", "airport", ["flight"], 22.7218, 75.8011),
  p("apt-bdq", "Vadodara Airport", "BDQ", "Vadodara", "GJ", "airport", ["flight"], 22.3362, 73.2263, ["baroda"]),
  p("apt-raj", "Rajkot Airport", "RAJ", "Rajkot", "GJ", "airport", ["flight"], 22.3092, 70.7795),
  p("apt-sxr", "Srinagar Airport", "SXR", "Srinagar", "JK", "airport", ["flight"], 33.9871, 74.7743),
  p("apt-ixa", "Agartala Airport", "IXA", "Agartala", "TR", "airport", ["flight"], 23.8869, 91.2404),
  p("apt-ixz", "Veer Savarkar (Port Blair)", "IXZ", "Port Blair", "AN", "airport", ["flight"], 11.6412, 92.7297),
  p("apt-udi", "Udaipur Airport", "UDR", "Udaipur", "RJ", "airport", ["flight"], 24.6177, 73.8961),
  p("apt-vns", "Lal Bahadur Shastri", "VNS", "Varanasi", "UP", "airport", ["flight"], 25.4524, 82.8593, ["banaras"]),
  p("apt-ixr", "Birsa Munda", "IXR", "Ranchi", "JH", "airport", ["flight"], 23.3143, 85.3217),
  p("apt-rpr", "Swami Vivekananda", "RPR", "Raipur", "CG", "airport", ["flight"], 21.1804, 81.7388),
  p("apt-atq", "Sri Guru Ram Dass Jee", "ATQ", "Amritsar", "PB", "airport", ["flight"], 31.7096, 74.7973),
  p("apt-ded", "Dehradun / Jolly Grant", "DED", "Dehradun", "UK", "airport", ["flight"], 30.1897, 78.1803),

  // —— Railway stations ——
  p("stn-sbc", "KSR Bengaluru City", "SBC", "Bengaluru", "KA", "station", ["train"], 12.9784, 77.5699, ["bangalore city", "krantivira"]),
  p("stn-ypr", "Yesvantpur Junction", "YPR", "Bengaluru", "KA", "station", ["train"], 13.0235, 77.551),
  p("stn-ndls", "New Delhi", "NDLS", "Delhi", "DL", "station", ["train"], 28.642, 77.219),
  p("stn-dli", "Old Delhi", "DLI", "Delhi", "DL", "station", ["train"], 28.6609, 77.2277),
  p("stn-nzm", "Hazrat Nizamuddin", "NZM", "Delhi", "DL", "station", ["train"], 28.589, 77.253),
  p("stn-cstm", "CSMT Mumbai", "CSMT", "Mumbai", "MH", "station", ["train"], 18.9398, 72.8355, ["vt", "cst"]),
  p("stn-ltt", "Lokmanya Tilak (LTT)", "LTT", "Mumbai", "MH", "station", ["train"], 19.0696, 72.891),
  p("stn-bdts", "Bandra Terminus", "BDTS", "Mumbai", "MH", "station", ["train"], 19.0623, 72.8405),
  p("stn-mas", "MGR Chennai Central", "MAS", "Chennai", "TN", "station", ["train"], 13.0827, 80.2756),
  p("stn-ms", "Chennai Egmore", "MS", "Chennai", "TN", "station", ["train"], 13.0781, 80.2615),
  p("stn-hyb", "Hyderabad Deccan", "HYB", "Hyderabad", "TS", "station", ["train"], 17.3925, 78.4675),
  p("stn-sc", "Secunderabad Junction", "SC", "Hyderabad", "TS", "station", ["train"], 17.4337, 78.5016),
  p("stn-hwh", "Howrah Junction", "HWH", "Kolkata", "WB", "station", ["train"], 22.583, 88.3426),
  p("stn-koaa", "Kolkata (KOAA)", "KOAA", "Kolkata", "WB", "station", ["train"], 22.6015, 88.3831),
  p("stn-pune", "Pune Junction", "PUNE", "Pune", "MH", "station", ["train"], 18.5289, 73.8745),
  p("stn-adi", "Ahmedabad Junction", "ADI", "Ahmedabad", "GJ", "station", ["train"], 23.0258, 72.6005),
  p("stn-jp", "Jaipur Junction", "JP", "Jaipur", "RJ", "station", ["train"], 26.9196, 75.788),
  p("stn-lko", "Lucknow NR", "LKO", "Lucknow", "UP", "station", ["train"], 26.8381, 80.9248),
  p("stn-pnbe", "Patna Junction", "PNBE", "Patna", "BR", "station", ["train"], 25.603, 85.1376),
  p("stn-ers", "Ernakulam Junction", "ERS", "Kochi", "KL", "station", ["train"], 9.9689, 76.291),
  p("stn-tvc", "Thiruvananthapuram Central", "TVC", "Thiruvananthapuram", "KL", "station", ["train"], 8.4855, 76.9492),
  p("stn-bza", "Vijayawada Junction", "BZA", "Vijayawada", "AP", "station", ["train"], 16.518, 80.62),
  p("stn-ghy", "Guwahati", "GHY", "Guwahati", "AS", "station", ["train"], 26.1823, 91.7505),
  p("stn-bsb", "Varanasi Junction", "BSB", "Varanasi", "UP", "station", ["train"], 25.327, 82.986),
  p("stn-ald", "Prayagraj Junction", "PRYJ", "Prayagraj", "UP", "station", ["train"], 25.446, 81.826, ["allahabad"]),
  p("stn-gwl", "Gwalior Junction", "GWL", "Gwalior", "MP", "station", ["train"], 26.215, 78.182),
  p("stn-bhopal", "Bhopal Junction", "BPL", "Bhopal", "MP", "station", ["train"], 23.267, 77.413),
  p("stn-indb", "Indore Junction", "INDB", "Indore", "MP", "station", ["train"], 22.717, 75.868),
  p("stn-ngp", "Nagpur Junction", "NGP", "Nagpur", "MH", "station", ["train"], 21.152, 79.088),
  p("stn-mao", "Madgaon (Goa)", "MAO", "Madgaon", "GA", "station", ["train"], 15.28, 73.98, ["goa", "margao"]),

  // —— Cities (bus + shared) ——
  p("city-blr", "Bengaluru", undefined, "Bengaluru", "KA", "city", ["bus", "train", "flight"], 12.9716, 77.5946, ["bangalore"]),
  p("city-del", "Delhi / NCR", undefined, "Delhi", "DL", "city", ["bus", "train", "flight"], 28.6139, 77.209, ["ncr", "new delhi", "gurgaon", "noida"]),
  p("city-bom", "Mumbai", undefined, "Mumbai", "MH", "city", ["bus", "train", "flight"], 19.076, 72.8777, ["bombay"]),
  p("city-maa", "Chennai", undefined, "Chennai", "TN", "city", ["bus", "train", "flight"], 13.0827, 80.2707, ["madras"]),
  p("city-hyd", "Hyderabad", undefined, "Hyderabad", "TS", "city", ["bus", "train", "flight"], 17.385, 78.4867),
  p("city-ccu", "Kolkata", undefined, "Kolkata", "WB", "city", ["bus", "train", "flight"], 22.5726, 88.3639, ["calcutta"]),
  p("city-pnq", "Pune", undefined, "Pune", "MH", "city", ["bus", "train", "flight"], 18.5204, 73.8567),
  p("city-goa", "Goa", undefined, "Goa", "GA", "city", ["bus", "train", "flight"], 15.2993, 74.124, ["panaji", "panjim"]),
  p("city-cok", "Kochi", undefined, "Kochi", "KL", "city", ["bus", "train", "flight"], 9.9312, 76.2673, ["cochin", "ernakulam"]),
  p("city-amd", "Ahmedabad", undefined, "Ahmedabad", "GJ", "city", ["bus", "train", "flight"], 23.0225, 72.5714),
  p("city-jai", "Jaipur", undefined, "Jaipur", "RJ", "city", ["bus", "train", "flight"], 26.9124, 75.7873),
  p("city-lko", "Lucknow", undefined, "Lucknow", "UP", "city", ["bus", "train", "flight"], 26.8467, 80.9462),
  p("city-ind", "Indore", undefined, "Indore", "MP", "city", ["bus", "train", "flight"], 22.7196, 75.8577),
  p("city-cbe", "Coimbatore", undefined, "Coimbatore", "TN", "city", ["bus", "train", "flight"], 11.0168, 76.9558),
  p("city-mys", "Mysuru", undefined, "Mysuru", "KA", "city", ["bus", "train"], 12.2958, 76.6394, ["mysore"]),
  p("city-mdu", "Madurai", undefined, "Madurai", "TN", "city", ["bus", "train", "flight"], 9.9252, 78.1198),
  p("city-viz", "Visakhapatnam", undefined, "Visakhapatnam", "AP", "city", ["bus", "train", "flight"], 17.6868, 83.2185, ["vizag"]),
  p("city-nag", "Nagpur", undefined, "Nagpur", "MH", "city", ["bus", "train", "flight"], 21.1458, 79.0882),
  p("city-sur", "Surat", undefined, "Surat", "GJ", "city", ["bus", "train"], 21.1702, 72.8311),
  p("city-vad", "Vadodara", undefined, "Vadodara", "GJ", "city", ["bus", "train", "flight"], 22.3072, 73.1812, ["baroda"]),
  p("city-chr", "Chandigarh", undefined, "Chandigarh", "CH", "city", ["bus", "train", "flight"], 30.7333, 76.7794),
  p("city-amn", "Amritsar", undefined, "Amritsar", "PB", "city", ["bus", "train", "flight"], 31.634, 74.8723),
  p("city-udi", "Udaipur", undefined, "Udaipur", "RJ", "city", ["bus", "train", "flight"], 24.5854, 73.7125),
  p("city-agr", "Agra", undefined, "Agra", "UP", "city", ["bus", "train"], 27.1767, 78.0081),
  p("city-vns", "Varanasi", undefined, "Varanasi", "UP", "city", ["bus", "train", "flight"], 25.3176, 82.9739, ["banaras", "kashi"]),
  p("city-rsh", "Rishikesh", undefined, "Rishikesh", "UK", "city", ["bus"], 30.0869, 78.2676),
  p("city-man", "Manali", undefined, "Manali", "HP", "city", ["bus"], 32.2396, 77.1887),
  p("city-shim", "Shimla", undefined, "Shimla", "HP", "city", ["bus"], 31.1048, 77.1734),
  p("city-pud", "Puducherry", undefined, "Puducherry", "PY", "city", ["bus"], 11.9416, 79.8083, ["pondicherry"]),
  p("city-oot", "Ooty", undefined, "Udhagamandalam", "TN", "city", ["bus"], 11.4102, 76.695, ["ooty", "udhagamandalam"]),
  p("city-hos", "Hosur", undefined, "Hosur", "TN", "city", ["bus"], 12.7409, 77.8253),
];

function norm(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

function scorePlace(place: TravelPlace, q: string): number {
  if (!q) return 0;
  const code = (place.code || "").toLowerCase();
  const name = norm(place.name);
  const city = norm(place.city);
  const aliases = (place.aliases || []).map(norm);
  if (code && code === q) return 1000;
  if (code && code.startsWith(q)) return 900 - q.length;
  if (city === q) return 800;
  if (city.startsWith(q)) return 700;
  if (name.startsWith(q)) return 650;
  if (aliases.some((a) => a === q)) return 780;
  if (aliases.some((a) => a.startsWith(q))) return 620;
  if (code && code.includes(q)) return 500;
  if (city.includes(q)) return 450;
  if (name.includes(q)) return 400;
  if (aliases.some((a) => a.includes(q))) return 380;
  if (place.state && norm(place.state).startsWith(q)) return 200;
  return 0;
}

export function searchPlaces(query: string, mode: TravelMode, limit = 8): TravelPlace[] {
  const q = norm(query);
  if (!q || q.length < 1) {
    // Popular defaults per mode
    const popularIds =
      mode === "flight"
        ? ["apt-blr", "apt-del", "apt-bom", "apt-maa", "apt-hyd", "apt-ccu", "apt-goi", "apt-pnq"]
        : mode === "train"
          ? ["stn-sbc", "stn-ndls", "stn-cstm", "stn-mas", "stn-sc", "stn-hwh", "stn-pune", "stn-adi"]
          : ["city-blr", "city-del", "city-bom", "city-maa", "city-hyd", "city-pnq", "city-goa", "city-mys"];
    return popularIds.map((id) => TRAVEL_PLACES.find((x) => x.id === id)!).filter(Boolean).slice(0, limit);
  }

  return TRAVEL_PLACES.filter((pl) => pl.modes.includes(mode))
    .map((pl) => ({ pl, score: scorePlace(pl, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.pl.city.localeCompare(b.pl.city))
    .slice(0, limit)
    .map((x) => x.pl);
}

export function placeLabel(place: TravelPlace): string {
  if (place.code) return `${place.city} (${place.code})`;
  return place.city;
}

export function placeSubLabel(place: TravelPlace): string {
  const bits = [place.name];
  if (place.state) bits.push(place.state);
  if (place.kind === "airport") bits.push("Airport");
  if (place.kind === "station") bits.push("Station");
  return bits.join(" · ");
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Resolve free text / code to a place for the mode (best match). */
export function resolvePlace(input: string, mode: TravelMode): TravelPlace | null {
  const raw = input.trim();
  if (!raw) return null;
  // "Bengaluru (BLR)" / "Delhi (DEL)"
  const paren = raw.match(/\(([A-Za-z]{2,5})\)\s*$/);
  if (paren) {
    const byCode = TRAVEL_PLACES.find(
      (pl) => pl.modes.includes(mode) && pl.code && pl.code.toLowerCase() === paren[1].toLowerCase()
    );
    if (byCode) return byCode;
  }
  const q = norm(raw);
  const byCode = TRAVEL_PLACES.find(
    (pl) => pl.modes.includes(mode) && pl.code && pl.code.toLowerCase() === q
  );
  if (byCode) return byCode;
  const hits = searchPlaces(raw.replace(/\([^)]*\)/g, " "), mode, 1);
  return hits[0] ?? null;
}
