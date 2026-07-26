/**
 * Visa network-tier perks (India) — issuer-agnostic benefits that come with the
 * plastic's Visa tier, separate from bank cashback / lounge rules.
 *
 * Sources change often; treat claim links / eligibility as "verify before travel".
 * Held cards mapped in HELD_VISA_TIERS.
 */

export type VisaTier = "infinite" | "signature" | "platinum";

export type VisaPerk = {
  id: string;
  title: string;
  summary: string;
  howToClaim: string;
  eligibility?: string;
  valueHint?: string;
  link?: string;
  /** Soft signal for recommend / tips (not a hard cash %). */
  recommendHint?: string;
};

export type VisaTierGuide = {
  tier: VisaTier;
  label: string;
  short: string;
  heldCardIds: string[];
  perks: VisaPerk[];
};

/** Which of your cards unlock which Visa tier. */
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
    short: "Top Visa tier — Meet & Assist, ITC, Avis, concierge",
    heldCardIds: ["hsbc_live_plus", "bob_eterna"],
    perks: [
      {
        id: "inf-meet-greet",
        title: "Airport Meet & Greet (India)",
        summary:
          "Complimentary international departure/arrival Meet & Assist at select Indian airports (Adani / Visa programme) — curb-to-gate help, porter, often lounge access where available.",
        howToClaim:
          "Book at visameetandgreet.com at least 48 hours ahead. Use an India-issued Visa Infinite card. 1 complimentary visit per calendar year (unused visits don't roll over).",
        eligibility:
          "Typically needs ≥ USD 1,000 international card-present spend in the prior 12 months on that Infinite card (cash advances / disputed txns don't count).",
        valueHint: "~₹3,000–8,000 retail Meet & Assist value if you fly intl via India hubs",
        link: "https://www.visameetandgreet.com/",
        recommendHint: "If you're building toward $1k intl POS on Live+ or BOB, Scapia 0% forex still wins on markup — but one Infinite card can take a deliberate intl POS push for Meet & Greet eligibility.",
      },
      {
        id: "inf-itc",
        title: "ITC Hotels offers",
        summary:
          "Visa Infinite cardholders often get preferential ITC stays (e.g. complimentary night / % off second night on participating properties). Exact offer rotates.",
        howToClaim:
          "Book via the live Visa × ITC offer page or ITC site with Infinite BIN; pay with Infinite card. Check current T&Cs before travel.",
        eligibility: "India-issued Visa Infinite; offer windows vary.",
        valueHint: "Can be worth a full night at premium ITC properties when live",
        link: "https://www.visa.co.in/",
      },
      {
        id: "inf-avis",
        title: "Avis car rental benefits",
        summary: "Preferred rates / upgrades for Visa Infinite on Avis rentals (domestic & intl where offered).",
        howToClaim: "Quote Visa Infinite rate code on Avis India / global booking; pay with Infinite card.",
        link: "https://www.visa.co.in/",
      },
      {
        id: "inf-concierge",
        title: "Visa Infinite Concierge",
        summary: "Lifestyle concierge for dining, travel, entertainment bookings (availability depends on issuer activation).",
        howToClaim: "Call the Visa Infinite concierge number on the back of the card / issuer app.",
      },
      {
        id: "inf-emergency",
        title: "Travel emergency assistance",
        summary: "24×7 multilingual referral help (medical, legal, lost luggage guidance). Assistance only — you pay for services used.",
        howToClaim: "Use Visa global customer assistance numbers from visa.co.in while travelling.",
        link: "https://www.visa.co.in/",
      },
      {
        id: "inf-times-prime",
        title: "Times Prime (when bundled)",
        summary:
          "Many Infinite / Signature issuers bundle complimentary Times Prime (Spotify, Uber One, OTT packs, etc.). Live+ specifically advertises 12-mo Times Prime.",
        howToClaim: "Activate via issuer email / timesprime.com Visa offer with card verification (often ₹1 auth).",
        link: "https://www.timesprime.com/visa-offer",
        valueHint: "Often ₹1,000+ of sub value if you use Spotify / Uber / OTT",
      },
    ],
  },
  {
    tier: "signature",
    label: "Visa Signature",
    short: "Lifestyle tier — Times Prime, MMT seats, dining offers",
    heldCardIds: ["scapia"],
    perks: [
      {
        id: "sig-times-prime",
        title: "Complimentary Times Prime (1 year)",
        summary:
          "Visa Signature credit cards in India typically unlock a free Times Prime membership (Spotify, Uber One, Watcho/OTT packs, Lenskart, etc.). Offer windows renew periodically.",
        howToClaim:
          "Go to timesprime.com/visa-offer → Activate → verify with Signature card. Cancel auto-renew before paid period starts.",
        eligibility: "India-issued Visa Signature; usually 1 membership per card.",
        valueHint: "High if you use 2–3 of the bundled apps",
        link: "https://www.timesprime.com/visa-offer",
      },
      {
        id: "sig-mmt-seat",
        title: "MakeMyTrip complimentary seat selection",
        summary: "Domestic flight seat selection discounts / comps (often ~2 bookings per FY) when paying with Signature.",
        howToClaim: "Book on MakeMyTrip, pay with Signature; promo often auto-applies at payment (check live Visa × MMT T&Cs).",
        link: "https://www.visa.co.in/",
      },
      {
        id: "sig-mmt-hotel",
        title: "MakeMyTrip hotel cashback / My Cash",
        summary: "Periodic Visa Signature hotel offers (e.g. wallet cashback with a promo code). Rotating — verify before booking.",
        howToClaim: "Use the live promo code on MMT hotels; pay with Signature.",
        link: "https://www.makemytrip.com/",
      },
      {
        id: "sig-dining",
        title: "Dining / District-style offers",
        summary: "Issuer + Visa Signature dining discounts (Live+ also has District BOGO separately as an HSBC perk).",
        howToClaim: "Check issuer app offers + Visa offers portal before dining out.",
      },
    ],
  },
  {
    tier: "platinum",
    label: "Visa Platinum",
    short: "Entry premium — shopping protection + lighter lifestyle offers",
    heldCardIds: ["sbi_simplyclick", "amazon_pay_icici"],
    perks: [
      {
        id: "plat-purchase-protection",
        title: "Purchase protection / extended warranty (where offered)",
        summary:
          "Some India Platinum programmes include limited purchase protection or extended warranty. Coverage is issuer-specific and often underused.",
        howToClaim: "Read your card's Guide to Benefits PDF; file via issuer within the stated window with invoice + card statement.",
        eligibility: "Varies heavily by issuer — confirm on SBI Card / ICICI app for your plastic.",
      },
      {
        id: "plat-offers",
        title: "Visa offers portal",
        summary: "Rotating merchant discounts (travel, shopping, dining) for Platinum BINs.",
        howToClaim: "Browse visa.co.in offers and pay with the Platinum card.",
        link: "https://www.visa.co.in/",
      },
      {
        id: "plat-times-prime",
        title: "Times Prime (if your BIN is eligible)",
        summary:
          "Some Platinum cards are included in Visa × Times Prime campaigns; Signature/Infinite are more consistently covered. Check the offer page with your card.",
        howToClaim: "Try timesprime.com/visa-offer — it will accept or reject based on BIN.",
        link: "https://www.timesprime.com/visa-offer",
      },
    ],
  },
];

export function visaTierForCard(cardId: string): VisaTier | null {
  return HELD_VISA_BY_CARD[cardId] ?? null;
}

export function guidesForHeldCards(): VisaTierGuide[] {
  return VISA_TIER_GUIDES.filter((g) => g.heldCardIds.length > 0);
}
