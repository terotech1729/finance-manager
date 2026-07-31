/**
 * One-time claimable benefits — vouchers, welcome bonuses, enrollments, limited activations.
 * Recurring perks (BOGO, lounges, monthly unlocks, Visa portal discounts, Amex Offers)
 * live in Recommend / Network perks / Milestones — not this checklist.
 */

export type BenefitUrgency = "urgent" | "open";

export type BenefitClaim = {
  id: string;
  cardId: string;
  cardLabel: string;
  title: string;
  detail: string;
  how?: string;
  link?: string;
  /** Approximate value when claimed / activated. */
  valueHint?: string;
  urgency: BenefitUrgency;
  /** Sync to AppState boolean / array when toggled. */
  legacyKey?: "bobWelcomeUnlocked" | "hsbcWelcomeClaimed" | "hdfcDebitWelcomeGyftrClaimed" | "amazonWelcome";
  /** For amazonWelcome — matching AMAZON_WELCOME_OFFERS id. */
  amazonOfferId?: string;
};

export const BENEFIT_CLAIMS: readonly BenefitClaim[] = [
  // ── BOB Eterna ──────────────────────────────────────────────
  {
    id: "bob_fitpass",
    cardId: "bob_eterna",
    cardLabel: "BOB Eterna",
    title: "FITPASS Pro welcome membership",
    detail: "Complimentary FITPASS Pro (6–12 mo depending on cohort). Must activate within ~60 days of card issuance or it lapses.",
    how: "Wait ~15 days after delivery for whitelist → fitpass.co.in/corporates/bobcards → mobile + first 6 digits of card → OTP.",
    link: "https://fitpass.co.in/corporates/bobcards",
    valueHint: "~₹15k–48k",
    urgency: "urgent",
  },
  {
    id: "bob_welcome_50k",
    cardId: "bob_eterna",
    cardLabel: "BOB Eterna",
    title: "₹50k / 60-day welcome → 10,000 RP",
    detail: "Spend ₹50,000 within 60 days of issuance for 10,000 bonus RP (~₹2,500 at ₹0.25).",
    how: "Route eligible retail to Eterna until ₹50k; mark when bonus RP is credited.",
    valueHint: "~₹2,500",
    urgency: "urgent",
    legacyKey: "bobWelcomeUnlocked",
  },
  {
    id: "bob_annual_5l",
    cardId: "bob_eterna",
    cardLabel: "BOB Eterna",
    title: "₹5L annual → 20,000 RP credited",
    detail: "One-time annual milestone: 20,000 RP (~₹5,000) when ₹5L spend posts.",
    how: "Track in Milestones; mark when bonus RP posts on the statement.",
    valueHint: "~₹5,000",
    urgency: "open",
  },

  // ── HSBC Live+ ──────────────────────────────────────────────
  {
    id: "hsbc_welcome_1k",
    cardId: "hsbc_live_plus",
    cardLabel: "HSBC Live+",
    title: "Welcome ₹1,000 cashback (₹25k / 30d + app login)",
    detail: "Download & log into HSBC India app and spend ~₹25,000 within 30 days of issuance.",
    how: "App login + eligible spend; cashback typically within 60 days after the 30-day window.",
    valueHint: "₹1,000",
    urgency: "urgent",
    legacyKey: "hsbcWelcomeClaimed",
  },
  {
    id: "hsbc_activate_750",
    cardId: "hsbc_live_plus",
    cardLabel: "HSBC Live+",
    title: "₹750 activate voucher (txn ≥₹300)",
    detail: "Amazon Pay / Zomato / Swiggy voucher after activating with a single ≥₹300 transaction.",
    how: "Watch SMS/email ~5 days after eligible txn; claim within issuer window (~95 days).",
    valueHint: "₹750",
    urgency: "urgent",
  },
  {
    id: "hsbc_vkyc_250",
    cardId: "hsbc_live_plus",
    cardLabel: "HSBC Live+",
    title: "₹250 Amazon e-gift (online apply + VKYC)",
    detail: "If you applied online and completed video KYC, confirm ₹250 Amazon voucher credited.",
    how: "Check welcome email / Amazon Pay balance / HSBC communications.",
    valueHint: "₹250",
    urgency: "open",
  },
  {
    id: "hsbc_times_prime",
    cardId: "hsbc_live_plus",
    cardLabel: "HSBC Live+",
    title: "Times Prime activated",
    detail: "One-time activation of Times Prime / Live+ Reserve dining access.",
    how: "Activate via HSBC / Times Prime / dinewithtimesprime.com/hsbcliveplus.",
    link: "https://dinewithtimesprime.com/hsbcliveplus",
    urgency: "open",
  },
  {
    id: "hsbc_liveplus_reserve",
    cardId: "hsbc_live_plus",
    cardLabel: "HSBC Live+",
    title: "Live+ Reserve account activated",
    detail: "DineWithTimesPrime curated restaurants programme (from ~1 Aug 2026) — mark once activated.",
    how: "Activate account → then book restaurants as needed (bookings themselves are not checklist items).",
    link: "https://dinewithtimesprime.com/hsbcliveplus",
    urgency: "open",
  },

  // ── Amex PT ─────────────────────────────────────────────────
  {
    id: "amex_pt_priority_pass",
    cardId: "amex_plat_travel",
    cardLabel: "Amex PT",
    title: "Priority Pass enrollment",
    detail: "Enroll once if not already. Membership fee waived with PT; intl visits usually paid.",
    how: "americanexpress.com/in → Benefits → Priority Pass / LoungeKey as issued.",
    urgency: "open",
  },
  {
    id: "amex_pt_taj",
    cardId: "amex_plat_travel",
    cardLabel: "Amex PT",
    title: "Taj / Marriott milestone voucher redeemed",
    detail: "When a higher annual milestone unlocks a hotel voucher — mark after you redeem it.",
    how: "Confirm voucher credit after ₹4L / ₹7L (current T&Cs); redeem before expiry.",
    urgency: "open",
  },

  // ── Amex MRCC ───────────────────────────────────────────────
  {
    id: "amex_mrcc_20k_enroll",
    cardId: "amex_mrcc",
    cardLabel: "Amex MRCC",
    title: "₹20k/mo bonus enrollment confirmed",
    detail: "One-time check: enrollment for 1,000 MR at ₹20k/mo is still active (not the monthly hit itself).",
    how: "americanexpress.com/in → MRCC ₹20k benefit → enroll / verify.",
    urgency: "open",
  },

  // ── IDFC Indigo ─────────────────────────────────────────────
  {
    id: "idfc_bluchip_2l",
    cardId: "idfc_indigo",
    cardLabel: "IDFC Indigo",
    title: "₹2L milestone BluChip voucher redeemed",
    detail: "Voucher credits ~5 days after statement month; ~6 months validity.",
    how: "IndiGo BluChips wallet / email → redeem on IndiGo before expiry.",
    valueHint: "Voucher",
    urgency: "urgent",
  },
  {
    id: "idfc_bluchip_5l",
    cardId: "idfc_indigo",
    cardLabel: "IDFC Indigo",
    title: "₹5L milestone BluChip voucher redeemed",
    detail: "Same credit/validity rules as ₹2L voucher — check wallet for unused codes.",
    how: "Redeem on IndiGo before voucher expiry.",
    valueHint: "Voucher",
    urgency: "urgent",
  },

  // ── Kiwi Neon (claimable lounge passes when unlocked) ─────
  {
    id: "kiwi_lounge_50k",
    cardId: "yes_kiwi",
    cardLabel: "Kiwi Neon",
    title: "Lounge pass claimed @ ₹50k cycle",
    detail: "Claim the lounge pass in Kiwi after the milestone unlocks (typically ~6-mo validity).",
    how: "Kiwi app → Benefits / Lounge after hitting spend.",
    urgency: "open",
  },
  {
    id: "kiwi_lounge_1l",
    cardId: "yes_kiwi",
    cardLabel: "Kiwi Neon",
    title: "Lounge pass claimed @ ₹1L cycle",
    detail: "Second Neon lounge pass — mark when claimed in-app.",
    how: "Claim in Kiwi app when unlocked.",
    urgency: "open",
  },
  {
    id: "kiwi_lounge_15l",
    cardId: "yes_kiwi",
    cardLabel: "Kiwi Neon",
    title: "Lounge pass claimed @ ₹1.5L cycle",
    detail: "Third Neon lounge pass — mark when claimed in-app.",
    how: "Claim in Kiwi app when unlocked.",
    urgency: "open",
  },

  // ── SBI SimplyCLICK ─────────────────────────────────────────
  {
    id: "sbi_fee_waiver",
    cardId: "sbi_simplyclick",
    cardLabel: "SBI SimplyCLICK",
    title: "Annual fee waived (this fee year)",
    detail: "Mark once the fee-anniversary waiver posts on the statement (₹1L eligible retail).",
    how: "Confirm on statement after fee levy / reversal.",
    valueHint: "~₹589+GST",
    urgency: "open",
  },
  {
    id: "sbi_online_1l",
    cardId: "sbi_simplyclick",
    cardLabel: "SBI SimplyCLICK",
    title: "Online ₹1L → Cleartrip/Yatra ₹2k e-voucher",
    detail: "Online spend milestone voucher — mark when redeemed (or when expired unused).",
    how: "Voucher via SMS/email after threshold; redeem before expiry.",
    valueHint: "₹2,000",
    urgency: "open",
  },
  {
    id: "sbi_online_2l",
    cardId: "sbi_simplyclick",
    cardLabel: "SBI SimplyCLICK",
    title: "Online ₹2L → second Cleartrip/Yatra ₹2k e-voucher",
    detail: "Second online milestone voucher in the same voucher year.",
    how: "Redeem voucher before expiry.",
    valueHint: "₹2,000",
    urgency: "open",
  },

  // ── Amazon Pay ICICI welcome coupons ────────────────────────
  {
    id: "amz_shop",
    cardId: "amazon_pay_icici",
    cardLabel: "Amazon Pay ICICI",
    title: "Welcome: first Amazon order coupon",
    detail: "Typical cohort: 100% up to ₹200 on first Amazon order.",
    how: "Amazon → Your Cards → Amazon Pay ICICI → Offers.",
    valueHint: "up to ₹200",
    urgency: "open",
    legacyKey: "amazonWelcome",
    amazonOfferId: "amz_shop",
  },
  {
    id: "amz_broadband",
    cardId: "amazon_pay_icici",
    cardLabel: "Amazon Pay ICICI",
    title: "Welcome: first broadband bill",
    detail: "Typical: 25% up to ₹550.",
    how: "Pay broadband with Amazon Pay ICICI while coupon live.",
    valueHint: "up to ₹550",
    urgency: "open",
    legacyKey: "amazonWelcome",
    amazonOfferId: "amz_broadband",
  },
  {
    id: "amz_postpaid",
    cardId: "amazon_pay_icici",
    cardLabel: "Amazon Pay ICICI",
    title: "Welcome: first postpaid bill",
    detail: "Typical: 25% up to ₹500.",
    how: "Amazon Pay ICICI → Offers.",
    valueHint: "up to ₹500",
    urgency: "open",
    legacyKey: "amazonWelcome",
    amazonOfferId: "amz_postpaid",
  },
  {
    id: "amz_dth",
    cardId: "amazon_pay_icici",
    cardLabel: "Amazon Pay ICICI",
    title: "Welcome: first DTH recharge",
    detail: "Typical: 25% up to ₹250.",
    how: "Amazon Pay ICICI → Offers.",
    valueHint: "up to ₹250",
    urgency: "open",
    legacyKey: "amazonWelcome",
    amazonOfferId: "amz_dth",
  },
  {
    id: "amz_gas",
    cardId: "amazon_pay_icici",
    cardLabel: "Amazon Pay ICICI",
    title: "Welcome: first gas booking",
    detail: "Typical: 10% up to ₹250.",
    how: "Amazon Pay ICICI → Offers.",
    valueHint: "up to ₹250",
    urgency: "open",
    legacyKey: "amazonWelcome",
    amazonOfferId: "amz_gas",
  },
  {
    id: "amz_elec",
    cardId: "amazon_pay_icici",
    cardLabel: "Amazon Pay ICICI",
    title: "Welcome: first electricity bill",
    detail: "Typical: 20% up to ₹100.",
    how: "Amazon Pay ICICI → Offers.",
    valueHint: "up to ₹100",
    urgency: "open",
    legacyKey: "amazonWelcome",
    amazonOfferId: "amz_elec",
  },
  {
    id: "amz_prepaid",
    cardId: "amazon_pay_icici",
    cardLabel: "Amazon Pay ICICI",
    title: "Welcome: first prepaid recharge",
    detail: "Typical: 50% up to ₹50.",
    how: "Amazon Pay ICICI → Offers.",
    valueHint: "up to ₹50",
    urgency: "open",
    legacyKey: "amazonWelcome",
    amazonOfferId: "amz_prepaid",
  },

  // ── HDFC Debit / GyFTR ──────────────────────────────────────
  {
    id: "hdfc_gyftr_received",
    cardId: "hdfc_visa_platinum_debit",
    cardLabel: "HDFC Debit",
    title: "Welcome GyFTR ₹750 received",
    detail: "New-account campaign: 5× ≥₹500 POS/ecom → ₹750 GyFTR voucher emailed.",
    how: "Check email/SMS; code on gyftr.com/rewards/hdfcbank-dc-campaigns.",
    link: "https://www.gyftr.com/rewards/hdfcbank-dc-campaigns/",
    valueHint: "₹750",
    urgency: "open",
    legacyKey: "hdfcDebitWelcomeGyftrClaimed",
  },
  {
    id: "hdfc_gyftr_spent",
    cardId: "hdfc_visa_platinum_debit",
    cardLabel: "HDFC Debit",
    title: "GyFTR ₹750 balance spent / redeemed",
    detail: "Spend voucher on GyFTR merchants before code expiry.",
    how: "Redeem via GyFTR portal / merchant list; mark when balance is zero.",
    link: "https://www.gyftr.com/rewards/hdfcbank-dc-campaigns/",
    valueHint: "₹750",
    urgency: "urgent",
  },

  // ── Visa Infinite — limited / one-time only ─────────────────
  {
    id: "visa_inf_district_play",
    cardId: "visa_infinite",
    cardLabel: "Visa Infinite",
    title: "District Play (first 3 sports bookings used)",
    detail: "Limited pool: up to 50% off (max ₹300) on first 3 pickleball/padel bookings — mark when exhausted.",
    how: "Visa District offer → Redeem Now → District Play.",
    link: "https://www.visa.co.in/en_in/visa-offers-and-perks/district/179308?locale=en_IN",
    urgency: "open",
  },
  {
    id: "visa_inf_concierge",
    cardId: "visa_infinite",
    cardLabel: "Visa Infinite",
    title: "Visa Concierge activated",
    detail: "One-time: register / first use of Visa Concierge (24/7 dining, travel & tickets).",
    how: "concierge-asia.visa.com or number on card / HSBC app.",
    link: "https://www.concierge-asia.visa.com/",
    urgency: "open",
  },
];

