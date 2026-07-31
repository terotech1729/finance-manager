/**
 * Smart merchant → category + channel detection.
 * Free-text only — word order shouldn't matter ("agoda hotel" == "hotel agoda").
 * Brand + intent tokens are composed; clarification asked only when still ambiguous.
 */

export type ChannelType = "online" | "offline_pos" | "upi" | "upi_normal" | "merchant_app" | "foreign";

export type ClarificationOption = {
  value: string;
  label: string;
  category: string;
  channel?: ChannelType;
  forex?: boolean;
};

export type Clarification = {
  id: string;
  question: string;
  options: ClarificationOption[];
};

export type CategoryDetection = {
  category: string;
  prettyLabel: string;
  channel: ChannelType;
  confidence: "high" | "medium" | "low";
  forex?: boolean;
  clarification?: Clarification;
};

type Rule = {
  match: RegExp;
  category: string;
  prettyLabel: string;
  channel: ChannelType;
  confidence: "high" | "medium" | "low";
  forex?: boolean;
  clarification?: Clarification;
};

/** Normalize free text: lower, collapse space, light typo / alias folds. */
function normalizeQuery(raw: string): string {
  let t = (raw || "").toLowerCase().trim();
  t = t.replace(/[^a-z0-9.+&\s/-]/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  // Common aliases / typos (token-level friendly)
  const folds: [RegExp, string][] = [
    [/\bmakemytrip\b|\bmake\s*my\s*trip\b|\bmmt\b|\bgoibibo\b/g, " makemytrip "],
    [/\bbooking\s*\.?\s*com\b|\bbookingcom\b/g, " bookingcom "],
    [/\beasemytrip\b|\bease\s*my\s*trip\b/g, " easemytrip "],
    [/\bred\s*bus\b|\bredbus\b/g, " redbus "],
    [/\bbook\s*my\s*show\b|\bbms\b/g, " bookmyshow "],
    [/\btata\s*cliq\b|\btatacliq\b/g, " tatacliq "],
    [/\binstamart\b|\bswiggy\s*instamart\b/g, " instamart "],
    [/\bamzn\b|\bamz\b/g, " amazon "],
    [/\bfkrt\b|\bfk\b/g, " flipkart "],
    [/\bhotels\b/g, " hotel "],
    [/\bflights\b|\bairfare\b|\bair\s*ticket\b/g, " flight "],
    [/\btrains\b|\brailway\b/g, " train "],
    [/\bbusses\b|\bbuses\b/g, " bus "],
    [/\bstay\b|\bresort\b/g, " hotel "], // soft: stay → hotel intent
  ];
  for (const [re, rep] of folds) t = t.replace(re, rep);
  return t.replace(/\s+/g, " ").trim();
}

function hasToken(t: string, ...words: string[]): boolean {
  return words.some((w) => new RegExp(`(?:^|\\s)${w}(?:\\s|$)`).test(t));
}

function hasAny(t: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(t));
}

type TravelIntent = "hotel" | "flight" | "bus" | "train";

function detectTravelIntent(t: string): TravelIntent | null {
  // Prefer more specific tokens if multiple appear
  if (hasToken(t, "flight") || /\bairline\b|\bindigo\b|\b6e\b|\bair\s*india\b|\bspicejet\b|\bakasa\b|\bvistara\b/.test(t)) {
    return "flight";
  }
  if (hasToken(t, "bus") || hasToken(t, "redbus") || /\babhibus\b/.test(t)) return "bus";
  if (hasToken(t, "train") || hasToken(t, "irctc")) return "train";
  if (hasToken(t, "hotel") || /\btaj\b|\bmarriott\b|\bhyatt\b|\boberoi\b|\bhilton\b|\bitc\b|\bleela\b|\bvivanta\b|\bradisson\b|\bnovotel\b|\bibis\b|\bseleqtion\b|\bihg\b|intercontinental|holiday\s*inn|six\s*senses/.test(t)) {
    return "hotel";
  }
  return null;
}

