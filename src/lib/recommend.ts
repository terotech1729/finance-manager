import { CARDS, getCardById, ANNUAL_MILESTONES } from "./cards";
import { findCashkaro } from "./cashkaro";
import { findGiftCardDeals, findWelcomeOffer } from "./stacking";
import { findRedemption } from "./redemptions";
import { VISA_TIER_GUIDES } from "./visaBenefits";
import type { Card, RecommendationResult, RouteOption } from "./types";

function visaInfiniteOffer(id: string): { title: string; link?: string; howToClaim?: string } | null {
  const perk = VISA_TIER_GUIDES.find((g) => g.tier === "infinite")?.perks.find((p) => p.id === id);
  return perk ? { title: perk.title, link: perk.link, howToClaim: perk.howToClaim } : null;
}

/**
 * How liquid/usable a route's reward is:
 *  - "cash"     → cashback, statement credit, gift-card discount, Cashkaro, Kiwi, BOB/SBI RP
 *  - "flexible" → Amex MR (good but needs redemption/transfer)
 *  - "locked"   → travel-locked coins you must accumulate & redeem on travel (Scapia, BluChips)
 * Used to weight ranking so locked currencies don't out-rank equal-nominal liquid cash.
 */
function liquidityOf(cardId: string, label: string): "cash" | "flexible" | "locked" {
  const l = label.toLowerCase();
  if (cardId === "scapia") return l.includes("forex") ? "cash" : "locked"; // 0% forex saving is real cash; coins are locked
  if (cardId === "idfc_indigo") return l.includes("forex") ? "cash" : "locked"; // BluChips travel-locked
  if (cardId === "amex_gold" || cardId === "amex_plat_travel" || cardId === "amex_mrcc") return "flexible";
  return "cash"; // kiwi (cashable), bob/sbi RP (statement credit), amazon cashback, gift cards, cashkaro, etc.
}

/**
 * Redemption-value range for a points-based route. The reward scales linearly with
 * the point value (₹/point), while any fixed ShopWise fee stays constant.
 */
// Only these cards earn genuinely variable-value POINTS (everything else is cashback/discount/fixed).
const VARIABLE_POINTS_CARDS = new Set(["amex_gold", "amex_plat_travel", "amex_mrcc", "idfc_indigo", "sbi_simplyclick"]);

function pointsRange(cardId: string, label: string, totalRewardInr: number, effectivePct: number, amt: number):
  { worstPct: number; typicalPct: number; bestPct: number; currency: string } | null {
  if (!VARIABLE_POINTS_CARDS.has(cardId)) return null; // BOGO/cashback/discount routes aren't points
  // A discount/cashback/coupon route on a points card (rare) isn't earning that card's points:
  if (/bogo|cashback|gift card|discount|district/i.test(label)) return null;
  const r = findRedemption(cardId);
  if (!r || amt <= 0 || totalRewardInr <= 0) return null;
  if (r.worst === r.best) return null; // fixed-value currency → no range
  const feeInr = /shopwise/i.test(label) ? amt * 0.0177 : 0; // 1.5% + GST, not scaled by point value
  const gross = totalRewardInr + feeInr; // reward value at typical, before fee
  const netAt = (v: number) => Math.max(0, gross * (v / r.typical) - feeInr);
  return {
    worstPct: (netAt(r.worst) / amt) * 100,
    typicalPct: effectivePct,
    bestPct: (netAt(r.best) / amt) * 100,
    currency: r.currency,
  };
}

/** Build a complete RouteOption from a partial, filling sensible defaults. */
function mkOption(amt: number, o: Partial<RouteOption> & { cardId: string; label: string; effectivePct: number; rationale: string }): RouteOption {
  const base = o.baseRewardInr ?? amt * (o.effectivePct / 100);
  const bonus = o.bonusRewardInr ?? 0;
  return {
    cardId: o.cardId, label: o.label, effectivePct: o.effectivePct,
    baseRewardInr: base, bonusRewardInr: bonus, totalRewardInr: base + bonus,
    feasible: o.feasible ?? true, feasibilityNote: o.feasibilityNote,
    pros: (o.pros ?? []).filter(Boolean), cons: (o.cons ?? []).filter(Boolean),
    cashkaroSuggested: o.cashkaroSuggested ?? false,
    worstCasePct: o.worstCasePct ?? o.effectivePct, bestCasePct: o.bestCasePct ?? o.effectivePct,
    steps: o.steps ?? [], rationale: o.rationale,
  };
}

export type RecommendInput = {
  merchant: string;
  category: string;
  amount: number;
  channel: "online" | "offline_pos" | "upi" | "upi_normal" | "merchant_app" | "foreign";
  isForeign?: boolean;
  ptccEligibleSpend?: number;
  mrccCycleSpend?: number;
  bobYtdSpend?: number;
  bobCycleSpend5x?: number;
  sbiYtdSpend?: number;
  /** SBI SimplyCLICK fee-waiver eligible spend (anniversary year) — separate from online voucher YTD. */
  sbiFeeWaiverSpend?: number;
  idfcYtdSpend?: number;
  blckYtdSpend?: number; // legacy unused
  hsbcLivePlusYtdSpend?: number;
  livePlusAccelCashbackUsedThisMonth?: number;
  goldThisMonthTxnsAt1k?: number;
  mrccThisCycleTxnsAt1500?: number;
  mrccThisCycleAmount?: number;
  goldShopwiseUsedThisMonth?: number;
  bobBogoUsedThisMonth?: boolean;
  scapiaMonthlySpend?: number;
  kiwiNeonCycleSpend?: number;
  swiggyBlckIssued?: boolean; // legacy — always treat as false (card not obtained)
  amazonPayIciciIssued?: boolean;
  primeMember?: boolean;
  amazonPayBalance?: number;
  amazonWelcomeClaimed?: string[];
  giftCardRateOverrides?: Record<string, number>;
  cashkaroPctOverride?: number; // live Cashkaro % you see (e.g. a limited-time sale) — overrides defaults
  amazonOrderCashbackInr?: number; // order-level Amazon offer cashback you see at checkout (e.g. ₹200 on orders > ₹1398)
  /** Live CRED gift-card discount % you see in CRED Store (e.g. PVR 24%, Cinepolis 28%). */
  credGiftCardPctOverride?: number;
  /** Cinema chain for movie bookings — drives CRED GC merchant label / ranking. */
  movieTheatre?: "pvr" | "cinepolis" | "inox" | "bms" | "district" | "other";
  bobEternaIssueDate?: string;
  bobWelcomeUnlocked?: boolean;
  hsbcLivePlusIssueDate?: string;
  hsbcWelcomeClaimed?: boolean;
  /** Live+ spend inside the 30-day welcome window (from txn log). Falls back to YTD if unset. */
  hsbcLivePlusWelcomeSpend?: number;
  today?: string; // ISO; used for calendar-month milestone feasibility
  // legacy aliases
  goldMonthlyTxnsDone?: number;
  mrccMonthlyTxnsDone?: number;
  mrccMonthlyAmount?: number;
};

/**
 * ShopWise (Amex Reward Multiplier) charges a 1.5% + 18% GST convenience fee
 * on voucher purchases (= 1.77% effective). 5× MR ≈ 5.8% gross − 1.77% fee ≈ 4.0% net.
 */
const SHOPWISE_GROSS_PCT = 5.8;
const SHOPWISE_FEE_PCT = 1.5 * 1.18; // 1.77%
const SHOPWISE_NET_PCT = +(SHOPWISE_GROSS_PCT - SHOPWISE_FEE_PCT).toFixed(2); // ≈ 4.03%

/** HSBC Live+ Visa Infinite reval (26 Jul 2026): shared accelerated cashback cap. */
const LIVE_PLUS_ACCEL_PCT = 10;
const LIVE_PLUS_ACCEL_CAP_INR = 1200; // ≈ ₹12k eligible accelerated spend / month
const LIVE_PLUS_BASE_PCT = 1.5;
/** Welcome refreshed Jul 2026: ₹1k CB when app login + ₹25k spend in first 30 days. */
const LIVE_PLUS_WELCOME_SPEND = 25000;
/** Temporary: Live+ earns 10% on Myntra shopping until this date (then marketplace 1.5%). */
const LIVE_PLUS_MYNTRA_PROMO_END = new Date("2026-10-31T23:59:59");

function livePlusMyntraPromoActive(today?: string): boolean {
  const d = today ? new Date(today) : new Date();
  return Number.isFinite(d.getTime()) && d <= LIVE_PLUS_MYNTRA_PROMO_END;
}

/** Amazon / Flipkart always 1.5%; Myntra excluded after promo ends 31 Oct 2026. */
function isLivePlusMarketplaceExcluded(merchant: string, category: string, today?: string): boolean {
  const t = `${merchant} ${category}`.toLowerCase();
  if (/\bamazon\b|\bamzn\b|flipkart|\bfkrt\b/.test(t)) return true;
  if (/\bmyntra\b/.test(t)) return !livePlusMyntraPromoActive(today);
  return false;
}

/**
 * Live+ 10% buckets (post-reval): dining, food delivery, groceries, utilities, shopping
 * (shopping excludes Amazon/Flipkart; Myntra allowed only during promo). Returns null if base 1.5%.
 */
function livePlusAccelBucket(merchant: string, category: string, today?: string):
  "food" | "dining" | "grocery" | "utility" | "shopping" | null {
  if (isLivePlusMarketplaceExcluded(merchant, category, today)) return null;
  const c = category.toLowerCase();
  const m = merchant.toLowerCase();
  if (/\bmyntra\b/.test(`${m} ${c}`) && livePlusMyntraPromoActive(today)) return "shopping";
  if (
    m.includes("swiggy") || c === "swiggy" ||
    m.includes("zomato") || c.includes("zomato") ||
    c.includes("food delivery")
  ) return "food";
  if (c.includes("dining") || c.includes("restaurant")) return "dining";
  if (
    c.includes("grocery") || c.includes("instamart") ||
    m.includes("instamart") || m.includes("blinkit") || m.includes("zepto") ||
    m.includes("bigbasket") || m.includes("big basket")
  ) return "grocery";
  if (
    c.includes("utility") || c.includes("electric") || c.includes("mobile") ||
    c.includes("recharge") || c.includes("broadband") || c.includes("dth") ||
    (c.includes("tv") && !c.includes("movie")) || c.includes("gas") || c.includes("water")
  ) return "utility";
  if (
    c.includes("shopping") || c.includes("fashion") || c.includes("electronics") ||
    c.includes("online") || c.includes("apparel") || c.includes("myntra")
  ) return "shopping";
  return null;
}

function buildLivePlusOption(
  amt: number,
  bucket: "food" | "dining" | "grocery" | "utility" | "shopping",
  input: RecommendInput,
  opts?: { cashkaroInr?: number; cashkaroNote?: string }
): RouteOption {
  const ckInr = opts?.cashkaroInr ?? 0;
  const used = input.livePlusAccelCashbackUsedThisMonth ?? 0;
  const headroom = Math.max(0, LIVE_PLUS_ACCEL_CAP_INR - used);
  const uncappedBase = amt * (LIVE_PLUS_ACCEL_PCT / 100);
  const cappedBase = Math.min(uncappedBase, headroom);
  const overflow = Math.max(0, uncappedBase - cappedBase);
  const overflowAtBase = overflow > 0 ? (overflow / LIVE_PLUS_ACCEL_PCT) * LIVE_PLUS_BASE_PCT : 0; // remainder earns 1.5%
  const liveCash = cappedBase + overflowAtBase;
  const welcome = livePlusWelcomeBonus(input, amt);
  const welcomeInr = welcome?.inr ?? 0;
  const bucketLabel: Record<typeof bucket, string> = {
    food: "dining / food delivery",
    dining: "dining",
    grocery: "groceries",
    utility: "utilities (pay biller direct — not via Amazon)",
    shopping: "shopping (not Amazon / Flipkart; Myntra 10% till 31 Oct 2026)",
  };
  const capFull = headroom < 1;
  const effPct = ((liveCash + ckInr + welcomeInr) / amt) * 100;
  return mkOption(amt, {
    cardId: "hsbc_live_plus",
    label: capFull
      ? `HSBC Live+ (accel cap full → ~${LIVE_PLUS_BASE_PCT}% base on this txn)`
      : ckInr > 0
        ? `Cashkaro → HSBC Live+ 10% (${bucketLabel[bucket]})`
        : `HSBC Live+ 10% on ${bucketLabel[bucket]}`,
    effectivePct: effPct,
    baseRewardInr: liveCash + ckInr,
    bonusRewardInr: welcomeInr,
    cashkaroSuggested: ckInr > 0,
    worstCasePct: capFull ? LIVE_PLUS_BASE_PCT : LIVE_PLUS_ACCEL_PCT,
    bestCasePct: effPct,
    feasible: true,
    feasibilityNote: capFull
      ? `₹${LIVE_PLUS_ACCEL_CAP_INR.toLocaleString("en-IN")}/mo 10% cap already used this month — this txn earns ${LIVE_PLUS_BASE_PCT}% base only`
      : headroom < uncappedBase
        ? `Only ~₹${Math.round(headroom)} of 10% headroom left this month; rest at ${LIVE_PLUS_BASE_PCT}%`
        : undefined,
    pros: [
      capFull
        ? `Accelerated cap already used — ${LIVE_PLUS_BASE_PCT}% statement cashback (auto ~45 days)`
        : `10% statement cashback (Visa Infinite) — liquid, auto-credited`,
      `Shared accel cap ₹${LIVE_PLUS_ACCEL_CAP_INR.toLocaleString("en-IN")}/mo (~₹${Math.round(used)} used this month)`,
      "Also: Live+ Reserve dining (from 1 Aug 2026), District + BMS BOGO, 2 domestic + 1 intl lounge/yr",
      welcome?.note ?? "",
      opts?.cashkaroNote ?? "",
    ],
    cons: [
      "Amazon / Flipkart earn only 1.5% — use Amazon Pay ICICI for Amazon; Myntra 10% only till 31 Oct 2026",
      bucket === "utility" ? "Pay BBPS / GPay / biller app — not Amazon bill-pay (codes as Amazon 1.5%)" : "",
      "International spends earn 0% cashback post-deval — use Scapia abroad",
      "Fee ₹999+GST waived at ₹2L/yr",
    ],
    rationale: capFull
      ? `Live+ 10% monthly cap is exhausted. This ${bucket} spend earns ${LIVE_PLUS_BASE_PCT}% base until next calendar month.${ckInr > 0 ? ` Cashkaro still adds ${inr(ckInr)}.` : ""}`
      : `Live+ is your primary ${bucket} card at 10% (statement credit). Cap ₹${LIVE_PLUS_ACCEL_CAP_INR.toLocaleString("en-IN")}/mo across dining/food/grocery/utilities/shopping${ckInr > 0 ? `; Cashkaro adds ${inr(ckInr)}` : ""}.${welcome ? ` ${welcome.note}` : ""}`,
    steps: [
      ckInr > 0 ? "Open Cashkaro → click through to the merchant first" : "",
      bucket === "utility"
        ? "Open BBPS / Google Pay / the biller app (not Amazon Pay bills)"
        : "Open the merchant app / site",
      `Pay ${inr(amt)} with HSBC Live+`,
      capFull
        ? `Expect ~${LIVE_PLUS_BASE_PCT}% (${inr(liveCash)}) — 10% cap already used`
        : `Expect ~${LIVE_PLUS_ACCEL_PCT}% on eligible portion (${inr(cappedBase)} toward ₹${LIVE_PLUS_ACCEL_CAP_INR.toLocaleString("en-IN")}/mo cap)`,
    ].filter(Boolean),
  });
}