export function benefitCardGroups(): { cardId: string; cardLabel: string; items: BenefitClaim[] }[] {
  const order: string[] = [];
  const map = new Map<string, BenefitClaim[]>();
  for (const b of BENEFIT_CLAIMS) {
    if (!map.has(b.cardId)) {
      order.push(b.cardId);
      map.set(b.cardId, []);
    }
    map.get(b.cardId)!.push(b);
  }
  return order.map((cardId) => ({
    cardId,
    cardLabel: map.get(cardId)![0].cardLabel,
    items: map.get(cardId)!,
  }));
}

/** Minimal state shape for claim lookups (AppState-compatible). */
export type ClaimState = {
  benefitClaims?: Record<string, boolean>;
  bobWelcomeUnlocked?: boolean;
  hsbcWelcomeClaimed?: boolean;
  hdfcDebitWelcomeGyftrClaimed?: boolean;
  amazonWelcomeClaimed?: string[];
  gyftrVouchers?: { id: string; redeemed?: boolean }[];
  gyftrBalance?: number;
};

/** Whether a benefit is marked claimed (explicit checklist OR legacy flag). */
export function isBenefitClaimed(id: string, st: ClaimState): boolean {
  const explicit = st.benefitClaims?.[id];
  if (typeof explicit === "boolean") return explicit;

  const b = BENEFIT_CLAIMS.find((x) => x.id === id);
  if (!b?.legacyKey) {
    if (id === "hdfc_gyftr_spent") {
      return !!st.gyftrVouchers?.find((x) => x.id === "gyftr-hdfc-dc-750")?.redeemed;
    }
    return false;
  }
  if (b.legacyKey === "bobWelcomeUnlocked") return !!st.bobWelcomeUnlocked;
  if (b.legacyKey === "hsbcWelcomeClaimed") return !!st.hsbcWelcomeClaimed;
  if (b.legacyKey === "hdfcDebitWelcomeGyftrClaimed") return !!st.hdfcDebitWelcomeGyftrClaimed;
  if (b.legacyKey === "amazonWelcome" && b.amazonOfferId) {
    return (st.amazonWelcomeClaimed ?? []).includes(b.amazonOfferId);
  }
  return false;
}

