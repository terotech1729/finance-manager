import { CARDS, getCardById, ANNUAL_MILESTONES } from "./cards";
import { findCashkaro } from "./cashkaro";
import { findGiftCardDeals, findWelcomeOffer } from "./stacking";
import { findRedemption } from "./redemptions";
import type { Card, RecommendationResult, RouteOption } from "./types";

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
  idfcYtdSpend?: number;
  blckYtdSpend?: number;
  goldThisMonthTxnsAt1k?: number;
  mrccThisCycleTxnsAt1500?: number;
  mrccThisCycleAmount?: number;
  goldShopwiseUsedThisMonth?: number;
  bobBogoUsedThisMonth?: boolean;
  scapiaMonthlySpend?: number;
  kiwiNeonCycleSpend?: number;
  swiggyBlckIssued?: boolean;
  amazonPayIciciIssued?: boolean;
  primeMember?: boolean;
  amazonPayBalance?: number;
  amazonWelcomeClaimed?: string[];
  giftCardRateOverrides?: Record<string, number>;
  cashkaroPctOverride?: number; // live Cashkaro % you see (e.g. a limited-time sale) — overrides defaults
  bobEternaIssueDate?: string;
  bobWelcomeUnlocked?: boolean;
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

/** Amex MRCC milestone marginal value (4×₹1.5K + ₹20K, statement cycle). */
function mrccMilestoneBonus(input: RecommendInput, amt: number): { inr: number; note: string } | null {
  const txnsDone = input.mrccThisCycleTxnsAt1500 ?? input.mrccMonthlyTxnsDone ?? 0;
  const amtDone = input.mrccThisCycleAmount ?? input.mrccMonthlyAmount ?? 0;
  const daysLeft = daysLeftInMonth(input.today);
  let bonus = 0;
  const notes: string[] = [];
  if (amt >= 1500 && txnsDone < 4) {
    const remaining = 4 - txnsDone;
    if (remaining > daysLeft + 1) {
      notes.push(`4-txn part unreachable (${remaining} more ≥₹1.5K needed, ${daysLeft}d left)`);
    } else {
      bonus += remaining === 1 ? 500 : 500 / remaining; // completing unlocks full ₹500
      notes.push(remaining === 1 ? `completes 4-txn milestone (+₹500)` : `txn ${txnsDone + 1}/4 (≥₹1.5K)`);
    }
  }
  if (amtDone < 20000) {
    const fills = Math.min(amt, 20000 - amtDone);
    bonus += (fills / 20000) * 500; // ₹20K can be filled by one big txn, so not day-gated
    notes.push(`fills ${inr(fills)} of ₹20K cycle target`);
  }
  if (bonus <= 0) return null;
  return { inr: bonus, note: `MRCC milestone: ${notes.join(", ")} → +${inr(bonus)} marginal` };
}

function ckRange(merchant: string, category: string): { mid: number; min: number; max: number; zone: string } | null {
  const m = findCashkaro(merchant, category);
  if (!m) return null;
  return { mid: (m.minRate + m.maxRate) / 2, min: m.minRate, max: m.maxRate, zone: m.zone };
}

/**
 * Does Amazon Pay accept this payment cleanly? (bills/recharges/Amazon/partner merchants).
 * NOTE: insurance is intentionally EXCLUDED — Amazon Pay levies convenience fees on insurance
 * premiums (+ ₹1L / 6-per-month caps), so 2% doesn't net out; pay the insurer/PolicyBazaar direct.
 */
function amazonPayable(category: string, merchant: string): boolean {
  const c = `${category} ${merchant}`.toLowerCase();
  return /utilit|electric|mobile|recharge|broadband|\btv\b|dth|\bgas\b|water|amazon|bookmyshow|\bbms\b|movie/.test(c);
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
    case "swiggy_blck": return input.blckYtdSpend ?? 0;
    default: return 0;
  }
}

/**
 * Marginal value of pushing THIS spend toward a card's next ANNUAL milestone.
 * Completing the milestone (crossing the threshold) attributes the FULL reward; partial
 * progress is pro-rata over the threshold. Reads thresholds from ANNUAL_MILESTONES.
 */
