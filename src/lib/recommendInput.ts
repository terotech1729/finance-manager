/**
 * Single bridge: AppState (portal counters + benefit claims) → RecommendInput.
 * Recommend must never invent a parallel copy of spend / welcome / claim truth.
 */
import { isBenefitClaimed } from "./benefitClaims";
import { AMAZON_WELCOME_OFFERS } from "./stacking";
import { getLivePlusWelcomeSpend, loadTransactions, resolveScapiaCycleSpend, type AppState } from "./storage";
import type { RecommendInput } from "./recommend";
import type { ChannelType } from "./categorize";
import { todayLocal } from "./utils";

export type RecommendRequest = {
  merchant: string;
  category: string;
  amount: number;
  channel: ChannelType;
  isForeign?: boolean;
  today?: string;
  cashkaroPctOverride?: number;
  amazonOrderCashbackInr?: number;
  indigoBluChipVoucherInr?: number;
  credGiftCardPctOverride?: number;
  movieTheatre?: RecommendInput["movieTheatre"];
  bobBogoUsedThisMonth?: boolean;
  livePlusBogoUsedThisMonth?: boolean;
};

/** Resolve Amazon welcome coupons from legacy array + /claims checklist. */
export function resolvedAmazonWelcomeClaimed(st: AppState): string[] {
  const set = new Set(st.amazonWelcomeClaimed ?? []);
  for (const o of AMAZON_WELCOME_OFFERS) {
    if (isBenefitClaimed(o.id, st)) set.add(o.id);
  }
  return Array.from(set);
}

/**
 * Full RecommendInput from live portal state. Claim checklist overrides legacy
 * welcome booleans so ticking /claims immediately changes ranking.
 */
export function buildRecommendInputFromState(st: AppState, req: RecommendRequest): RecommendInput {
  const on = req.today || todayLocal();
  const txns = typeof window !== "undefined" ? loadTransactions() : [];
  return {
    merchant: req.merchant,
    category: req.category,
    amount: req.amount,
    channel: req.channel,
    isForeign: req.isForeign,
    today: req.today,

    ptccEligibleSpend: st.ptccEligibleSpend,
    mrccCycleSpend: st.mrccCycleSpend,
    bobYtdSpend: st.bobYtdSpend,
    bobCycleSpend5x: st.bobCycleSpend5x,
    sbiYtdSpend: st.sbiYtdSpend,
    sbiFeeWaiverSpend: st.sbiFeeWaiverSpend,
    idfcYtdSpend: st.idfcYtdSpend,
    hsbcLivePlusYtdSpend: st.hsbcLivePlusYtdSpend,
    livePlusAccelCashbackUsedThisMonth: st.livePlusAccelCashbackUsedThisMonth,
    goldThisMonthTxnsAt1k: st.goldThisMonthTxnsAt1k,
    mrccThisCycleTxnsAt1500: st.mrccThisCycleTxnsAt1500,
    mrccThisCycleAmount: st.mrccThisCycleAmount,
    goldShopwiseUsedThisMonth: st.goldShopwiseUsedThisMonth,
    swiggyMoneyBalance: st.swiggyMoneyBalance ?? 0,
    bobBogoUsedThisMonth: req.bobBogoUsedThisMonth ?? st.bobBogoUsedThisMonth,
    livePlusBogoUsedThisMonth: req.livePlusBogoUsedThisMonth ?? st.livePlusBogoUsedThisMonth,
    // Prefer logged Scapia spends in the 25→24 billing cycle over the settings counter.
    scapiaMonthlySpend: resolveScapiaCycleSpend(st, txns, on),
    kiwiNeonCycleSpend: st.kiwiNeonCycleSpend,

    amazonPayIciciIssued: st.amazonPayIciciIssued,
    primeMember: st.primeMember,
    amazonPayBalance: st.amazonPayBalance,
    amazonWelcomeClaimed: resolvedAmazonWelcomeClaimed(st),
    giftCardRateOverrides: st.giftCardRateOverrides,

    bobEternaIssueDate: st.bobEternaIssueDate,
    bobWelcomeUnlocked: isBenefitClaimed("bob_welcome_50k", st),
    hsbcLivePlusIssueDate: st.hsbcLivePlusIssueDate,
    hsbcWelcomeClaimed: isBenefitClaimed("hsbc_welcome_1k", st),
    // True 30-day welcome window from txn log (falls back to 0 if no issue date).
    hsbcLivePlusWelcomeSpend: getLivePlusWelcomeSpend(st),

    milestonesHit: st.milestonesHit ?? [],
    benefitClaims: st.benefitClaims ?? {},
    hdfcDebitWelcomeGyftrClaimed: isBenefitClaimed("hdfc_gyftr_received", st),
    gyftrBalance: st.gyftrBalance,
    gyftrVouchers: st.gyftrVouchers,
    /** true = enrolled confirmed; false = explicitly not enrolled on /claims; undefined = unknown. */
    mrcc20kEnrolled: (() => {
      const explicit = st.benefitClaims?.amex_mrcc_20k_enroll;
      if (typeof explicit === "boolean") return explicit;
      return undefined;
    })(),
    ptccLoungesUsed: st.ptccLoungesUsed,
    ptccLoungesUsedThisQuarter: st.ptccLoungesUsedThisQuarter,

    cashkaroPctOverride: req.cashkaroPctOverride,
    amazonOrderCashbackInr: req.amazonOrderCashbackInr,
    indigoBluChipVoucherInr: req.indigoBluChipVoucherInr,
    credGiftCardPctOverride: req.credGiftCardPctOverride,
    movieTheatre: req.movieTheatre,
  };
}