/** Apply claim toggle; returns a patch to merge into AppState. */
export function applyBenefitClaim(
  id: string,
  claimed: boolean,
  st: ClaimState
): Partial<ClaimState> {
  const b = BENEFIT_CLAIMS.find((x) => x.id === id);
  const benefitClaims = { ...(st.benefitClaims ?? {}), [id]: claimed };
  const patch: Partial<ClaimState> = { benefitClaims };

  if (b?.legacyKey === "bobWelcomeUnlocked") patch.bobWelcomeUnlocked = claimed;
  if (b?.legacyKey === "hsbcWelcomeClaimed") patch.hsbcWelcomeClaimed = claimed;
  if (b?.legacyKey === "hdfcDebitWelcomeGyftrClaimed") patch.hdfcDebitWelcomeGyftrClaimed = claimed;
  if (b?.legacyKey === "amazonWelcome" && b.amazonOfferId) {
    const set = new Set(st.amazonWelcomeClaimed ?? []);
    if (claimed) set.add(b.amazonOfferId);
    else set.delete(b.amazonOfferId);
    patch.amazonWelcomeClaimed = Array.from(set);
  }
  if (id === "hdfc_gyftr_spent") {
    const vouchers = (st.gyftrVouchers ?? []).map((v) =>
      v.id === "gyftr-hdfc-dc-750" ? { ...v, redeemed: claimed } : v
    );
    patch.gyftrVouchers = vouchers;
    if (claimed) patch.gyftrBalance = 0;
  }
  return patch;
}
