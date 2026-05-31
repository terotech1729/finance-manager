import type { AppState } from "./storage";

/**
 * Apply a real card spend to the milestone/cycle counters for that card.
 * Shared by the manual transaction logger and the bill-reconciliation tool.
 * UPI / cash / gift-card / "other" are independent and pass through with no effect.
 */
export function applyCardSpend(next: AppState, cardId: string, amt: number, rewardInr: number): void {
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
  if (cardId === "swiggy_blck") next.blckYtdSpend += amt;
  if (cardId === "scapia") next.scapiaMonthlySpend += amt;
  if (cardId === "amex_gold" && amt >= 1000) next.goldThisMonthTxnsAt1k = Math.min(6, next.goldThisMonthTxnsAt1k + 1);
  if (cardId === "yes_kiwi") {
    next.kiwiNeonCycleSpend += amt;
    next.kiwiCashback += rewardInr / 0.25;
    next.kiwiLifetimeEarned += rewardInr;
  }
}