type BrandHit = {
  id: string;
  pretty: string;
  channel: ChannelType;
  /** If brand implies a default travel kind when intent missing */
  defaultTravel?: TravelIntent;
  /** Brand is primarily travel OTA */
  travelBrand?: boolean;
};

function detectBrand(t: string): BrandHit | null {
  if (hasToken(t, "amazon")) return { id: "amazon", pretty: "Amazon", channel: "online" };
  if (hasToken(t, "agoda")) return { id: "agoda", pretty: "Agoda", channel: "online", defaultTravel: "hotel", travelBrand: true };
  if (hasToken(t, "bookingcom")) return { id: "booking", pretty: "Booking.com", channel: "online", defaultTravel: "hotel", travelBrand: true };
  if (hasToken(t, "cleartrip")) return { id: "cleartrip", pretty: "Cleartrip", channel: "online", travelBrand: true };
  if (hasToken(t, "makemytrip")) return { id: "makemytrip", pretty: "MakeMyTrip", channel: "online", travelBrand: true };
  if (hasToken(t, "easemytrip") || hasToken(t, "yatra")) return { id: "yatra", pretty: "EaseMyTrip / Yatra", channel: "online", travelBrand: true };
  if (hasToken(t, "redbus")) return { id: "redbus", pretty: "RedBus", channel: "online", defaultTravel: "bus", travelBrand: true };
  if (hasToken(t, "indigo") || /\b6e\b/.test(t)) return { id: "indigo", pretty: "IndiGo", channel: "merchant_app", defaultTravel: "flight", travelBrand: true };
  if (hasToken(t, "flipkart")) return { id: "flipkart", pretty: "Flipkart", channel: "online" };
  if (hasToken(t, "myntra")) return { id: "myntra", pretty: "Myntra", channel: "online" };
  if (hasToken(t, "ajio")) return { id: "ajio", pretty: "AJIO", channel: "online" };
  if (hasToken(t, "nykaa")) return { id: "nykaa", pretty: "Nykaa", channel: "online" };
  if (hasToken(t, "tatacliq")) return { id: "tatacliq", pretty: "Tata CLiQ", channel: "online" };
  if (hasToken(t, "meesho")) return { id: "meesho", pretty: "Meesho", channel: "online" };
  if (hasToken(t, "swiggy") && !hasToken(t, "instamart")) return { id: "swiggy", pretty: "Swiggy", channel: "merchant_app" };
  if (hasToken(t, "zomato")) return { id: "zomato", pretty: "Zomato", channel: "merchant_app" };
  if (hasToken(t, "instamart") || hasToken(t, "blinkit") || hasToken(t, "zepto") || hasToken(t, "bigbasket") || hasToken(t, "dmart")) {
    return { id: "grocery", pretty: "Groceries", channel: "merchant_app" };
  }
  if (hasToken(t, "bookmyshow") || hasToken(t, "district") || hasToken(t, "pvr") || hasToken(t, "inox") || hasToken(t, "cinepolis")) {
    return { id: "movies", pretty: "Movie / event tickets", channel: "merchant_app" };
  }
  return null;
}

function travelClarification(id: string, prefix: string): Clarification {
  const opts: ClarificationOption[] = [
    { value: "hotel", label: "Hotel", category: `${prefix} hotels`, channel: "online" },
    { value: "flight", label: "Flight", category: `${prefix} flights`, channel: "online" },
  ];
  if (id === "makemytrip" || id === "amazon") {
    opts.push({ value: "bus", label: "Bus", category: id === "amazon" ? "amazon travel bus" : "bus booking", channel: "online" });
  }
  if (id === "amazon") {
    opts.push({ value: "train", label: "Train", category: "amazon travel train", channel: "online" });
    // Amazon travel uses "amazon travel X" categories, not "amazon travel hotels"
    opts[0] = { value: "hotel", label: "Hotel", category: "amazon travel hotel", channel: "online" };
    opts[1] = { value: "flight", label: "Flight", category: "amazon travel flight", channel: "online" };
  }
  return {
    id: `${id}_travel_type`,
    question: `${id === "amazon" ? "Amazon" : id === "makemytrip" ? "MakeMyTrip" : id === "cleartrip" ? "Cleartrip" : "Travel"} booking type?`,
    options: opts,
  };
}

