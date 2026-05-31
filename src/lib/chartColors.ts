export const CARD_COLORS: Record<string, string> = {
  amex_gold: "#d4a017",
  amex_plat_travel: "#94a3b8",
  amex_mrcc: "#4f46e5",
  scapia: "#0ea5e9",
  idfc_indigo: "#6366f1",
  bob_eterna: "#f59e0b",
  yes_kiwi: "#84cc16",
  sbi_simplyclick: "#a855f7",
  swiggy_blck: "#f97316",
  amazon_pay_icici: "#fb923c",
  giftcard: "#22d3ee",
  upi: "#64748b",
  cash: "#475569",
};

export const CHART_PALETTE = [
  "#4f46e5", "#0ea5e9", "#84cc16", "#f59e0b", "#a855f7",
  "#fb923c", "#22d3ee", "#ef4444", "#14b8a6", "#eab308",
];

export function colorFor(key: string, i = 0): string {
  return CARD_COLORS[key] ?? CHART_PALETTE[i % CHART_PALETTE.length];
}
