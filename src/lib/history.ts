/**
 * Historical monthly statement spend per card (₹), from the bills you provided.
 * Used by the Spend Analyzer for trend charts before/alongside live logged transactions.
 * Months are calendar months 2026-01 … 2026-05.
 */
export type MonthlySpend = { month: string; byCard: Record<string, number> };

export const HISTORICAL_SPEND: MonthlySpend[] = [
  { month: "2026-01", byCard: { amex_gold: 6778, amex_mrcc: 7774, amex_plat_travel: 12631, sbi_simplyclick: 0, yes_kiwi: 15771, scapia: 44012, idfc_indigo: 52516, bob_eterna: 0 } },
  { month: "2026-02", byCard: { amex_gold: 6360, amex_mrcc: 2221, amex_plat_travel: 108317, sbi_simplyclick: 1852, yes_kiwi: 5880, scapia: 28102, idfc_indigo: 91417, bob_eterna: 0 } },
  { month: "2026-03", byCard: { amex_gold: 0, amex_mrcc: 8677, amex_plat_travel: 31689, sbi_simplyclick: 75903, yes_kiwi: 0, scapia: 54345, idfc_indigo: 131558, bob_eterna: 0 } },
  { month: "2026-04", byCard: { amex_gold: 0, amex_mrcc: 10124, amex_plat_travel: 25068, sbi_simplyclick: 4775, yes_kiwi: 1179, scapia: 17009, idfc_indigo: 212845, bob_eterna: 0 } },
  { month: "2026-05", byCard: { amex_gold: 6106, amex_mrcc: 9633, amex_plat_travel: 0, sbi_simplyclick: 9084, yes_kiwi: 11849, scapia: 44009, idfc_indigo: 20587, bob_eterna: 0 } },
  { month: "2026-06", byCard: { amex_gold: 0, amex_mrcc: 0, amex_plat_travel: 0, sbi_simplyclick: 0, yes_kiwi: 0, scapia: 0, idfc_indigo: 0, bob_eterna: 0 } },
  { month: "2026-07", byCard: { amex_gold: 0, amex_mrcc: 24459, amex_plat_travel: 0, sbi_simplyclick: 0, yes_kiwi: 0, scapia: 0, idfc_indigo: 0, bob_eterna: 0 } },
];

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}