/** Fallback regex rules for non-travel / when brand+intent composition doesn't apply. */
const FALLBACK_RULES: Rule[] = [
  {
    match: /\bdistrict\b|\bbookmyshow\b|movie|cinema|\bpvr\b|\binox\b|\bcinepolis\b/i,
    category: "movies / events",
    prettyLabel: "Movie / event tickets",
    channel: "merchant_app",
    confidence: "medium",
    clarification: {
      id: "movie_tickets",
      question: "How many tickets? (Amount above = total for all tickets, not per ticket)",
      options: [
        { value: "one", label: "Just 1 ticket", category: "movies / events · 1 ticket", channel: "merchant_app" },
        { value: "two", label: "Exactly 2 tickets", category: "movies / events · 2 tickets", channel: "merchant_app" },
        { value: "multi", label: "3 or more tickets", category: "movies / events · 3+ tickets", channel: "merchant_app" },
      ],
    },
  },
  { match: /\bswiggy\b/i, category: "swiggy", prettyLabel: "Swiggy", channel: "merchant_app", confidence: "high" },
  { match: /\bzomato\b/i, category: "zomato", prettyLabel: "Zomato", channel: "merchant_app", confidence: "high" },
  { match: /\binstamart\b|\bblinkit\b|\bzepto\b|\bbigbasket\b|\bdmart\b|grocery|groceries|kirana/i, category: "groceries", prettyLabel: "Groceries", channel: "merchant_app", confidence: "high" },
  { match: /\bflipkart\b/i, category: "flipkart (fashion)", prettyLabel: "Flipkart", channel: "online", confidence: "high" },
  { match: /\bmyntra\b/i, category: "myntra", prettyLabel: "Myntra", channel: "online", confidence: "high" },
  { match: /\bajio\b/i, category: "ajio", prettyLabel: "AJIO", channel: "online", confidence: "high" },
  { match: /\bnykaa\b/i, category: "nykaa", prettyLabel: "Nykaa", channel: "online", confidence: "high" },
  { match: /\btatacliq\b/i, category: "tata cliq", prettyLabel: "Tata CLiQ", channel: "online", confidence: "high" },
  { match: /\bmeesho\b/i, category: "meesho", prettyLabel: "Meesho", channel: "online", confidence: "high" },
  { match: /\bplayo\b|\bbadminton\b|\bsports\s*court\b|\bturf\s*book/i, category: "playo / sports booking", prettyLabel: "Playo / sports court", channel: "upi", confidence: "high" },
  { match: /\b(uber|ola|rapido|namma\s*yatri)\b/i, category: "ride / cab", prettyLabel: "Ride / cab", channel: "upi", confidence: "high" },
  { match: /\bmetro\b/i, category: "transit (metro / train)", prettyLabel: "Metro", channel: "online", confidence: "medium" },
  {
    match: /(mobile|phone|sim)\s*(recharge|bill|prepaid|postpaid)|recharge\s*(plan|pack)?\b|\b(airtel|jio|vi|vodafone|bsnl|idea)\b/i,
    category: "utility (mobile)",
    prettyLabel: "Mobile recharge / bill",
    channel: "online",
    confidence: "high",
  },
  {
    match: /electricity|electric\s*bill|current\s*bill|\b(bescom|tneb|tsspdcl|bsescom|adani\s*electricity|tata\s*power|msedcl|mseb|kseb|pspcl|punjab\s*power|dvvnl)\b/i,
    category: "utility (electricity)",
    prettyLabel: "Electricity bill",
    channel: "online",
    confidence: "high",
  },
  { match: /broadband|wifi.*bill|fiber|airtel\s*xstream|jio\s*fiber|act\s*fibernet/i, category: "utility (broadband)", prettyLabel: "Broadband bill", channel: "online", confidence: "high" },
  { match: /tata\s*sky|dish\s*tv|\bdth\b|cable\s*recharge|sun\s*direct|\btatasky\b/i, category: "utility (tv)", prettyLabel: "DTH / Cable", channel: "online", confidence: "high" },
  { match: /\bgas\s*bill\b|\bigl\b|\bmgl\b|\bggl\b|\badani\s*gas\b/i, category: "utility (gas)", prettyLabel: "Gas bill", channel: "online", confidence: "high" },
  { match: /\bwater\s*bill\b|bwssb|kwa/i, category: "utility (water)", prettyLabel: "Water bill", channel: "online", confidence: "high" },
  {
    match: /\b(bike|car|vehicle|scooter|motorcycle|two.?wheeler|auto)\s*(service|servicing|repair|repairs)\b|\bservice\s*(centre|center)\b|\bgarage\b|\bworkshop\b/i,
    category: "vehicle service / repair",
    prettyLabel: "Vehicle service / repair",
    channel: "offline_pos",
    confidence: "high",
  },
  {
    match: /\bfuel\b|\bpetrol\b|\bdiesel\b|\bhpcl\b|\biocl\b|\bbpcl\b|\bshell\b|petrol\s*pump|fuel\s*station/i,
    category: "fuel",
    prettyLabel: "Fuel",
    channel: "offline_pos",
    confidence: "high",
  },
  { match: /\binsurance\b|\blic\b|policybazaar|hdfc\s*life|icici\s*pru/i, category: "insurance", prettyLabel: "Insurance", channel: "online", confidence: "medium" },
  { match: /\brent\b|\bhouse\s*rent\b|\bnobroker\b|\bcred\s*rent\b|\bredgiraffe\b/i, category: "rent", prettyLabel: "House rent", channel: "online", confidence: "high" },
  { match: /\btax\s*payment\b|advance\s*tax|income\s*tax|\bgst\b|govt\s*payment|government\s*payment/i, category: "tax / govt", prettyLabel: "Tax / Govt", channel: "online", confidence: "high" },
  {
    match: /mutual\s*fund|\bsmallcase\b|\bstocks?\b|\bequity\b|\bsip\b|\bnps\b|\bppf\b|fixed\s*deposit|\bcrypto\b|\bgroww\b|\bzerodha\b|invest|trading|prop\s*firm/i,
    category: "investments / trading",
    prettyLabel: "Investment / Trading",
    channel: "upi_normal",
    confidence: "high",
  },
  { match: /restaurant|\bcafe\b|\bstarbucks\b|food\s*court|\bdining\b|\bdinner\b|\blunch\b|\bbreakfast\b|\bdomino|\bkfc\b|\bmcd|mcdonald/i, category: "dining (offline restaurant)", prettyLabel: "Dining out", channel: "offline_pos", confidence: "medium" },
  { match: /\bcroma\b|\bvijay\s*sales\b|reliance\s*digital/i, category: "electronics (offline)", prettyLabel: "Electronics store", channel: "offline_pos", confidence: "high" },
  { match: /\blenskart\b/i, category: "lenskart / boat / mamaearth", prettyLabel: "Lenskart", channel: "online", confidence: "high" },
  { match: /\bboat\b|\bmamaearth\b|\bsugar\b|\bplum\b/i, category: "lenskart / boat / mamaearth", prettyLabel: "D2C brand", channel: "online", confidence: "high" },
  { match: /amazon\s*pay\s*wallet|\bpaytm\s*wallet\b|\bphonepe\s*wallet\b|wallet\s*top\s*up|gift\s*card/i, category: "wallet top-up", prettyLabel: "Wallet / Gift card", channel: "online", confidence: "medium" },
  {
    match: /amazon\.com|\bnetflix\b|\bspotify\b|\bopenai\b|\bchatgpt\b|claude\.ai|\banthropic\b|\bgithub\b|\baws\b|foreign|international|\busd\b|\beur\b|\bgbp\b/i,
    category: "online subscription / foreign",
    prettyLabel: "Foreign / SaaS subscription",
    channel: "foreign",
    confidence: "high",
    forex: true,
  },
  { match: /\bapollo\b.*pharm|\bnetmeds\b|\b1mg\b|\bpharmeasy\b|pharmacy/i, category: "online (general)", prettyLabel: "Pharmacy / health", channel: "online", confidence: "high" },
  { match: /hospital|clinic|doctor|consult|dermat|derma|skin\s*clinic/i, category: "healthcare", prettyLabel: "Healthcare", channel: "online", confidence: "medium" },
];

