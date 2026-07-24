import type { AppState } from "./storage";

/**
 * Apply a real card spend to the milestone/cycle counters for that card.
 * Shared by the manual transaction logger and the bill-reconciliation tool.
 * UPI / cash / gift-card / "other" are independent and pass through with no effect.
 */
export function applyCardSpend(next: AppState, cardId: string, amt: number, rewardInr: number, effectivePct?: number): void {
  if (cardId === "amex_plat_travel") next.ptccEligibleSpend += amt;
  if (cardId === "amex_mrcc") {
    next.mrccCycleSpend += amt;
    next.mrccThisCycleAmount += amt;
    if (amt >= 1500) next.mrccThisCycleTxnsAt1500 = Math.min(4, next.mrccThisCycleTxnsAt1500 + 1);
  }
  if (cardId === "bob_eterna") {
    next.bobYtdSpend += amt;
    if (next.bobYtdSpend >= 50000) next.bobWelcomeUnlocked = true;
  }
  if (cardId === "sbi_simplyclick") next.sbiYtdSpend += amt;
  if (cardId === "idfc_indigo") next.idfcYtdSpend += amt;
  if (cardId === "hsbc_live_plus") {
    next.hsbcLivePlusYtdSpend += amt;
    if ((effectivePct ?? 0) >= 9 || rewardInr >= amt * 0.09) {
      next.livePlusAccelCashbackUsedThisMonth += Math.min(rewardInr || amt * 0.1, amt * 0.1);
    }
    if (next.hsbcLivePlusYtdSpend >= 20000) next.hsbcWelcomeClaimed = next.hsbcWelcomeClaimed; // set manually after bank credits
  }
  if (cardId === "scapia") next.scapiaMonthlySpend += amt;
  if (cardId === "amex_gold" && amt >= 1000) next.goldThisMonthTxnsAt1k = Math.min(6, next.goldThisMonthTxnsAt1k + 1);
  if (cardId === "yes_kiwi") {
    next.kiwiNeonCycleSpend += amt;
    next.kiwiCashback += rewardInr / 0.25;
    next.kiwiLifetimeEarned += rewardInr;
  }
}

const clamp0 = (n: number) => (n < 0 ? 0 : n);

/**
 * Undo the milestone/cycle effect of a previously-applied card spend.
 * Used when a logged card transaction is edited or deleted so counters stay accurate.
 * Counters are clamped at 0 (the txn-count milestones can't perfectly invert across a
 * month reset, but clamping keeps them sane and never negative).
 */
export function reverseCardSpend(next: AppState, cardId: string, amt: number, rewardInr: number, effectivePct?: number): void {
  if (cardId === "amex_plat_travel") next.ptccEligibleSpend = clamp0(next.ptccEligibleSpend - amt);
  if (cardId === "amex_mrcc") {
    next.mrccCycleSpend = clamp0(next.mrccCycleSpend - amt);
    next.mrccThisCycleAmount = clamp0(next.mrccThisCycleAmount - amt);
    if (amt >= 1500) next.mrccThisCycleTxnsAt1500 = clamp0(next.mrccThisCycleTxnsAt1500 - 1);
  }
  if (cardId === "bob_eterna") {
    next.bobYtdSpend = clamp0(next.bobYtdSpend - amt);
    next.bobWelcomeUnlocked = next.bobYtdSpend >= 50000;
  }
  if (cardId === "sbi_simplyclick") next.sbiYtdSpend = clamp0(next.sbiYtdSpend - amt);
  if (cardId === "idfc_indigo") next.idfcYtdSpend = clamp0(next.idfcYtdSpend - amt);
  if (cardId === "hsbc_live_plus") {
    next.hsbcLivePlusYtdSpend = clamp0(next.hsbcLivePlusYtdSpend - amt);
    if ((effectivePct ?? 0) >= 9 || rewardInr >= amt * 0.09) {
      next.livePlusAccelCashbackUsedThisMonth = clamp0(
        next.livePlusAccelCashbackUsedThisMonth - Math.min(rewardInr || amt * 0.1, amt * 0.1)
      );
    }
  }
  if (cardId === "scapia") next.scapiaMonthlySpend = clamp0(next.scapiaMonthlySpend - amt);
  if (cardId === "amex_gold" && amt >= 1000) next.goldThisMonthTxnsAt1k = clamp0(next.goldThisMonthTxnsAt1k - 1);
  if (cardId === "yes_kiwi") {
    next.kiwiNeonCycleSpend = clamp0(next.kiwiNeonCycleSpend - amt);
    next.kiwiCashback = clamp0(next.kiwiCashback - rewardInr / 0.25);
    next.kiwiLifetimeEarned = clamp0(next.kiwiLifetimeEarned - rewardInr);
  }
}
