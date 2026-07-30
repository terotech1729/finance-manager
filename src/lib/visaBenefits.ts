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
        title: "Meet & Assist",
        blurb: "Airport Meet & Assist after $1k intl spend",
        summary: "Complimentary airport Meet & Assist when you spend over USD1,000 abroad in the past 12 months on your Infinite card.",
        howToClaim: "Open the Visa offer page → Redeem Now (online). Book ≥48h ahead. Confirm eligibility ($1k intl POS in prior 12 months) on that page before travel.",
        eligibility: "Visa Infinite; ≥ USD1,000 international spend in past 12 months (per offer T&Cs).",
        valueHint: "₹3k–8k value",
        link: "https://www.visa.co.in/en_in/visa-offers-and-perks/visa-meet-assist/168650?locale=en_IN",
        recommendHint: "Scapia still wins abroad on 0% forex. Only push Live+/BOB intl POS if hunting Meet & Assist eligibility.",
      },
      {
        id: "inf-itc",
        title: "ITC Hotels",
        blurb: "3rd night free or 50% off 2nd night",
        summary: "Experience luxury stays with ITC — complimentary 3rd night for every 2 consecutive paid nights, or 50% off the 2nd night on a 2-night stay (participating properties).",
        howToClaim: "Open the Visa ITC offer → Redeem Now (online redemption). Complete booking through the partner flow and pay with Live+ / Infinite. Check T&Cs on that page before locking dates.",
        eligibility: "India-issued Visa Infinite; offer windows / hotels rotate.",
        valueHint: "1 free / half night",
        link: "https://www.visa.co.in/en_in/visa-offers-and-perks/itc-hotels/166364?locale=en_IN",
      },
      {
        id: "inf-avis",
        title: "Avis rentals",
        blurb: "Up to 35% off + President’s Club",
        summary: "Save up to 35% on standard Avis rates plus complimentary Avis President’s Club membership for Infinite holders.",
        howToClaim: "Open the Visa Avis offer → Redeem Now (online). Book via the partner link and pay with Infinite. Keep the offer confirmation.",
        valueHint: "Up to 35% off",
        link: "https://www.visa.co.in/en_in/visa-offers-and-perks/avis/141275?locale=en_IN",
      },
      {
        id: "inf-ihg",
        title: "IHG Hotels",
        blurb: "Save ~20% flexible rates",
        summary: "Best flexible rates at participating IHG hotels (InterContinental, Six Senses, Holiday Inn, and more).",
        howToClaim: "Open the Visa IHG offer → Redeem Now (online). Book through the linked IHG flow and pay with Infinite.",
        valueHint: "~20% off",
        link: "https://www.visa.co.in/en_in/visa-offers-and-perks/ihg-hotels-resorts/150837?locale=en_IN",
      },
      {
        id: "inf-agoda",
        title: "Agoda",
        blurb: "Up to ~7% off hotels/flights",
        summary: "Discounted hotels, flights and activities in 200+ countries via Visa Infinite × Agoda.",
        howToClaim: "Open the Visa Agoda offer → Redeem Now (online). Complete booking on Agoda through that link; pay with Infinite where required.",
        valueHint: "Up to 7%",
        link: "https://www.visa.co.in/en_in/visa-offers-and-perks/agoda/177864?locale=en_IN",
      },
      {
        id: "inf-dine-visa",
        title: "Dine with Visa",
        blurb: "Exclusive dining program",
        summary: "Visa Infinite Premium Dining Program — curated exclusive dining experiences.",
        howToClaim: "Open the Visa dining offer → Redeem Now / follow restaurant booking steps on that page. Pay with Infinite.",
        link: "https://www.visa.co.in/en_in/visa-offers-and-perks/visa-infinite-premium-dining-program-dine-with-visa/168644?locale=en_IN",
      },
      {
        id: "inf-ajio-luxe",
        title: "Ajio Luxe",
        blurb: "8% off up to ₹4,500",
        summary: "Instant discount of up to ₹4,500 when you spend ₹10,000 or more at Ajio Luxe.",
        howToClaim: "Open the Visa Ajio Luxe offer → Redeem Now (online). Shop via the partner link and pay with Infinite.",
        valueHint: "Up to ₹4,500",
        link: "https://www.visa.co.in/en_in/visa-offers-and-perks/ajio-luxe/172178",
      },
      {
        id: "inf-tattva",
        title: "Tattva Spa",
        blurb: "Flat 20% off select massages",
        summary: "Flat 20% off deep tissue, Indian Abhyanga and Swedish full-body massages.",
        howToClaim: "Open the Visa Tattva Spa offer → Redeem Now / follow booking steps. Pay with Infinite.",
        valueHint: "20% off",
        link: "https://www.visa.co.in/en_in/visa-offers-and-perks/tattva-spa/172048",
      },
      {
        id: "inf-district-play",
        title: "District Play",
        blurb: "Up to 50% off first 3 sports bookings",
        summary: "Save up to 50% (max ₹300) on your first 3 pickleball, padel, football or tennis bookings with District Play.",
        howToClaim: "Open the Visa District offer → Redeem Now (online). Book in District Play via that flow and pay with Infinite / Live+.",
        valueHint: "Up to ₹300×3",
        link: "https://www.visa.co.in/en_in/visa-offers-and-perks/district/179308?locale=en_IN",
      },
      {
        id: "inf-sephora",
        title: "Sephora",
        blurb: "10% off online",
        summary: "10% off all online purchases at Sephora for Infinite holders.",
        howToClaim: "Open the Visa Sephora offer → Redeem Now (online). Shop via the partner link and pay with Infinite.",
        valueHint: "10% off",
        link: "https://www.visa.co.in/en_in/visa-offers-and-perks/sephora/178058",
      },
      {
        id: "inf-concierge",
        title: "Visa Concierge",
        blurb: "24/7 dining, travel & tickets help",
        summary: "Recommendations, reservations and assistance 24/7 via Visa Concierge Asia.",
        howToClaim: "Open concierge-asia.visa.com (or call the Infinite concierge number on your card / HSBC app).",
        link: "https://www.concierge-asia.visa.com/",
      },
      {
        id: "inf-liveplus-reserve",
        title: "Live+ Reserve dining",
        blurb: "DineWithTimesPrime from 1 Aug 2026",
        summary: "HSBC Live+ Reserve powered by DineWithTimesPrime — curated fine-dining restaurants (Indian Accent, Tresind, Comorin, Olive, etc.) with chef menus and complimentary beverages/desserts, plus Times Prime lifestyle privileges.",
        howToClaim: "Open dinewithtimesprime.com/hsbcliveplus → activate / book with Live+. Live+ only (not BOB).",
        eligibility: "HSBC Live+ from 1 Aug 2026.",
        valueHint: "High if used",
        link: "https://dinewithtimesprime.com/hsbcliveplus",
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