/** Welcome: ₹1,000 cashback when HSBC app login + ₹25k spend within 30 days of issue. */
function livePlusWelcomeBonus(input: RecommendInput, amt: number): { inr: number; note: string } | null {
  if (input.hsbcWelcomeClaimed) return null;
  const issue = input.hsbcLivePlusIssueDate;
  if (!issue) return null;
  const today = input.today ? new Date(input.today) : new Date();
  const issued = new Date(issue);
  const days = Math.floor((today.getTime() - issued.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0 || days > 30) return null;
  // Prefer spend actually logged inside the 30-day window; fall back to YTD only if unset.
  const spent = input.hsbcLivePlusWelcomeSpend ?? input.hsbcLivePlusYtdSpend ?? 0;
  if (spent >= LIVE_PLUS_WELCOME_SPEND) return null;
  const remaining = LIVE_PLUS_WELCOME_SPEND - spent;
  const progress = Math.min(amt, remaining) / LIVE_PLUS_WELCOME_SPEND;
  const inrVal = 1000 * progress;
  const completes = spent + amt >= LIVE_PLUS_WELCOME_SPEND;
  const spentLabel = inr(spent + Math.min(amt, remaining));
  return {
    inr: inrVal,
    note: completes
      ? `Completes ₹25k/30-day welcome → unlocks ₹1,000 cashback (also need HSBC app login)`
      : `Builds welcome ₹25k/30d (${spentLabel}/₹25k) → +${inr(inrVal)} marginal of ₹1k bonus`,
  };
}

/** Post-reval: hospital + local transport (bus/metro) earn 0% — not even 1.5% base. */
function livePlusZeroBase(merchant: string, category: string): boolean {
  const t = `${merchant} ${category}`.toLowerCase();
  return /hospital|healthcare|clinic|doctor|dermat|derma|medical|metro|local\s*transport|\bbus\b/.test(t);
}

function pickCard(id: string): Card {
  return getCardById(id) ?? CARDS[0];
}

function inr(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function daysSince(iso?: string): number {
  if (!iso) return 9999;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 9999;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

/** Days remaining in the current calendar month (Amex Gold/MRCC milestones reset on the 1st). */
function daysLeftInMonth(iso?: string): number {
  const d = iso ? new Date(iso) : new Date();
  if (!Number.isFinite(d.getTime())) return 30;
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return lastDay - d.getDate();
}

/**
 * Marginal value (in ₹) of pushing this spend toward an unfinished milestone.
 * Returns an extra reward amount attributable to THIS transaction.
 */
function bobWelcomeBonus(input: RecommendInput, amt: number): { inr: number; note: string } | null {
  if (input.bobWelcomeUnlocked) return null;
  const within60 = daysSince(input.bobEternaIssueDate) <= 60;
  if (!within60) return null;
  const ytd = input.bobYtdSpend ?? 0;
  const target = 50000;
  if (ytd >= target) return null;
  // 10,000 RP = ₹2,500 on hitting ₹50K. Attribute pro-rata to the portion of this
  // spend that fills the remaining gap.
  const remaining = target - ytd;
  const fillsGap = Math.min(amt, remaining);
  const bonusValue = (fillsGap / target) * 2500;
  const daysLeft = 60 - daysSince(input.bobEternaIssueDate);
  return {
    inr: bonusValue,
    note: `Fills ${inr(fillsGap)} of the ₹50K BOB welcome (${inr(remaining)} left, ~${daysLeft}d remaining) → +${inr(bonusValue)} pro-rata welcome value`,
  };
}

/** Amex Gold 6×₹1K calendar-month milestone marginal value (feasibility-gated by days left). */
function goldMilestoneBonus(input: RecommendInput, amt: number): { inr: number; note: string } | null {
  if (amt < 1000) return null; // only ≥₹1K txns count
  const done = input.goldThisMonthTxnsAt1k ?? input.goldMonthlyTxnsDone ?? 0;
  if (done >= 6) return null; // already hit this calendar month
  const remainingTxns = 6 - done;
  const daysLeft = daysLeftInMonth(input.today);
  // If you can't realistically fit the remaining ≥₹1K txns before the month resets,
  // the milestone won't complete — so this txn carries ~no milestone value.
  if (remainingTxns > daysLeft + 1) {
    return {
      inr: 0,
      note: `Milestone unreachable: ${remainingTxns} more ₹1K+ txns needed but only ${daysLeft} day(s) left this calendar month — no milestone value. Use a ShopWise/other route instead.`,
    };
  }
  const completing = done === 5;
  // Completing the 6th unlocks the full 1,000 MR ≈ ₹500; earlier txns pro-rata.
  const perTxn = completing ? 500 : 500 / remainingTxns;
  return {
    inr: perTxn,
    note: completing
      ? `Completes the 6-txn Amex Gold milestone → +₹500 (1,000 MR). ${daysLeft}d left.`
      : `Counts as txn ${done + 1}/6 of Amex Gold milestone (${daysLeft}d left) → +${inr(perTxn)} marginal`,
  };
}

/** Amex MRCC milestone marginal value (4×₹1.5K + ₹20K calendar month). */
function mrccMilestoneBonus(input: RecommendInput, amt: number): { inr: number; note: string; label: string } | null {
  const txnsDone = input.mrccThisCycleTxnsAt1500 ?? input.mrccMonthlyTxnsDone ?? 0;
  const amtDone = input.mrccThisCycleAmount ?? input.mrccMonthlyAmount ?? 0;
  const daysLeft = daysLeftInMonth(input.today);
  let bonus = 0;
  const notes: string[] = [];
  const txnOpen = amt >= 1500 && txnsDone < 4;
  const amtOpen = amtDone < 20000;

  if (txnOpen) {
    const remaining = 4 - txnsDone;
    if (remaining > daysLeft + 1) {
      notes.push(`4-txn part unreachable (${remaining} more ≥₹1.5K needed, ${daysLeft}d left)`);
    } else {
      bonus += remaining === 1 ? 500 : 500 / remaining;
      notes.push(remaining === 1 ? `completes 4-txn part (+₹500)` : `txn ${txnsDone + 1}/4 (≥₹1.5K)`);
    }
  }
  if (amtOpen) {
    const fills = Math.min(amt, 20000 - amtDone);
    bonus += (fills / 20000) * 500;
    notes.push(`fills ${inr(fills)} of ₹20K amount`);
  } else if (txnOpen) {
    notes.push("₹20K amount already hit — a big prior spend only counted as 1 txn");
  }
  if (bonus <= 0) return null;

  let label = "Amex MRCC (fills monthly milestone)";
  if (!amtOpen && txnOpen) {
    label = `Amex MRCC (still need ${4 - txnsDone} more ≥₹1.5k txns)`;
  } else if (amtOpen && !txnOpen) {
    label = "Amex MRCC (still need ₹20k amount — 4-txn done)";
  } else if (txnOpen && txnsDone === 3) {
    label = "Amex MRCC (completes 4-txn monthly)";
  }

  return {
    inr: bonus,
    note: `MRCC: ${notes.join("; ")} → +${inr(bonus)} marginal`,
    label,
  };
}

function ckRange(merchant: string, category: string): { mid: number; min: number; max: number; zone: string; flatInr?: number } | null {
  const m = findCashkaro(merchant, category);
  if (!m) return null;
  if (m.flatInr != null && m.flatInr > 0) {
    return { mid: 0, min: 0, max: 0, zone: m.zone, flatInr: m.flatInr };
  }
  return { mid: (m.minRate + m.maxRate) / 2, min: m.minRate, max: m.maxRate, zone: m.zone };
}

/** Cashkaro ₹ for a named OTA (supports flat ₹ rates like Agoda 7% or MMT ₹140). */
function ckInrForStore(
  store: string,
  category: string,
  amt: number,
  overridePct?: number
): { inr: number; note: string; zone: string } | null {
  if (overridePct != null && overridePct > 0) {
    return { inr: amt * (overridePct / 100), note: `Cashkaro live ${overridePct}% (you entered)`, zone: "reliable" };
  }
  const r = ckRange(store, category);
  if (!r || r.zone === "na") return null;
  if (r.flatInr != null && r.flatInr > 0) {
    return { inr: r.flatInr, note: `Cashkaro flat ${inr(r.flatInr)} on ${store}`, zone: r.zone };
  }
  if (r.mid <= 0) return null;
  const haircut = r.zone === "try" ? 0.7 : 0.85;
  return {
    inr: amt * (r.mid / 100) * haircut,
    note: `Cashkaro ~${r.mid}% on ${store}${r.zone === "try" ? " (tracking try-zone)" : ""}`,
    zone: r.zone,
  };
}

type TravelKind = "hotel" | "flight" | "bus" | "train";

function travelKindOf(cat: string, merchant: string): TravelKind | null {
  const t = `${cat} ${merchant}`.toLowerCase();
  if (/amazon travel hotel|cleartrip hotels|agoda|booking\.com|makemytrip hotels|hotel direct|hotel booking|\bhotel\b|ihg|intercontinental|holiday\s*inn|six\s*senses|\bitc\b/.test(t) && !/flight/.test(t)) {
    return "hotel";
  }
  if (/indigo|cleartrip flights|makemytrip flights|flight booking|amazon travel flight|airline|\bflight\b|air india|spicejet|akasa|vistara/.test(t)) {
    return "flight";
  }
  if (/bus booking|amazon travel bus|\bbus\b|redbus|abhibus/.test(t)) return "bus";
  if (/train booking|amazon travel train|irctc|\btrain\b/.test(t) && !/metro/.test(t)) return "train";
  if (/travel booking|amazon travel/.test(t)) return null; // needs clarification
  return null;
}

/**
 * Amazon Pay ICICI earn on Amazon.in travel (per Amazon help / Oct 2025 partner refresh):
 * flights & hotels → 5% Prime / 3% non-Prime; bus & train → treat as digitally-fulfilled-style ~2%.
 * Enter any first-booking / checkout promo via amazonOrderCashbackInr.
 */
function amazonTravelCardPct(kind: TravelKind, prime: boolean): number {
  if (kind === "flight" || kind === "hotel") return prime ? 5 : 3;
  return 2; // bus / train on Amazon
}

type AddFn = (o: Partial<RouteOption> & { cardId: string; label: string; effectivePct: number }) => void;

/** Prefer BOB for travel MCC earn; Live+ hotel/flight is only 1.5% (0% abroad). */
function infinitePayCard(input: RecommendInput, travelMcc: boolean): {
  cardId: "bob_eterna" | "hsbc_live_plus";
  earnPct: number;
  earnNote: string;
} {
  const bobHeadroom = Math.max(0, 33000 - (input.bobCycleSpend5x ?? 0));
  const bob5xOk = travelMcc && bobHeadroom >= 1000;
  if (bob5xOk) {
    return { cardId: "bob_eterna", earnPct: 3.75, earnNote: "BOB 5× travel MCC (3.75%) — redeem RP later @ ₹0.25" };
  }
  if (travelMcc) {
    return { cardId: "bob_eterna", earnPct: 0.75, earnNote: "BOB base 0.75% (5× headroom low) — still Infinite for Visa portal" };
  }
  return { cardId: "hsbc_live_plus", earnPct: 1.5, earnNote: "Live+ 1.5% base (Visa Infinite portal)" };
}

/**
 * Visa Infinite portal discounts from HSBC Live+ Know-more offers.
 * Fare/checkout discounts (not Live+ 10% cashback) — open Visa offer → Redeem Now.
 */
function addVisaInfiniteBenefitRoutes(
  kind: TravelKind | "dining" | "shopping" | "car" | "spa" | "sports",
  input: RecommendInput,
  amt: number,
  add: AddFn,
  merchCat: string
): void {
  const t = merchCat.toLowerCase();
  const payTravel = infinitePayCard(input, kind === "hotel" || kind === "flight" || kind === "car");

  if (kind === "hotel" || kind === "flight") {
    const offer = visaInfiniteOffer("inf-agoda");
    const discPct = 7;
    const discInr = amt * (discPct / 100);
    const earnInr = amt * (payTravel.earnPct / 100);
    add({
      cardId: payTravel.cardId,
      label: `Visa Infinite → Agoda ${kind} (~${discPct}% portal) + ${payTravel.cardId === "bob_eterna" ? "BOB" : "Live+"}`,
      effectivePct: ((discInr + earnInr) / amt) * 100,
      baseRewardInr: earnInr,
      bonusRewardInr: discInr,
      worstCasePct: payTravel.earnPct,
      bestCasePct: discPct + payTravel.earnPct,
      pros: [
        `Visa Infinite Agoda portal discount up to ~${discPct}% (hotels/flights/activities)`,
        payTravel.earnNote,
        "Same Infinite plastic: Live+ or BOB Eterna",
      ],
      cons: [
        "Must open Visa Agoda offer → Redeem Now (not plain Agoda app)",
        "Usually does NOT stack with Cashkaro Agoda — pick portal OR Cashkaro, not both",
        "Compare all-in fare vs Cashkaro Agoda 7% + BOB / Amazon 5%",
      ],
      rationale: `Visa Infinite × Agoda portal (~${discPct}% off) + card earn. Alternative to Cashkaro→Agoda when the Visa rate wins or Cashkaro tracking fails.`,
      steps: [
        offer?.link ? `Open ${offer.link}` : "Open Network perks → Agoda Visa offer",
        "Tap Redeem Now → continue on Agoda",
        `Book ${kind}`,
        `Pay with ${payTravel.cardId === "bob_eterna" ? "BOB Eterna" : "HSBC Live+"} (Infinite)`,
      ],
    });
  }

  if (kind === "hotel") {
    const isIhg = /ihg|intercontinental|holiday\s*inn|six\s*senses|crowne\s*plaza|kimpton|voco/.test(t);
    const isItc = /\bitc\b/.test(t);
    {
      const offer = visaInfiniteOffer("inf-ihg");
      const discPct = 20;
      const discInr = amt * (discPct / 100);
      const earnInr = amt * (payTravel.earnPct / 100);
      add({
        cardId: payTravel.cardId,
        label: `Visa Infinite → IHG hotels (~${discPct}% flexible rates) + ${payTravel.cardId === "bob_eterna" ? "BOB" : "Live+"}`,
        effectivePct: ((discInr + earnInr) / amt) * 100,
        baseRewardInr: earnInr,
        bonusRewardInr: discInr,
        worstCasePct: payTravel.earnPct,
        bestCasePct: discPct + payTravel.earnPct,
        feasible: isIhg || !/(agoda|makemytrip|cleartrip|booking|amazon|marriott|hyatt|hilton|taj|oberai)/.test(t),
        feasibilityNote: isIhg
          ? undefined
          : "Only if the stay is at a participating IHG property (InterContinental / Holiday Inn / Six Senses / etc.)",
        pros: [
          "Visa Infinite IHG portal — ~20% on flexible rates at participating hotels",
          payTravel.earnNote,
        ],
        cons: [
          "Must book via Visa IHG offer → Redeem Now",
          "Flexible-rate base can still beat prepaid OTAs — compare all-in",
        ],
        rationale: "IHG via Visa Infinite portal is often the best route for InterContinental / Holiday Inn / Six Senses when the property participates.",
        steps: [
          offer?.link ? `Open ${offer.link}` : "Network perks → IHG",
          "Redeem Now → book on IHG",
          `Pay with ${payTravel.cardId === "bob_eterna" ? "BOB Eterna" : "HSBC Live+"}`,
        ],
      });
    }
    {
      const offer = visaInfiniteOffer("inf-itc");
      const discPct = 25;
      const discInr = amt * (discPct / 100);
      const earnInr = amt * (payTravel.earnPct / 100);
      add({
        cardId: payTravel.cardId,
        label: `Visa Infinite → ITC Hotels (3rd night free / 50% off 2nd) + ${payTravel.cardId === "bob_eterna" ? "BOB" : "Live+"}`,
        effectivePct: ((discInr + earnInr) / amt) * 100,
        baseRewardInr: earnInr,
        bonusRewardInr: discInr,
        worstCasePct: payTravel.earnPct,
        bestCasePct: 33 + payTravel.earnPct,
        feasible: isItc || !/(agoda|makemytrip|cleartrip|booking|amazon|marriott|hyatt|hilton|taj|ihg|holiday)/.test(t),
        feasibilityNote: isItc ? undefined : "Only for participating ITC Hotels stays — book via Visa ITC offer",
        pros: [
          "Complimentary 3rd night (2 paid) or 50% off 2nd night — modelled ~25% of stay value",
          payTravel.earnNote,
          "Redeem online on Visa ITC offer page",
        ],
        cons: [
          "Must open Visa ITC offer → Redeem Now (online)",
          "Participating hotels / stay length T&Cs apply — verify before booking",
        ],
        rationale: "ITC via Visa Infinite portal often beats OTA % when the free-night / 2nd-night deal applies.",
        steps: [
          offer?.link ? `Open ${offer.link}` : "Network perks → ITC Hotels",
          "Redeem Now → complete ITC booking online",
          `Pay with ${payTravel.cardId === "bob_eterna" ? "BOB Eterna" : "HSBC Live+"}`,
        ],
      });
    }
  }

  if (kind === "car" || /avis|\bcar\s*rental\b/.test(t)) {
    const offer = visaInfiniteOffer("inf-avis");
    const discPct = 35;
    const discInr = amt * (discPct / 100);
    const earnInr = amt * (payTravel.earnPct / 100);
    add({
      cardId: payTravel.cardId,
      label: `Visa Infinite → Avis (up to ${discPct}% + President’s Club)`,
      effectivePct: ((discInr + earnInr) / amt) * 100,
      baseRewardInr: earnInr,
      bonusRewardInr: discInr,
      worstCasePct: payTravel.earnPct,
      bestCasePct: discPct + payTravel.earnPct,
      pros: ["Up to 35% off standard Avis rates", "Complimentary Avis President’s Club", payTravel.earnNote],
      cons: ["Must book via Visa Avis offer → Redeem Now", "Confirm discount % on the live offer"],
      rationale: "Avis is a Visa Infinite portal play — large % off dwarfs card earn.",
      steps: [
        offer?.link ? `Open ${offer.link}` : "Network perks → Avis",
        "Redeem Now → book Avis",
        `Pay with ${payTravel.cardId === "bob_eterna" ? "BOB Eterna" : "HSBC Live+"}`,
      ],
    });
  }

  if (kind === "dining") {
    const reserve = visaInfiniteOffer("inf-liveplus-reserve");
    add({
      cardId: "hsbc_live_plus",
      label: "Live+ Reserve (DineWithTimesPrime) + Live+ 10% dining",
      effectivePct: 10,
      pros: [
        "Curated fine dining from 1 Aug 2026 (chef menus + comps)",
        "Still earns Live+ 10% dining toward ₹1,200/mo cap",
      ],
      cons: ["Live+ only — not BOB", "Restaurant list / comps are T&C bound"],
      rationale: "For premium dining, book via Live+ Reserve then pay Live+ for 10% cashback.",
      steps: [
        reserve?.link ? `Open ${reserve.link}` : "Open dinewithtimesprime.com/hsbcliveplus",
        "Book participating restaurant",
        "Pay with HSBC Live+",
      ],
    });
    const dine = visaInfiniteOffer("inf-dine-visa");
    add({
      cardId: "hsbc_live_plus",
      label: "Visa Infinite Premium Dining (Dine with Visa) + Live+ 10%",
      effectivePct: 10,
      pros: ["Visa exclusive dining program", "Live+ 10% dining cashback"],
      cons: ["Must use Visa dining offer flow", "Shared ₹1,200/mo 10% cap"],
      rationale: "Dine with Visa portal + Live+ 10% when the restaurant is on the exclusive list.",
      steps: [
        dine?.link ? `Open ${dine.link}` : "Network perks → Dine with Visa",
        "Redeem / book",
        "Pay with HSBC Live+",
      ],
    });
  }

  if (kind === "shopping" || /sephora|ajio/.test(t)) {
    if (/sephora/.test(t) || kind === "shopping") {
      const offer = visaInfiniteOffer("inf-sephora");
      const discPct = 10;
      const discInr = amt * (discPct / 100);
      const used = input.livePlusAccelCashbackUsedThisMonth ?? 0;
      const headroom = Math.max(0, 1200 - used);
      const liveCash = Math.min(amt * 0.1, headroom);
      add({
        cardId: "hsbc_live_plus",
        label: /sephora/.test(t)
          ? "Visa Infinite → Sephora (10% portal) + Live+ shopping"
          : "Visa Infinite → Sephora (10% off online) — if shopping Sephora",
        effectivePct: ((discInr + liveCash) / amt) * 100,
        baseRewardInr: liveCash,
        bonusRewardInr: discInr,
        feasible: /sephora/.test(t),
        feasibilityNote: /sephora/.test(t) ? undefined : "Only when buying at Sephora online",
        pros: ["Visa Infinite Sephora 10% portal discount", "Live+ may also earn shopping 10% (shared monthly cap)"],
        cons: ["Open Visa Sephora offer → Redeem Now", "Don't double-count if portal price already includes the 10%"],
        rationale: "Sephora: Visa portal 10% off + Live+ shopping earn when eligible.",
        steps: [
          offer?.link ? `Open ${offer.link}` : "Network perks → Sephora",
          "Redeem Now → shop Sephora",
          "Pay with HSBC Live+",
        ],
      });
    }
    if (/ajio/.test(t)) {
      const offer = visaInfiniteOffer("inf-ajio-luxe");
      const discInr = Math.min(amt * 0.08, 4500);
      const need = amt >= 10000;
      add({
        cardId: "hsbc_live_plus",
        label: need
          ? "Visa Infinite → Ajio Luxe (8% up to ₹4,500) + Live+"
          : "Visa Infinite → Ajio Luxe (needs ≥₹10k for up to ₹4,500 off)",
        effectivePct: need ? ((discInr + amt * 0.015) / amt) * 100 : 1.5,
        baseRewardInr: amt * 0.015,
        bonusRewardInr: need ? discInr : 0,
        feasible: need,
        feasibilityNote: need ? undefined : "Spend ≥₹10,000 in one booking to unlock up to ₹4,500 off",
        pros: ["Instant discount up to ₹4,500 at ₹10k+", "Pay Infinite (Live+ / BOB)"],
        cons: ["Ajio Luxe via Visa offer only", "Confirm live T&Cs"],
        rationale: "Ajio Luxe Visa Infinite portal — strong when basket ≥₹10k.",
        steps: [
          offer?.link ? `Open ${offer.link}` : "Network perks → Ajio Luxe",
          "Redeem Now → shop Ajio Luxe ≥₹10k",
          "Pay with HSBC Live+ or BOB Eterna",
        ],
      });
    }
  }

  if (kind === "spa" || /tattva/.test(t)) {
    const offer = visaInfiniteOffer("inf-tattva");
    const discPct = 20;
    add({
      cardId: "hsbc_live_plus",
      label: `Visa Infinite → Tattva Spa (${discPct}% off select massages)`,
      effectivePct: discPct + 1.5,
      baseRewardInr: amt * 0.015,
      bonusRewardInr: amt * (discPct / 100),
      pros: ["Flat 20% off deep tissue / Abhyanga / Swedish"],
      cons: ["Visa Tattva offer → Redeem Now"],
      rationale: "Tattva Spa is a Visa Infinite portal discount.",
      steps: [
        offer?.link ? `Open ${offer.link}` : "Network perks → Tattva Spa",
        "Redeem / book",
        "Pay with HSBC Live+ or BOB Eterna",
      ],
    });
  }

  if (kind === "sports" || /district\s*play|pickleball|padel/.test(t)) {
    const offer = visaInfiniteOffer("inf-district-play");
    const discInr = Math.min(amt * 0.5, 300);
    add({
      cardId: "hsbc_live_plus",
      label: "Visa Infinite → District Play (up to 50% / ₹300, first 3 bookings)",
      effectivePct: (discInr / amt) * 100,
      bonusRewardInr: discInr,
      pros: ["Up to 50% off (max ₹300) on first 3 pickleball/padel/football/tennis bookings"],
      cons: ["First 3 bookings only", "Visa District offer → Redeem Now"],
      rationale: "District Play sports discount via Visa Infinite.",
      steps: [
        offer?.link ? `Open ${offer.link}` : "Network perks → District Play",
        "Redeem Now → book in District Play",
        "Pay with HSBC Live+",
      ],
    });
  }
}


/** Exhaust OTA + Amazon + Scapia routes for hotel / flight / bus / train. */
function addExhaustiveTravelRoutes(
  kind: TravelKind,
  input: RecommendInput,
  amt: number,
  add: AddFn,
  ckOverride?: number
): void {
  const prime = input.primeMember !== false;
  const apPct = amazonTravelCardPct(kind, prime);
  const extra = input.amazonOrderCashbackInr && input.amazonOrderCashbackInr > 0 ? input.amazonOrderCashbackInr : 0;
  const bobHeadroom = Math.max(0, 33000 - (input.bobCycleSpend5x ?? 0));
  const bob5xOk = bobHeadroom >= Math.min(amt, 1000);

  // --- Amazon.in travel + Amazon Pay ICICI ---
  {
    const cardInr = amt * (apPct / 100);
    const total = cardInr + extra;
    add({
      cardId: "amazon_pay_icici",
      label: extra > 0
        ? `Amazon.in ${kind} → Amazon Pay ICICI (${apPct}% + ${inr(extra)} checkout offer)`
        : `Amazon.in ${kind} → Amazon Pay ICICI (${apPct}%${prime && (kind === "flight" || kind === "hotel") ? " Prime" : ""})`,
      effectivePct: (total / amt) * 100,
      baseRewardInr: cardInr,
      bonusRewardInr: extra,
      worstCasePct: apPct,
      bestCasePct: (total / amt) * 100,
      pros: [
        kind === "flight" || kind === "hotel"
          ? `${apPct}% uncapped on Amazon.in flights & hotels (${prime ? "Prime" : "non-Prime"})`
          : `${apPct}% on Amazon bus/train-style bookings (digitally fulfilled / bills tier)`,
        extra > 0 ? `+ ${inr(extra)} Amazon checkout / first-booking offer you entered` : "Add any Amazon first-booking / wallet cashback ₹ in the widget if shown",
        "Liquid as Amazon Pay balance",
      ],
      cons: [
        "Compare Amazon's fare vs Agoda/MMT/Cleartrip before locking — fare can wipe the % win",
        kind === "bus" || kind === "train" ? "Confirm category posts as expected (2%); exclusions can apply" : "",
      ].filter(Boolean),
      rationale: `Always price-check Amazon vs OTAs. Card earn: ${apPct}% via Amazon Pay ICICI on Amazon.in ${kind}${extra > 0 ? ` plus ${inr(extra)} order offer` : ""}.`,
      steps: [
        `Open Amazon.in → Travel → ${kind}`,
        "Compare total payable vs Agoda / MMT / Cleartrip / airline site",
        `Pay with Amazon Pay ICICI card (${apPct}%) — not AP balance`,
        extra > 0 ? `Expect ~${inr(total)} total (card + checkout offer)` : `Expect ~${apPct}% (${inr(cardInr)})`,
      ],
    });
  }

  // --- Portal accelerated: Amex Reward Multiplier → MakeMyTrip (hotels & flights) ---
  // Gold 5× MR = 5 pts/₹50 ≈ 5.8% @ ₹0.58/MR (no ShopWise voucher fee on travel bookings).
  // Must open via Amex RM / ShopWise travel — MMT app alone does NOT get the multiplier.
  if (kind === "hotel" || kind === "flight") {
    const goldRmPct = 5.8;
    const goldMilestone = goldMilestoneBonus(input, amt);
    const goldTotal = amt * (goldRmPct / 100) + (goldMilestone?.inr ?? 0);
    add({
      cardId: "amex_gold",
      label: `Amex Reward Multiplier → MMT ${kind} (Gold 5× ≈ ${goldRmPct}%)`,
      effectivePct: (goldTotal / amt) * 100,
      baseRewardInr: amt * (goldRmPct / 100),
      bonusRewardInr: goldMilestone?.inr ?? 0,
      worstCasePct: goldRmPct,
      bestCasePct: (goldTotal / amt) * 100,
      pros: [
        `5× Membership Rewards via Amex Reward Multiplier portal ≈ ${goldRmPct}% @ Taj/24K value`,
        "No ShopWise voucher convenience fee (this is a travel booking, not an e-voucher)",
        goldMilestone?.note ?? "Also counts as a ≥₹1k Gold txn if amount qualifies",
      ].filter(Boolean),
      cons: [
        "Must start from Amex Reward Multiplier / ShopWise → MakeMyTrip (not MMT app alone)",
        "Fare on MMT via RM can be higher than Agoda — compare all-in",
        "Usually behind Cashkaro Agoda 7% + BOB 5× (~10.75%) when Agoda price matches",
      ],
      rationale: `Amex Gold portal accel on MMT ${kind}: ~${goldRmPct}% MR. Beats Amazon ${apPct}% when fares are equal; still check Agoda+Cashkaro+BOB first.`,
      steps: [
        "Open Amex app / americanexpress.com → Reward Multiplier (or ShopWise travel)",
        `Select MakeMyTrip → book ${kind}`,
        "Pay with Amex Gold in the same session",
        "Do NOT book in the standalone MMT app — multiplier won't apply",
      ],
    });
    // MRCC gets a weaker multiplier (~2× ≈ 2.3%) — still list for milestone fills
    const mrccRmPct = 2.3;
    const mrccB = mrccMilestoneBonus(input, amt);
    add({
      cardId: "amex_mrcc",
      label: `Amex Reward Multiplier → MMT ${kind} (MRCC ~2× ≈ ${mrccRmPct}%)`,
      effectivePct: ((amt * (mrccRmPct / 100) + (mrccB?.inr ?? 0)) / amt) * 100,
      baseRewardInr: amt * (mrccRmPct / 100),
      bonusRewardInr: mrccB?.inr ?? 0,
      pros: [mrccB?.note ?? "MRCC portal earn on MMT", "Useful if you need ≥₹1.5k MRCC txn"],
      cons: [`Only ~${mrccRmPct}% — usually behind Gold RM, Amazon, and Agoda+BOB`],
      rationale: "MRCC Reward Multiplier on MMT is a milestone tool more than a yield play.",
      steps: [
        "Amex Reward Multiplier → MakeMyTrip",
        `Book ${kind}`,
        "Pay with Amex MRCC",
      ],
    });
  }

  // --- Hotels: Agoda 7% Cashkaro + BOB 5× (MCC auto-accel — not a separate portal earn) ---
  if (kind === "hotel") {
    const agoda = ckInrForStore("Agoda", "Hotels", amt, ckOverride);
    if (agoda) {
      const bobInr = bob5xOk ? amt * 0.0375 : amt * 0.0075;
      const bobPct = bob5xOk ? 3.75 : 0.75;
      add({
        cardId: "bob_eterna",
        label: `Cashkaro → Agoda + BOB ${bobPct}% travel 5× (MCC auto)`,
        effectivePct: ((agoda.inr + bobInr) / amt) * 100,
        baseRewardInr: agoda.inr + bobInr,
        cashkaroSuggested: true,
        worstCasePct: bobPct,
        bestCasePct: ((agoda.inr + bobInr) / amt) * 100,
        pros: [
          agoda.note,
          `BOB 5× travel is automatic on travel MCC (15 RP/₹100 = 3.75%) — no special portal to open`,
          "Redeem RP later at portal.bobcard.co.in @ ₹0.25/RP statement credit",
          "Often beats Amazon 5% and Amex RM when Agoda fare is similar",
        ],
        cons: [
          !bob5xOk ? "BOB 5× cycle headroom low — base 0.75% only on card side" : "5× bonus capped at 5,000 RP/cycle (~₹33k accelerated spend)",
          "Taj / Amex voucher stays need IHCL direct — not Agoda",
        ],
        rationale: `Agoda via Cashkaro (often flat 7%) + BOB travel 5× MCC earn. BOBCARD portal/app is for redeeming points (statement credit / SmartDeal), not for earning the 5×.`,
        steps: ["Open Cashkaro → Agoda", "Book hotel", "Pay with BOB Eterna", "Redeem RP later: portal.bobcard.co.in → statement credit (min 1,000 RP)"],
      });
    }
    const booking = ckInrForStore("Booking.com", "Hotels", amt, ckOverride);
    if (booking) {
      const bobInr = bob5xOk ? amt * 0.0375 : amt * 0.0075;
      add({
        cardId: "bob_eterna",
        label: `Cashkaro → Booking.com + BOB ${bob5xOk ? "5×" : "base"}`,
        effectivePct: ((booking.inr + bobInr) / amt) * 100,
        baseRewardInr: booking.inr + bobInr,
        cashkaroSuggested: true,
        pros: [booking.note, "BOB travel earn"],
        cons: ["Usually behind Agoda's flat 7% when both list the hotel"],
        rationale: "Booking.com Cashkaro stack — backup if Agoda inventory/price is worse.",
        steps: ["Cashkaro → Booking.com", "Pay with BOB Eterna"],
      });
    }
    const mmtH = ckInrForStore("MakeMyTrip", "Hotels", amt, ckOverride);
    if (mmtH) {
      const bobInr = bob5xOk ? amt * 0.0375 : amt * 0.0075;
      add({
        cardId: "bob_eterna",
        label: `Cashkaro → MMT hotels (${mmtH.note}) + BOB`,
        effectivePct: ((mmtH.inr + bobInr) / amt) * 100,
        baseRewardInr: mmtH.inr + bobInr,
        cashkaroSuggested: true,
        pros: [mmtH.note, "Good when MMT has exclusive inventory"],
        cons: ["Flat Cashkaro ₹ is weak on large hotel bills vs Agoda 7%"],
        rationale: "MMT domestic hotels: flat Cashkaro ₹ + BOB. Prefer Agoda % on bigger stays.",
        steps: ["Cashkaro → MakeMyTrip Hotels", "Pay with BOB Eterna"],
      });
    }
    const ctH = ckInrForStore("Cleartrip", "Hotels", amt, ckOverride);
    if (ctH) {
      const bobInr = bob5xOk ? amt * 0.0375 : amt * 0.0075;
      add({
        cardId: "bob_eterna",
        label: `Cashkaro → Cleartrip hotels + BOB 5×`,
        effectivePct: ((ctH.inr + bobInr) / amt) * 100,
        baseRewardInr: ctH.inr + bobInr,
        cashkaroSuggested: true,
        pros: [ctH.note, "BOB 5× travel"],
        cons: ["Flat CK ₹ — weak vs Agoda 7% on large bookings"],
        rationale: "Cleartrip hotels via Cashkaro + BOB.",
        steps: ["Cashkaro → Cleartrip", "Book hotel", "Pay with BOB Eterna"],
      });
    }
    // Scapia-app travel 4%
    add({
      cardId: "scapia",
      label: "Scapia app travel (20% coins = 4% value)",
      effectivePct: 4.0,
      worstCasePct: 2.0,
      bestCasePct: 4.0,
      pros: ["4% when booked inside Scapia app/store", "Coins redeemable only for Scapia travel"],
      cons: ["Need Scapia inventory; coins travel-locked", "Maintain ₹20k/mo for lounge if you care"],
      rationale: "If the hotel is on Scapia travel, 4% locked coins can beat Amazon 5% only when you will burn Scapia coins — otherwise Amazon/Agoda cash stacks win.",
      steps: ["Open Scapia → Travel", "Book hotel if listed", "Pay with Scapia"],
    });
    // Amex PT milestone / direct hotel
    {
      const mb = annualMilestoneBonus("amex_plat_travel", input, amt);
      const base = amt * 0.01;
      add({
        cardId: "amex_plat_travel",
        label: mb ? `Hotel direct / OTA → Amex PT (1% + milestone)` : "Hotel direct → Amex PT (1% / MR)",
        effectivePct: ((base + (mb?.inr ?? 0)) / amt) * 100,
        baseRewardInr: base,
        bonusRewardInr: mb?.inr ?? 0,
        pros: [
          "Needed for Taj / Amex voucher stays (book IHCL direct)",
          mb?.note ?? "Counts toward PT ₹4L / ₹7L",
        ],
        cons: ["Yield below Agoda 7% + BOB or Amazon 5% unless voucher / milestone matters"],
        rationale: "Use Amex PT when burning Taj vouchers (direct IHCL only) or pushing annual milestones — not for pure OTA yield.",
        steps: [
          "For Taj voucher: book on tajhotels.com (public rate), apply voucher, pay remainder Amex",
          "Else compare vs Amazon / Agoda stacks first",
        ],
      });
    }
  }

  // --- Flights: Cleartrip / MMT Cashkaro + BOB; airline direct ---
  if (kind === "flight") {
    const ctF = ckInrForStore("Cleartrip", "Flights", amt, ckOverride);
    if (ctF) {
      const bobInr = bob5xOk ? amt * 0.0375 : amt * 0.0075;
      add({
        cardId: "bob_eterna",
        label: `Cashkaro → Cleartrip flights + BOB ${bob5xOk ? "5×" : "base"}`,
        effectivePct: ((ctF.inr + bobInr) / amt) * 100,
        baseRewardInr: ctF.inr + bobInr,
        cashkaroSuggested: true,
        pros: [ctF.note, "BOB 5× travel"],
        cons: ["Flight Cashkaro often flat ₹ — Amazon 5% usually wins on large fares if fare matches"],
        rationale: "Cleartrip + Cashkaro + BOB. Always fare-match vs Amazon and airline direct.",
        steps: ["Cashkaro → Cleartrip", "Book flight", "Pay with BOB Eterna"],
      });
    }
    const mmtF = ckInrForStore("MakeMyTrip", "Flights", amt, ckOverride);
    if (mmtF) {
      const bobInr = bob5xOk ? amt * 0.0375 : amt * 0.0075;
      add({
        cardId: "bob_eterna",
        label: `Cashkaro → MMT flights + BOB`,
        effectivePct: ((mmtF.inr + bobInr) / amt) * 100,
        baseRewardInr: mmtF.inr + bobInr,
        cashkaroSuggested: true,
        pros: [mmtF.note],
        cons: ["Flat CK weak on expensive tickets vs Amazon 5%"],
        rationale: "MMT flights via Cashkaro — compare fare + Amazon 5%.",
        steps: ["Cashkaro → MakeMyTrip", "Pay with BOB Eterna"],
      });
    }
    if (sbiSimplyClickPartner("cleartrip", "flights")) {
      add({
        cardId: "sbi_simplyclick",
        label: "Cashkaro → Cleartrip → SBI SimplyCLICK 10× (~2.5%)",
        effectivePct: 2.5 + (ctF ? (ctF.inr / amt) * 100 : 0),
        cashkaroSuggested: !!ctF,
        pros: ["10× partner"],
        cons: ["Usually behind BOB 5× and Amazon 5%"],
        rationale: "SBI Cleartrip backup if BOB 5× is exhausted.",
        steps: ["Cashkaro → Cleartrip", "Pay with SBI SimplyCLICK"],
      });
    }
    add({
      cardId: "scapia",
      label: "Scapia app flights (20% coins = 4%)",
      effectivePct: 4.0,
      pros: ["4% travel-locked coins in Scapia app"],
      cons: ["Only if you will redeem Scapia coins on travel"],
      rationale: "Scapia-app flight when inventory exists and you burn coins.",
      steps: ["Scapia → Travel → Flights", "Pay with Scapia"],
    });
  }

  // --- Bus ---
  if (kind === "bus") {
    const rb = ckInrForStore("RedBus", "Bus", amt, ckOverride);
    if (rb) {
      const bobInr = bob5xOk ? amt * 0.0375 : amt * 0.0075;
      add({
        cardId: "bob_eterna",
        label: `Cashkaro → RedBus + BOB`,
        effectivePct: ((rb.inr + bobInr) / amt) * 100,
        baseRewardInr: rb.inr + bobInr,
        cashkaroSuggested: true,
        pros: [rb.note],
        cons: ["Amazon bus at 2% may be simpler if fare is equal"],
        rationale: "RedBus via Cashkaro vs Amazon 2% — pick higher all-in.",
        steps: ["Cashkaro → RedBus (if listed)", "Or Amazon Travel → Bus", "Pay accordingly"],
      });
    }
    add({
      cardId: "scapia",
      label: "Scapia travel bus (4% if in-app)",
      effectivePct: 4.0,
      pros: ["4% when booked in Scapia"],
      cons: ["Coins travel-locked"],
      rationale: "Scapia bus if available in-app.",
      steps: ["Scapia → Travel → Bus"],
    });
  }
  // Visa Infinite portal discounts (Agoda/IHG/ITC/Avis) from Live+ Know-more links
  addVisaInfiniteBenefitRoutes(kind, input, amt, add, `${input.merchant || ""} ${input.category || ""}`);

}

function isMovieExpense(merchant: string, category: string): boolean {
  return /bookmyshow|\bbms\b|district|pvr|inox|cinepolis|cinema|movie|event/.test(
    `${merchant} ${category}`.toLowerCase()
  );
}

/** Ticket count from clarification category (defaults to 2 for legacy "2+" labels). */
function movieTicketCount(category: string): number {
  const c = category.toLowerCase();
  if (/1 ticket/.test(c)) return 1;
  if (/·\s*2 tickets/.test(c) || /\b2 tickets\b/.test(c)) return 2;
  if (/3\+|3 or more|·\s*3/.test(c)) return 3;
  if (/2\+\s*tickets/.test(c)) return 2;
  return 2;
}

function theatreFromInput(input: RecommendInput, merchant: string, cat: string): RecommendInput["movieTheatre"] {
  if (input.movieTheatre) return input.movieTheatre;
  const t = `${merchant} ${cat}`;
  // Premium hall brands → operator (not the screen format)
  if (/\binsignia\b|\bdirector'?s\s*cut\b|\bluxe\b|\bp\[?xl\]?\b|\bplayhouse\b/i.test(t)) return "pvr";
  if (/\bcinepolis\b|\bmacro\s*xe\b/i.test(t)) return "cinepolis";
  if (/\bpvr\b/i.test(t)) return "pvr";
  if (/\binox\b/i.test(t)) return "inox";
  if (/\bdistrict\b/i.test(t)) return "district";
  if (/bookmyshow|\bbms\b/i.test(t)) return "bms";
  // IMAX / 4DX / ScreenX are formats on PVR, Cinepolis, Miraj, etc. — do NOT guess the chain
  return undefined;
}

function theatreLabelOf(theatre: RecommendInput["movieTheatre"] | undefined): string {
  if (theatre === "cinepolis") return "Cinepolis";
  if (theatre === "pvr") return "PVR";
  if (theatre === "inox") return "INOX";
  if (theatre === "district") return "District";
  if (theatre === "bms") return "BookMyShow";
  return "cinema";
}

/** Typical CRED Store movie GC defaults (no live fetch — app-gated). Override via widget / Settings. */
const MOVIE_CRED_GC_DEFAULTS: { id: NonNullable<RecommendInput["movieTheatre"]>; label: string; pct: number }[] = [
  { id: "cinepolis", label: "Cinepolis", pct: 28 },
  { id: "pvr", label: "PVR", pct: 24 },
  { id: "inox", label: "INOX", pct: 24 },
  { id: "bms", label: "BookMyShow", pct: 3.75 },
  { id: "district", label: "District", pct: 3.75 },
];

function resolveMovieCredPct(
  brand: (typeof MOVIE_CRED_GC_DEFAULTS)[number],
  input: RecommendInput,
  selected: RecommendInput["movieTheatre"] | undefined
): { pct: number; live: boolean } {
  const live = input.credGiftCardPctOverride && input.credGiftCardPctOverride > 0
    ? input.credGiftCardPctOverride
    : undefined;
  const selectedMatches =
    selected === brand.id ||
    (selected === "inox" && brand.id === "pvr") ||
    (selected === "pvr" && brand.id === "inox");
  if (live != null && selectedMatches) return { pct: live, live: true };
  const ov = input.giftCardRateOverrides?.[`CRED:${brand.label}`];
  if (ov != null && Number.isFinite(ov) && ov > 0) return { pct: ov, live: false };
  return { pct: brand.pct, live: false };
}

/** Always surface CRED cinema GCs for movie queries (defaults if no live % entered). */
function addMovieCredGiftCardRoutes(
  input: RecommendInput,
  amt: number,
  add: (o: Partial<RouteOption> & { cardId: string; label: string; effectivePct: number }) => void,
  bogoSavingsCap: number
) {
  const selected = theatreFromInput(input, input.merchant || "", input.category || "");
  const brands =
    selected && selected !== "other"
      ? MOVIE_CRED_GC_DEFAULTS.filter((b) => b.id === selected || (selected === "inox" && b.id === "inox") || (selected === "pvr" && b.id === "pvr"))
      : MOVIE_CRED_GC_DEFAULTS.filter((b) => b.id !== "inox"); // show Cinepolis/PVR/BMS/District when chain unknown

  // If user picked a chain, also mention BMS/District GC as mild fallbacks only when selected is bms/district — already covered.
  for (const brand of brands) {
    const { pct, live } = resolveMovieCredPct(brand, input, selected);
    if (pct <= 0) continue;
    const saveInr = amt * (pct / 100);
    const beatsBogo = saveInr > bogoSavingsCap;
    add({
      cardId: "giftcard",
      label: `CRED ${brand.label} gift card (${pct}% off${live ? " · live" : ""}) → pay tickets with GC`,
      effectivePct: pct,
      baseRewardInr: saveInr,
      worstCasePct: pct,
      bestCasePct: pct,
      pros: [
        `${pct}% off face value via CRED Store ${brand.label} gift card${live ? " (rate you entered)" : " (typical default — verify in CRED)"}`,
        `≈ ${inr(saveInr)} saved on this ${inr(amt)} booking`,
        "Custom amount / open denomination — buy GC for the exact ticket total",
        beatsBogo
          ? `Beats BOB/Live+ BOGO (cap ~₹${bogoSavingsCap}) on this amount`
          : "Compare vs BOGO (~₹250 cap) — GC % wins on larger bookings",
      ],
      cons: [
        "Buy the gift card in CRED Store first, then pay at BMS / District / theatre with the GC balance",
        "Gift-card balance is brand-locked (PVR GC ≠ Cinepolis ≠ BMS)",
        live ? "" : "Rates rotate — confirm the live % in CRED before buying",
      ].filter(Boolean),
      rationale: `CRED Store ${brand.label} gift cards are typically ~${pct}% off${live ? ` (you entered ${pct}%)` : ""}. Custom amount coupons mean you can match the ticket total exactly. Paying with that GC saves ${inr(saveInr)} (${pct}%) — often better than BOGO's ₹250 cap on multi-ticket / premium seats.`,
      steps: [
        `Open CRED → Store → ${brand.label} gift card`,
        `Buy a custom-amount GC for ~${inr(amt)} at ${pct}% off (pay via UPI)`,
        "Book on BookMyShow / District / theatre app and pay with the gift-card balance",
        "Keep the CRED purchase receipt",
      ],
    });
  }
}

/** Live CRED % applies only to the deal that matches the selected theatre / merchant — not every CRED row. */
function credLivePctAppliesToDeal(
  dealLabel: string,
  input: RecommendInput,
  merchant: string,
  category: string
): boolean {
  if (!input.credGiftCardPctOverride || input.credGiftCardPctOverride <= 0) return false;
  const label = dealLabel.toLowerCase();
  const theatre = theatreFromInput(input, merchant, category);
  if (theatre === "pvr") return /\bpvr\b/.test(label);
  if (theatre === "cinepolis") return /\bcinepolis\b/.test(label);
  if (theatre === "inox") return /\binox\b/.test(label);
  if (theatre === "bms") return /bookmyshow|\bbms\b/.test(label);
  if (theatre === "district") return /\bdistrict\b/.test(label);
  // Shopping / other: apply to deals whose label matches the merchant text
  const merch = (input.merchant || "").toLowerCase();
  if (!merch) return true; // single generic override
  return label.includes(merch) || new RegExp(merch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(dealLabel);
}

/** Keep the best gift-card option per merchant label (avoids CRED Cinepolis + inflated BMS GC duplicates). */
function dedupeGiftCardOptions(options: RouteOption[]): RouteOption[] {
  const out: RouteOption[] = [];
  const bestGc = new Map<string, RouteOption>();
  for (const o of options) {
    if (o.cardId !== "giftcard") {
      out.push(o);
      continue;
    }
    const m = o.label.match(/(?:CRED|CheQ|ShopWise|Brand)\s+([^→(]+?)(?:\s+gift|\s*\(|$)/i);
    const key = (m?.[1] || o.label).trim().toLowerCase().replace(/\s+/g, " ");
    const prev = bestGc.get(key);
    if (!prev || o.totalRewardInr > prev.totalRewardInr) bestGc.set(key, o);
  }
  out.push(...bestGc.values());
  return out;
}

function sbiSimplyClickPartner(merchant: string, category: string): boolean {
  return /bookmyshow|\bbms\b|myntra|cleartrip|yatra|apollo|netmeds|domino|tata\s*cliq|tatacliq/.test(
    `${merchant} ${category}`.toLowerCase()
  );
}

/**
 * Does Amazon Pay accept this payment cleanly? (bills/recharges/Amazon/partner merchants).
 * NOTE: insurance is intentionally EXCLUDED — Amazon Pay levies convenience fees on insurance
 * premiums (+ ₹1L / 6-per-month caps), so 2% doesn't net out; pay the insurer/PolicyBazaar direct.
 */
function amazonPayable(category: string, merchant: string): boolean {
  const c = `${category} ${merchant}`.toLowerCase();
  return /utilit|electric|mobile|recharge|broadband|\btv\b|dth|\bgas\b|water|amazon|bookmyshow|\bbms\b|movie|flight|hotel|bus|train|travel/.test(c);
}

/** Categories where Amex earns no MR AND doesn't count toward Amex milestones. */
function amexExcluded(category: string): boolean {
  const c = category.toLowerCase();
  return /fuel|petrol|diesel|insurance|\brent\b|wallet|\btax\b|govt|government|emi/.test(c);
}

/** Year-to-date spend tracked for each card's annual milestone. */
function ytdForCard(cardId: string, input: RecommendInput): number {
  switch (cardId) {
    case "amex_plat_travel": return input.ptccEligibleSpend ?? 0;
    case "amex_mrcc": return input.mrccCycleSpend ?? 0;
    case "sbi_simplyclick": return input.sbiYtdSpend ?? 0;
    case "idfc_indigo": return input.idfcYtdSpend ?? 0;
    case "bob_eterna": return input.bobYtdSpend ?? 0;
    case "hsbc_live_plus": return input.hsbcLivePlusYtdSpend ?? 0;
    default: return 0;
  }
}

/**
 * Marginal value of pushing THIS spend toward a card's next ANNUAL milestone.
 * Only counts when this spend completes the threshold OR you're already close
 * (within 10% of the goal or ≤₹15k remaining). Far-away pro-rata used to
 * inflate every SBI/IDFC/PT spend (e.g. ₹740 toward a ₹63k gap still got ~₹15
 * of "milestone" value) and falsely beat real routes like Amazon travel.
 */
function annualMilestoneBonus(cardId: string, input: RecommendInput, amt: number): { inr: number; note: string; threshold: number } | null {
  const short = getCardById(cardId)?.short ?? cardId;

  // SBI fee waiver is a separate counter from online voucher YTD.
  if (cardId === "sbi_simplyclick") {
    const feeSpend = input.sbiFeeWaiverSpend ?? 0;
    const feeThreshold = 100000;
    const feeReward = 589; // ₹499 + 18% GST
    if (feeSpend < feeThreshold) {
      const remaining = feeThreshold - feeSpend;
      const close = remaining <= Math.max(feeThreshold * 0.1, 15000);
      if (amt >= remaining || close) {
        const completes = amt >= remaining;
        const value = completes ? feeReward : Math.min(feeReward, (amt / remaining) * feeReward);
        return {
          inr: value,
          note: completes
            ? `Completes SBI fee-waiver ₹1L eligible retail → ~${inr(feeReward)} fee saved`
            : `Near SBI fee waiver — ${inr(remaining)} more to ₹1L eligible retail (~${inr(feeReward)} fee save)`,
          threshold: feeThreshold,
        };
      }
    }
  }

  const ytd = ytdForCard(cardId, input);
  const ms = ANNUAL_MILESTONES.filter((m) => m.cardId === cardId).slice().sort((a, b) => a.threshold - b.threshold);
  // Use live YTD only — ignore stale static `hit` flags in cards.ts.
  const next = ms.find((m) => ytd < m.threshold);
  if (!next) return null;
  const remaining = next.threshold - ytd;
  const completes = amt >= remaining;
  const close = remaining <= Math.max(next.threshold * 0.1, 15000);
  if (!completes && !close) return null;

  const value = completes
    ? next.rewardValueInr
    : Math.min(next.rewardValueInr, (amt / remaining) * next.rewardValueInr);
  const note = completes
    ? `Completes ${short}'s ${inr(next.threshold)} milestone → unlocks ${next.reward} (${inr(next.rewardValueInr)})`
    : `Near ${short}'s ${inr(next.threshold)} milestone — ${inr(remaining)} to go (${next.reward})`;
  return { inr: value, note, threshold: next.threshold };
}

/**
 * Cashkaro reward when paying ON THE AMAZON PLATFORM (you click the Cashkaro Amazon
 * link first, then do the same payment with a card — Cashkaro tracks the Amazon order
 * and pays on top). Recharges/bills = flat ₹1.5; shopping = category %.
 * Only valid when paying with a CARD (not Amazon Pay balance/voucher, which voids tracking).
 */
function amazonPlatformCashkaro(category: string, amt: number, override?: number): { inr: number; bestInr: number; note: string } | null {
  if (override != null && override > 0) {
    const v = amt * (override / 100);
    return { inr: v, bestInr: v, note: `Cashkaro live rate ${override}% (you entered)` };
  }
  const cat = category.toLowerCase();
  if (/recharge|mobile|broadband|dth|\btv\b|electric|\bgas\b|water|utility|bill/.test(cat)) {
    return { inr: 1.5, bestInr: 1.5, note: "Amazon recharge/bills Cashkaro link ≈ flat ₹1.5 (stacks on top)" };
  }
  const m = findCashkaro("Amazon", category);
  if (m && m.maxRate > 0) {
    const mid = (m.minRate + m.maxRate) / 2;
    return { inr: amt * (mid / 100) * 0.85, bestInr: amt * (m.maxRate / 100), note: `Amazon ${m.category ?? ""} Cashkaro ~${mid}% (tracking unreliable — treat as bonus)` };
  }
  // No Cashkaro link for this category (e.g. insurance, generic) → none.
  return null;
}

/**
 * Kiwi Neon excludes whole MCC families from BOTH cashback and milestone spends.
 * (Per gokiwi.in/neon/neon2 T&Cs.) Returns the reason text if excluded.
 */
function kiwiExcluded(cat: string, merchant: string): { excluded: boolean; reason?: string } {
  const c = `${cat} ${merchant}`.toLowerCase();
  if (/utility|electric|mobile|recharge|broadband|\btv\b|dth|gas bill|water bill|telecom/.test(c))
    return { excluded: true, reason: "telecom & utility MCCs (4812/4814/4900)" };
  if (/fuel|petrol|diesel/.test(c)) return { excluded: true, reason: "fuel MCCs (5541/5542)" };
  if (/\btax\b|govt|government/.test(c)) return { excluded: true, reason: "government MCCs (9211–9405)" };
  if (/insurance/.test(c)) return { excluded: true, reason: "insurance MCC (6300)" };
  if (/\brent\b|real estate/.test(c)) return { excluded: true, reason: "rent / real-estate MCC (6513)" };
  if (/investment|trading|stocks|mutual fund|crypto/.test(c)) return { excluded: true, reason: "financial-institution MCCs (6011/6051/6211)" };
  if (/wallet|gift\s*card/.test(c)) return { excluded: true, reason: "wallet / gift-card MCCs (6540/5947)" };
  if (/vehicle service|repair|garage|workshop|auto rental|denting|painting/.test(c)) return { excluded: true, reason: "auto-service / repair MCCs (7531/7538)" };
  if (/jewel/.test(c)) return { excluded: true, reason: "jewellery MCC (5944)" };
  if (/education|tuition|school|college|university/.test(c)) return { excluded: true, reason: "educational-services MCCs (8211–8299)" };
  return { excluded: false };
}

/** Scapia excludes the same MCC families from coins (rent/forex/insurance/utility/wallet/education/gift/EMI/cash/govt/fuel). */
function scapiaExcluded(cat: string, merchant: string): { excluded: boolean; reason?: string } {
  const c = `${cat} ${merchant}`.toLowerCase();
  if (/utility|electric|mobile|recharge|broadband|\btv\b|dth|gas bill|water bill/.test(c)) return { excluded: true, reason: "utility/telecom" };
  if (/fuel|petrol|diesel/.test(c)) return { excluded: true, reason: "fuel" };
  if (/insurance/.test(c)) return { excluded: true, reason: "insurance" };
  if (/\brent\b/.test(c)) return { excluded: true, reason: "rent" };
  if (/\btax\b|govt|government|business/.test(c)) return { excluded: true, reason: "government/business" };
  if (/wallet|gift\s*card/.test(c)) return { excluded: true, reason: "wallet/gift-card" };
  if (/education|tuition|school/.test(c)) return { excluded: true, reason: "education" };
  if (/crypto|bitcoin|ethereum/.test(c)) return { excluded: true, reason: "crypto" };
  if (/investment|trading/.test(c)) return { excluded: true, reason: "investments" };
  return { excluded: false };
}

/**
 * Build the Kiwi route option with correct Neon mechanics:
 *  - exclusion-aware (0% + reason for excluded MCCs)
 *  - 2% on in-person UPI scan & pay; 0.5% on online redirect
 *  - milestone top-up upside (3/5/7% marginal) based on current Neon cycle spend
 */
function buildKiwiOption(input: RecommendInput, amt: number): RouteOption {
  const cat = (input.category || "").toLowerCase();
  const merch = (input.merchant || "").toLowerCase();
  const ch = input.channel;
  const opt = (o: Partial<RouteOption> & { label: string; effectivePct: number; rationale: string }): RouteOption => {
    const base = o.baseRewardInr ?? amt * (o.effectivePct / 100);
    return {
      cardId: "yes_kiwi", label: o.label, effectivePct: o.effectivePct,
      baseRewardInr: base, bonusRewardInr: o.bonusRewardInr ?? 0, totalRewardInr: base + (o.bonusRewardInr ?? 0),
      feasible: o.feasible ?? true, feasibilityNote: o.feasibilityNote,
      pros: o.pros ?? [], cons: o.cons ?? [], cashkaroSuggested: false,
      worstCasePct: o.worstCasePct ?? o.effectivePct, bestCasePct: o.bestCasePct ?? o.effectivePct,
      steps: o.steps ?? [], rationale: o.rationale,
    };
  };

  const exc = kiwiExcluded(cat, merch);
  if (exc.excluded) {
    return opt({
      label: "YES Bank Kiwi (excluded category)", effectivePct: 0,
      cons: [`Kiwi Neon excludes ${exc.reason} from BOTH cashback AND milestone spends — this earns 0 Kiwis and does not progress your ₹50K / ₹1L / ₹1.5L milestones.`],
      rationale: `Even via Kiwi UPI, ${exc.reason} are on Kiwi's exclusion list, so this transaction earns nothing and is not counted toward Neon milestones.`,
    });
  }

  if (ch === "online") {
    return opt({
      label: "YES Bank Kiwi (online redirect, 0.5%)", effectivePct: 0.5, worstCasePct: 0, bestCasePct: 0.5,
      cons: ["Online (card-not-present) earns only 0.5% via Kiwi, and only if the merchant supports Kiwi's redirect (most don't). Kiwi shines on in-person UPI scan & pay."],
      rationale: "For card-not-present online checkout, Kiwi only earns 0.5% (and rarely supports the merchant). A dedicated card usually wins here.",
    });
  }

  // In-app movie / event checkout is card/wallet — not Kiwi QR scan & pay.
  if (isMovieExpense(merch, cat) && ch === "merchant_app") {
    return opt({
      label: "YES Bank Kiwi (not for in-app movie checkout)",
      effectivePct: 0,
      cons: ["BookMyShow / District / theatre apps are in-app payments — Kiwi's 2% is for scanning a UPI QR, not for app checkout"],
      rationale: "Movie tickets booked in BMS/District aren't a Kiwi UPI scan & pay. Use BOGO, CRED theatre gift card, Amazon Pay, or Cashkaro instead.",
    });
  }

  // In-person / merchant-app / explicit UPI → scan & pay 2%, with milestone upside
  const k = input.kiwiNeonCycleSpend ?? 0;
  let marginal = 2;
  let mileNote = "";
  if (k < 50000) { marginal = 3; mileNote = `Counts toward Neon ₹50K milestone (₹${Math.round(k).toLocaleString("en-IN")}/₹50K this cycle). Hitting ₹50K retroactively lifts all eligible spends to 3%.`; }
  else if (k < 100000) { marginal = 5; mileNote = `Past ₹50K — the next ₹${(100000 - k).toLocaleString("en-IN")} toward ₹1L earns ~5% effective once milestone 2 credits.`; }
  else if (k < 150000) { marginal = 7; mileNote = `Past ₹1L — the next ₹${(150000 - k).toLocaleString("en-IN")} toward ₹1.5L earns ~7% effective once milestone 3 credits.`; }
  else { marginal = 2; mileNote = "All three Neon milestones cleared this cycle → flat 2%."; }

  // Like the BOB welcome, reflect the Neon milestone marginal in the effective %:
  // 2% lands immediately; the retroactive top-up lifts it to ~3/5/7% as you march to the
  // next threshold. Worst case (if you stall before the milestone) is the guaranteed 2%.
  const baseInr = amt * 0.02;
  const milestoneInr = amt * ((marginal - 2) / 100);
  return opt({
    label: marginal > 2
      ? `YES Bank Kiwi — UPI scan & pay (~${marginal}% with Neon milestone)`
      : "YES Bank Kiwi — UPI scan & pay (2%)",
    effectivePct: marginal,
    baseRewardInr: baseInr,
    bonusRewardInr: milestoneInr,
    worstCasePct: 2.0,
    bestCasePct: marginal,
    pros: [`2% instant${marginal > 2 ? ` + Neon milestone top-up → ~${marginal}% effective` : ""} (1 Kiwi = ₹0.25, cashable)`, mileNote],
    cons: amt < 100 ? ["Kiwis accrue per ₹100 slab; sub-₹100 rounds down"] : (marginal > 2 ? ["The extra above 2% credits only when you actually hit the next Neon milestone"] : []),
    steps: [
      "Open the Kiwi app",
      "Scan the merchant's UPI QR (or enter UPI ID)",
      `Pay ${inr(amt)} via Kiwi (RuPay credit card on UPI)`,
      `Earn 2% now; the spend counts toward Neon milestones (retroactive ~${marginal}% once the next threshold credits)`,
    ],
    rationale: `Kiwi turns an in-person UPI payment into 2% now, and — like the BOB welcome — the Neon milestone top-up lifts it to ~${marginal}% as you march to the next threshold. ${mileNote}`,
  });
}

/**
 * THE ENGINE: builds candidate RouteOptions, scores each by total ₹ return
 * (base reward + milestone/welcome marginal value), filters infeasible ones,
 * and returns the best + ranked alternatives.
 */
export function recommend(input: RecommendInput): RecommendationResult {
  const merchant = (input.merchant || "").toLowerCase().trim();
  const cat = (input.category || "").toLowerCase().trim();
  const amt = input.amount;
  const isForeign = input.isForeign || input.channel === "foreign";
  const ckOverride = input.cashkaroPctOverride && input.cashkaroPctOverride > 0 ? input.cashkaroPctOverride : undefined;
  const ck = ckOverride != null
    ? { mid: ckOverride, min: ckOverride, max: ckOverride, zone: "reliable" as const }
    : ckRange(input.merchant, input.category);
  const apBal = input.amazonPayBalance ?? 0;
  const prime = input.primeMember !== false;

  const options: RouteOption[] = [];

  const add = (o: Partial<RouteOption> & { cardId: string; label: string; effectivePct: number }) => {
    const base = (o.baseRewardInr ?? amt * (o.effectivePct / 100));
    const bonus = o.bonusRewardInr ?? 0;
    options.push({
      cardId: o.cardId,
      label: o.label,
      effectivePct: o.effectivePct,
      baseRewardInr: base,
      bonusRewardInr: bonus,
      totalRewardInr: base + bonus,
      feasible: o.feasible ?? true,
      feasibilityNote: o.feasibilityNote,
      pros: o.pros ?? [],
      cons: o.cons ?? [],
      cashkaroSuggested: o.cashkaroSuggested ?? false,
      worstCasePct: o.worstCasePct ?? o.effectivePct,
      bestCasePct: o.bestCasePct ?? o.effectivePct,
      steps: o.steps ?? [],
      rationale: o.rationale ?? "",
    });
  };

  // ============ HARD-ROUTED CATEGORIES (channel/MCC forces the card) ============

  // --- UPI normal (no card rewards) ---
  if (input.channel === "upi_normal") {
    return finalize([{
      cardId: "yes_kiwi",
      label: "Switch to Kiwi UPI (2%) — or PhonePe/GPay = 0%",
      effectivePct: 2.0,
      baseRewardInr: amt >= 500 ? amt * 0.02 : 0,
      bonusRewardInr: 0,
      totalRewardInr: amt >= 500 ? amt * 0.02 : 0,
      feasible: true,
      pros: ["Same UPI QR, 2% via Kiwi credit-card UPI", "Builds Kiwi Neon milestone progress"],
      cons: amt < 500 ? ["Below ₹500 → no Kiwi cashback; just use PhonePe/GPay"] : [],
      cashkaroSuggested: false,
      worstCasePct: 0,
      bestCasePct: 5,
      steps: amt >= 500
        ? ["Open the Kiwi app", "Scan the same UPI QR", `Pay ${inr(amt)} via Kiwi (CC-UPI)`, "Earn 2% (1 Kiwi = ₹0.25, cashable)"]
        : ["Pay via PhonePe / GPay (amount < ₹500, Kiwi cashback won't apply)"],
      rationale: "Normal UPI earns nothing. Kiwi turns the same scan into a 2% cashback transaction.",
    }], input, amt, isForeign, ck);
  }

  // --- Foreign currency → Scapia (0% forex) ---
  if (isForeign) {
    const ckUsable = ck && ck.zone !== "na";
    add({
      cardId: "scapia",
      label: ckUsable ? "Scapia (0% forex) + Cashkaro" : "Scapia (0% forex)",
      effectivePct: 3.5 + (ckUsable ? ck!.mid * 0.7 : 0),
      worstCasePct: 3.5,
      bestCasePct: 3.5 + (ckUsable ? ck!.max : 0),
      cashkaroSuggested: !!ckUsable,
      pros: ["0% forex markup — saves ~3.5% vs Amex / ~2% vs IDFC abroad", "Best card you hold for non-INR"],
      cons: ["Scapia earns no coins on forex spends (excluded) — the win is purely the 0% markup", "Maintain ≥₹20K/mo for lounge"],
      rationale: "Scapia has 0% forex — unbeatable for non-INR. (Visa Infinite Meet & Greet needs ~$1k intl POS on Live+/BOB — don't use those abroad for markup; use Scapia, then push a deliberate Infinite POS only if hunting Meet & Assist eligibility — see Network perks.)",
      steps: [
        ckUsable ? "If on Cashkaro (Booking/Agoda), open via Cashkaro first" : `Pay with Scapia at the foreign merchant / POS`,
        "Scapia charges 0% forex markup",
        "See Network perks → Visa Infinite Meet & Greet if you still need $1k intl POS on Live+ or BOB",
      ],
    });
    // IDFC as a backup forex option
    add({
      cardId: "idfc_indigo",
      label: "IDFC Indigo (1.49% forex backup)",
      effectivePct: 1.0,
      worstCasePct: 1.0,
      bestCasePct: 1.0,
      pros: ["Low 1.49% forex if Scapia is declined"],
      cons: ["1.49% forex markup vs Scapia's 0%"],
      rationale: "Backup only if Scapia fails abroad.",
      steps: [`Pay with IDFC Indigo (1.49% forex)`],
    });
    return finalize(options, input, amt, isForeign, ck);
  }

  // --- Travel bookings (hotel / flight / bus / train) — exhaust Amazon + OTA + Scapia ---
  {
    const kind = travelKindOf(cat, merchant);
    const isIndiGo = cat.includes("indigo") || (merchant.includes("indigo") && !merchant.includes("amazon"));
    // Car rental / Avis — Visa Infinite portal (not OTA travelKind)
    if (/avis|\bcar\s*rental\b|\bhire\s*car\b/.test(`${cat} ${merchant}`)) {
      addVisaInfiniteBenefitRoutes("car", input, amt, add, `${merchant} ${cat}`);
      return finalize(options, input, amt, isForeign, ck);
    }
    if (/sephora/.test(`${cat} ${merchant}`)) {
      addVisaInfiniteBenefitRoutes("shopping", input, amt, add, `${merchant} ${cat}`);
      return finalize(options, input, amt, isForeign, ck);
    }
    if (/ajio/.test(`${cat} ${merchant}`)) {
      addVisaInfiniteBenefitRoutes("shopping", input, amt, add, `${merchant} ${cat}`);
      return finalize(options, input, amt, isForeign, ck);
    }
    if (/tattva/.test(`${cat} ${merchant}`)) {
      addVisaInfiniteBenefitRoutes("spa", input, amt, add, `${merchant} ${cat}`);
      return finalize(options, input, amt, isForeign, ck);
    }
    if (/district\s*play|pickleball|padel/.test(`${cat} ${merchant}`)) {
      addVisaInfiniteBenefitRoutes("sports", input, amt, add, `${merchant} ${cat}`);
      return finalize(options, input, amt, isForeign, ck);
    }
    if (isIndiGo) {
      add({
        cardId: "idfc_indigo",
        label: "IDFC Indigo via IndiGo app (up to 22 BluChips/₹100)",
        effectivePct: 9.9,
        bestCasePct: 9.9,
        worstCasePct: 6 * 0.45,
        pros: ["Up to 22 BluChips/₹100 (6 card + up to 16 IndiGo tier) ≈ 9.9% at ₹0.45/BluChip", "Burn BluChip vouchers on IndiGo"],
        cons: ["Must book on IndiGo app/site directly", "BluChips redeemable only on IndiGo one-way flights (base fare+fuel)"],
        rationale: "IndiGo direct + IDFC is usually the best flight route you hold — still compare Amazon 5% if IndiGo fare is worse on Amazon.",
        steps: ["Open IndiGo (6E) app", "Select flight", "Pay with IDFC Indigo card", "Earn up to 22 BluChips/₹100"],
      });
      addExhaustiveTravelRoutes("flight", input, amt, add, ckOverride);
      return finalize(options, input, amt, isForeign, ck);
    }
    if (kind) {
      addExhaustiveTravelRoutes(kind, input, amt, add, ckOverride);
      return finalize(options, input, amt, isForeign, ck);
    }
  }

  // --- UPI scan/pay (Kiwi) ---
  if (input.channel === "upi") {
    options.push(buildKiwiOption(input, amt));
    return finalize(options, input, amt, isForeign, ck);
  }

  // ============ UTILITIES (electricity / mobile / broadband / TV / gas / water) ============
  if (cat.includes("utility") || cat.includes("electric") || cat.includes("mobile") || cat.includes("recharge") || cat.includes("broadband") || cat.includes("tv") || cat.includes("gas") || cat.includes("water") || cat.includes("dth")) {
    // Live+ 10% on utilities (from 26 Jul 2026) — primary bills card; pay biller DIRECT (not Amazon).
    options.push(buildLivePlusOption(amt, "utility", input));

    // Overflow after Live+ cap: Amazon Pay ICICI via Amazon bill-pay = 2%
    {
      const ckAmz = amazonPlatformCashkaro(cat, amt, ckOverride);
      const ckInr = ckAmz?.inr ?? 0;
      const baseCash = amt * 0.02;
      add({
        cardId: "amazon_pay_icici",
        label: ckInr > 0 ? "Cashkaro → Amazon Pay ICICI bill-pay (2% + Cashkaro) — after Live+ cap" : "Amazon Pay ICICI via Amazon bill-pay (2%) — after Live+ cap",
        effectivePct: ((baseCash + ckInr) / amt) * 100,
        baseRewardInr: baseCash + ckInr,
        cashkaroSuggested: !!ckAmz,
        worstCasePct: 2.0,
        pros: [`2% on bills/recharges via Amazon.in${ckInr > 0 ? ` + Cashkaro ${inr(ckInr)}` : ""}`, "Use when Live+ ₹1,200/mo accelerated cap is already full"],
        cons: ["Only 2% vs Live+ 10%", "1% fee if a single utility txn > ₹50K", "Pay with the CARD (not balance) so Cashkaro tracks"],
        rationale: `After Live+'s shared 10% cap is exhausted, Amazon Pay ICICI at 2% via Amazon bills is the held overflow route${ckInr > 0 ? ` (+ Cashkaro ${inr(ckInr)})` : ""}.`,
        steps: [
          ckInr > 0 ? "Open Cashkaro → Amazon → Recharge & Bills link first" : "Open Amazon.in → Amazon Pay → Recharges & Bills",
          `Select the biller, enter ${inr(amt)}`,
          "Pay with the Amazon Pay ICICI card (not balance)",
          `2% (${inr(baseCash)})${ckInr > 0 ? ` + Cashkaro ${inr(ckInr)}` : ""} credited`,
        ],
      });
    }

    // Spend down Amazon Pay balance (sunk gift-card money)
    if (apBal >= 100) {
      const used = Math.min(apBal, amt);
      add({
        cardId: "amazon_pay_icici",
        label: `Use idle Amazon Pay balance (${inr(used)})`,
        effectivePct: 0,
        baseRewardInr: 0,
        pros: [`Clears ${inr(used)} of idle Amazon Pay balance`, "No fee"],
        cons: ["Earns 0% — only to drain leftover balance", apBal < amt ? `Covers only ${inr(used)}; pay rest with Live+` : "Fully covers this bill"],
        rationale: `Your ${inr(apBal)} Amazon Pay balance is sunk gift-card money earning nothing. Spending it on a recharge clears idle balance but earns no new reward.`,
        steps: [
          "Open Amazon.in → Recharges & Bills",
          `Apply Amazon Pay balance (${inr(used)})`,
          apBal < amt ? `Pay remaining ${inr(amt - used)} with HSBC Live+ (10%)` : "Done — fully covered by balance",
        ],
      });
    }

    // BOB — welcome push / base
    {
      const bobWelcome = bobWelcomeBonus(input, amt);
      const bobBase = amt * 0.0075;
      add({
        cardId: "bob_eterna",
        label: bobWelcome ? "BOB Eterna (welcome push to ₹50K)" : "BOB Eterna (base 0.75%)",
        effectivePct: 0.75 + (bobWelcome ? (bobWelcome.inr / amt) * 100 : 0),
        baseRewardInr: bobBase,
        bonusRewardInr: bobWelcome?.inr ?? 0,
        pros: bobWelcome
          ? [bobWelcome.note, "Every rupee counts toward ₹50K welcome (₹2,500)"]
          : ["Telecom earns base RP from 1 Apr 2026"],
        cons: ["Base rate only 0.75% on utilities", !bobWelcome ? "Welcome window already closed/met" : "", "Worse than Live+ 10%"],
        rationale: bobWelcome
          ? `Inside BOB 60-day welcome — ${bobWelcome.note} Prefer Live+ for yield unless you specifically need welcome volume.`
          : "BOB base 0.75% on utilities — Live+ 10% wins unless cap is full.",
        steps: ["Open biller app / BBPS", `Pay ${inr(amt)} with BOB Eterna`],
      });
    }

    const goldBonus = goldMilestoneBonus(input, amt);
    add({
      cardId: "amex_gold",
      label: goldBonus ? "Amex Gold (1% + fills 6-txn milestone)" : "Amex Gold (1%, milestone N/A)",
      effectivePct: 1.0 + (goldBonus ? (goldBonus.inr / amt) * 100 : 0),
      baseRewardInr: amt * 0.01,
      bonusRewardInr: goldBonus?.inr ?? 0,
      pros: goldBonus ? ["1 MR/₹50 = 1% on utilities", goldBonus.note] : ["1 MR/₹50 = 1% on utilities"],
      cons: amt < 1000
        ? ["< ₹1,000 → does NOT count toward the 6-txn milestone"]
        : goldBonus ? ["Worse yield than Live+ 10%"] : ["Monthly 6-txn milestone already hit"],
      rationale: amt < 1000
        ? `Amex Gold earns 1% on utilities, but ₹${Math.round(amt)} is below the ₹1,000 minimum for the 6-txn milestone.`
        : "Prefer Live+ 10% for utilities; use Gold only if you still need a ≥₹1k milestone txn this month.",
      steps: ["Open biller app", `Pay ${inr(amt)} with Amex Gold`],
    });

    return finalize(options, input, amt, isForeign, ck);
  }

  // ============ FUEL ============
  if (cat.includes("fuel") || cat.includes("petrol") || cat.includes("diesel")) {
    add({
      cardId: "upi",
      label: "Debit / cash / PhonePe UPI — fuel earns ~0% on every card",
      effectivePct: 0,
      baseRewardInr: 0,
      pros: ["Avoids pointless CC friction", "Kiwi / Scapia / BOB all exclude fuel from rewards"],
      cons: ["No reward anywhere worth chasing"],
      rationale: "Fuel MCCs earn nothing on Kiwi (excluded from cashback AND Neon milestones), Scapia, BOB, Amex, and Amazon Pay ICICI. Paying petrol with Kiwi only helps if you need the 1% surcharge waiver (₹400–₹5k) — you still get 0% cashback. Prefer debit/cash/PhonePe.",
      steps: ["Pay with debit card, cash, or PhonePe UPI", "Do NOT use Kiwi expecting cashback — fuel is excluded"],
    });
    add({
      cardId: "idfc_indigo",
      label: "IDFC Indigo — only if you want 1% fuel surcharge waiver (~0.2–0.3% net)",
      effectivePct: 0.25,
      pros: ["1% surcharge waiver on typical pump CC txns"],
      cons: ["BluChips on fuel are tiny; still prefer debit if no surcharge"],
      rationale: "Only use a CC at the pump for surcharge waiver. Rewards are negligible.",
      steps: ["If the pump forces CC and adds surcharge, IDFC Indigo can waive ~1% (check live T&Cs)"],
    });
    return finalize(options, input, amt, isForeign, ck);
  }

  // ============ INSURANCE / RENT / TAX ============
  if (cat.includes("insurance") || cat.includes("rent") || cat.includes("tax") || cat.includes("govt")) {
    if (cat.includes("rent")) {
      add({
        cardId: "upi",
        label: "PhonePe / bank UPI or NEFT — keep doing this for rent",
        effectivePct: 0,
        baseRewardInr: 0,
        pros: ["No platform fee", "Your cards exclude rent from rewards anyway"],
        cons: ["CC rent via RedGirraffe/NoBroker costs ~0.5–1%+ and your cards earn 0% on rent MCC"],
        rationale: "In 2026, rent-via-credit-card is a cash-flow tool at best, not a rewards hack. PhonePe/CRED CC rent rails were shut or restricted; remaining platforms charge fees that beat any reward your portfolio earns on rent (most cards exclude MCC 6513). Stick with PhonePe UPI / NEFT for the ₹40k rent.",
        steps: ["Continue PhonePe UPI / NEFT to landlord", "Skip RedGirraffe/NoBroker unless you need 45-day float and accept ~₹200 fee on ₹40k"],
      });
    }
    const bobWelcome = bobWelcomeBonus(input, amt);
    if (bobWelcome && !cat.includes("rent")) {
      add({
        cardId: "bob_eterna", label: "BOB Eterna (welcome push)", effectivePct: 0.75 + (bobWelcome.inr / amt) * 100,
        baseRewardInr: amt * 0.0075, bonusRewardInr: bobWelcome.inr,
        pros: [bobWelcome.note, "All spends count toward ₹50K welcome"],
        cons: ["Insurance/rent/tax earn no base RP, but DO count toward welcome milestone"],
        rationale: "Inside BOB welcome window, even excluded-category spends count toward the ₹50K milestone.",
        steps: ["Pay with BOB Eterna", "Drives ₹50K welcome (₹2,500)"],
      });
    }
    if (!cat.includes("rent")) {
      add({
        cardId: "idfc_indigo", label: "Pay direct on insurer / PolicyBazaar (or NEFT) — IDFC ~0.33%", effectivePct: 0.33,
        pros: ["Paying the insurer/PolicyBazaar directly avoids the platform convenience fee"],
        cons: ["Insurance/tax earn little on any card"],
        rationale: "These MCCs earn almost nothing — pay the insurer directly or NEFT/UPI.",
        steps: ["Pay on the insurer's site / PolicyBazaar directly", "Use IDFC (~0.33%) or NEFT/UPI"],
      });
    }
    return finalize(options, input, amt, isForeign, ck);
  }

  // ============ INVESTMENTS ============
  if (cat.includes("investment") || cat.includes("trading")) {
    return finalize([{
      cardId: "yes_kiwi", label: "Pay via UPI/NEFT — log in Investments", effectivePct: 0,
      baseRewardInr: 0, bonusRewardInr: 0, totalRewardInr: 0, feasible: true,
      pros: ["SEBI prohibits CC for direct equity/MF"], cons: ["No card rewards possible"],
      cashkaroSuggested: false, worstCasePct: 0, bestCasePct: 0,
      steps: ["Pay via UPI/NEFT from bank", "Log this on the Investments page, not Transactions"],
      rationale: "Investments can't be paid by credit card. Track on the Investments page.",
    }], input, amt, isForeign, ck);
  }

  // ============ SWIGGY ============
  if (merchant.includes("swiggy") || cat === "swiggy") {
    options.push(buildLivePlusOption(amt, "food", input));
    add({
      cardId: "bob_eterna",
      label: "BOB Eterna 5× dining/online (~3.75%) — backup if Live+ cap full",
      effectivePct: 3.75,
      pros: ["LTF", "5× dining / online shopping"],
      cons: ["5× cap ~₹33k/cycle", "~6pp worse than HSBC Live+ 10%"],
      rationale: "Backup if Live+'s shared ₹1,200/mo accelerated cap is already used this month.",
      steps: ["Open Swiggy", "Pay with BOB Eterna"],
    });
    add({
      cardId: "amex_gold",
      label: `Amex Gold via ShopWise → Swiggy voucher (${SHOPWISE_NET_PCT}% net) — Gold 6×₹1k milestone`,
      effectivePct: SHOPWISE_NET_PCT,
      pros: [
        `~${SHOPWISE_NET_PCT}% net + counts as a Gold ≥₹1k txn`,
        "Uses Swiggy spend you already make — no Amazon Pay pile-up",
      ],
      cons: [
        "Worse yield than HSBC Live+ 10%",
        "Only use this slice for Gold milestone; put leftover Swiggy on Live+",
      ],
      rationale: "Amex Gold milestone fuel should be ShopWise Swiggy vouchers (meals you already order), NOT Amazon Pay vouchers.",
      steps: ["Open ShopWise", "Buy Swiggy voucher ≥₹1k with Amex Gold (up to 6 separate days)", "Redeem in Swiggy for meals you'd buy anyway"],
    });
    return finalize(options, input, amt, isForeign, ck);
  }

  // ============ RIDES / PLAYO (UPI scan) ============
  if (cat.includes("ride") || cat.includes("cab") || cat.includes("playo") || cat.includes("sports") ||
      merchant.includes("uber") || merchant.includes("rapido") || merchant.includes("ola") || merchant.includes("playo")) {
    options.push(buildKiwiOption({ ...input, channel: input.channel === "online" ? "upi" : input.channel }, amt));
    add({
      cardId: "upi",
      label: "Normal PhonePe / GPay UPI — 0%",
      effectivePct: 0,
      baseRewardInr: 0,
      pros: [],
      cons: ["No rewards — only if Kiwi QR isn't accepted"],
      rationale: "Playo / Uber / Rapido paid via UPI should go through Kiwi scan & pay for ~2%+ Neon, not PhonePe.",
      steps: ["Prefer Kiwi app → scan & pay"],
    });
    return finalize(options, input, amt, isForeign, ck);
  }

  // ============ AMAZON ============
  if (merchant.includes("amazon") || cat.includes("amazon")) {
    const realApRate = prime ? 5.0 : 3.0;
    const goldB = goldMilestoneBonus(input, amt);
    const mrccB = amt >= 1500 ? mrccMilestoneBonus(input, amt) : null;
    const shopwiseLeft = 10000 - (input.goldShopwiseUsedThisMonth ?? 0);

    // Daily Amazon Now / shopping: ICICI 5% (+ Cashkaro / order CB) is the yield winner.
    {
      const ckAmz = amazonPlatformCashkaro(cat, amt, ckOverride);
      const ckInr = ckAmz?.inr ?? 0;
      const base = amt * (realApRate / 100);
      add({
        cardId: "amazon_pay_icici",
        label: ckInr > 0
          ? `Cashkaro → Amazon Pay ICICI (${realApRate}% + Cashkaro) — daily Amazon`
          : `Amazon Pay ICICI direct (${realApRate}% Prime) — daily Amazon Now / shopping`,
        effectivePct: ((base + ckInr) / amt) * 100,
        baseRewardInr: base + ckInr,
        cashkaroSuggested: !!ckAmz,
        worstCasePct: realApRate,
        bestCasePct: realApRate + (ckAmz && amt > 0 ? (ckAmz.bestInr / amt) * 100 : 0),
        pros: [`${realApRate}% uncapped on Amazon.in / Amazon Now`, ckInr > 0 ? `+ Cashkaro ${inr(ckInr)}` : "Enter order-level cashback ₹ in the widget if shown"].filter(Boolean),
        cons: ["Do NOT pay with Amazon Pay balance if you want this 5%", "Save ShopWise Amazon vouchers for Amex milestone days, not every milk order"],
        rationale: `For routine Amazon Now (milk, yoghurt, misc) and shopping, Amazon Pay ICICI at ${realApRate}% (Prime) beats ShopWise (~${SHOPWISE_NET_PCT}% net). Use ShopWise only as deliberate Amex milestone fuel (see below), then drain that AP balance on later Amazon orders.`,
        steps: [
          ckInr > 0 ? "Open Cashkaro → Amazon first" : "Open Amazon / Amazon Now",
          `Pay with Amazon Pay ICICI card (${realApRate}%) — not AP balance`,
          "Log any extra order cashback ₹ shown at checkout in Recommend",
        ],
      });
    }

    // Drain idle AP balance (from prior ShopWise) — opportunity cost is forgoing 5% on that slice.
    if (apBal >= 100) {
      const used = Math.min(apBal, amt);
      add({
        cardId: "amazon_pay_icici",
        label: `Drain Amazon Pay balance (${inr(used)}) then ICICI on the rest`,
        effectivePct: ((amt - used) * (realApRate / 100) / amt) * 100,
        baseRewardInr: (amt - used) * (realApRate / 100),
        pros: [`Clears ${inr(used)} idle ShopWise-funded balance`, "Prevents AP pile-up"],
        cons: [`Balance slice forgoes ${realApRate}% ICICI — only drain what ShopWise created this month`],
        rationale: "After Amex ShopWise top-ups, spend that AP balance on Amazon deliberately so it doesn't sit idle. Rest of the order still earns ICICI 5%.",
        steps: ["Apply Amazon Pay balance at checkout", `Pay remainder with Amazon Pay ICICI (${realApRate}%)`],
      });
    }

    // Amex Gold ShopWise Amazon — only if you need a Gold txn AND will drain AP on real Amazon.
    // Prefer ShopWise Swiggy for Gold milestones (see Swiggy branch) — you don't have ₹6k+ spare Amazon.
    {
      const swNet = amt * (SHOPWISE_NET_PCT / 100);
      const bonus = goldB?.inr ?? 0;
      add({
        cardId: "amex_gold",
        label: goldB
          ? `Amex Gold ShopWise Amazon voucher — only if you'll drain this AP balance`
          : `Amex Gold ShopWise Amazon voucher (${SHOPWISE_NET_PCT}% net)`,
        effectivePct: ((swNet + bonus) / amt) * 100,
        baseRewardInr: swNet,
        bonusRewardInr: bonus,
        feasible: shopwiseLeft >= 100 && amt >= 1000 && (goldB != null || apBal < 500),
        feasibilityNote: amt < 1000
          ? "Gold milestone needs ≥₹1,000 per txn"
          : !goldB && apBal >= 500
            ? "Gold milestone done / AP balance already idle — prefer ICICI 5%; use ShopWise Swiggy for Gold instead of more Amazon GC"
            : shopwiseLeft < amt
              ? `Only ${inr(Math.max(0, shopwiseLeft))} ShopWise headroom left this month`
              : undefined,
        pros: [
          `~${SHOPWISE_NET_PCT}% net MR after fee`,
          goldB ? goldB.note : "Prefer ShopWise Swiggy vouchers for Gold 6×₹1k — matches food spend you already have",
        ],
        cons: [
          "Creates Amazon Pay balance you must spend on Amazon — you may not have enough Amazon volume",
          "Daily Amazon Now should stay on ICICI 5%",
        ],
        rationale: "Do not buy ₹6–16k/mo Amazon ShopWise vouchers. Gold milestones → ShopWise Swiggy. Amazon ShopWise only in small amounts you can clear on real Amazon Now orders.",
        steps: [
          "Prefer: ShopWise → Swiggy voucher on Amex Gold for milestones",
          "Only if needed: small Amazon Pay voucher you can drain the same week",
          "All other Amazon → ICICI 5%",
        ],
      });
    }

    // Amex MRCC — do NOT push Amazon vouchers; park real shopping. Shown as guidance when ≥₹1.5k.
    if (amt >= 1500 && mrccB) {
      add({
        cardId: "amex_mrcc",
        label: "Consider Amex MRCC for this ≥₹1.5k spend (cycle milestone) — not via Amazon GC",
        effectivePct: 0.78 + (mrccB.inr / amt) * 100,
        baseRewardInr: amt * 0.0078,
        bonusRewardInr: mrccB.inr,
        pros: [mrccB.note, "Better on Flipkart/Myntra/big tickets than inventing Amazon vouchers"],
        cons: [
          "Amazon itself is still better on ICICI 5% for pure yield",
          "Only divert non-Amazon big spends to MRCC, or accept missing monthly MRCC milestone",
        ],
        rationale: "MRCC should eat real Myntra/Flipkart/large spends — not ₹10k/mo Amazon gift cards you can't liquidate. Skip forced Amazon ShopWise for MRCC.",
        steps: [
          "For Amazon: pay ICICI 5%",
          "For Flipkart/Myntra ≥₹1.5k when MRCC cycle is open: pay MRCC (or ShopWise Flipkart/Myntra voucher)",
          "Don't manufacture Amazon volume for MRCC",
        ],
      });
    }

    // Live+ on Amazon = base 1.5% only (marketplace excluded from 10%)
    add({
      cardId: "hsbc_live_plus",
      label: "HSBC Live+ on Amazon (1.5% only — marketplace excluded from 10%)",
      effectivePct: LIVE_PLUS_BASE_PCT,
      worstCasePct: LIVE_PLUS_BASE_PCT,
      bestCasePct: LIVE_PLUS_BASE_PCT,
      pros: ["Accepted on Amazon"],
      cons: [
        "Amazon / Flipkart / Myntra are excluded from Live+ 10%",
        `Only ${LIVE_PLUS_BASE_PCT}% vs Amazon Pay ICICI ${realApRate}%`,
      ],
      rationale: `Live+ can pay Amazon, but accelerated 10% does not apply — you get ${LIVE_PLUS_BASE_PCT}%. Always prefer Amazon Pay ICICI for Amazon shopping / Now.`,
      steps: ["Do not use Live+ for Amazon — use Amazon Pay ICICI instead"],
    });

    return finalize(options, input, amt, isForeign, ck);
  }

  // ============ CLEARTRIP / MMT / AGODA handled in travel exhaust above ============
  // (legacy Cleartrip-only block removed — travelKindOf covers these merchants)

  // ============ MOVIES / EVENTS (before Cashkaro-reliable early-return) ============
  // BookMyShow is a "reliable" Cashkaro merchant — if this block ran AFTER that early-return,
  // typing "BookMyShow" would skip BOGO + CRED theatre GC entirely.
  if (isMovieExpense(merchant, cat)) {
    const ticketCount = movieTicketCount(cat);
    const oneTicket = ticketCount === 1;
    const bogoAvailable = input.bobBogoUsedThisMonth !== true && !oneTicket;
    const platformIsDistrict = /\bdistrict\b/i.test(`${merchant} ${cat}`);
    const platformIsBms = /bookmyshow|\bbms\b/i.test(merchant) && !platformIsDistrict;
    const bogoCap = Math.min(amt / ticketCount, 250);

    // CRED cinema GCs — always ranked (defaults: Cinepolis 28%, PVR 24%, BMS/District 3.75%).
    // No live CRED API; widget live % / Settings overrides when provided.
    addMovieCredGiftCardRoutes(input, amt, add, bogoCap);

    if (oneTicket) {
      add({
        cardId: "bob_eterna",
        label: "Single ticket — BOGO doesn't apply (needs 2 tickets)",
        effectivePct: 0,
        baseRewardInr: 0,
        pros: ["The BOB Eterna BOGO frees the 2nd ticket — with 1 ticket there's nothing to discount"],
        cons: ["Book 2+ tickets (even gifting one) to unlock ~₹250 off via the District BOGO"],
        rationale: "You're booking a single ticket, so the buy-1-get-1 can't trigger. If you'll ever book 2, do it together on District for the free 2nd ticket. Otherwise the routes below are your best for one ticket.",
        steps: ["For 1 ticket, pick the best route below (CRED gift card, UPI/Kiwi, Amazon Pay, etc.)"],
      });
    }
    if (bogoAvailable) {
      // Free ticket ≈ one ticket's share of the booking, capped at ₹250 (District only).
      const savings = bogoCap;
      const bobW = bobWelcomeBonus(input, amt);
      const welcomeInr = bobW?.inr ?? 0;
      const theatre = theatreFromInput(input, merchant, cat);
      const theatreLabel = theatreLabelOf(theatre);
      const credSave = (() => {
        const brand = MOVIE_CRED_GC_DEFAULTS.find((b) => b.id === theatre) ?? MOVIE_CRED_GC_DEFAULTS[0];
        const { pct } = resolveMovieCredPct(brand, input, theatre);
        return amt * (pct / 100);
      })();
      add({
        cardId: "bob_eterna",
        label: "BOB Eterna BOGO — book via District app (2nd ticket free, up to ₹250)",
        effectivePct: ((savings + welcomeInr) / amt) * 100,
        baseRewardInr: savings,
        bonusRewardInr: welcomeInr,
        worstCasePct: 0,
        bestCasePct: ((250 + welcomeInr) / Math.max(amt, 1)) * 100,
        feasible: !platformIsBms,
        feasibilityNote: platformIsBms
          ? "BOGO only works on District — switch from BookMyShow to unlock this"
          : undefined,
        pros: [
          `Buy-1-Get-1: free ticket ≈ ${inr(savings)} off (${ticketCount} tickets, capped ₹250)`,
          welcomeInr > 0 ? `Also counts toward the BOB ₹50K welcome (+${inr(welcomeInr)})` : "Once per calendar month",
          platformIsDistrict ? "You're already on District — BOGO applies here" : "Open District (not BookMyShow) to unlock",
        ],
        cons: [
          "Works on the District app ONLY — not BookMyShow",
          "Once per calendar month",
          "Needs 2+ tickets; free-ticket value capped at ₹250",
          credSave > savings
            ? `CRED ${theatreLabel} GC saves more (${inr(credSave)}) on this amount — compare ranks`
            : "",
        ].filter(Boolean),
        rationale: `BOB Eterna's monthly BOGO is a District-app benefit (not BookMyShow). Book the same show on District to get one ticket free (up to ₹250) — about ${inr(savings)} off for ${ticketCount} tickets${welcomeInr > 0 ? `, and it also drives your ₹50K welcome (+${inr(welcomeInr)})` : ""}.`,
        steps: [
          "Open the District app (NOT BookMyShow) — the BOGO only works there",
          `Select ${ticketCount}+ tickets for the same show`,
          "Pay with BOB Eterna → one ticket free, up to ₹250",
        ],
      });
    }
    if (!oneTicket) {
      // Live+ cinema BOGO on District + BookMyShow (issuer perk, refreshed Jul 2026).
      const lpSavings = Math.min(amt / ticketCount, 250);
      add({
        cardId: "hsbc_live_plus",
        label: platformIsBms
          ? "HSBC Live+ BOGO — BookMyShow (2nd ticket free; also 10% off live events)"
          : "HSBC Live+ BOGO — District or BookMyShow (2nd ticket free)",
        effectivePct: (lpSavings / amt) * 100,
        baseRewardInr: lpSavings,
        worstCasePct: 0,
        bestCasePct: (250 / Math.max(amt, 1)) * 100,
        pros: [
          `Buy-1-Get-1 ≈ ${inr(lpSavings)} off (capped ~₹250 — confirm in-app)`,
          platformIsBms ? "Works on BookMyShow with Live+ (unlike BOB which is District-only)" : "District or BookMyShow both listed for Live+",
          "Also counts toward Live+ ₹2L fee-waiver / welcome spend",
        ],
        cons: [
          "Once per calendar month — confirm unused in District / BMS offer before booking",
          "Needs 2+ tickets; T&Cs / cap may vary by theatre",
        ],
        rationale: "HSBC Live+ now advertises cinema BOGO on District and BookMyShow (plus 10% off BMS live events). Prefer Live+ when BOB BOGO is used or you're already on BMS.",
        steps: [
          platformIsBms ? "Stay on BookMyShow (or open District)" : "Open District or BookMyShow",
          `Select ${ticketCount}+ tickets`,
          "Pay with HSBC Live+ and apply the BOGO offer",
        ],
      });
    }
    add({
      cardId: "amazon_pay_icici",
      label: "Pay via Amazon Pay (BookMyShow is an Amazon Pay partner) — 2%",
      effectivePct: 2.0,
      pros: ["2% cashback (Amazon Pay balance) if you pay via Amazon Pay 'Login & Pay'", "Cashback is liquid"],
      cons: ["Works where the platform accepts Amazon Pay (BookMyShow yes; District — verify)"],
      rationale: "BookMyShow is an Amazon Pay partner merchant — paying via Amazon Pay with the ICICI card earns 2% (liquid cashback).",
      steps: ["At checkout choose Amazon Pay", "Pay with Amazon Pay ICICI", "2% back as Amazon Pay balance"],
    });
    // SBI SimplyCLICK 10× on BookMyShow (~2.5%)
    {
      const ckBonus = ck && ck.zone !== "na" ? ck.mid * 0.85 : 0;
      add({
        cardId: "sbi_simplyclick",
        label: ckBonus > 0
          ? `Cashkaro → BookMyShow → SBI SimplyCLICK 10× (~${(2.5 + ckBonus).toFixed(1)}%)`
          : "SBI SimplyCLICK 10× on BookMyShow (2.5%)",
        effectivePct: 2.5 + ckBonus,
        cashkaroSuggested: ckBonus > 0,
        worstCasePct: 2.5,
        bestCasePct: 2.5 + (ck ? ck.max : 0),
        pros: ["10× partner earn ≈ 2.5% on BookMyShow", ckBonus > 0 ? `+ Cashkaro ~${ck!.mid}%` : ""].filter(Boolean),
        cons: ["Usually behind District BOGO / high CRED theatre GC %", "Keep the card mainly for credit age"],
        rationale: "SBI SimplyCLICK's 10× partner rate covers BookMyShow (~2.5%). Useful after BOGO is used and when CRED GC isn't better — and it keeps the card active for age.",
        steps: [
          ckBonus > 0 ? "Open Cashkaro → BookMyShow" : "Open BookMyShow",
          "Book tickets",
          "Pay with SBI SimplyCLICK",
        ],
      });
    }
    add({
      cardId: "amex_gold",
      label: bogoAvailable ? "Extra tickets: Cashkaro → BookMyShow → Amex Gold" : "BOGO used this month — Cashkaro → BookMyShow → Amex Gold",
      effectivePct: 1.0 + (ck ? ck.mid * 0.85 : 0),
      worstCasePct: 1.0,
      bestCasePct: 1.0 + (ck ? ck.max : 0),
      cashkaroSuggested: !!ck && ck.zone !== "na",
      pros: ["Cashkaro on BookMyShow (5–10%) + Amex Gold 1%"],
      cons: ["Use only after the monthly BOB BOGO is exhausted (and if CRED GC isn't better)"],
      rationale: "For tickets beyond the monthly BOGO, stack Cashkaro on BookMyShow and pay with Amex Gold — unless a CRED theatre gift card % is higher.",
      steps: ["Open Cashkaro → BookMyShow", "Book tickets", "Pay with Amex Gold"],
    });
    return finalize(options, input, amt, isForeign, ck);
  }

  // ============ ZOMATO (before Cashkaro-reliable — Zomato is also zone reliable) ============
  if (merchant.includes("zomato")) {
    const ckInr = ck && ck.zone === "reliable" ? amt * (ck.mid / 100) * 0.85 : 0;
    options.push(buildLivePlusOption(amt, "food", input, {
      cashkaroInr: ckInr,
      cashkaroNote: ckInr > 0 ? `+ ~${ck!.mid}% Cashkaro via click-through` : "",
    }));
    add({ cardId: "bob_eterna", label: "Cashkaro + BOB 5× dining", effectivePct: 3.75 + (ck ? ck.mid * 0.85 : 0),
      worstCasePct: 3.75, bestCasePct: 3.75 + (ck?.max ?? 0), cashkaroSuggested: !!ck,
      pros: ["BOB 5× dining + Cashkaro Zomato"], cons: ["5× cap 5K RP/cycle", "Worse than Live+ 10%"],
      rationale: "Backup if Live+ accelerated cap is full. Cashkaro + BOB ≈ 6.75–8.75%.",
      steps: ["Cashkaro → Zomato", "Pay with BOB Eterna"] });
    return finalize(options, input, amt, isForeign, ck);
  }

  // ============ GROCERIES (Instamart / Blinkit / Zepto / BigBasket) ============
  if (cat.includes("grocery") || merchant.includes("instamart") || merchant.includes("blinkit") || merchant.includes("zepto") || merchant.includes("bigbasket") || merchant.includes("big basket")) {
    options.push(buildLivePlusOption(amt, "grocery", input));
    add({
      cardId: "bob_eterna",
      label: "BOB Eterna 5× online (~3.75%) — backup",
      effectivePct: 3.75,
      pros: ["LTF 5× online"],
      cons: ["Worse than Live+ 10%"],
      rationale: "Live+ 10% on groceries is primary; BOB is overflow after the shared cap.",
      steps: ["Pay with BOB Eterna"],
    });
    return finalize(options, input, amt, isForeign, ck);
  }

  // ============ CASHKARO-RELIABLE ONLINE MERCHANTS ============
  if (ck && ck.zone === "reliable") {
    // Live+ 10% on eligible shopping (Amazon/FK excluded; Myntra OK till 31 Oct 2026) + Cashkaro
    const lpBucket = livePlusAccelBucket(merchant, cat, input.today);
    if (lpBucket === "shopping" || lpBucket === "food" || lpBucket === "grocery") {
      const ckInr = amt * (ck.mid / 100) * 0.85;
      options.push(buildLivePlusOption(amt, lpBucket, input, {
        cashkaroInr: ckInr,
        cashkaroNote: `+ ~${ck.mid}% Cashkaro`,
      }));
    }
    const bob5xLeft = 33000 - (input.bobCycleSpend5x ?? 0);
    add({ cardId: "bob_eterna", label: "Cashkaro + BOB Eterna 5× online (3.75%)",
      effectivePct: 3.75 + ck.mid * 0.85, worstCasePct: 3.75, bestCasePct: 3.75 + ck.max, cashkaroSuggested: true,
      feasible: bob5xLeft >= 100, feasibilityNote: bob5xLeft < amt ? `Only ${inr(Math.max(0,bob5xLeft))} of 5× headroom left this cycle` : undefined,
      pros: ["BOB 5× online (3.75%) + Cashkaro"], cons: ["5× cap 5,000 RP/cycle (~₹33K)"],
      rationale: "BOB 5× online + Cashkaro stacks. Cap 5K RP/cycle. Prefer Live+ 10% when the merchant is Live+-eligible.",
      steps: ["Cashkaro click-through", `Pay ${input.merchant} with BOB Eterna`] });
    return finalize(options, input, amt, isForeign, ck);
  }

  // ============ DINING (offline) ============
  if (cat.includes("dining") || cat.includes("restaurant")) {
    options.push(buildLivePlusOption(amt, "dining", input));
    addVisaInfiniteBenefitRoutes("dining", input, amt, add, `${merchant} ${cat}`);
    add({ cardId: "bob_eterna", label: "BOB Eterna 5× dining (3.75%) — backup", effectivePct: 3.75,
      pros: ["5× dining"], cons: ["Cap 5K RP/cycle", "Worse than Live+ 10%"], rationale: "Live+ 10% dining is primary.",
      steps: ["Pay with BOB Eterna at the restaurant"] });
    return finalize(options, input, amt, isForeign, ck);
  }

  // ============ GENERIC ONLINE / OFFLINE ============
  // Build the realistic candidate set and let scoring decide.

  // BOB welcome push (any category counts)
  const bobWelcome = bobWelcomeBonus(input, amt);
  if (bobWelcome) {
    add({ cardId: "bob_eterna", label: "BOB Eterna (welcome push to ₹50K)",
      effectivePct: 0.75 + (bobWelcome.inr / amt) * 100, baseRewardInr: amt * 0.0075, bonusRewardInr: bobWelcome.inr,
      pros: [bobWelcome.note], cons: ["Base only 0.75% on non-5× categories"],
      rationale: `You're inside the BOB 60-day welcome window — ${bobWelcome.note} Every spend drives the ₹50K → ₹2,500 bonus.`,
      steps: ["Pay with BOB Eterna", "Drives ₹50K welcome milestone"] });
  }

  // Amex PT — only when near ₹4L (real urgency). Otherwise the universal annual push covers it once.
  if (amt >= 5000) {
    const ptSpend = input.ptccEligibleSpend ?? 0;
    const ptClose = ptSpend > 350000;
    if (ptClose) {
      const mb = annualMilestoneBonus("amex_plat_travel", input, amt);
      add({
        cardId: "amex_plat_travel",
        label: mb ? `Amex PT — near ${inr(mb.threshold)} milestone` : "Amex PT (near milestone)",
        effectivePct: 1.0 + ((mb?.inr ?? 0) / amt) * 100,
        baseRewardInr: amt * 0.01,
        bonusRewardInr: mb?.inr ?? 0,
        worstCasePct: 1.0,
        bestCasePct: 7.0,
        pros: [mb?.note ?? "Near ₹4L / ₹7L annual milestone"],
        cons: ["Excludes fuel/insurance/utilities/cash/EMI"],
        rationale: mb?.note ?? "Near the next PT annual milestone.",
        steps: [`Pay ${inr(amt)} with Amex PT`, "Builds annual milestone"],
      });
    }
  }

  // Amex MRCC milestone filler
  const mrccBonus = mrccMilestoneBonus(input, amt);
  if (mrccBonus) {
    add({ cardId: "amex_mrcc", label: mrccBonus.label,
      effectivePct: 0.78 + (mrccBonus.inr / amt) * 100, baseRewardInr: amt * 0.0078, bonusRewardInr: mrccBonus.inr,
      pros: [mrccBonus.note], cons: ["Excludes fuel/insurance/utilities", "One big spend still counts as only 1 of 4 ≥₹1.5k txns"],
      rationale: mrccBonus.note,
      steps: [`Pay with Amex MRCC`, mrccBonus.label.includes("still need") ? "Counts toward the open monthly part" : "Fills monthly milestone"] });
  }

  // Amex Gold milestone filler (≥₹1K)
  const goldBonus = goldMilestoneBonus(input, amt);
  if (goldBonus) {
    add({ cardId: "amex_gold", label: "Amex Gold (fills 6-txn milestone)",
      effectivePct: 0.78 + (goldBonus.inr / amt) * 100, baseRewardInr: amt * 0.0078, bonusRewardInr: goldBonus.inr,
      pros: [goldBonus.note], cons: ["Needs ≥₹1K per txn"],
      rationale: "Gold 6-txn monthly milestone marginal value.",
      steps: [`Pay with Amex Gold`, "Counts toward 6-txn milestone"] });
  }

  // Plain fallback if nothing else
  if (options.length === 0) {
    add({ cardId: "amex_mrcc", label: "Amex MRCC (general 0.78%)", effectivePct: 0.78,
      pros: ["Builds ₹1.5L fee-waiver"], cons: [], rationale: "Catch-all small generic spend.",
      steps: [`Pay with Amex MRCC`] });
  }

  return finalize(options, input, amt, isForeign, ck);
}

function channelLabel(ch: string): string {
  return ch === "upi" ? "UPI-scan" :
    ch === "upi_normal" ? "normal-UPI" :
    ch === "offline_pos" ? "offline card-swipe" :
    ch === "merchant_app" ? "in-app" :
    ch === "foreign" ? "foreign" : "online";
}

/**
 * Generic per-card evaluation used to give a REASON for every active card
 * that wasn't already chosen by a category-specific rule. This guarantees the
 * user sees why each card (incl. Kiwi/Scapia/SBI/etc.) was or wasn't picked.
 */
function genericCardEval(
  cardId: string,
  input: RecommendInput,
  isForeign: boolean
): { pct: number; label: string; reason: string } | null {
  const ch = input.channel;
  const cat = (input.category || "").toLowerCase();
  const merch = (input.merchant || "").toLowerCase();
  // Cards other than Kiwi cannot be used for UPI scan & pay.
  if (ch === "upi" && cardId !== "yes_kiwi") {
    return { pct: 0, label: "Not UPI-capable", reason: "Only the RuPay Kiwi card supports credit-card-on-UPI (scan & pay). This card can't be used for a UPI QR payment." };
  }
  if (isForeign) {
    switch (cardId) {
      case "amex_gold":
      case "amex_plat_travel":
      case "amex_mrcc":
        return { pct: 0, label: "Amex (abroad)", reason: "3.5% forex markup abroad wipes the ~1% reward → net negative. Use Scapia (0% forex)." };
      case "bob_eterna":
        return { pct: 1.75, label: "BOB Eterna (abroad)", reason: "5× international (3.75%) minus 2% forex ≈ 1.75% net. Scapia's 0% forex still wins." };
      case "yes_kiwi":
        return { pct: 0, label: "Kiwi (abroad)", reason: "3.5% forex markup and RuPay is poorly accepted abroad." };
      case "sbi_simplyclick":
        return { pct: 0, label: "SBI (abroad)", reason: "3.5% forex, no international bonus." };
      case "amazon_pay_icici":
        return { pct: 0, label: "Amazon Pay ICICI (abroad)", reason: "International spends are excluded from cashback + forex markup applies." };
      case "hsbc_live_plus":
        return { pct: 0, label: "HSBC Live+ (abroad)", reason: "International spends are excluded from Live+ cashback post-deval; forex markup applies. Use Scapia." };
      default:
        return null;
    }
  }
  // Reward-excluded MCC families: most cards earn ~0 or base-only here, no accelerated rates.
  const rewardExcluded = /insurance|\brent\b|\btax\b|govt|government|fuel|petrol|diesel|wallet/.test(cat);
  if (rewardExcluded) {
    switch (cardId) {
      case "amex_gold": case "amex_plat_travel": case "amex_mrcc":
        return { pct: 0, label: "Amex", reason: "Amex earns no MR on insurance / rent / fuel / tax / wallet (excluded MCCs)." };
      case "amazon_pay_icici":
        return { pct: 0, label: "Amazon Pay ICICI", reason: "Excluded outside Amazon (rent / tax / utilities / insurance earn no cashback)." };
      case "sbi_simplyclick":
        return { pct: 0.25, label: "SBI SimplyCLICK", reason: "Base 0.25% only — these aren't reward categories (no 5×/10×)." };
      case "idfc_indigo":
        return { pct: 0.5 * 0.45, label: "IDFC Indigo", reason: "0.5 BluChip/₹100 ≈ 0.23% on these MCCs (travel-locked)." };
      case "bob_eterna":
        return { pct: 0.75, label: "BOB Eterna", reason: "Base 0.75% (5× doesn't apply). Only worth it during the ₹50K welcome window, where every spend counts." };
      case "hsbc_live_plus":
        return { pct: 0, label: "HSBC Live+", reason: "Rent / fuel / insurance / tax are not Live+ accelerated categories (and often excluded)." };
      // scapia / yes_kiwi fall through to their exclusion handling below (→ 0).
    }
  }
  switch (cardId) {
    case "yes_kiwi":
      return { pct: 0, label: "YES Bank Kiwi", reason: `Kiwi earns 2% only on in-person UPI scan/pay via the Kiwi app. This is a ${channelLabel(ch)} payment, so Kiwi earns nothing here. (You're also early in the Apr–Mar Neon cycle, so no milestone urgency.)` };
    case "scapia": {
      const scExc = scapiaExcluded(cat, merch);
      if (scExc.excluded) return { pct: 0, label: "Scapia", reason: `Scapia excludes ${scExc.reason} from coins — earns 0 here.` };
      return { pct: 2.0, label: "Scapia", reason: "10% Scapia coins = 2% value on eligible spends. Coins are redeemable ONLY for travel on the Scapia app/store (not cashable) — good for you since you travel quarterly, otherwise they sit idle." };
    }
    case "idfc_indigo": {
      const lowCat = /insurance|utilit|electric|mobile|recharge|broadband|\btv\b|dth|gas|water|fuel|petrol|diesel|rent|wallet/.test(cat);
      const pct = lowCat ? 0.5 * 0.45 : 3 * 0.45; // 0.5 or 3 BluChips/₹100 × ₹0.45
      return { pct, label: "IDFC Indigo", reason: `Earns ${lowCat ? "0.5" : "3"} BluChips/₹100 here (≈${pct.toFixed(2)}% at ₹0.45/BluChip). Its real value is IndiGo flights (up to 22/₹100 ≈ 9.9%). BluChips are travel-locked to IndiGo one-way flights.` };
    }
    case "sbi_simplyclick": {
      if (sbiSimplyClickPartner(merch, cat)) {
        return {
          pct: 2.5,
          label: "SBI SimplyCLICK 10× partner (2.5%)",
          reason: "BookMyShow / Myntra / Cleartrip / Yatra / Apollo / Netmeds / Domino's / Tata CLiQ earn 10× (≈2.5%). Still usually behind BOGO / CRED GC / Cashkaro stacks for movies.",
        };
      }
      return { pct: ch === "offline_pos" ? 0.25 : 1.25, label: "SBI SimplyCLICK", reason: `10× applies only to partner brands (Myntra, BookMyShow, Cleartrip, Yatra, Apollo, Netmeds, Dominos, Tata CLiQ). Not this merchant → ${ch === "offline_pos" ? "0.25% offline" : "1.25% other-online"} only.` };
    }
    case "amazon_pay_icici":
      return { pct: 1.0, label: "Amazon Pay ICICI", reason: "5% on Amazon.in, 2% on bills/recharges via Amazon, 2% at Amazon Pay partner merchants. Only 1% on other merchants like this one." };
    case "amex_gold":
      return { pct: 0.78, label: "Amex Gold", reason: "~0.78% base. Its real value is the 6×₹1K monthly milestone (needs ≥₹1K txns) or 1% on utilities — no edge for this spend, and the milestone is either met or the txn is too small." };
    case "amex_plat_travel":
      return { pct: 1.0, label: "Amex PT", reason: "1% base — best reserved for large spends that push the ₹4L / ₹7L annual milestone." };
    case "amex_mrcc":
      return { pct: 0.78, label: "Amex MRCC", reason: "~0.78% base. Best as a monthly-milestone filler (4×₹1.5K + ₹20K/cycle) when the cycle is still open." };
    case "bob_eterna":
      return { pct: 0.75, label: "BOB Eterna", reason: "5× (3.75%) only on online shopping / dining / travel / international. This spend is general → base 0.75% only (and the welcome window isn't driving it)." };
    case "hsbc_live_plus": {
      const bucket = livePlusAccelBucket(merch, cat, input.today);
      if (bucket) {
        return {
          pct: LIVE_PLUS_ACCEL_PCT,
          label: "HSBC Live+",
          reason: `10% accelerated on ${bucket} (shared ₹${LIVE_PLUS_ACCEL_CAP_INR.toLocaleString("en-IN")}/mo cap). Category rule should have ranked this already if it's the best route.`,
        };
      }
      if (isLivePlusMarketplaceExcluded(merch, cat, input.today)) {
        return {
          pct: LIVE_PLUS_BASE_PCT,
          label: "HSBC Live+",
          reason: livePlusMyntraPromoActive(input.today)
            ? `Amazon / Flipkart are excluded from Live+ 10% — only ${LIVE_PLUS_BASE_PCT}% base. Prefer Amazon Pay ICICI for Amazon.`
            : `Amazon / Flipkart / Myntra are excluded from Live+ 10% — only ${LIVE_PLUS_BASE_PCT}% base. Prefer Amazon Pay ICICI for Amazon.`,
        };
      }
      if (livePlusZeroBase(merch, cat)) {
        return {
          pct: 0,
          label: "HSBC Live+",
          reason: "Hospital / healthcare / local transport earn 0% post-reval (not even 1.5% base). Use only if you need ₹25k/30d welcome volume.",
        };
      }
      return {
        pct: LIVE_PLUS_BASE_PCT,
        label: "HSBC Live+",
        reason: `Not an accelerated category here → ${LIVE_PLUS_BASE_PCT}% base. Live+ 10% is for dining / food / grocery / utilities / shopping (Myntra promo till 31 Oct 2026).`,
      };
    }
    default:
      return null;
  }
}

/** Rank options by total ₹ return (feasible first), build the result. */
function finalize(
  options: RouteOption[],
  input: RecommendInput,
  amt: number,
  isForeign: boolean,
  ck: { mid: number; min: number; max: number; zone: string } | null
): RecommendationResult {
  // Inject the proper Kiwi option (exclusion-aware, milestone-aware) for any
  // non-foreign expense — in-person UPI scan & pay is near-universal in India.
  // Skip for in-app movie checkout (buildKiwiOption also returns 0%, but don't clutter).
  const movieApp = isMovieExpense(input.merchant || "", input.category || "") &&
    input.channel === "merchant_app";
  if (!isForeign && !movieApp && !options.some((o) => o.cardId === "yes_kiwi")) {
    options.push(buildKiwiOption(input, amt));
  }

  // ---- Amazon Pay ICICI: welcome coupon STACKS with the card's own cashback ----
  // Paying inside Amazon.in with the ICICI card earns the welcome coupon AND the card's
  // base rate (5%/3% on Amazon shopping, 2% on bills/recharges/partner merchants) together.
  if (input.amazonPayIciciIssued !== false) {
    const prime = input.primeMember !== false;
    const welcome = findWelcomeOffer(input.merchant || "", input.category || "", input.amazonWelcomeClaimed || []);
    if (welcome) {
      const welcomeCash = Math.min(amt * (welcome.pctBack / 100), welcome.capInr);
      const isAmazonShop = welcome.id === "amz_shop";
      const baseRate = isAmazonShop ? (prime ? 5 : 3) : 2; // bills/recharges/partner = 2%
      const baseCash = amt * (baseRate / 100);
      // Cashkaro Amazon link stacks on top (you must click through Cashkaro FIRST and pay with the card)
      const ckAmz = amazonPlatformCashkaro(input.category || "", amt, input.cashkaroPctOverride);
      const ckInr = ckAmz?.inr ?? 0;
      const total = welcomeCash + baseCash + ckInr;
      if (total > 0) {
        options.push(mkOption(amt, {
          cardId: "amazon_pay_icici",
          label: `Cashkaro → Amazon Pay ICICI — welcome (${welcome.label}) + ${baseRate}% card`,
          effectivePct: (total / amt) * 100,
          baseRewardInr: baseCash + ckInr,
          bonusRewardInr: welcomeCash,
          cashkaroSuggested: !!ckAmz,
          worstCasePct: ((welcomeCash + baseCash) / amt) * 100, // if Cashkaro doesn't track
          bestCasePct: ((welcomeCash + baseCash + (ckAmz?.bestInr ?? 0)) / amt) * 100,
          pros: [
            `Welcome ${inr(welcomeCash)} + card ${baseRate}% (${inr(baseCash)})${ckInr > 0 ? ` + Cashkaro ${inr(ckInr)}` : ""} = ${inr(total)} total — all STACK`,
            "One-time welcome coupon — grab it on this first transaction",
          ],
          cons: ["Welcome is one-time & capped", "Pay with the CARD (not Amazon Pay balance) so Cashkaro tracks", "Confirm the offer is live in Amazon app → Amazon Pay ICICI → Offers"],
          rationale: `Click the Cashkaro Amazon link first, then on Amazon.in the welcome coupon stacks with the card's ${baseRate}% AND Cashkaro: ${inr(welcomeCash)} + ${inr(baseCash)} + ${inr(ckInr)} = ${inr(total)}.${ckAmz ? ` (${ckAmz.note})` : ""}`,
          steps: [
            "Open Cashkaro → search Amazon → tap the relevant link (Shopping / Recharge & Bills)",
            "It opens Amazon.in → go to the relevant section",
            `Pay ${inr(amt)} with the Amazon Pay ICICI CARD (not balance)`,
            `Get ${inr(welcomeCash)} welcome + ${inr(baseCash)} (${baseRate}% card) + ${inr(ckInr)} Cashkaro = ${inr(total)}`,
          ],
        }));
      }
    }
  }

  // ---- ShopWise → Amazon Pay voucher funding route (universal for Amazon-Pay-payable spends) ----
  // Buy an Amazon Pay gift voucher with Amex Gold via ShopWise (5× MR ≈ 5.8%), load it to
  // Amazon Pay, then pay the bill/recharge/Amazon order with the balance.
  {
    const apText = `${input.category || ""} ${input.merchant || ""}`.toLowerCase();
    const apPayable = /utilit|electric|mobile|recharge|broadband|\btv\b|dth|gas|water|amazon/.test(apText);
    const alreadyShopwise = options.some((o) => o.label.toLowerCase().includes("shopwise"));
    if (!isForeign && apPayable && !alreadyShopwise) {
      const left = 10000 - (input.goldShopwiseUsedThisMonth ?? 0);
      options.push(mkOption(amt, {
        cardId: "amex_gold",
        label: "ShopWise → Amazon Pay voucher → pay via Amazon Pay balance",
        effectivePct: SHOPWISE_NET_PCT,
        feasible: left >= 100,
        feasibilityNote: left < amt ? `Only ${inr(Math.max(0, left))} ShopWise headroom left this month (₹10K/mo cap)` : undefined,
        pros: [`5× MR on the voucher ≈ 5.8%, minus 1.77% ShopWise fee = ${SHOPWISE_NET_PCT}% net`, "Amazon Pay balance pays recharges / utility bills / Amazon"],
        cons: ["₹10K/mo ShopWise voucher cap", "ShopWise charges 1.5%+GST convenience fee (already netted)", "Two steps: buy voucher, then pay the bill"],
        rationale: `Buy an Amazon Pay gift voucher with Amex Gold on ShopWise (5× MR ≈ 5.8% − 1.77% fee = ${SHOPWISE_NET_PCT}% net), load it to Amazon Pay, then pay this bill/recharge from that balance.`,
        steps: [
          "Open ShopWise → buy an Amazon Pay voucher with Amex Gold (5×; 1.5%+GST fee applies)",
          "Load the voucher to your Amazon Pay balance",
          `Pay ${inr(amt)} from Amazon Pay balance (Recharges & Bills / checkout)`,
          `≈${SHOPWISE_NET_PCT}% net after the ShopWise fee`,
        ],
      }));
    }
  }

  // ---- Gift-card funding stacks (CRED / CheQ / brand) ----
  // Precedence: widget live CRED % (credGiftCardPctOverride) wins over Settings giftCardRateOverrides
  // for the *matching* deal only (theatre / merchant). Never apply a theatre % to an unrelated brand GC.
  const theatre = theatreFromInput(input, input.merchant || "", input.category || "");
  const gcMatchText = [
    input.merchant || "",
    input.category || "",
    theatre === "pvr" ? "pvr" :
      theatre === "cinepolis" ? "cinepolis" :
      theatre === "inox" ? "inox" :
      theatre === "bms" ? "bookmyshow" :
      theatre === "district" ? "district" : "",
  ].filter(Boolean).join(" ");
  const gcDeals = findGiftCardDeals(gcMatchText, "", input.giftCardRateOverrides || {});
  const liveCredPct = input.credGiftCardPctOverride && input.credGiftCardPctOverride > 0 ? input.credGiftCardPctOverride : undefined;
  const moviesAlreadyHasCredGc =
    isMovieExpense(input.merchant || "", input.category || "") &&
    options.some((o) => o.cardId === "giftcard" && /cred/i.test(o.label));
  // Generic fallback: most online-retail brands have a CRED/CheQ gift card even if not in our table.
  if (gcDeals.length === 0 && !isForeign && !moviesAlreadyHasCredGc) {
    const shopText = `${input.category || ""} ${input.merchant || ""}`.toLowerCase();
    const isShopping = /online|fashion|electronics|shopping|apparel|clothing|footwear|shoes|lenskart|boat|mamaearth|meesho|decathlon|nike|adidas|puma|grocery|groceries|pharmac/.test(shopText);
    if (isShopping) {
      const merchLabel = input.merchant?.trim() || "this store";
      const pct = liveCredPct ?? 2.5;
      options.push(mkOption(amt, {
        cardId: "giftcard",
        label: liveCredPct
          ? `CRED gift card (${liveCredPct}% off) → ${merchLabel}`
          : `CRED / CheQ gift card (if available) → ${merchLabel}`,
        effectivePct: pct,
        worstCasePct: liveCredPct ?? 0,
        bestCasePct: liveCredPct ?? 5,
        pros: liveCredPct
          ? [`${liveCredPct}% off face value via CRED Store (rate you entered)`, "Stack with Cashkaro on top when available"]
          : ["Many online brands have a 2–5% discounted gift card on CRED / CheQ", "Can boost with CRED coins / CheQ chips on select drops", "Stack with Cashkaro on top"],
        cons: [`Verify in the CRED/CheQ app whether a ${merchLabel} gift card exists and its live %`, "If none exists, fall back to the best card route above"],
        rationale: liveCredPct
          ? `You entered ${liveCredPct}% off on the CRED ${merchLabel} gift card. Buy it, then shop (via Cashkaro if available) and pay with the gift-card balance.`
          : `Most online retailers have a discounted gift card on CRED or CheQ (~2–5%). Check the app — if a ${merchLabel} card exists, buy it, then shop via Cashkaro and pay with the gift card to stack discount + cashback.`,
        steps: [
          `Open CRED → Store (or CheQ → Gift cards) and search "${merchLabel}"`,
          liveCredPct ? `Buy the gift card at ${liveCredPct}% off` : "If a gift card exists, buy it (apply coins/chips to boost the discount)",
          `Open Cashkaro → click through to ${merchLabel}`,
          "Add items, pay with the gift-card balance, screenshot the order",
        ],
      }));
    }
  }
  for (const d of gcDeals) {
    // Movies branch already ranked the live CRED theatre GC — don't re-add CRED rows (esp. BMS inflated to theatre %).
    if (moviesAlreadyHasCredGc && d.store === "CRED") continue;
    const applyLive = d.store === "CRED" && liveCredPct != null &&
      credLivePctAppliesToDeal(d.merchantLabel, input, input.merchant || "", input.category || "");
    const pct = applyLive ? liveCredPct! : d.discountPct;
    const ckBonus = ck && ck.zone === "reliable" ? ck.mid * 0.85 : 0;
    const eff = pct + ckBonus;
    options.push(mkOption(amt, {
      cardId: "giftcard",
      label: `${d.store} gift card (${pct}% off${applyLive ? " · live" : ""}) → ${ckBonus > 0 ? "Cashkaro → " : ""}${d.merchantLabel}`,
      effectivePct: eff,
      cashkaroSuggested: ckBonus > 0,
      worstCasePct: pct,
      bestCasePct: eff + (ckBonus > 0 ? (ck!.max - ck!.mid) * 0.85 : 0),
      pros: [
        `${pct}% off face value via ${d.store} gift card${applyLive ? " (rate you entered)" : ""}`,
        ckBonus > 0 ? `+ ~${ck!.mid}% Cashkaro at ${d.merchantLabel}` : "",
        d.coinFunded ? "Can boost using CRED coins / CheQ chips on select drops" : "",
      ],
      cons: [
        "Gift-card rates are app-dynamic — verify the live rate in CRED/CheQ before buying",
        "Pay for the gift card via UPI or a card that rewards GC purchases for a little extra",
      ],
      rationale: `Buy a ${d.merchantLabel} gift card at ${pct}% off on ${d.store}${ckBonus > 0 ? `, click through Cashkaro (~${ck!.mid}%)` : ""}, then pay at ${d.merchantLabel} with the gift-card balance. This stacks the gift-card discount with cashback.`,
      steps: [
        `Open ${d.store} → buy a ${d.merchantLabel} gift card (${pct}% off${d.coinFunded ? "; apply coins/chips to boost" : ""})`,
        ckBonus > 0 ? `Open Cashkaro → click through to ${d.merchantLabel}` : `Go to ${d.merchantLabel}`,
        "Add items, pay using the gift-card balance",
        ckBonus > 0 ? "Screenshot the order for Cashkaro tracking" : "Keep the receipt",
      ],
    }));
  }
  // User entered a live CRED % but no table deal matched — still rank the CRED GC route (non-movie).
  if (liveCredPct != null && !moviesAlreadyHasCredGc && gcDeals.every((d) => d.store !== "CRED") && !isForeign) {
    const merchLabel = input.merchant?.trim() || "this merchant";
    const ckBonus = ck && ck.zone === "reliable" ? ck.mid * 0.85 : 0;
    options.push(mkOption(amt, {
      cardId: "giftcard",
      label: `CRED gift card (${liveCredPct}% off) → ${ckBonus > 0 ? "Cashkaro → " : ""}${merchLabel}`,
      effectivePct: liveCredPct + ckBonus,
      cashkaroSuggested: ckBonus > 0,
      worstCasePct: liveCredPct,
      bestCasePct: liveCredPct + ckBonus,
      pros: [`${liveCredPct}% off via CRED Store (rate you entered)`, ckBonus > 0 ? `+ Cashkaro at ${merchLabel}` : ""].filter(Boolean),
      cons: ["Confirm the gift card works at this merchant before buying"],
      rationale: `You entered ${liveCredPct}% off on CRED for ${merchLabel}. That discount is ranked against card + Cashkaro routes.`,
      steps: [
        `Open CRED → Store → buy a ${merchLabel} gift card at ${liveCredPct}% off`,
        ckBonus > 0 ? `Open Cashkaro → click through to ${merchLabel}` : `Go to ${merchLabel}`,
        "Pay with the gift-card balance",
      ],
    }));
  }

  // ---- Universal Amazon Pay rail (Amazon ICICI stacks) ----
  // Amazon Pay accepts many payments (bills/recharges/Amazon/insurance/partner merchants like
  // BookMyShow). Paying via Amazon Pay with the ICICI card earns 5% (Amazon) / 2% (bills/partner),
  // stacks Cashkaro, and is liquid cashback. Other cards via Amazon Pay just earn their normal
  // rate (= paying direct), so only the ICICI bonus route is worth surfacing here.
  if (!isForeign && amazonPayable(input.category || "", input.merchant || "") && !options.some((o) => o.cardId === "amazon_pay_icici")) {
    const isAmazonShop = /amazon/.test(`${input.category} ${input.merchant}`.toLowerCase()) && !/recharge|bill/.test(`${input.category}`.toLowerCase());
    const rate = isAmazonShop ? (input.primeMember !== false ? 5 : 3) : 2;
    const ckAmz = amazonPlatformCashkaro(input.category || "", amt, input.cashkaroPctOverride);
    const ckInr = ckAmz?.inr ?? 0;
    const base = amt * (rate / 100);
    options.push(mkOption(amt, {
      cardId: "amazon_pay_icici",
      label: ckInr > 0 ? `Cashkaro → Amazon Pay ICICI (${rate}% + Cashkaro)` : `Pay via Amazon Pay with ICICI (${rate}%)`,
      effectivePct: ((base + ckInr) / amt) * 100,
      baseRewardInr: base + ckInr,
      cashkaroSuggested: !!ckAmz,
      worstCasePct: rate,
      pros: [`${rate}% cashback via Amazon Pay${ckInr > 0 ? ` + Cashkaro ${inr(ckInr)}` : ""}`, "Liquid (Amazon Pay balance)"],
      cons: ["Only where the platform accepts Amazon Pay", "Pay with the card (not balance) so Cashkaro tracks"],
      rationale: `Amazon Pay accepts this payment — paying with the Amazon Pay ICICI card earns ${rate}%${ckInr > 0 ? ` and the Cashkaro Amazon link adds ${inr(ckInr)}` : ""}.`,
      steps: [ckInr > 0 ? "Open Cashkaro → Amazon link first" : "Open Amazon Pay", `Pay ${inr(amt)} with Amazon Pay ICICI`, `${rate}% back as Amazon Pay balance`],
    }));
  }

  // ---- Universal BOB Eterna welcome push (60-day ₹50K → ₹2,500 window) ----
  // While the welcome window is open, EVERY decent spend (any category) should be a candidate for
  // BOB Eterna, because each rupee drives the ₹50K milestone — even excluded MCCs count toward it.
  {
    const bobW = bobWelcomeBonus(input, amt);
    if (bobW && !options.some((o) => o.cardId === "bob_eterna" && /welcome/i.test(o.label))) {
      options.push(mkOption(amt, {
        cardId: "bob_eterna",
        label: "BOB Eterna (welcome push to ₹50K)",
        effectivePct: 0.75 + (bobW.inr / amt) * 100,
        baseRewardInr: amt * 0.0075,
        bonusRewardInr: bobW.inr,
        pros: [bobW.note, "Inside the 60-day welcome window — every spend drives the ₹50K → ₹2,500 bonus (all categories count)"],
        cons: ["Base only 0.75% on non-5× categories — the value is the welcome milestone, not the base rate"],
        rationale: `You're inside the BOB 60-day welcome window — ${bobW.note} Route most decent spends here until you hit ₹50K; the marginal value far exceeds the base 0.75%.`,
        steps: ["Pay with BOB Eterna", `Drives the ₹50K welcome milestone (₹2,500 bonus)`],
      }));
    }
  }

  // ---- Universal HSBC Live+ welcome push (30-day ₹25K → ₹1,000) ----
  // Same pattern as BOB: every eligible spend during the window drives the welcome, including
  // categories that only earn 1.5% (or 0% hospital/transport) base.
  {
    const lpW = livePlusWelcomeBonus(input, amt);
    if (lpW && !options.some((o) => o.cardId === "hsbc_live_plus" && (o.bonusRewardInr > 0 || /welcome/i.test(o.label)))) {
      const zero = livePlusZeroBase(input.merchant || "", input.category || "");
      const basePct = zero ? 0 : LIVE_PLUS_BASE_PCT;
      const baseInr = amt * (basePct / 100);
      options.push(mkOption(amt, {
        cardId: "hsbc_live_plus",
        label: zero
          ? "HSBC Live+ (welcome push — 0% base on healthcare/transport)"
          : "HSBC Live+ (welcome push to ₹25k/30d)",
        effectivePct: ((baseInr + lpW.inr) / amt) * 100,
        baseRewardInr: baseInr,
        bonusRewardInr: lpW.inr,
        pros: [lpW.note, "Inside 30-day welcome — every Live+ spend drives the ₹1,000 bonus (need HSBC app login too)"],
        cons: [
          zero ? "This MCC earns 0% base post-reval — value is welcome only" : `Base only ${LIVE_PLUS_BASE_PCT}% outside accelerated cats`,
          "Prefer Live+ 10% categories (dining/food/grocery/utilities/shopping) when available",
        ],
        rationale: `You're inside the Live+ ₹25k/30-day welcome window — ${lpW.note}`,
        steps: ["Pay with HSBC Live+", "Log into HSBC India app if you haven't", `Builds toward ₹25k welcome (₹1,000 cashback)`],
      }));
    }
  }

  // ---- Universal Amex monthly-milestone fillers (Gold 6×₹1K, MRCC 4×₹1.5K + ₹20K) ----
  // Considered for EVERY eligible expense (not just generic), so the engine surfaces the high
  // value of completing a monthly milestone — esp. the final txn (full ₹500). Skipped for
  // Amex-excluded categories (fuel/insurance/rent/wallet/tax) which don't count.
  if (!isForeign && !amexExcluded(input.category || "")) {
    const gB = goldMilestoneBonus(input, amt);
    if (gB && gB.inr > 0 && !options.some((o) => o.cardId === "amex_gold" && /milestone/i.test(o.label))) {
      options.push(mkOption(amt, {
        cardId: "amex_gold",
        label: "Amex Gold (fills 6-txn monthly milestone)",
        effectivePct: 0.78 + (gB.inr / amt) * 100,
        baseRewardInr: amt * 0.0078,
        bonusRewardInr: gB.inr,
        pros: [gB.note],
        cons: ["Needs ≥₹1K per txn"],
        rationale: `Routing this to Amex Gold ${gB.note}`,
        steps: ["Pay with Amex Gold", "Counts toward the 6×₹1K monthly milestone"],
      }));
    }
    const mB = mrccMilestoneBonus(input, amt);
    if (mB && mB.inr > 0 && !options.some((o) => o.cardId === "amex_mrcc" && /MRCC/i.test(o.label))) {
      options.push(mkOption(amt, {
        cardId: "amex_mrcc",
        label: mB.label,
        effectivePct: 0.78 + (mB.inr / amt) * 100,
        baseRewardInr: amt * 0.0078,
        bonusRewardInr: mB.inr,
        pros: [mB.note],
        cons: ["One big spend still counts as only 1 of 4 ≥₹1.5k txns"],
        rationale: mB.note,
        steps: ["Pay with Amex MRCC", "Counts toward the open monthly MRCC part"],
      }));
    }
  }

  // ---- Universal ANNUAL-milestone push (SBI fee/online, IDFC BluChip tiers, Amex PT) ----
  // Only when this spend completes the next threshold OR you're already close (≤10% / ₹15k).
  // Far-away pro-rata was removed — it made SBI win random spends with a fake ~2% "milestone".
  if (!isForeign) {
    for (const cardId of ["sbi_simplyclick", "idfc_indigo", "amex_plat_travel"]) {
      if (cardId === "amex_plat_travel" && amexExcluded(input.category || "")) continue;
      // One row per card — skip if this card already has any option.
      if (options.some((o) => o.cardId === cardId)) continue;
      const mb = annualMilestoneBonus(cardId, input, amt);
      if (!mb || mb.inr < 1) continue;
      const baseEval = genericCardEval(cardId, input, false);
      const basePct = baseEval?.pct ?? 0;
      const eff = basePct + (mb.inr / amt) * 100;
      if (eff <= basePct + 0.05) continue; // negligible — skip noise
      const short = getCardById(cardId)?.short ?? cardId;
      options.push(mkOption(amt, {
        cardId,
        label: `${short} — push to ${inr(mb.threshold)} annual milestone`,
        effectivePct: eff,
        baseRewardInr: (amt * basePct) / 100,
        bonusRewardInr: mb.inr,
        pros: [mb.note],
        cons: ["Annual-milestone value assumes you'll actually reach the threshold this cycle"],
        rationale: `Routing this to ${short}: ${mb.note}`,
        steps: [`Pay with ${short}`, `Builds toward the ${inr(mb.threshold)} annual milestone`],
      }));
    }
  }

  // ---- Normal UPI (PhonePe / GPay) — always available, 0% (last resort) ----
  if (!isForeign && input.channel !== "upi_normal" && !options.some((o) => o.cardId === "upi")) {
    options.push(mkOption(amt, {
      cardId: "upi",
      label: "Normal UPI (PhonePe / GPay) — 0%",
      effectivePct: 0,
      baseRewardInr: 0,
      pros: [],
      cons: ["No card rewards — last resort, or for categories every card excludes"],
      rationale: "Direct bank UPI earns nothing. Only use if no card/route applies or the category is reward-excluded everywhere.",
      steps: [`Pay ${inr(amt)} via PhonePe / GPay UPI`],
    }));
  }

  // Ensure every active card has at least a reasoning entry so the user always
  // sees WHY a card (incl. Kiwi/Scapia/SBI) was not the top pick.
  const present = new Set(options.map((o) => o.cardId));
  const active = ["amex_gold", "amex_plat_travel", "amex_mrcc", "scapia", "idfc_indigo", "bob_eterna", "yes_kiwi", "sbi_simplyclick", "hsbc_live_plus"];
  if (input.amazonPayIciciIssued !== false) active.push("amazon_pay_icici");

  for (const id of active) {
    if (present.has(id)) continue;
    // Don't inject a dead Kiwi row for in-app movie checkout (already skipped above).
    if (id === "yes_kiwi" && movieApp) continue;
    const g = genericCardEval(id, input, isForeign);
    if (!g) continue;
    const reward = amt * (g.pct / 100);
    options.push({
      cardId: id,
      label: g.label,
      effectivePct: g.pct,
      baseRewardInr: reward,
      bonusRewardInr: 0,
      totalRewardInr: reward,
      feasible: true,
      pros: [],
      cons: [g.reason],
      cashkaroSuggested: false,
      worstCasePct: g.pct,
      bestCasePct: g.pct,
      steps: [],
      rationale: g.reason,
    });
  }

  // ---- Amazon order-level offer (entered by the user at checkout) ----
  // e.g. "Cashback on orders above ₹1398 → ₹200 to Amazon Pay Wallet". These promos are
  // captured by paying via Amazon Pay, so we attach them to the Amazon Pay ICICI routes
  // (which is how you also bank the extra 5%). We can't know them, so the user inputs them.
  const amazonOrderCb = input.amazonOrderCashbackInr ?? 0;
  const isAmazonExpense = /amazon/.test(`${input.category} ${input.merchant}`.toLowerCase());
  if (amazonOrderCb > 0 && isAmazonExpense) {
    for (const o of options) {
      if (o.cardId !== "amazon_pay_icici") continue;
      o.bonusRewardInr += amazonOrderCb;
      o.totalRewardInr += amazonOrderCb;
      o.effectivePct = (o.totalRewardInr / amt) * 100;
      o.worstCasePct = o.effectivePct;
      o.bestCasePct = o.effectivePct;
      o.pros = [...o.pros, `+ ${inr(amazonOrderCb)} Amazon order offer (you entered)`];
    }
  }

  // Tag each option with liquidity + a redemption range, then rank by a LIQUIDITY-WEIGHTED
  // score so travel-locked coins (Scapia/BluChips) don't out-rank equal-nominal liquid cash.
  const LIQ_WEIGHT: Record<string, number> = { cash: 1.0, flexible: 0.9, locked: 0.7 };
  const unique = dedupeGiftCardOptions(options);
  // One best row per card (prevents e.g. two Amex PT rows: generic + annual push).
  const bestByCard = new Map<string, RouteOption>();
  for (const o of unique) {
    const prev = bestByCard.get(o.cardId);
    if (!prev || o.totalRewardInr > prev.totalRewardInr || (o.totalRewardInr === prev.totalRewardInr && o.bonusRewardInr > prev.bonusRewardInr)) {
      bestByCard.set(o.cardId, o);
    }
  }
  const deduped = [...bestByCard.values()];
  for (const o of deduped) {
    o.liquidity = liquidityOf(o.cardId, o.label);
    const rng = pointsRange(o.cardId, o.label, o.totalRewardInr, o.effectivePct, amt);
    if (rng) o.redemptionRange = { worstPct: rng.worstPct, bestPct: rng.bestPct };
  }
  const score = (o: RouteOption) => o.totalRewardInr * (LIQ_WEIGHT[o.liquidity ?? "cash"] ?? 1);
  const ranked = [...deduped].sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    return score(b) - score(a);
  });
  const best = ranked[0];
  const card = pickCard(best.cardId);
  const alternatives = ranked.slice(1); // full ranked list, with reasons

  // Milestone nudge: if the raw-best route does NOT itself progress a milestone,
  // surface the best milestone-feeding alternative so you can consciously feed it.
  const bestFeedsMilestone = best.bonusRewardInr > 0 || best.cardId === "yes_kiwi";
  let milestoneTip: RecommendationResult["milestoneTip"];
  if (!bestFeedsMilestone) {
    // Prefer a concrete milestone/welcome feeder (Amex/BOB) regardless of gap.
    let feeder = ranked.find((o) => o.feasible && o.cardId !== best.cardId && o.bonusRewardInr > 0);
    // Else nudge Kiwi (Neon cycle) only if it's not drastically worse.
    if (!feeder) {
      const kiwi = ranked.find((o) => o.feasible && o.cardId === "yes_kiwi" && o.effectivePct >= 2);
      if (kiwi && best.effectivePct - kiwi.effectivePct <= 2.5) feeder = kiwi;
    }
    if (feeder) {
      const giveUp = Math.max(0, +(best.effectivePct - feeder.effectivePct).toFixed(2));
      const why = feeder.cardId === "yes_kiwi"
        ? "progresses your Kiwi Neon cycle toward the 3% / 4% / 5% + lounge milestones"
        : (feeder.pros.find((p) => /milestone|welcome|cycle|fills|completes/i.test(p)) || feeder.rationale || "progresses a milestone");
      milestoneTip = {
        cardId: feeder.cardId,
        label: feeder.label,
        effectivePct: feeder.effectivePct,
        giveUpPct: giveUp,
        note: `${why} — you'd earn ${feeder.effectivePct.toFixed(2)}% here (giving up ~${giveUp.toFixed(2)}% vs the top pick) but build toward a milestone bonus worth far more.`,
      };
    }
  }

  const effectiveRange = pointsRange(best.cardId, best.label, best.totalRewardInr, best.effectivePct, amt) ?? undefined;

  return {
    card,
    path: best.label,
    effectivePct: best.effectivePct,
    worstCasePct: best.worstCasePct,
    bestCasePct: best.bestCasePct,
    rewardInr: best.totalRewardInr,
    rationale: best.rationale,
    caveats: best.cons.filter(Boolean),
    cashkaroSuggested: best.cashkaroSuggested,
    best,
    alternatives,
    effectiveRange,
    milestoneTip,
  };
}
