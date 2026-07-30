/**
 * Visa network-tier perks (India) — issuer-agnostic benefits that come with the
 * plastic's Visa tier, separate from bank cashback / lounge rules.
 *
 * Sources change often; treat claim links / eligibility as "verify before travel".
 */

export type VisaTier = "infinite" | "signature" | "platinum";

export type VisaPerk = {
  id: string;
  title: string;
  /** One-line scannable blurb for the tile. */
  blurb: string;
  summary: string;
  howToClaim: string;
  eligibility?: string;
  valueHint?: string;
  link?: string;
  recommendHint?: string;
};

export type VisaTierGuide = {
  tier: VisaTier;
  label: string;
  short: string;
  accent: string; // tailwind-ish gradient classes for the tier hero
  heldCardIds: string[];
  perks: VisaPerk[];
};

export const HELD_VISA_BY_CARD: Record<string, VisaTier> = {
  hsbc_live_plus: "infinite",
  bob_eterna: "infinite",
  scapia: "signature",
  sbi_simplyclick: "platinum",
  amazon_pay_icici: "platinum",
};

export const VISA_TIER_GUIDES: VisaTierGuide[] = [
  {
    tier: "infinite",
    label: "Visa Infinite",
    short: "Your top Visa tier",
    accent: "from-violet-600/40 via-fuchsia-700/20 to-bg-elevated",
    heldCardIds: ["hsbc_live_plus", "bob_eterna"],
    perks: [
      {
        id: "inf-meet-greet",
        title: "Meet & Greet",
        blurb: "1×/yr curb-to-gate at select India airports",
        summary: "Complimentary international Meet & Assist at select Indian airports — porter, escort, often lounge where available.",
        howToClaim: "Book at visameetandgreet.com ≥48h ahead. 1 free visit / calendar year.",
        eligibility: "Usually ≥ $1,000 intl card-present spend in prior 12 months on that Infinite card.",
        valueHint: "₹3k–8k value",
        link: "https://www.visameetandgreet.com/",
        recommendHint: "Scapia still wins abroad on 0% forex. Only push Live+/BOB intl POS if hunting Meet & Greet eligibility.",
      },
      {
        id: "inf-itc",
        title: "ITC Hotels",
        blurb: "3rd night free or 50% off 2nd night",
        summary: "Complimentary 3rd night for every 2 consecutive paid nights, or stay 2 nights and get 50% off the 2nd night at participating ITC Hotels (Visa Infinite × Live+).",
        howToClaim: "Book via Visa × ITC / ITC site with Infinite BIN; pay Live+ or other Infinite.",
        eligibility: "India-issued Visa Infinite; offer windows rotate.",
        valueHint: "1 free / half night",
        link: "https://www.visa.co.in/",
      },
      {
        id: "inf-avis",
        title: "Avis rentals",
        blurb: "Up to 35% off + President’s Club",
        summary: "Save up to 35% on standard rates with Avis and complimentary Avis President’s Club membership for Infinite holders.",
        howToClaim: "Quote Visa Infinite rate code on Avis; pay with Infinite.",
        valueHint: "Up to 35% off",
        link: "https://www.visa.co.in/",
      },
      {
        id: "inf-ihg",
        title: "IHG Hotels",
        blurb: "Save ~20% flexible rates",
        summary: "Best flexible rates at participating IHG hotels (InterContinental, Six Senses, Holiday Inn, etc.).",
        howToClaim: "Book via Visa Infinite IHG offer link; pay Infinite.",
        valueHint: "~20% off",
        link: "https://www.visa.co.in/",
      },
      {
        id: "inf-agoda",
        title: "Agoda",
        blurb: "Up to ~7% off hotels/flights",
        summary: "Discounted hotels, flights and activities in 200+ countries via Visa Infinite × Agoda.",
        howToClaim: "Use Visa Infinite Agoda portal; pay Infinite where required.",
        valueHint: "Up to 7%",
        link: "https://www.visa.co.in/",
      },
      {
        id: "inf-concierge",
        title: "Concierge",
        blurb: "Dining, travel & tickets help",
        summary: "Lifestyle concierge for bookings (issuer-dependent).",
        howToClaim: "Call the Infinite concierge number on the card / issuer app.",
      },
      {
        id: "inf-emergency",
        title: "Travel help",
        blurb: "24×7 medical / legal / luggage referrals",
        summary: "Global assistance referrals. You still pay for services used.",
        howToClaim: "Visa global assistance numbers on visa.co.in while travelling.",
        link: "https://www.visa.co.in/",
      },
      {
        id: "inf-times-prime",
        title: "Times Prime / Live+ Reserve",
        blurb: "Fine dining + Toni&Guy, Sony LIV, TUMI",
        summary: "Live+ Reserve (DineWithTimesPrime from 1 Aug 2026): curated restaurants with chef menus + comps. Times Prime lifestyle privileges across Toni & Guy, Sony LIV, TUMI and more.",
        howToClaim: "Activate via Live+ Reserve / Times Prime Visa offer; use Live+ where required.",
        valueHint: "High if used",
        link: "https://www.hsbc.co.in/credit-cards/products/live-plus/",
      },
      {
        id: "inf-liveplus-lifestyle",
        title: "Live+ cinema & beauty",
        blurb: "District + BMS BOGO, Sephora 10%",
        summary: "Issuer perks on Live+: District and BookMyShow cinema BOGO, 10% off BMS live events, District Play sports discounts, 10% Sephora online.",
        howToClaim: "Use District / BookMyShow / Sephora with Live+ and apply the in-app offer.",
        eligibility: "HSBC Live+ (Visa Infinite).",
        valueHint: "BOGO + % off",
        link: "https://www.hsbc.co.in/credit-cards/products/live-plus/",
      },
    ],
  },
  {
    tier: "signature",
    label: "Visa Signature",
    short: "Lifestyle stack",
    accent: "from-sky-600/35 via-indigo-700/15 to-bg-elevated",
    heldCardIds: ["scapia"],
    perks: [
      {
        id: "sig-times-prime",
        title: "Times Prime",
        blurb: "1 year free — Spotify, Uber, OTT",
        summary: "Complimentary Times Prime for Signature cards in India.",
        howToClaim: "timesprime.com/visa-offer → Activate → verify Signature. Cancel auto-renew later.",
        eligibility: "India Visa Signature; usually 1 membership / card.",
        valueHint: "High if used",
        link: "https://www.timesprime.com/visa-offer",
      },
      {
        id: "sig-mmt-seat",
        title: "MMT seats",
        blurb: "~2 free seat picks / FY on domestic",
        summary: "Domestic flight seat selection comps/discounts via MakeMyTrip.",
        howToClaim: "Book on MMT, pay Signature; promo often auto-applies.",
        link: "https://www.visa.co.in/",
      },
      {
        id: "sig-mmt-hotel",
        title: "MMT hotels",
        blurb: "Rotating My Cash / cashback",
        summary: "Periodic Signature hotel wallet cashback — verify before booking.",
        howToClaim: "Use live promo on MMT hotels; pay Signature.",
        link: "https://www.makemytrip.com/",
      },
      {
        id: "sig-dining",
        title: "Dining",
        blurb: "Issuer + Visa dining discounts",
        summary: "Signature dining offers; Live+ also has separate District BOGO (issuer perk).",
        howToClaim: "Check issuer app + Visa offers before dining.",
      },
    ],
  },
  {
    tier: "platinum",
    label: "Visa Platinum",
    short: "Everyday extras",
    accent: "from-slate-500/30 via-zinc-700/20 to-bg-elevated",
    heldCardIds: ["sbi_simplyclick", "amazon_pay_icici"],
    perks: [
      {
        id: "plat-purchase-protection",
        title: "Purchase cover",
        blurb: "Protection / warranty (issuer-specific)",
        summary: "Limited purchase protection or extended warranty on some Platinum programmes.",
        howToClaim: "Check Guide to Benefits PDF; file via issuer with invoice + statement.",
        eligibility: "Confirm on SBI Card / ICICI app for your plastic.",
      },
      {
        id: "plat-offers",
        title: "Visa offers",
        blurb: "Rotating shopping & travel deals",
        summary: "Merchant discounts for Platinum BINs.",
        howToClaim: "Browse visa.co.in offers; pay with Platinum.",
        link: "https://www.visa.co.in/",
      },
      {
        id: "plat-times-prime",
        title: "Times Prime?",
        blurb: "Try your BIN — not always eligible",
        summary: "Some Platinum BINs qualify for Times Prime; Signature/Infinite are more reliable.",
        howToClaim: "Try timesprime.com/visa-offer — accept/reject by BIN.",
        link: "https://www.timesprime.com/visa-offer",
      },
    ],
  },
];

export function visaTierForCard(cardId: string): VisaTier | null {
  return HELD_VISA_BY_CARD[cardId] ?? null;
}
