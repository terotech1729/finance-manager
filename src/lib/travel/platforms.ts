import type { TravelMode, TravelPlatform, TravelSearchParams } from "./types";

function flightCabin(c?: TravelSearchParams["cabin"]): string {
  if (c === "business") return "Business";
  if (c === "premium") return "Premium";
  return "Economy";
}

function dmy(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function codeOrCity(p: TravelSearchParams["origin"]): string {
  return (p.code || p.city).trim();
}

/**
 * Curated booking platforms for the Travel assistant.
 * Inventory may be shared (esp. trains); we rank checkout rail + payment stack.
 */
export const TRAVEL_PLATFORMS: readonly TravelPlatform[] = [
  // —— Flights ——
  {
    id: "amazon_flight",
    mode: "flight",
    label: "Amazon Travel",
    recommendMerchant: "Amazon travel flight",
    recommendCategory: "amazon travel flight",
    cashkaroMerchant: "Amazon",
    openSteps: ["Open Amazon Travel Flights (link below)", "Confirm the same OD / date", "Pay with Amazon Pay ICICI card (not balance)"],
    url: "https://www.amazon.in/travel/flights",
    buildSearchUrl: () => "https://www.amazon.in/travel/flights",
    notes: "Prime: 5% uncapped via Amazon Pay ICICI.",
    primary: true,
    fareBiasInr: 0,
  },
  {
    id: "cleartrip_flight",
    mode: "flight",
    label: "Cleartrip",
    recommendMerchant: "Cleartrip flights",
    recommendCategory: "cleartrip flights",
    cashkaroMerchant: "Cleartrip",
    openSteps: ["Prefer Cashkaro → Cleartrip Flights click-through first", "Or open Cleartrip search (link)", "Pay with the ranked card"],
    url: "https://www.cleartrip.com/flights",
    buildSearchUrl: (p) =>
      `https://www.cleartrip.com/flights/results?adults=${p.adults}&childs=${p.children}&infants=0&intl=n&from=${encodeURIComponent(codeOrCity(p.origin))}&to=${encodeURIComponent(codeOrCity(p.destination))}&depart_date=${encodeURIComponent(dmy(p.date))}&class=${encodeURIComponent(flightCabin(p.cabin))}`,
    notes: "Cashkaro often flat ₹ on flights — verify live.",
    primary: true,
    fareBiasInr: 0,
  },
  {
    id: "mmt_flight",
    mode: "flight",
    label: "MakeMyTrip",
    recommendMerchant: "MakeMyTrip flights",
    recommendCategory: "makemytrip flights",
    cashkaroMerchant: "MakeMyTrip",
    openSteps: ["Cashkaro → MakeMyTrip Flights (if using CK stack)", "Or Amex Reward Multiplier → MMT for Gold 5×", "Compare fare vs Amazon / Cleartrip"],
    url: "https://www.makemytrip.com/flights",
    buildSearchUrl: (p) =>
      `https://www.makemytrip.com/flight/search?itinerary=${encodeURIComponent(codeOrCity(p.origin))}-${encodeURIComponent(codeOrCity(p.destination))}-${dmy(p.date).replace(/\//g, "")}&tripType=O&paxType=A-${p.adults}_C-${p.children}_I-0&cabinClass=${p.cabin === "business" ? "B" : p.cabin === "premium" ? "W" : "E"}`,
    notes: "Amex RM portal ≈ 5.8% on Gold when started from Amex.",
    primary: true,
    fareBiasInr: 50,
  },
  {
    id: "easemytrip_flight",
    mode: "flight",
    label: "EaseMyTrip / Yatra",
    recommendMerchant: "EaseMyTrip",
    recommendCategory: "flight booking",
    openSteps: ["Open EaseMyTrip or Yatra directly (not on Cashkaro)", "Book flight", "Pay with ranked card (often BOB 5× travel)"],
    url: "https://www.easemytrip.com",
    buildSearchUrl: (p) =>
      `https://flight.easemytrip.com/FlightList/Index?org=${encodeURIComponent(codeOrCity(p.origin))}&dept=${encodeURIComponent(codeOrCity(p.destination))}&deptDt=${encodeURIComponent(dmy(p.date))}&ADT=${p.adults}&CHD=${p.children}&INF=0&Cabin=${p.cabin === "business" ? "B" : "E"}`,
    notes: "Not on Cashkaro — compare sticker vs Amazon / Cleartrip / IndiGo.",
    primary: false,
    fareBiasInr: -80,
  },
  {
    id: "indigo_direct",
    mode: "flight",
    label: "IndiGo direct",
    recommendMerchant: "IndiGo",
    recommendCategory: "indigo flight",
    openSteps: ["Open IndiGo search (link)", "Book flight", "Pay with IDFC Indigo for BluChip earn when it wins"],
    url: "https://www.goindigo.in",
    buildSearchUrl: () => "https://www.goindigo.in",
    notes: "Airline app sticker can run above cheapest OTA/calendar fare — confirm before paying.",
    primary: true,
    // Direct often ~10–15% above the cheapest market fare on the same day
    fareBiasPct: 0.12,
    fareBiasInr: 0,
  },
  {
    id: "scapia_flight",
    mode: "flight",
    label: "Scapia Travel",
    recommendMerchant: "Scapia flight",
    recommendCategory: "flight booking",
    openSteps: ["Open Scapia → Travel → Flights", "Book if inventory exists", "Coins are travel-locked"],
    notes: "4% locked coins — only if you will burn Scapia coins on travel.",
    primary: false,
    fareBiasInr: 120,
  },

  // —— Trains ——
  {
    id: "irctc",
    mode: "train",
    label: "IRCTC",
    recommendMerchant: "IRCTC",
    recommendCategory: "train booking",
    openSteps: ["Open IRCTC Rail Connect / irctc.co.in", "Book the same train / class", "Amex often declined — keep a Visa/MC ready"],
    url: "https://www.irctc.co.in",
    buildSearchUrl: () => "https://www.irctc.co.in/nget/train-search",
    notes: "Official rail. Card acceptance is spotty (esp. Amex).",
    primary: true,
    fareBiasInr: 0,
  },
  {
    id: "railone",
    mode: "train",
    label: "RailOne",
    recommendMerchant: "RailOne",
    recommendCategory: "train booking",
    openSteps: ["Open RailOne app", "Search train / book", "Pay with card or UPI as ranked"],
    notes: "Same IRCTC inventory; UX often smoother than IRCTC app.",
    primary: true,
    fareBiasInr: 0,
  },
  {
    id: "confirmtkt",
    mode: "train",
    label: "ConfirmTkt",
    recommendMerchant: "ConfirmTkt",
    recommendCategory: "train booking",
    openSteps: ["Open ConfirmTkt", "Book via IRCTC flow", "Watch convenience fees vs Amazon / RailOne"],
    url: "https://www.confirmtkt.com",
    buildSearchUrl: (p) =>
      `https://www.confirmtkt.com/rbooking-b/${encodeURIComponent(codeOrCity(p.origin))}/${encodeURIComponent(codeOrCity(p.destination))}/${p.date.replace(/-/g, "")}`,
    notes: "Convenience fees can erase card earn.",
    primary: false,
    fareBiasInr: 40,
  },
  {
    id: "amazon_train",
    mode: "train",
    label: "Amazon Travel",
    recommendMerchant: "Amazon travel train",
    recommendCategory: "amazon travel train",
    cashkaroMerchant: "Amazon",
    openSteps: ["Open Amazon Travel Trains", "Book same train", "Pay with Amazon Pay ICICI (~2%)"],
    url: "https://www.amazon.in/travel",
    buildSearchUrl: () => "https://www.amazon.in/travel",
    notes: "~2% via Amazon Pay ICICI.",
    primary: true,
    fareBiasInr: 25,
  },

  // —— Buses ——
  {
    id: "redbus",
    mode: "bus",
    label: "RedBus",
    recommendMerchant: "RedBus",
    recommendCategory: "bus booking",
    cashkaroMerchant: "RedBus",
    openSteps: ["Cashkaro → RedBus (if using CK stack)", "Or open RedBus search", "Pay with ranked card (often BOB 5×)"],
    url: "https://www.redbus.in",
    buildSearchUrl: (p) =>
      `https://www.redbus.in/bus-tickets/${encodeURIComponent(p.origin.city.toLowerCase().replace(/\s+/g, "-"))}-to-${encodeURIComponent(p.destination.city.toLowerCase().replace(/\s+/g, "-"))}?date=${p.date}`,
    notes: "Cashkaro RedBus is try-zone — verify tracking.",
    primary: true,
    fareBiasInr: 0,
  },
  {
    id: "abhibus",
    mode: "bus",
    label: "AbhiBus",
    recommendMerchant: "AbhiBus",
    recommendCategory: "bus booking",
    openSteps: ["Open AbhiBus", "Book bus", "Pay with ranked card"],
    url: "https://www.abhibus.com",
    buildSearchUrl: (p) =>
      `https://www.abhibus.com/${encodeURIComponent(p.origin.city.toLowerCase())}-to-${encodeURIComponent(p.destination.city.toLowerCase())}-bus-booking`,
    primary: false,
    fareBiasInr: -20,
  },
  {
    id: "amazon_bus",
    mode: "bus",
    label: "Amazon Travel",
    recommendMerchant: "Amazon travel bus",
    recommendCategory: "amazon travel bus",
    cashkaroMerchant: "Amazon",
    openSteps: ["Open Amazon Travel Bus", "Book", "Pay with Amazon Pay ICICI (~2%)"],
    url: "https://www.amazon.in/travel",
    buildSearchUrl: () => "https://www.amazon.in/travel",
    notes: "~2% Amazon Pay ICICI.",
    primary: true,
    fareBiasInr: 30,
  },
];

export function platformsForMode(mode: TravelMode): TravelPlatform[] {
  return TRAVEL_PLATFORMS.filter((p) => p.mode === mode);
}

export function getPlatformById(id: string): TravelPlatform | undefined {
  return TRAVEL_PLATFORMS.find((p) => p.id === id);
}
