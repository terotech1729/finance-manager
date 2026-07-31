/**
 * Issuer / network benefits you can claim or activate — checklist for the portal.
 * Mark claimed in /claims; some IDs sync to legacy AppState flags used by Recommend.
 */

export type BenefitUrgency = "urgent" | "open" | "ongoing" | "info";

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
    how: "Route eligible retail to Eterna until ₹50k; bonus posts after window. Mark claimed when RP credited.",
    valueHint: "~₹2,500",
    urgency: "urgent",
    legacyKey: "bobWelcomeUnlocked",
  },
  {
    id: "bob_lounge_qtr",
    cardId: "bob_eterna",
    cardLabel: "BOB Eterna",
    title: "Unlimited domestic lounge (₹75k prior quarter)",
    detail: "From mid-2026, unlock needs ₹75,000 spend in the preceding calendar quarter (was ₹40k). First issue-quarter often exempt.",
    how: "Track prior-quarter spend; use lounge via Visa Infinite / Dreamfolks as issued.",
    valueHint: "Unlimited domestic",
    urgency: "ongoing",
  },
  {
    id: "bob_district_bogo",
    cardId: "bob_eterna",
    cardLabel: "BOB Eterna",
    title: "District BOGO movie (₹250/mo)",
    detail: "Buy-one-get-one movie ticket via District, typically capped ~₹250/mo.",
    how: "Book on District with Eterna; confirm BOGO applies before pay.",
    valueHint: "~₹250/mo",
    urgency: "ongoing",
  },
  {
    id: "bob_annual_5l",
    cardId: "bob_eterna",
    cardLabel: "BOB Eterna",
    title: "₹5L annual → 20,000 RP",
    detail: "Milestone 20,000 RP (~₹5,000) at ₹5,00,000 annual spend.",
    how: "Track in Milestones; mark when bonus RP posts.",
    valueHint: "~₹5,000",
    urgency: "ongoing",
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
    title: "Times Prime lifestyle privileges",
    detail: "Times Prime access bundled with Live+ / Live+ Reserve dining programme.",
    how: "Activate via HSBC / Times Prime / dinewithtimesprime.com/hsbcliveplus.",
    link: "https://dinewithtimesprime.com/hsbcliveplus",
    urgency: "open",
  },
  {
    id: "hsbc_liveplus_reserve",
    cardId: "hsbc_live_plus",
    cardLabel: "HSBC Live+",
    title: "Live+ Reserve fine dining",
    detail: "DineWithTimesPrime curated restaurants (chef menus, comps) from ~1 Aug 2026.",
    how: "Activate account → book participating restaurants; pay with Live+.",
    link: "https://dinewithtimesprime.com/hsbcliveplus",
    urgency: "open",
  },
  {
    id: "hsbc_fuel_qtr",
    cardId: "hsbc_live_plus",
    cardLabel: "HSBC Live+",
    title: "Quarterly contactless fuel cashback",
    detail: "Periodic contactless fuel CB (often ~₹250/qtr with spend gate — confirm live T&Cs).",
    how: "Pay contactless at fuel; meet quarterly spend if required.",
    urgency: "ongoing",
  },
  {
    id: "hsbc_myntra_10",
    cardId: "hsbc_live_plus",
    cardLabel: "HSBC Live+",
    title: "Myntra 10% promo (until ~31 Oct 2026)",
    detail: "Temporary 10% on Myntra with Live+ (then reverts to 1.5%).",
    how: "Pay with Live+ on Myntra while promo live.",
    urgency: "open",
  },

  // ── Amex PT ─────────────────────────────────────────────────
  {
    id: "amex_pt_priority_pass",
    cardId: "amex_plat_travel",
    cardLabel: "Amex PT",
    title: "Priority Pass enrollment",
    detail: "Membership fee waived with PT; international visits are usually paid (~USD 27–35). Enroll once if not already.",
    how: "americanexpress.com/in → Benefits → Priority Pass / LoungeKey as issued.",
    urgency: "open",
  },
  {
    id: "amex_pt_lounge_qtr",
    cardId: "amex_plat_travel",
    cardLabel: "Amex PT",
    title: "Domestic lounge visits (8/yr, 2/qtr)",
    detail: "Track remaining domestic lounge visits for the year/quarter.",
    how: "Present card at participating lounges; update lounge counters in Settings.",
    urgency: "ongoing",
  },
  {
    id: "amex_pt_purchase_protect",
    cardId: "amex_plat_travel",
    cardLabel: "Amex PT",
    title: "Purchase protection / extended warranty",
    detail: "Coverage on eligible purchases per Amex Guide to Benefits — claim with invoice + statement.",
    how: "File via Amex claims when needed; keep invoices.",
    urgency: "info",
  },
  {
    id: "amex_pt_offers",
    cardId: "amex_plat_travel",
    cardLabel: "Amex PT",
    title: "Amex Offers (rotating statement credits)",
    detail: "Add rotating merchant Offers in the Amex app before spend.",
    how: "Amex app → Offers → Add to Card before purchase.",
    urgency: "ongoing",
  },
  {
    id: "amex_pt_hpcl",
    cardId: "amex_plat_travel",
    cardLabel: "Amex PT",
    title: "HPCL fuel convenience-fee waiver",
    detail: "Issuer fuel convenience-fee waiver at HPCL (MR still 0 on fuel).",
    how: "Pay with PT at HPCL where waiver applies.",
    urgency: "info",
  },
  {
    id: "amex_pt_taj",
    cardId: "amex_plat_travel",
    cardLabel: "Amex PT",
    title: "Taj / Marriott milestone vouchers",
    detail: "Higher annual spend milestones unlock Taj / hotel vouchers — track in Milestones.",
    how: "Confirm voucher credit after hitting ₹4L / ₹7L (as per current T&Cs).",
    urgency: "ongoing",
  },

  // ── Amex Gold ───────────────────────────────────────────────
  {
    id: "amex_gold_collection",
    cardId: "amex_gold",
    cardLabel: "Amex Gold",
    title: "Gold Collection redemptions",
    detail: "Redeem MR via Gold Collection partners when rates beat cash.",
    how: "Amex app / rewards portal → Gold Collection.",
    urgency: "ongoing",
  },
  {
    id: "amex_gold_offers",
    cardId: "amex_gold",
    cardLabel: "Amex Gold",
    title: "Amex Offers on Gold",
    detail: "Same rotating Offers mechanic — add before spend.",
    how: "Amex app → Offers → Add to Card.",
    urgency: "ongoing",
  },
  {
    id: "amex_gold_shopwise",
    cardId: "amex_gold",
    cardLabel: "Amex Gold",
    title: "ShopWise / Referral Membership used this month",
    detail: "Monthly ShopWise voucher / RM path for online earn — track usage in Settings.",
    how: "Use ShopWise link when buying online; mark if you’ve exhausted the month.",
    urgency: "ongoing",
  },

  // ── Amex MRCC ───────────────────────────────────────────────
  {
    id: "amex_mrcc_20k_enroll",
    cardId: "amex_mrcc",
    cardLabel: "Amex MRCC",
    title: "₹20k/mo bonus enrollment active",
    detail: "Enrollment-based 1,000 MR when you hit ₹20k in a month — confirm still enrolled.",
    how: "americanexpress.com/in → MRCC ₹20k benefit → enroll / verify.",
    urgency: "open",
  },
  {
    id: "amex_mrcc_fee_waiver",
    cardId: "amex_mrcc",
    cardLabel: "Amex MRCC",
    title: "Fee waiver year on track (₹1.5L)",
    detail: "Annual fee waives at ₹1.5L eligible spend in fee year.",
    how: "Track mrccCycleSpend in Milestones / Settings.",
    urgency: "ongoing",
  },

  // ── Scapia ──────────────────────────────────────────────────
  {
    id: "scapia_lounge_unlock",
    cardId: "scapia",
    cardLabel: "Scapia",
    title: "Monthly lounge unlock (₹20k spend)",
    detail: "Hit ₹20k/mo to unlock complimentary lounge (or alternate airport benefit).",
    how: "Track scapiaMonthlySpend; claim lounge in Scapia app when unlocked.",
    urgency: "ongoing",
  },
  {
    id: "scapia_airport_alt",
    cardId: "scapia",
    cardLabel: "Scapia",
    title: "Airport dining / shop / spa (vs lounge)",
    detail: "With unlock you can often pick lounge OR coin-back at dining / retail / spa (caps apply).",
    how: "In Scapia app at airport → choose dining/shop/spa alternative when offered.",
    urgency: "open",
  },
  {
    id: "scapia_store",
    cardId: "scapia",
    cardLabel: "Scapia",
    title: "Scapia Store / visa / experiences redemptions",
    detail: "Coins redeem beyond flights/hotels — store, visa, experiences.",
    how: "Scapia app → Store / Experiences.",
    urgency: "ongoing",
  },
  {
    id: "scapia_intl_privilege",
    cardId: "scapia",
    cardLabel: "Scapia",
    title: "International privilege / forex gates",
    detail: "Confirm any intl spend gates for privilege lounges or partner offers.",
    how: "Check Scapia app benefits before travel.",
    urgency: "info",
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
  {
    id: "idfc_golf",
    cardId: "idfc_indigo",
    cardLabel: "IDFC Indigo",
    title: "Mastercard golf (4 rounds + 12 lessons/yr)",
    detail: "On Mastercard plastic only — complimentary golf rounds and lessons.",
    how: "Mastercard golf / IDFC benefits portal → book with card.",
    urgency: "open",
  },
  {
    id: "idfc_travel_insurance",
    cardId: "idfc_indigo",
    cardLabel: "IDFC Indigo",
    title: "Travel insurance / trip cancel cover",
    detail: "Product guide lists air accident / trip cancel covers — claim path via insurer.",
    how: "Keep boarding pass + card statement; file via issuer/insurer when needed.",
    urgency: "info",
  },

  // ── Kiwi Neon ───────────────────────────────────────────────
  {
    id: "kiwi_lounge_50k",
    cardId: "yes_kiwi",
    cardLabel: "Kiwi Neon",
    title: "Lounge pass unlocked @ ₹50k cycle",
    detail: "Claim lounge pass in Kiwi app after milestone; typically 6-mo validity.",
    how: "Kiwi app → Benefits / Lounge after hitting spend.",
    urgency: "ongoing",
  },
  {
    id: "kiwi_lounge_1l",
    cardId: "yes_kiwi",
    cardLabel: "Kiwi Neon",
    title: "Lounge pass unlocked @ ₹1L cycle",
    detail: "Second Neon lounge milestone.",
    how: "Claim in Kiwi app when unlocked.",
    urgency: "ongoing",
  },
  {
    id: "kiwi_lounge_15l",
    cardId: "yes_kiwi",
    cardLabel: "Kiwi Neon",
    title: "Lounge pass unlocked @ ₹1.5L cycle",
    detail: "Third Neon lounge milestone.",
    how: "Claim in Kiwi app when unlocked.",
    urgency: "ongoing",
  },

  // ── SBI SimplyCLICK ─────────────────────────────────────────
  {
    id: "sbi_fee_waiver",
    cardId: "sbi_simplyclick",
    cardLabel: "SBI SimplyCLICK",
    title: "Annual fee waiver (₹1L eligible retail)",
    detail: "Fee-anniversary year eligible spend → fee reversal. Separate from online voucher year.",
    how: "Confirm on statement after fee levy / reversal.",
    valueHint: "~₹589+GST",
    urgency: "open",
  },
  {
    id: "sbi_online_1l",
    cardId: "sbi_simplyclick",
    cardLabel: "SBI SimplyCLICK",
    title: "Online ₹1L → Cleartrip/Yatra ₹2k e-voucher",
    detail: "Online spend milestone in voucher year (not fee-waiver year).",
    how: "Voucher via SMS/email after threshold; redeem before expiry.",
    valueHint: "₹2,000",
    urgency: "ongoing",
  },
  {
    id: "sbi_online_2l",
    cardId: "sbi_simplyclick",
    cardLabel: "SBI SimplyCLICK",
    title: "Online ₹2L → second Cleartrip/Yatra ₹2k e-voucher",
    detail: "Second online milestone in the same voucher year.",
    how: "Redeem voucher before expiry.",
    valueHint: "₹2,000",
    urgency: "ongoing",
  },
  {
    id: "sbi_rp_bms",
    cardId: "sbi_simplyclick",
    cardLabel: "SBI SimplyCLICK",
    title: "Redeem RP → BookMyShow / partner voucher",
    detail: "SBI RP often redeem well into BMS / partner e-vouchers (~2k RP tiers).",
    how: "sbicard.com / YONO → Redeem rewards.",
    urgency: "open",
  },

  // ── Amazon Pay ICICI ────────────────────────────────────────
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
  {
    id: "amz_fuel_surcharge",
    cardId: "amazon_pay_icici",
    cardLabel: "Amazon Pay ICICI",
    title: "Fuel surcharge waiver",
    detail: "Fuel surcharge waiver on eligible fuel spends (confirm caps on statement).",
    how: "Pay fuel with card where waiver applies.",
    urgency: "info",
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
  {
    id: "hdfc_debit_cashback_pts",
    cardId: "hdfc_visa_platinum_debit",
    cardLabel: "HDFC Debit",
    title: "Monthly NetBanking cashback points",
    detail: "Debit cashback posts as points (≈₹1) in NetBanking — Swiggy/BMS etc. caps.",
    how: "NetBanking / MobileBanking → Rewards; redeem regularly.",
    urgency: "ongoing",
  },

  // ── Visa Infinite (Live+ / BOB) ──────────────────────────────
  {
    id: "visa_inf_meet_greet",
    cardId: "visa_infinite",
    cardLabel: "Visa Infinite",
    title: "Meet & Assist",
    detail: "Complimentary Meet & Assist after ~USD1k intl POS in prior 12 months.",
    how: "Visa offer page → Redeem Now; book ≥48h ahead.",
    link: "https://www.visa.co.in/en_in/visa-offers-and-perks/visa-meet-assist/168650?locale=en_IN",
    urgency: "open",
  },
  {
    id: "visa_inf_itc",
    cardId: "visa_infinite",
    cardLabel: "Visa Infinite",
    title: "ITC Hotels (3rd night free / 50% 2nd)",
    detail: "Participating ITC properties via Visa Redeem Now.",
    how: "Visa ITC offer → book through partner flow; pay with Infinite.",
    link: "https://www.visa.co.in/en_in/visa-offers-and-perks/itc-hotels/166364?locale=en_IN",
    urgency: "open",
  },
  {
    id: "visa_inf_avis",
    cardId: "visa_infinite",
    cardLabel: "Visa Infinite",
    title: "Avis rentals (up to 35% + President’s Club)",
    detail: "Book via Visa Avis offer link.",
    how: "Visa Avis → Redeem Now → pay with Infinite.",
    link: "https://www.visa.co.in/en_in/visa-offers-and-perks/avis/141275?locale=en_IN",
    urgency: "open",
  },
  {
    id: "visa_inf_ihg",
    cardId: "visa_infinite",
    cardLabel: "Visa Infinite",
    title: "IHG Hotels (~20% flexible rates)",
    detail: "Visa × IHG partner booking flow.",
    how: "Visa IHG offer → Redeem Now.",
    link: "https://www.visa.co.in/en_in/visa-offers-and-perks/ihg-hotels-resorts/150837?locale=en_IN",
    urgency: "open",
  },
  {
    id: "visa_inf_agoda",
    cardId: "visa_infinite",
    cardLabel: "Visa Infinite",
    title: "Agoda (up to ~7%)",
    detail: "Hotels/flights via Visa Infinite × Agoda.",
    how: "Visa Agoda offer → book via link.",
    link: "https://www.visa.co.in/en_in/visa-offers-and-perks/agoda/177864?locale=en_IN",
    urgency: "open",
  },
  {
    id: "visa_inf_district_play",
    cardId: "visa_infinite",
    cardLabel: "Visa Infinite",
    title: "District Play (first 3 sports bookings)",
    detail: "Up to 50% off (max ₹300) on first 3 pickleball/padel/etc. bookings.",
    how: "Visa District offer → Redeem Now → District Play.",
    link: "https://www.visa.co.in/en_in/visa-offers-and-perks/district/179308?locale=en_IN",
    urgency: "open",
  },
  {
    id: "visa_inf_sephora",
    cardId: "visa_infinite",
    cardLabel: "Visa Infinite",
    title: "Sephora 10% online",
    detail: "10% off Sephora online via Visa Infinite offer.",
    how: "Visa Sephora → Redeem Now → shop via link.",
    link: "https://www.visa.co.in/en_in/visa-offers-and-perks/sephora/178058",
    urgency: "open",
  },
  {
    id: "visa_inf_concierge",
    cardId: "visa_infinite",
    cardLabel: "Visa Infinite",
    title: "Visa Concierge activated / used",
    detail: "24/7 dining, travel & tickets assistance.",
    how: "concierge-asia.visa.com or number on card / HSBC app.",
    link: "https://www.concierge-asia.visa.com/",
    urgency: "info",
  },
  {
    id: "visa_inf_ajio_luxe",
    cardId: "visa_infinite",
    cardLabel: "Visa Infinite",
    title: "Ajio Luxe (up to ₹4,500 off)",
    detail: "Instant discount when spending ₹10k+ at Ajio Luxe via Visa offer.",
    how: "Visa Ajio Luxe → Redeem Now.",
    link: "https://www.visa.co.in/en_in/visa-offers-and-perks/ajio-luxe/172178",
    urgency: "open",
  },
  {
    id: "visa_inf_tattva",
    cardId: "visa_infinite",
    cardLabel: "Visa Infinite",
    title: "Tattva Spa 20% off",
    detail: "Flat 20% on select full-body massages.",
    how: "Visa Tattva offer → book via flow.",
    link: "https://www.visa.co.in/en_in/visa-offers-and-perks/tattva-spa/172048",
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

type ClaimState = {
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
  const b = BENEFIT_CLAIMS.find((x) => x.id === id);
  const explicit = st.benefitClaims?.[id];
  if (typeof explicit === "boolean") return explicit;

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
