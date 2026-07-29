/**
 * Smart merchant → category + channel detection.
 * The user only needs to type "what they're buying" in free text.
 * We figure out the category, payment channel, and ask 1 clarifying
 * question if the merchant is genuinely ambiguous (e.g. Amazon, Cleartrip).
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

const RULES: Rule[] = [
  // ---- E-COMMERCE (need clarifications for Amazon) ----
  {
    match: /\bamazon\b|amzn|\bamz\b/i,
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
      ],
    },
  },
  { match: /\bflipkart\b|fkrt/i, category: "flipkart (fashion)", prettyLabel: "Flipkart", channel: "online", confidence: "high" },
  { match: /\bmyntra\b/i, category: "myntra", prettyLabel: "Myntra", channel: "online", confidence: "high" },
  { match: /\bajio\b/i, category: "ajio", prettyLabel: "AJIO", channel: "online", confidence: "high" },
  { match: /\bnykaa\b/i, category: "nykaa", prettyLabel: "Nykaa", channel: "online", confidence: "high" },
  { match: /\btata\s*cliq\b|\btatacliq\b/i, category: "tata cliq", prettyLabel: "Tata CLiQ", channel: "online", confidence: "high" },
  { match: /\bmeesho\b/i, category: "meesho", prettyLabel: "Meesho", channel: "online", confidence: "high" },
  { match: /\bjiomart\b|reliance\s*digital/i, category: "online (general)", prettyLabel: "Reliance / JioMart", channel: "online", confidence: "high" },

  // ---- MOVIES / EVENTS ----  (booked in-app → UPI-payable → merchant_app channel)
  {
    match: /\bdistrict\b|\bbookmyshow\b|\bbms\b|movie\s*ticket|movie|\bpvr\b|\binox\b|\bcinepolis\b|cinema/i,
    category: "movies / events",
    prettyLabel: "Movie / event tickets",
    channel: "merchant_app",
    confidence: "medium",
    clarification: {
      id: "movie_tickets",
      question: "How many tickets?",
      options: [
        { value: "one", label: "Just 1 ticket", category: "movies / events · 1 ticket", channel: "merchant_app" },
        { value: "two", label: "Exactly 2 tickets", category: "movies / events · 2 tickets", channel: "merchant_app" },
        { value: "multi", label: "3 or more tickets", category: "movies / events · 3+ tickets", channel: "merchant_app" },
      ],
    },
  },

  // ---- FOOD DELIVERY ----
  { match: /\bswiggy\s*instamart\b|\binstamart\b/i, category: "groceries", prettyLabel: "Swiggy Instamart", channel: "merchant_app", confidence: "high" },
  { match: /\bswiggy\b/i, category: "swiggy", prettyLabel: "Swiggy", channel: "merchant_app", confidence: "high" },
  { match: /\bzomato\b/i, category: "zomato", prettyLabel: "Zomato", channel: "merchant_app", confidence: "high" },
  { match: /\beatsure\b|\bdomino|\bpizza\s*hut\b|\bkfc\b|\bmcd|mcdonald|\bsubway\b|\bbiryani/i, category: "dining (offline restaurant)", prettyLabel: "Restaurant chain", channel: "online", confidence: "medium" },

  // ---- TRAVEL ----
  {
    match: /\bcleartrip\b/i,
    category: "cleartrip flights",
    prettyLabel: "Cleartrip",
    channel: "online",
    confidence: "medium",
    clarification: {
      id: "cleartrip_type",
      question: "Cleartrip booking type?",
      options: [
        { value: "hotel", label: "Hotel", category: "cleartrip hotels", channel: "online" },
        { value: "flight", label: "Flight", category: "cleartrip flights", channel: "online" },
      ],
    },
  },
  {
    match: /\bmakemytrip\b|\bmmt\b|\bgoibibo\b/i,
    category: "makemytrip hotels",
    prettyLabel: "MakeMyTrip / Goibibo",
    channel: "online",
    confidence: "medium",
    clarification: {
      id: "mmt_type",
      question: "MakeMyTrip booking type?",
      options: [
        { value: "hotel", label: "Hotel", category: "makemytrip hotels", channel: "online" },
        { value: "flight", label: "Flight", category: "makemytrip flights", channel: "online" },
        { value: "bus", label: "Bus", category: "bus booking", channel: "online" },
      ],
    },
  },
  {
    match: /\bagoda\b/i,
    category: "agoda hotels",
    prettyLabel: "Agoda hotel",
    channel: "online",
    confidence: "high",
  },
  {
    match: /\bbooking\.com\b/i,
    category: "booking.com hotels",
    prettyLabel: "Booking.com hotel",
    channel: "online",
    confidence: "high",
  },
  { match: /\beasemytrip\b|\byatra\b/i, category: "makemytrip / easemytrip", prettyLabel: "EaseMyTrip / Yatra", channel: "online", confidence: "medium" },
  { match: /\bindigo\b|\b6e\b\s*flight|\b6e\s*rewards/i, category: "indigo flight", prettyLabel: "IndiGo flight", channel: "merchant_app", confidence: "high" },
  { match: /\bair\s*india\b|\bvistara\b|\bspicejet\b|\bakasa\b/i, category: "flight (other airline)", prettyLabel: "Other airline", channel: "online", confidence: "high" },
  {
    match: /\b(taj|marriott|hyatt|oberoi|hilton|itc|leela|radisson|novotel|ibis|vivanta|seleqtion)\b/i,
    category: "hotel direct",
    prettyLabel: "Hotel (direct)",
    channel: "online",
    confidence: "medium",
  },
  {
    match: /\bredbus\b|\bred\s*bus\b|\babhibus\b|\bbus\s*ticket|\bbus\s*booking\b/i,
    category: "bus booking",
    prettyLabel: "Bus booking",
    channel: "online",
    confidence: "high",
  },
  {
    match: /\birctc\b|\btrain\s*ticket|\btrain\s*booking\b|\brailway\b/i,
    category: "train booking",
    prettyLabel: "Train booking",
    channel: "online",
    confidence: "high",
  },
  {
    match: /\bamazon\b.*\b(flight|hotel|bus|train|travel)\b|\b(flight|hotel|bus|train)\b.*\bamazon\b/i,
    category: "amazon travel",
    prettyLabel: "Amazon travel",
    channel: "online",
    confidence: "medium",
    clarification: {
      id: "amazon_travel_type",
      question: "Amazon travel type?",
      options: [
        { value: "flight", label: "Flight", category: "amazon travel flight", channel: "online" },
        { value: "hotel", label: "Hotel", category: "amazon travel hotel", channel: "online" },
        { value: "bus", label: "Bus", category: "amazon travel bus", channel: "online" },
        { value: "train", label: "Train", category: "amazon travel train", channel: "online" },
      ],
    },
  },
  {
    match: /^\s*(hotel|hotels|flight|flights|bus|train|travel)\s*$/i,
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
  },
  {
    match: /\bhotel\s*booking\b|\bbook\s*a?\s*hotel\b|\bstay\s*booking\b/i,
    category: "hotel booking",
    prettyLabel: "Hotel booking",
    channel: "online",
    confidence: "high",
  },
  {
    match: /\bflight\s*booking\b|\bbook\s*a?\s*flight\b|\bair\s*ticket\b/i,
    category: "flight booking",
    prettyLabel: "Flight booking",
    channel: "online",
    confidence: "high",
  },
  { match: /\bplayo\b|\bbadminton\b|\bsports\s*court\b|\bturf\s*book/i, category: "playo / sports booking", prettyLabel: "Playo / sports court", channel: "upi", confidence: "high" },
  { match: /\b(uber|ola|rapido|namma\s*yatri)\b/i, category: "ride / cab", prettyLabel: "Ride / cab", channel: "upi", confidence: "high" },
  { match: /\bmetro\b/i, category: "transit (metro / train)", prettyLabel: "Metro", channel: "online", confidence: "medium" },

  // ---- UTILITIES ----
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

  // ---- VEHICLE SERVICE / REPAIR (Kiwi-excluded MCC 7531/7538) ----
  {
    match: /\b(bike|car|vehicle|scooter|motorcycle|two.?wheeler|auto)\s*(service|servicing|repair|repairs)\b|\bservice\s*(centre|center)\b|\bgarage\b|\bworkshop\b|\bdenting\b|\bpainting\b/i,
    category: "vehicle service / repair",
    prettyLabel: "Vehicle service / repair",
    channel: "offline_pos",
    confidence: "high",
  },

  // ---- FUEL ----
  {
    match: /\bfuel\b|\bpetrol\b|\bdiesel\b|\bhpcl\b|\biocl\b|\bhp\s*petrol\b|\bbp\s*petrol\b|\bbpcl\b|\bshell\b|petrol\s*pump|fuel\s*station/i,
    category: "fuel",
    prettyLabel: "Fuel",
    channel: "offline_pos",
    confidence: "high",
  },

  // ---- INSURANCE / RENT / TAX ----
  { match: /\binsurance\b|\blic\b|premium|policybazaar|hdfc\s*life|icici\s*pru/i, category: "insurance", prettyLabel: "Insurance", channel: "online", confidence: "medium" },
  { match: /\brent\b|\bhouse\s*rent\b|\bnobroker\b|\bcred\s*rent\b|\bredgiraffe\b|\bmagicbricks\b/i, category: "rent", prettyLabel: "House rent", channel: "online", confidence: "high" },
  { match: /\btax\s*payment\b|advance\s*tax|income\s*tax|gst|govt\s*payment|government\s*payment/i, category: "tax / govt", prettyLabel: "Tax / Govt", channel: "online", confidence: "high" },

  // ---- INVESTMENTS ----
  {
    match: /mutual\s*fund|\bsmallcase\b|\bstocks?\b|\bequity\b|\bsip\b|\bnps\b|\bppf\b|fixed\s*deposit|\bfd\b|recurring\s*deposit|\brd\b|\bcrypto\b|\bbitcoin\b|\bethereum\b|gold\s*bond|\bsgb\b|\bgroww\b|\bzerodha\b|coin\s*dcx|\bwazirx\b|\bkucoin\b|\bbinance\b|\bcoinbase\b|invest|trading|trade|account\s*purchase|prop\s*firm|ftmo|topstep/i,
    category: "investments / trading",
    prettyLabel: "Investment / Trading",
    channel: "upi_normal",
    confidence: "high",
  },

  // ---- GROCERIES / QUICK COMMERCE ----
  { match: /\bbigbasket\b|\bblinkit\b|\bzepto\b|\bdmart\b|\bgrofers\b|grocery|groceries|kirana|reliance\s*fresh|nature\s*basket/i, category: "groceries", prettyLabel: "Groceries", channel: "merchant_app", confidence: "high" },

  // ---- DINING (offline) ----
  { match: /restaurant|\bcafe\b|cafe\s*coffee|\bccd\b|\bstarbucks\b|food\s*court|\bdining\b|\bdinner\b|\blunch\b|\bbreakfast\b/i, category: "dining (offline restaurant)", prettyLabel: "Dining out", channel: "offline_pos", confidence: "medium" },

  // ---- SHOPPING (apparel / electronics offline) ----
  { match: /\bcroma\b|\bvijay\s*sales\b|reliance\s*digital/i, category: "electronics (offline)", prettyLabel: "Electronics store", channel: "offline_pos", confidence: "high" },
  { match: /\blenskart\b/i, category: "lenskart / boat / mamaearth", prettyLabel: "Lenskart", channel: "online", confidence: "high" },
  { match: /\bboat\b|\bmamaearth\b|\bsugar\b|\bplum\b/i, category: "lenskart / boat / mamaearth", prettyLabel: "D2C brand", channel: "online", confidence: "high" },
  { match: /\bdecathlon\b|\badidas\b|\bnike\b|\bpuma\b|\breebok\b/i, category: "online (general)", prettyLabel: "Sports / lifestyle", channel: "online", confidence: "medium" },

  // ---- WALLETS / GIFT CARDS ----
  { match: /amazon\s*pay\s*wallet|\bpaytm\s*wallet\b|\bphonepe\s*wallet\b|wallet\s*top\s*up|\btop\s*up\b|gift\s*card/i, category: "wallet top-up", prettyLabel: "Wallet / Gift card", channel: "online", confidence: "medium" },

  // ---- FOREIGN ----
  {
    match: /amazon\.com|\bnetflix\b|\bspotify\b|\bopenai\b|\bchatgpt\b|claude\.ai|\banthropic\b|\bgithub\b|\baws\b|\bgcp\b|\bazure\b|\bfigma\b|\bnotion\b|\bvercel\b|foreign|international|\busd\b|\beur\b|\bgbp\b/i,
    category: "online subscription / foreign",
    prettyLabel: "Foreign / SaaS subscription",
    channel: "foreign",
    confidence: "high",
    forex: true,
  },

  // ---- HEALTH ----
  { match: /\bapollo\b.*pharm|\bnetmeds\b|\b1mg\b|\bpharmeasy\b|medlife|pharmacy/i, category: "online (general)", prettyLabel: "Pharmacy / health", channel: "online", confidence: "high" },
  { match: /hospital|clinic|doctor|consult|dermat|derma|skin\s*clinic/i, category: "healthcare", prettyLabel: "Healthcare", channel: "online", confidence: "medium" },
];

export function detectCategory(merchant: string): CategoryDetection {
  const text = (merchant || "").trim();
  if (!text) {
    return { category: "general", prettyLabel: "—", channel: "online", confidence: "low" };
  }
  for (const rule of RULES) {
    if (rule.match.test(text)) {
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
  return { category: "general", prettyLabel: text, channel: "online", confidence: "low" };
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