export function detectCategory(merchant: string): CategoryDetection {
  const raw = (merchant || "").trim();
  if (!raw) {
    return { category: "general", prettyLabel: "—", channel: "online", confidence: "low" };
  }

  const t = normalizeQuery(raw);
  const brand = detectBrand(t);
  const intent = detectTravelIntent(t);

  // Luxury hotel brands → direct (any word order: "taj hotel", "hotel taj mumbai")
  if (/\btaj\b|\bmarriott\b|\bhyatt\b|\boberoi\b|\bhilton\b|\bitc\b|\bleela\b|\bvivanta\b|\bradisson\b|\bnovotel\b|\bibis\b|\bseleqtion\b|\bihg\b|intercontinental|holiday\s*inn|six\s*senses/.test(t)) {
    return { category: "hotel direct", prettyLabel: "Hotel (direct)", channel: "online", confidence: "high" };
  }

  // Other airlines
  if (/\bair\s*india\b|\bvistara\b|\bspicejet\b|\bakasa\b/.test(t)) {
    return { category: "flight (other airline)", prettyLabel: "Other airline", channel: "online", confidence: "high" };
  }

  // ---- Brand + travel intent (order-independent) ----
  if (brand?.id === "amazon" && (intent || hasToken(t, "travel"))) {
    if (intent) {
      return {
        category: `amazon travel ${intent}`,
        prettyLabel: `Amazon ${intent}`,
        channel: "online",
        confidence: "high",
      };
    }
    return {
      category: "amazon travel",
      prettyLabel: "Amazon travel",
      channel: "online",
      confidence: "medium",
      clarification: travelClarification("amazon", "amazon travel"),
    };
  }

  if (brand?.id === "agoda") {
    // Agoda is hotels-only — "agoda", "agoda hotel", "hotel agoda" all resolve immediately
    return { category: "agoda hotels", prettyLabel: "Agoda hotel", channel: "online", confidence: "high" };
  }

  if (brand?.id === "booking") {
    return { category: "booking.com hotels", prettyLabel: "Booking.com hotel", channel: "online", confidence: "high" };
  }

  if (brand?.id === "indigo") {
    return { category: "indigo flight", prettyLabel: "IndiGo flight", channel: "merchant_app", confidence: "high" };
  }

  if (brand?.id === "redbus") {
    return { category: "bus booking", prettyLabel: "RedBus", channel: "online", confidence: "high" };
  }

  if (brand?.id === "cleartrip") {
    if (intent === "hotel" || intent === "flight") {
      return {
        category: intent === "hotel" ? "cleartrip hotels" : "cleartrip flights",
        prettyLabel: `Cleartrip ${intent}`,
        channel: "online",
        confidence: "high",
      };
    }
    return {
      category: "cleartrip flights",
      prettyLabel: "Cleartrip",
      channel: "online",
      confidence: "medium",
      clarification: travelClarification("cleartrip", "cleartrip"),
    };
  }

  if (brand?.id === "makemytrip") {
    if (intent === "hotel" || intent === "flight" || intent === "bus") {
      return {
        category: intent === "hotel" ? "makemytrip hotels" : intent === "flight" ? "makemytrip flights" : "bus booking",
        prettyLabel: `MakeMyTrip ${intent}`,
        channel: "online",
        confidence: "high",
      };
    }
    return {
      category: "makemytrip hotels",
      prettyLabel: "MakeMyTrip",
      channel: "online",
      confidence: "medium",
      clarification: travelClarification("makemytrip", "makemytrip"),
    };
  }

  if (brand?.id === "yatra") {
    if (intent) {
      return {
        category: intent === "hotel" ? "hotel booking" : intent === "flight" ? "flight booking" : intent === "bus" ? "bus booking" : "train booking",
        prettyLabel: `${brand.pretty} ${intent}`,
        channel: "online",
        confidence: "high",
      };
    }
    return { category: "makemytrip / easemytrip", prettyLabel: brand.pretty, channel: "online", confidence: "medium" };
  }

  // Plain travel intent with no brand → ask platform comparison via category
  if (!brand && intent) {
    return {
      category: intent === "hotel" ? "hotel booking" : intent === "flight" ? "flight booking" : intent === "bus" ? "bus booking" : "train booking",
      prettyLabel: `${intent.charAt(0).toUpperCase()}${intent.slice(1)} booking`,
      channel: "online",
      confidence: "high",
    };
  }

  if (!brand && hasToken(t, "travel")) {
    return {
      category: "travel booking",
      prettyLabel: "Travel booking",
      channel: "online",
      confidence: "medium",
      clarification: {
        id: "travel_type",
        question: "What are you booking? (we'll compare Amazon, Agoda/Cashkaro, MMT, Cleartrip, Scapia…)",
        options: [
          { value: "hotel", label: "Hotel", category: "hotel booking", channel: "online" },
          { value: "flight", label: "Flight", category: "flight booking", channel: "online" },
          { value: "bus", label: "Bus", category: "bus booking", channel: "online" },
          { value: "train", label: "Train", category: "train booking", channel: "online" },
        ],
      },
    };
  }

  // Amazon shopping (not travel) — clarify product type
  if (brand?.id === "amazon") {
    return {
      category: "amazon (general)",
      prettyLabel: "Amazon",
      channel: "online",
      confidence: "medium",
      clarification: {
        id: "amazon_type",
        question: "What kind of Amazon order is this?",
        options: [
          { value: "electronics", label: "Electronics (phone, laptop, gadget)", category: "amazon electronics", channel: "online" },
          { value: "general", label: "General (clothes, books, household)", category: "amazon (general)", channel: "online" },
          { value: "fresh", label: "Amazon Fresh / Now (milk, groceries)", category: "amazon (general)", channel: "online" },
          { value: "flight", label: "Travel — flight", category: "amazon travel flight", channel: "online" },
          { value: "hotel", label: "Travel — hotel", category: "amazon travel hotel", channel: "online" },
          { value: "bus", label: "Travel — bus", category: "amazon travel bus", channel: "online" },
          { value: "train", label: "Travel — train", category: "amazon travel train", channel: "online" },
        ],
      },
    };
  }

  if (brand?.id === "movies") {
    return {
      category: "movies / events",
      prettyLabel: "Movie / event tickets",
      channel: "merchant_app",
      confidence: "medium",
      clarification: {
        id: "movie_tickets",
        question: "How many tickets? (Amount above = total for all tickets, not per ticket)",
        options: [
          { value: "one", label: "Just 1 ticket", category: "movies / events · 1 ticket", channel: "merchant_app" },
          { value: "two", label: "Exactly 2 tickets", category: "movies / events · 2 tickets", channel: "merchant_app" },
          { value: "multi", label: "3 or more tickets", category: "movies / events · 3+ tickets", channel: "merchant_app" },
        ],
      },
    };
  }

  if (brand?.id === "grocery") {
    return { category: "groceries", prettyLabel: "Groceries", channel: "merchant_app", confidence: "high" };
  }
  if (brand?.id === "swiggy") return { category: "swiggy", prettyLabel: "Swiggy", channel: "merchant_app", confidence: "high" };
  if (brand?.id === "zomato") return { category: "zomato", prettyLabel: "Zomato", channel: "merchant_app", confidence: "high" };
  if (brand?.id === "flipkart") return { category: "flipkart (fashion)", prettyLabel: "Flipkart", channel: "online", confidence: "high" };
  if (brand?.id === "myntra") return { category: "myntra", prettyLabel: "Myntra", channel: "online", confidence: "high" };
  if (brand?.id === "ajio") return { category: "ajio", prettyLabel: "AJIO", channel: "online", confidence: "high" };
  if (brand?.id === "nykaa") return { category: "nykaa", prettyLabel: "Nykaa", channel: "online", confidence: "high" };
  if (brand?.id === "tatacliq") return { category: "tata cliq", prettyLabel: "Tata CLiQ", channel: "online", confidence: "high" };
  if (brand?.id === "meesho") return { category: "meesho", prettyLabel: "Meesho", channel: "online", confidence: "high" };

  for (const rule of FALLBACK_RULES) {
    if (rule.match.test(raw) || rule.match.test(t)) {
      return {
        category: rule.category,
        prettyLabel: rule.prettyLabel,
        channel: rule.channel,
        confidence: rule.confidence,
        forex: rule.forex,
        clarification: rule.clarification,
      };
    }
  }

  return { category: "general", prettyLabel: raw, channel: "online", confidence: "low" };
}