function annualMilestoneBonus(cardId: string, input: RecommendInput, amt: number): { inr: number; note: string; threshold: number } | null {
  const ytd = ytdForCard(cardId, input);
  const ms = ANNUAL_MILESTONES.filter((m) => m.cardId === cardId).slice().sort((a, b) => a.threshold - b.threshold);
  const next = ms.find((m) => !m.hit && ytd < m.threshold); // skip already-hit milestones
  if (!next) return null;
  const remaining = next.threshold - ytd;
  const completes = amt >= remaining;
  const value = completes ? next.rewardValueInr : (amt / next.threshold) * next.rewardValueInr;
  const short = getCardById(cardId)?.short ?? cardId;
  const note = completes
    ? `Completes ${short}'s ${inr(next.threshold)} milestone → unlocks ${next.reward} (${inr(next.rewardValueInr)})`
    : `Builds toward ${short}'s ${inr(next.threshold)} milestone — ${inr(remaining)} to go (${next.reward})`;
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
      rationale: "Scapia has 0% forex — unbeatable for non-INR.",
      steps: [
        ckUsable ? "If on Cashkaro (Booking/Agoda), open via Cashkaro first" : `Pay with Scapia at the foreign merchant / POS`,
        "Scapia charges 0% forex markup",
        "Earn coins on Scapia-app travel",
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

  // --- IndiGo flight → IDFC Indigo direct ---
  if (cat.includes("indigo") || (merchant.includes("indigo") && !merchant.includes("amazon"))) {
    add({
      cardId: "idfc_indigo",
      label: "IDFC Indigo via IndiGo app (up to 22 BluChips/₹100)",
      effectivePct: 9.9,
      bestCasePct: 9.9,
      worstCasePct: 6 * 0.45, // card-only 6 BluChips if not a tier member
      pros: ["Up to 22 BluChips/₹100 (6 card + up to 16 IndiGo tier) ≈ 9.9% at ₹0.45/BluChip", "Burn 5K-BluChip voucher (exp 6 Jun 2026)"],
      cons: ["Must book on IndiGo app/site directly", "BluChips redeemable only on IndiGo one-way flights (base fare+fuel), value dynamic ₹0.40–0.60"],
      rationale: "Up to 22 BluChips/₹100 ≈ 9.9% (at ₹0.45/BluChip). IndiGo isn't a Cashkaro affiliate, so book direct.",
      steps: ["Open IndiGo (6E) app", "Select flight", "Pay with IDFC Indigo card", "Earn up to 22 BluChips/₹100"],
    });
    return finalize(options, input, amt, isForeign, ck);
  }

  // --- UPI scan/pay (Kiwi) ---
  if (input.channel === "upi") {
    options.push(buildKiwiOption(input, amt));
    return finalize(options, input, amt, isForeign, ck);
  }

  // ============ UTILITIES (electricity / mobile / broadband / TV / gas / water) ============
  if (cat.includes("utility") || cat.includes("electric") || cat.includes("mobile") || cat.includes("recharge") || cat.includes("broadband") || cat.includes("tv") || cat.includes("gas") || cat.includes("water") || cat.includes("dth")) {
    // Option A: Amazon Pay ICICI via Amazon Pay bill-pay = 2% (regardless of Prime), + Cashkaro flat ₹1.5
    {
      const ckAmz = amazonPlatformCashkaro(cat, amt, ckOverride);
      const ckInr = ckAmz?.inr ?? 0;
      const baseCash = amt * 0.02;
      add({
        cardId: "amazon_pay_icici",
        label: ckInr > 0 ? "Cashkaro → Amazon Pay ICICI bill-pay (2% + Cashkaro)" : "Amazon Pay ICICI via Amazon bill-pay (2%)",
        effectivePct: ((baseCash + ckInr) / amt) * 100,
        baseRewardInr: baseCash + ckInr,
        cashkaroSuggested: !!ckAmz,
        worstCasePct: 2.0,
        pros: [`2% on bills/recharges via Amazon.in${ckInr > 0 ? ` + Cashkaro ${inr(ckInr)} (click Cashkaro Amazon link first)` : ""}`, "Cashback as Amazon Pay balance — recycles into more recharges"],
        cons: ["1% fee if a single utility txn > ₹50K", "Pay with the CARD (not balance) so Cashkaro tracks"],
        rationale: `Amazon Pay ICICI gives 2% on bills/recharges via Amazon.in${ckInr > 0 ? `, and the Cashkaro Amazon link adds ${inr(ckInr)} on top` : ""}.`,
        steps: [
          ckInr > 0 ? "Open Cashkaro → Amazon → tap the Recharge & Bills link first" : "Open Amazon.in → Amazon Pay → Recharges & Bills",
          `Select the biller, enter ${inr(amt)}`,
          "Pay with the Amazon Pay ICICI card (not balance, so Cashkaro tracks)",
          `2% (${inr(baseCash)})${ckInr > 0 ? ` + Cashkaro ${inr(ckInr)}` : ""} credited`,
        ],
      });
    }

    // Option B: Spend down Amazon Pay balance (sunk gift-card money) — counts as 0% reward but liquidates idle balance
    if (apBal >= 100) {
      const used = Math.min(apBal, amt);
      add({
        cardId: "amazon_pay_icici",
        label: `Use idle Amazon Pay balance (${inr(used)})`,
        effectivePct: 0,
        baseRewardInr: 0,
        // "bonus" = value of liquidating otherwise-idle gift-card balance is not a reward, keep 0
        pros: [`Clears ${inr(used)} of idle Amazon Pay balance (gift-card money sitting unused)`, "No fee"],
        cons: ["Earns 0% — only do this to drain leftover balance", apBal < amt ? `Covers only ${inr(used)}; pay rest with a card` : "Fully covers this bill"],
        rationale: "Your ₹3,338 Amazon Pay balance is sunk gift-card money earning nothing. Spending it on a recharge is effectively 'free' money you already paid for — but it earns no new reward.",
        steps: [
          "Open Amazon.in → Recharges & Bills",
          `Apply Amazon Pay balance (${inr(used)})`,
          apBal < amt ? `Pay remaining ${inr(amt - used)} with Amazon Pay ICICI (2%)` : "Done — fully covered by balance",
        ],
      });
    }

    // Option C: BOB Eterna — telecom now earns base RP (1 Apr 2026) + WELCOME PUSH
    if (input.swiggyBlckIssued !== undefined) {
      const bobWelcome = bobWelcomeBonus(input, amt);
      const bobBase = amt * 0.0075; // base 3 RP/₹100 = 0.75% (telecom earns base RP from 1 Apr 2026)
      add({
        cardId: "bob_eterna",
        label: bobWelcome ? "BOB Eterna (welcome push to ₹50K)" : "BOB Eterna (base 0.75%)",
        effectivePct: 0.75 + (bobWelcome ? (bobWelcome.inr / amt) * 100 : 0),
        baseRewardInr: bobBase,
        bonusRewardInr: bobWelcome?.inr ?? 0,
        pros: bobWelcome
          ? [bobWelcome.note, "Every rupee counts toward ₹50K welcome (₹2,500) regardless of category"]
          : ["Telecom earns base RP from 1 Apr 2026"],
        cons: ["Base rate only 0.75% on utilities (not a 5× category)", !bobWelcome ? "Welcome window already closed/met" : ""],
        rationale: bobWelcome
          ? `You're inside the BOB 60-day welcome window — ${bobWelcome.note} Every spend (even utilities at base 0.75%) drives the ₹50K → 10,000 RP (₹2,500) bonus, so the marginal value is huge right now.`
          : "BOB base 0.75% on utilities — only worth it during the welcome window.",
        steps: [
          "Open biller app / BBPS",
          `Pay ${inr(amt)} with BOB Eterna`,
          bobWelcome ? "Drives ₹50K welcome milestone (₹2,500 bonus)" : "Earns base 0.75%",
        ],
      });
    }

    // Option D: Amex Gold — 1 MR/₹50 = 1% + monthly 6-txn milestone (only if ≥₹1K AND milestone not done)
    const goldBonus = goldMilestoneBonus(input, amt);
    add({
      cardId: "amex_gold",
      label: goldBonus ? "Amex Gold (1% + fills 6-txn milestone)" : "Amex Gold (1%, milestone N/A)",
      effectivePct: 1.0 + (goldBonus ? (goldBonus.inr / amt) * 100 : 0),
      baseRewardInr: amt * 0.01,
      bonusRewardInr: goldBonus?.inr ?? 0,
      pros: goldBonus
        ? ["1 MR/₹50 = 1% on utilities", goldBonus.note]
        : ["1 MR/₹50 = 1% on utilities"],
      cons: amt < 1000
        ? ["< ₹1,000 → does NOT count toward the 6-txn milestone", "Monthly milestone may already be hit this calendar month"]
        : goldBonus ? [] : ["Monthly 6-txn milestone already hit this calendar month → no bonus"],
      rationale: amt < 1000
        ? `Amex Gold earns 1% on utilities, but ₹${Math.round(amt)} is below the ₹1,000 minimum that counts toward the 6-txn monthly milestone.`
        : "Amex Gold earns 1% + the txn counts toward the 6×₹1K monthly milestone if not yet hit.",
      steps: ["Open biller app", `Pay ${inr(amt)} with Amex Gold`, "Earn 1 MR per ₹50"],
    });

    return finalize(options, input, amt, isForeign, ck);
  }

  // ============ FUEL ============
  if (cat.includes("fuel") || cat.includes("petrol") || cat.includes("diesel")) {
    add({
      cardId: "idfc_indigo", label: "IDFC Indigo (0.33%) or pay cash", effectivePct: 0.33,
      pros: ["Best of a bad lot for fuel"], cons: ["All cards near-zero on fuel; prefer debit/cash"],
      rationale: "Fuel earns almost nothing on any card.",
      steps: ["Prefer cash/debit", "If CC: IDFC Indigo (0.33%, 1% surcharge waiver)"],
    });
    return finalize(options, input, amt, isForeign, ck);
  }

  // ============ INSURANCE / RENT / TAX ============
  if (cat.includes("insurance") || cat.includes("rent") || cat.includes("tax") || cat.includes("govt")) {
    const bobWelcome = bobWelcomeBonus(input, amt);
    if (bobWelcome) {
      add({
        cardId: "bob_eterna", label: "BOB Eterna (welcome push)", effectivePct: 0.75 + (bobWelcome.inr / amt) * 100,
        baseRewardInr: amt * 0.0075, bonusRewardInr: bobWelcome.inr,
        pros: [bobWelcome.note, "All spends count toward ₹50K welcome"],
        cons: ["Insurance/rent/tax earn no base RP, but DO count toward welcome milestone"],
        rationale: "Inside BOB welcome window, even excluded-category spends count toward the ₹50K milestone.",
        steps: ["Pay with BOB Eterna", "Drives ₹50K welcome (₹2,500)"],
      });
    }
    add({
      cardId: "idfc_indigo", label: "Pay direct on insurer / PolicyBazaar (or NEFT) — IDFC ~0.33%", effectivePct: 0.33,
      pros: ["Paying the insurer/PolicyBazaar directly avoids the platform convenience fee (e.g. Amazon Pay charges fees on insurance)"],
      cons: ["Insurance/rent/tax earn little on any card; most exclude them. Watch for any 1-2% biller convenience fee — UPI/NEFT direct is often cheapest"],
      rationale: "These MCCs earn almost nothing on any card and platforms like Amazon Pay add fees — so pay the insurer/PolicyBazaar directly (CC for ~0.33% via IDFC, or NEFT/UPI to avoid fees), unless you're filling the BOB welcome.",
      steps: ["Pay on the insurer's site / PolicyBazaar directly (avoid wallet platform fees)", "Use IDFC (~0.33%) or NEFT/UPI"],
    });
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
    if (input.swiggyBlckIssued) {
      add({ cardId: "swiggy_blck", label: "Swiggy BLCK in-app (10%)", effectivePct: 10.0,
        pros: ["10% on Swiggy (min ₹249)"], cons: ["Cap ₹1,500/mo = ₹15K spend"],
        rationale: "BLCK 10% on Swiggy.", steps: ["Open Swiggy app", "Pay with HDFC BLCK", "10% cashback"] });
    } else {
      add({ cardId: "amex_gold", label: `Amex Gold via ShopWise → Swiggy voucher (${SHOPWISE_NET_PCT}% net)`, effectivePct: SHOPWISE_NET_PCT,
        pros: [`5.8% MR − 1.77% ShopWise fee ≈ ${SHOPWISE_NET_PCT}% net, until BLCK arrives`], cons: ["₹10K/mo ShopWise cap", "ShopWise charges 1.5%+GST convenience fee (already netted)"],
        rationale: `ShopWise route nets ${SHOPWISE_NET_PCT}% after the 1.5%+GST fee, until Swiggy BLCK is issued.`,
        steps: ["Open ShopWise", "Buy Swiggy voucher with Amex Gold (5×, ~1.77% fee applies)", "Use voucher in Swiggy app"] });
    }
    return finalize(options, input, amt, isForeign, ck);
  }

  // ============ AMAZON ============
  if (merchant.includes("amazon")) {
    const realApRate = prime ? 5.0 : 3.0; // Amazon.in earns 5% (Prime) / 3% (non-Prime) incl. electronics

    // Use idle Amazon Pay balance first if present
    if (apBal >= 100) {
      const used = Math.min(apBal, amt);
      add({
        cardId: "amazon_pay_icici", label: `Apply Amazon Pay balance (${inr(used)}) + ICICI ${realApRate}%`,
        effectivePct: realApRate, baseRewardInr: (amt - used) * (realApRate / 100),
        pros: [`Drains ${inr(used)} idle balance`, `Remaining earns ${realApRate}% (Prime)`],
        cons: ["Balance portion earns no reward (already paid)"],
        rationale: "Spend idle Amazon Pay balance, pay the rest with Amazon Pay ICICI for max cashback.",
        steps: ["On Amazon checkout, apply Amazon Pay balance", `Pay rest with Amazon Pay ICICI (${realApRate}%)`],
      });
    }
    // ShopWise route (deterministic, via Amex Gold) — capped ₹10K/mo, net of 1.77% fee
    const shopwiseLeft = 10000 - (input.goldShopwiseUsedThisMonth ?? 0);
    add({
      cardId: "amex_gold", label: `Amex Gold via ShopWise → Amazon Pay voucher (${SHOPWISE_NET_PCT}% net)`,
      effectivePct: SHOPWISE_NET_PCT, feasible: shopwiseLeft >= 100,
      feasibilityNote: shopwiseLeft < amt ? `Only ${inr(Math.max(0, shopwiseLeft))} ShopWise headroom left this month` : undefined,
      pros: [`Deterministic ${SHOPWISE_NET_PCT}% net (5.8% MR − 1.77% fee), no tracking risk`],
      cons: ["₹10K/mo ShopWise cap", "ShopWise 1.5%+GST convenience fee (already netted)"],
      rationale: `ShopWise nets ${SHOPWISE_NET_PCT}% after the 1.5%+GST fee — deterministic, usually beats Cashkaro on Amazon (CK Amazon tracking is unreliable).`,
      steps: ["Open ShopWise", "Buy Amazon Pay voucher with Amex Gold (5×, ~1.77% fee)", "Use voucher on Amazon"],
    });
    // Amazon Pay ICICI direct
    add({
      cardId: "amazon_pay_icici", label: `Amazon Pay ICICI direct (${realApRate}% Prime)`,
      effectivePct: realApRate, worstCasePct: realApRate, bestCasePct: realApRate + (ck ? ck.max * 0.5 : 0),
      cashkaroSuggested: !!ck && ck.zone !== "na",
      pros: [`${realApRate}% on Amazon.in (uncapped)`, "Best above ShopWise ₹10K cap"],
      cons: ["CK Amazon tracking unreliable — treat as bonus only"],
      rationale: `Amazon Pay ICICI ${realApRate}% (Prime), uncapped. Use above the ShopWise cap.`,
      steps: ["Add to Amazon cart", `Pay with Amazon Pay ICICI (${realApRate}%)`, "Do NOT pay with Amazon Pay voucher if trying Cashkaro"],
    });
    return finalize(options, input, amt, isForeign, ck);
  }

  // ============ CLEARTRIP ============
  if (merchant.includes("cleartrip")) {
    const isHotel = cat.includes("hotel");
    if (input.swiggyBlckIssued) {
      add({ cardId: "swiggy_blck", label: `BLCK + HDFCCC coupon (${isHotel ? "24%" : "11%"})`,
        effectivePct: isHotel ? 24 : 11, worstCasePct: isHotel ? 24 : 11, bestCasePct: isHotel ? 28 : 13,
        cashkaroSuggested: true,
        pros: ["BLCK coupon stack is best-in-class"], cons: ["Cashkaro may not track with instant discount"],
        rationale: "BLCK HDFCCC coupon + 5% online = top stack.",
        steps: ["Try Cashkaro click-through", "Apply HDFCCC coupon on Cleartrip", "Pay with BLCK"] });
    } else {
      add({ cardId: "amex_plat_travel", label: "Amex PT + Cashkaro (until BLCK arrives)",
        effectivePct: 1.0 + (ck ? ck.mid * 0.7 : 0), worstCasePct: 1.0, bestCasePct: 1.0 + (ck ? ck.max : 0),
        cashkaroSuggested: true, bonusRewardInr: 0,
        pros: ["Counts toward PT ₹4L/₹7L milestone"], cons: ["Low base until BLCK arrives"],
        rationale: "Amex PT + Cashkaro is your best Cleartrip route pre-BLCK.",
        steps: ["Try Cashkaro → Cleartrip", "Pay with Amex PT"] });
    }
    return finalize(options, input, amt, isForeign, ck);
  }

  // ============ CASHKARO-RELIABLE ONLINE MERCHANTS ============
  if (ck && ck.zone === "reliable") {
    if (input.swiggyBlckIssued) {
      add({ cardId: "swiggy_blck", label: `Cashkaro + BLCK 5% online`,
        effectivePct: 5 + ck.mid * 0.85, worstCasePct: 5, bestCasePct: 5 + ck.max, cashkaroSuggested: true,
        pros: ["BLCK 5% online + Cashkaro stack"], cons: ["BLCK 5% cap ₹1,500/mo"],
        rationale: "BLCK 5% online + Cashkaro stacks reliably.",
        steps: ["Cashkaro click-through", `Pay ${input.merchant} with BLCK`] });
    }
    const bob5xLeft = 33000 - (input.bobCycleSpend5x ?? 0);
    add({ cardId: "bob_eterna", label: "Cashkaro + BOB Eterna 5× online (3.75%)",
      effectivePct: 3.75 + ck.mid * 0.85, worstCasePct: 3.75, bestCasePct: 3.75 + ck.max, cashkaroSuggested: true,
      feasible: bob5xLeft >= 100, feasibilityNote: bob5xLeft < amt ? `Only ${inr(Math.max(0,bob5xLeft))} of 5× headroom left this cycle` : undefined,
      pros: ["BOB 5× online (3.75%) + Cashkaro"], cons: ["5× cap 5,000 RP/cycle (~₹33K)"],
      rationale: "BOB 5× online + Cashkaro stacks. Cap 5K RP/cycle.",
      steps: ["Cashkaro click-through", `Pay ${input.merchant} with BOB Eterna`] });
    return finalize(options, input, amt, isForeign, ck);
  }

  // ============ ZOMATO ============
  if (merchant.includes("zomato")) {
    add({ cardId: "bob_eterna", label: "Cashkaro + BOB 5× dining", effectivePct: 3.75 + 4 * 0.85,
      worstCasePct: 3.75, bestCasePct: 8.75, cashkaroSuggested: true,
      pros: ["BOB 5× dining + Cashkaro Zomato"], cons: ["5× cap 5K RP/cycle"],
      rationale: "BOB 5× dining + Cashkaro ≈ 6.75-8.75%.",
      steps: ["Cashkaro → Zomato", "Pay with BOB Eterna"] });
    return finalize(options, input, amt, isForeign, ck);
  }

  // ============ DINING (offline) ============
  if (cat.includes("dining") || cat.includes("restaurant")) {
    add({ cardId: "bob_eterna", label: "BOB Eterna 5× dining (3.75%)", effectivePct: 3.75,
      pros: ["5× dining"], cons: ["Cap 5K RP/cycle"], rationale: "BOB 5× on dining.",
      steps: ["Pay with BOB Eterna at the restaurant"] });
    return finalize(options, input, amt, isForeign, ck);
  }

  // ============ MOVIES / EVENTS ============
  if (merchant.includes("bookmyshow") || merchant.includes("bms") || merchant.includes("district") || merchant.includes("pvr") || merchant.includes("inox") || cat.includes("movie") || cat.includes("event")) {
    const oneTicket = cat.includes("1 ticket");
    // BOGO needs a 2nd ticket; not used yet this month; District-app only.
    const bogoAvailable = input.bobBogoUsedThisMonth !== true && !oneTicket;
    if (oneTicket) {
      add({
        cardId: "bob_eterna",
        label: "Single ticket — BOGO doesn't apply (needs 2 tickets)",
        effectivePct: 0,
        baseRewardInr: 0,
        pros: ["The BOB Eterna BOGO frees the 2nd ticket — with 1 ticket there's nothing to discount"],
        cons: ["Book 2+ tickets (even gifting one) to unlock ~₹250 off via the District BOGO"],
        rationale: "You're booking a single ticket, so the buy-1-get-1 can't trigger. If you'll ever book 2, do it together on District for the free 2nd ticket. Otherwise the routes below are your best for one ticket.",
        steps: ["For 1 ticket, pick the best route below (UPI/Kiwi, Amazon Pay, etc.)"],
      });
    }
    if (bogoAvailable) {
      // Buy-1-Get-1: 2nd ticket 100% off up to ₹250, once per calendar month — DISTRICT app only.
      // Paying via BOB on District ALSO counts toward the ₹50K welcome window, so add that marginal.
      const savings = Math.min(amt / 2, 250);
      const bobW = bobWelcomeBonus(input, amt);
      const welcomeInr = bobW?.inr ?? 0;
      add({
        cardId: "bob_eterna",
        label: "BOB Eterna BOGO — book via District app (2nd ticket free, up to ₹250)",
        effectivePct: ((savings + welcomeInr) / amt) * 100,
        baseRewardInr: savings,
        bonusRewardInr: welcomeInr,
        worstCasePct: 0,
        bestCasePct: ((250 + welcomeInr) / Math.max(amt, 1)) * 100,
        pros: [
          `Buy-1-Get-1: 2nd ticket 100% off up to ₹250 — ≈ ${inr(savings)} off this booking`,
          welcomeInr > 0 ? `Also counts toward the BOB ₹50K welcome (+${inr(welcomeInr)})` : "Once per calendar month",
        ],
        cons: ["Works on the District app ONLY — not BookMyShow", "Once per calendar month", "Needs 2+ tickets; free-ticket value capped at ₹250"],
        rationale: `BOB Eterna's monthly BOGO is a District-app benefit (not BookMyShow). Book the same show on District to get the 2nd ticket free (up to ₹250) — about ${inr(savings)} off${welcomeInr > 0 ? `, and it also drives your ₹50K welcome (+${inr(welcomeInr)})` : ""}.`,
        steps: [
          "Open the District app (NOT BookMyShow) — the BOGO only works there",
          "Select 2 tickets for the same show",
          "Pay with BOB Eterna → 2nd ticket free, up to ₹250",
        ],
      });
    }
    // Amazon Pay partner route — BookMyShow is an Amazon Pay partner (2% via Amazon Pay)
    add({
      cardId: "amazon_pay_icici",
      label: "Pay via Amazon Pay (BookMyShow is an Amazon Pay partner) — 2%",
      effectivePct: 2.0,
      pros: ["2% cashback (Amazon Pay balance) if you pay via Amazon Pay 'Login & Pay'", "Cashback is liquid"],
      cons: ["Works where the platform accepts Amazon Pay (BookMyShow yes; District — verify)"],
      rationale: "BookMyShow is an Amazon Pay partner merchant — paying via Amazon Pay with the ICICI card earns 2% (liquid cashback).",
      steps: ["At checkout choose Amazon Pay", "Pay with Amazon Pay ICICI", "2% back as Amazon Pay balance"],
    });
    // Additional tickets / when BOGO is used up: Cashkaro → BookMyShow → Amex Gold
    add({
      cardId: "amex_gold",
      label: bogoAvailable ? "Extra tickets: Cashkaro → BookMyShow → Amex Gold" : "BOGO used this month — Cashkaro → BookMyShow → Amex Gold",
      effectivePct: 1.0 + (ck ? ck.mid * 0.85 : 0),
      worstCasePct: 1.0,
      bestCasePct: 1.0 + (ck ? ck.max : 0),
      cashkaroSuggested: !!ck && ck.zone !== "na",
      pros: ["Cashkaro on BookMyShow (5–10%) + Amex Gold 1%"],
      cons: ["Use only after the monthly BOB BOGO is exhausted"],
      rationale: "For tickets beyond the monthly BOGO, stack Cashkaro on BookMyShow and pay with Amex Gold.",
      steps: ["Open Cashkaro → BookMyShow", "Book tickets", "Pay with Amex Gold"],
    });
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

  // Amex PT for large spends (milestone push)
  if (amt >= 5000) {
    const ptClose = (input.ptccEligibleSpend ?? 0) > 350000;
    add({ cardId: "amex_plat_travel", label: ptClose ? "Amex PT (near ₹4L milestone!)" : "Amex PT (1% + milestone)",
      effectivePct: 1.0, baseRewardInr: amt * 0.01, bonusRewardInr: ptClose ? amt * 0.04 : 0,
      worstCasePct: 1.0, bestCasePct: 7.0,
      pros: ["Builds ₹4L (10K MR) and ₹7L (22.5K MR + Taj voucher) milestones"],
      cons: ["Excludes fuel/insurance/utilities/cash/EMI"],
      rationale: ptClose ? "Near the ₹4L milestone — pushing here triggers the 10K MR bonus." : "Default workhorse for large spends building PT milestones.",
      steps: [`Pay ${inr(amt)} with Amex PT`, "Builds annual milestone"] });
  }

  // Amex MRCC milestone filler
  const mrccBonus = mrccMilestoneBonus(input, amt);
  if (mrccBonus) {
    add({ cardId: "amex_mrcc", label: "Amex MRCC (fills monthly milestone)",
      effectivePct: 0.78 + (mrccBonus.inr / amt) * 100, baseRewardInr: amt * 0.0078, bonusRewardInr: mrccBonus.inr,
      pros: [mrccBonus.note], cons: ["Excludes fuel/insurance/utilities"],
      rationale: "MRCC monthly milestone marginal value.",
      steps: [`Pay with Amex MRCC`, "Fills monthly milestone"] });
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
      case "swiggy_blck":
        return { pct: 0, label: "HDFC BLCK (abroad)", reason: "Forex excluded from BLCK cashback; 3.5% markup." };
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
    case "sbi_simplyclick":
      return { pct: ch === "offline_pos" ? 0.25 : 1.25, label: "SBI SimplyCLICK", reason: `10× applies only to partner brands (Myntra, BookMyShow, Cleartrip, Yatra, Apollo, Netmeds, Dominos, Tata CLiQ). Not this merchant → ${ch === "offline_pos" ? "0.25% offline" : "1.25% other-online"} only.` };
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
    case "swiggy_blck":
      return { pct: 1.0, label: "HDFC Swiggy BLCK", reason: "10% on Swiggy, 5% on select online (Amazon/Flipkart/Myntra/Ajio/Nykaa) + Cleartrip coupon stack. Not applicable here → 1% base." };
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
  if (!isForeign && !options.some((o) => o.cardId === "yes_kiwi")) {
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
  const gcDeals = findGiftCardDeals(input.merchant || "", input.category || "", input.giftCardRateOverrides || {});
  // Generic fallback: most online-retail brands have a CRED/CheQ gift card even if not in our table.
  if (gcDeals.length === 0 && !isForeign) {
    const shopText = `${input.category || ""} ${input.merchant || ""}`.toLowerCase();
    const isShopping = /online|fashion|electronics|shopping|apparel|clothing|footwear|shoes|lenskart|boat|mamaearth|meesho|decathlon|nike|adidas|puma|grocery|groceries|pharmac/.test(shopText);
    if (isShopping) {
      const merchLabel = input.merchant?.trim() || "this store";
      options.push(mkOption(amt, {
        cardId: "giftcard",
        label: `CRED / CheQ gift card (if available) → ${merchLabel}`,
        effectivePct: 2.5,
        worstCasePct: 0,
        bestCasePct: 5,
        pros: ["Many online brands have a 2–5% discounted gift card on CRED / CheQ", "Can boost with CRED coins / CheQ chips on select drops", "Stack with Cashkaro on top"],
        cons: [`Verify in the CRED/CheQ app whether a ${merchLabel} gift card exists and its live %`, "If none exists, fall back to the best card route above"],
        rationale: `Most online retailers have a discounted gift card on CRED or CheQ (~2–5%). Check the app — if a ${merchLabel} card exists, buy it, then shop via Cashkaro and pay with the gift card to stack discount + cashback.`,
        steps: [
          `Open CRED → Store (or CheQ → Gift cards) and search "${merchLabel}"`,
          "If a gift card exists, buy it (apply coins/chips to boost the discount)",
          `Open Cashkaro → click through to ${merchLabel}`,
          "Add items, pay with the gift-card balance, screenshot the order",
        ],
      }));
    }
  }
  for (const d of gcDeals) {
    const ckBonus = ck && ck.zone === "reliable" ? ck.mid * 0.85 : 0;
    const eff = d.discountPct + ckBonus;
    options.push(mkOption(amt, {
      cardId: "giftcard",
      label: `${d.store} gift card (~${d.discountPct}% off) → ${ckBonus > 0 ? "Cashkaro → " : ""}${d.merchantLabel}`,
      effectivePct: eff,
      cashkaroSuggested: ckBonus > 0,
      worstCasePct: d.discountPct,
      bestCasePct: eff + (ckBonus > 0 ? (ck!.max - ck!.mid) * 0.85 : 0),
      pros: [
        `${d.discountPct}% off face value via ${d.store} gift card`,
        ckBonus > 0 ? `+ ~${ck!.mid}% Cashkaro at ${d.merchantLabel}` : "",
        d.coinFunded ? "Can boost using CRED coins / CheQ chips on select drops" : "",
      ],
      cons: [
        "Gift-card rates are app-dynamic — verify the live rate in CRED/CheQ before buying",
        "Pay for the gift card via UPI or a card that rewards GC purchases for a little extra",
      ],
      rationale: `Buy a ${d.merchantLabel} gift card at ~${d.discountPct}% off on ${d.store}${ckBonus > 0 ? `, click through Cashkaro (~${ck!.mid}%)` : ""}, then pay at ${d.merchantLabel} with the gift-card balance. This stacks the gift-card discount with cashback.`,
      steps: [
        `Open ${d.store} → buy a ${d.merchantLabel} gift card (~${d.discountPct}% off${d.coinFunded ? "; apply coins/chips to boost" : ""})`,
        ckBonus > 0 ? `Open Cashkaro → click through to ${d.merchantLabel}` : `Go to ${d.merchantLabel}`,
        "Add items, pay using the gift-card balance",
        ckBonus > 0 ? "Screenshot the order for Cashkaro tracking" : "Keep the receipt",
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
    if (mB && mB.inr > 0 && !options.some((o) => o.cardId === "amex_mrcc" && /milestone/i.test(o.label))) {
      options.push(mkOption(amt, {
        cardId: "amex_mrcc",
        label: "Amex MRCC (fills monthly milestone)",
        effectivePct: 0.78 + (mB.inr / amt) * 100,
        baseRewardInr: amt * 0.0078,
        bonusRewardInr: mB.inr,
        pros: [mB.note],
        cons: [],
        rationale: `Routing this to Amex MRCC — ${mB.note}`,
        steps: ["Pay with Amex MRCC", "Fills the monthly milestone (4×₹1.5K + ₹20K)"],
      }));
    }
  }

  // ---- Universal ANNUAL-milestone push (SBI ₹1L/₹2L, IDFC BluChip tiers, Amex PT ₹4L/₹7L) ----
  // Surfaces the marginal value of pushing a spend toward a card's next annual milestone —
  // huge when you're close enough to COMPLETE it (e.g. SBI near ₹1L → ₹2,499 voucher).
  if (!isForeign) {
    for (const cardId of ["sbi_simplyclick", "idfc_indigo", "amex_plat_travel"]) {
      if (cardId === "amex_plat_travel" && amexExcluded(input.category || "")) continue;
      // Skip if this card already has a milestone/bonus option (monthly/welcome takes precedence).
      if (options.some((o) => o.cardId === cardId && o.bonusRewardInr > 0)) continue;
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
  const active = ["amex_gold", "amex_plat_travel", "amex_mrcc", "scapia", "idfc_indigo", "bob_eterna", "yes_kiwi", "sbi_simplyclick"];
  if (input.amazonPayIciciIssued !== false) active.push("amazon_pay_icici");
  if (input.swiggyBlckIssued) active.push("swiggy_blck");

  for (const id of active) {
    if (present.has(id)) continue;
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

  // Tag each option with liquidity + a redemption range, then rank by a LIQUIDITY-WEIGHTED
  // score so travel-locked coins (Scapia/BluChips) don't out-rank equal-nominal liquid cash.
  const LIQ_WEIGHT: Record<string, number> = { cash: 1.0, flexible: 0.9, locked: 0.7 };
  for (const o of options) {
    o.liquidity = liquidityOf(o.cardId, o.label);
    const rng = pointsRange(o.cardId, o.label, o.totalRewardInr, o.effectivePct, amt);
    if (rng) o.redemptionRange = { worstPct: rng.worstPct, bestPct: rng.bestPct };
  }
  const score = (o: RouteOption) => o.totalRewardInr * (LIQ_WEIGHT[o.liquidity ?? "cash"] ?? 1);
  const ranked = [...options].sort((a, b) => {
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
