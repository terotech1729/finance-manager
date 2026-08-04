import type { TravelMode, TravelPlatform } from "./types";

/**
 * Curated booking platforms for the Travel assistant.
 * Inventory may be shared (esp. trains); we rank checkout rail + payment stack.
 */
export const TRAVEL_PLATFORMS: readonly TravelPlatform[] = [
  // —— Flights ——
  {
    id: "amazon_flight",
    mode: "flight",
    label: "Amazon Travel (flights)",
    recommendMerchant: "Amazon travel flight",
    recommendCategory: "amazon travel flight",
    cashkaroMerchant: "Amazon",
    openSteps: ["Open Amazon.in → Travel → Flights", "Search the same OD / date", "Pay with Amazon Pay ICICI card (not balance)"],
    url: "https://www.amazon.in/travel/flights",
    notes: "Prime: 5% uncapped via Amazon Pay ICICI. Always fare-match OTAs.",
    primary: true,
  },
  {
    id: "cleartrip_flight",
    mode: "flight",
    label: "Cleartrip (flights)",
    recommendMerchant: "Cleartrip flights",
    recommendCategory: "cleartrip flights",
    cashkaroMerchant: "Cleartrip",
    openSteps: ["Prefer Cashkaro → Cleartrip Flights click-through first", "Or open cleartrip.com → Flights", "Pay with the ranked card"],
    url: "https://www.cleartrip.com/flights",
    notes: "Cashkaro often flat ₹ on flights — verify live. SBI SimplyCLICK 10× partner.",
    primary: true,
  },
  {
    id: "mmt_flight",
    mode: "flight",
    label: "MakeMyTrip (flights)",
    recommendMerchant: "MakeMyTrip flights",
    recommendCategory: "makemytrip flights",
    cashkaroMerchant: "MakeMyTrip",
    openSteps: ["Cashkaro → MakeMyTrip Flights (if using CK stack)", "Or Amex Reward Multiplier → MMT for Gold 5×", "Compare fare vs Amazon / Cleartrip"],
    url: "https://www.makemytrip.com/flights",
    notes: "Amex RM portal ≈ 5.8% on Gold when started from Amex, not MMT app alone.",
    primary: true,
  },
  {
    id: "easemytrip_flight",
    mode: "flight",
    label: "EaseMyTrip / Yatra",
    recommendMerchant: "EaseMyTrip",
    recommendCategory: "flight booking",
    cashkaroMerchant: "EaseMyTrip",
    openSteps: ["Open Cashkaro → EaseMyTrip or Yatra", "Book flight", "Pay with ranked card (often BOB 5× travel)"],
    url: "https://www.easemytrip.com",
    primary: false,
  },
  {
    id: "indigo_direct",
    mode: "flight",
    label: "IndiGo (6E) direct",
    recommendMerchant: "IndiGo",
    recommendCategory: "indigo flight",
    openSteps: ["Open goindigo.in or IndiGo app", "Book flight", "Pay with IDFC Indigo for BluChip earn when it wins"],
    url: "https://www.goindigo.in",
    notes: "Best when IDFC BluChip earn + fare beats Amazon/OTA all-in.",
    primary: true,
  },
  {
    id: "scapia_flight",
    mode: "flight",
    label: "Scapia Travel (flights)",
    recommendMerchant: "Scapia flight",
    recommendCategory: "flight booking",
    openSteps: ["Open Scapia → Travel → Flights", "Book if inventory exists", "Coins are travel-locked"],
    notes: "4% locked coins — only if you will burn Scapia coins on travel.",
    primary: false,
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
    notes: "Official rail. Card acceptance is spotty (esp. Amex). UPI / Visa-MC more reliable.",
    primary: true,
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
  },
  {
    id: "confirmtkt",
    mode: "train",
    label: "ConfirmTkt",
    recommendMerchant: "ConfirmTkt",
    recommendCategory: "train booking",
    openSteps: ["Open ConfirmTkt app / site", "Book via IRCTC flow", "Watch convenience fees vs Amazon / RailOne"],
    url: "https://www.confirmtkt.com",
    notes: "Convenience fees can erase card earn — compare all-in.",
    primary: false,
  },
  {
    id: "amazon_train",
    mode: "train",
    label: "Amazon Travel (trains)",
    recommendMerchant: "Amazon travel train",
    recommendCategory: "amazon travel train",
    cashkaroMerchant: "Amazon",
    openSteps: ["Open Amazon.in → Travel → Trains", "Book same train", "Pay with Amazon Pay ICICI (~2%)"],
    url: "https://www.amazon.in/travel",
    notes: "~2% via Amazon Pay ICICI. Fare + fees must not exceed IRCTC all-in by more than the 2%.",
    primary: true,
  },

  // —— Buses ——
  {
    id: "redbus",
    mode: "bus",
    label: "RedBus",
    recommendMerchant: "RedBus",
    recommendCategory: "bus booking",
    cashkaroMerchant: "RedBus",
    openSteps: ["Cashkaro → RedBus (if using CK stack)", "Or open redbus.in", "Pay with ranked card (often BOB 5×)"],
    url: "https://www.redbus.in",
    notes: "Cashkaro RedBus is try-zone — verify tracking.",
    primary: true,
  },
  {
    id: "abhibus",
    mode: "bus",
    label: "AbhiBus",
    recommendMerchant: "AbhiBus",
    recommendCategory: "bus booking",
    openSteps: ["Open abhibus.com / app", "Book bus", "Pay with ranked card"],
    url: "https://www.abhibus.com",
    primary: false,
  },
  {
    id: "amazon_bus",
    mode: "bus",
    label: "Amazon Travel (bus)",
    recommendMerchant: "Amazon travel bus",
    recommendCategory: "amazon travel bus",
    cashkaroMerchant: "Amazon",
    openSteps: ["Open Amazon.in → Travel → Bus", "Book", "Pay with Amazon Pay ICICI (~2%)"],
    url: "https://www.amazon.in/travel",
    notes: "~2% Amazon Pay ICICI — often simpler than RedBus Cashkaro when fares match.",
    primary: true,
  },
];

export function platformsForMode(mode: TravelMode): TravelPlatform[] {
  return TRAVEL_PLATFORMS.filter((p) => p.mode === mode);
}

export function getPlatformById(id: string): TravelPlatform | undefined {
  return TRAVEL_PLATFORMS.find((p) => p.id === id);
}