export const ALL_CATEGORIES = [
  "general",
  "amazon (general)",
  "amazon electronics",
  "flipkart (fashion)",
  "myntra",
  "ajio",
  "nykaa",
  "tata cliq",
  "meesho",
  "movies / events (District)",
  "movies / events",
  "movies / events · 1 ticket",
  "movies / events · 2 tickets",
  "movies / events · 2+ tickets",
  "movies / events · 3+ tickets",
  "swiggy",
  "zomato",
  "groceries",
  "cleartrip hotels",
  "cleartrip flights",
  "indigo flight",
  "flight (other airline)",
  "flight booking",
  "agoda hotels",
  "booking.com hotels",
  "booking.com / agoda",
  "makemytrip hotels",
  "makemytrip flights",
  "makemytrip / easemytrip",
  "hotel direct",
  "hotel booking",
  "bus booking",
  "train booking",
  "amazon travel",
  "amazon travel flight",
  "amazon travel hotel",
  "amazon travel bus",
  "amazon travel train",
  "travel booking",
  "playo / sports booking",
  "ride / cab",
  "transit (metro / train)",
  "dining (offline restaurant)",
  "vehicle service / repair",
  "electronics (offline)",
  "online (general)",
  "lenskart / boat / mamaearth",
  "utility (mobile)",
  "utility (electricity)",
  "utility (broadband)",
  "utility (tv)",
  "utility (gas)",
  "utility (water)",
  "fuel",
  "insurance",
  "rent",
  "tax / govt",
  "wallet top-up",
  "investments / trading",
  "online subscription / foreign",
  "healthcare",
  "other",
] as const;

export const ALL_CHANNELS: { value: ChannelType; label: string; help: string }[] = [
  { value: "online", label: "Online (card-not-present)", help: "Web checkout, app payment with card details" },
  { value: "merchant_app", label: "In-app payment", help: "Inside Swiggy / Zomato / IndiGo / Cleartrip app" },
  { value: "offline_pos", label: "Offline POS / swipe", help: "In-store / restaurant tap-and-pay" },
  { value: "upi", label: "UPI via Kiwi (CC-UPI for cashback)", help: "Scan UPI QR using Kiwi app" },
  { value: "upi_normal", label: "UPI via PhonePe / GPay", help: "Direct UPI from bank — no card rewards" },
  { value: "foreign", label: "Foreign currency", help: "USD / EUR / international merchant" },
];
