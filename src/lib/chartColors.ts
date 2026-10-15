/**
 * Chart colours, tuned for the HUD palette.
 *
 * Series sit on a deep-navy ground, so these are pulled toward the cyan/teal/gold end
 * where they stay legible and read as part of the same instrument. Each card keeps a
 * recognisable hue (Amex gold, BOB amber, HSBC magenta) so a series is identifiable
 * across pages without a legend lookup.
 */
export const CARD_COLORS: Record<string, string> = {
  amex_gold: "#FFB454",
  amex_plat_travel: "#8FA6BD",
  amex_mrcc: "#6E8BFF",
  scapia: "#00CFFF",
  idfc_indigo: "#8B7BFF",
  bob_eterna: "#FFC978",
  yes_kiwi: "#7BE86B",
  sbi_simplyclick: "#C47BFF",
  swiggy_blck: "#FF9A4D",
  amazon_pay_icici: "#FFAE6B",
  hsbc_live_plus: "#FF5FA8",
  axis_ace: "#9B6BFF",
  cheq_au: "#00E6A8",
  hdfc_diners_black_metal: "#C8D6E5",
  giftcard: "#00FFF7",
  upi: "#5E7893",
  cash: "#44586D",
};

export const CHART_PALETTE = [
  "#00CFFF", "#00FFF7", "#00E6A8", "#FFB454", "#C47BFF",
  "#FF5FA8", "#6E8BFF", "#FF3C3C", "#7BE86B", "#FFC978",
];

export function colorFor(key: string, i = 0): string {
  return CARD_COLORS[key] ?? CHART_PALETTE[i % CHART_PALETTE.length];
}
