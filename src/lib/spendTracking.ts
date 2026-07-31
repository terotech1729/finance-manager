import type { AppState } from "./storage";

/**
 * SBI SimplyCLICK annual-fee waiver: eligible retail only.
 * Typically excludes fuel, rent, tax/govt, wallets/GCs, EMI, insurance, cash advances.
 */
export function sbiFeeWaiverEligible(category = "", merchant = ""): boolean {
  const c = `${category} ${merchant}`.toLowerCase();
  if (/fuel|petrol|diesel|hpcl|bpcl|iocl|indian\s*oil/.test(c)) return false;
  if (/\brent\b|landlord|nobroker|redgirraffe/.test(c)) return false;
  if (/\btax\b|govt|government|income\s*tax|gst\s*payment|municipality|property\s*tax/.test(c)) return false;
  if (/wallet|gift\s*card|gyftr|smartbuy\s*gc/.test(c)) return false;
  if (/\bemi\b|loan\s*repay|balance\s*transfer|cash\s*advance/.test(c)) return false;
  if (/insurance|policybazaar|\blic\b/.test(c)) return false;
  return true;
}

/**
 * Apply a real card spend to the milestone/cycle counters for that card.
 * Shared by the manual transaction logger and the bill-reconciliation tool.
 * UPI / cash / gift-card / "other" are independent and pass through with no effect.
 */
export function applyCardSpend(
  next: AppState,
  cardId: string,
  amt: number,
  rewardInr: number,
  effectivePct?: number,
  category?: string,
  merchant?: string
): void {
  if (cardId === "amex_plat_travel") next.ptccEligibleSpend += amt;
  if (cardId === "amex_mrcc") {
    next.mrccCycleSpend += amt;
    next.mrccThisCycleAmount += amt;
    if (amt >= 1500) next.mrccThisCycleTxnsAt1500 = Math.min(4, next.mrccThisCycleTxnsAt1500 + 1);
  }
  if (cardId === "bob_eterna") {
    next.bobYtdSpend += amt;
    next.bobCycleSpend5x += amt;
    if (next.bobYtdSpend >= 50000) next.bobWelcomeUnlocked = true;
  }
  if (cardId === "sbi_simplyclick") {
    next.sbiYtdSpend += amt;
    if (sbiFeeWaiverEligible(category, merchant)) next.sbiFeeWaiverSpend += amt;
  }
  if (cardId === "idfc_indigo") next.idfcYtdSpend += amt;
  if (cardId === "hsbc_live_plus") {
    next.hsbcLivePlusYtdSpend += amt;
    if ((effectivePct ?? 0) >= 9 || rewardInr >= amt * 0.09) {
      next.livePlusAccelCashbackUsedThisMonth += Math.min(rewardInr || amt * 0.1, amt * 0.1);
    }
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
 */
export function reverseCardSpend(
  next: AppState,
  cardId: string,
  amt: number,
  rewardInr: number,
  effectivePct?: number,
  category?: string,
  merchant?: string
): void {
  if (cardId === "amex_plat_travel") next.ptccEligibleSpend = clamp0(next.ptccEligibleSpend - amt);
  if (cardId === "amex_mrcc") {
    next.mrccCycleSpend = clamp0(next.mrccCycleSpend - amt);
    next.mrccThisCycleAmount = clamp0(next.mrccThisCycleAmount - amt);
    if (amt >= 1500) next.mrccThisCycleTxnsAt1500 = clamp0(next.mrccThisCycleTxnsAt1500 - 1);
  }
  if (cardId === "bob_eterna") {
    next.bobYtdSpend = clamp0(next.bobYtdSpend - amt);
    next.bobCycleSpend5x = clamp0(next.bobCycleSpend5x - amt);
    next.bobWelcomeUnlocked = next.bobYtdSpend >= 50000;
  }
  if (cardId === "sbi_simplyclick") {
    next.sbiYtdSpend = clamp0(next.sbiYtdSpend - amt);
    if (sbiFeeWaiverEligible(category, merchant)) {
      next.sbiFeeWaiverSpend = clamp0(next.sbiFeeWaiverSpend - amt);
    }
  }
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
