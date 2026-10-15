/**
 * Per-card visual styling for the credit-card representation on the dashboard.
 * Each card has a brand-specific gradient, accent color, network logo, and chip.
 */

export type CardStyle = {
  /** Tailwind classes for the card background. Use gradients aligned to brand. */
  bgClass: string;
  /** Foreground text color over the card. */
  fgClass: string;
  /** Primary network type for logo display. */
  network: "amex" | "visa" | "mastercard" | "rupay" | "dual";
  /** Issuer wordmark style. */
  issuerLabel: string;
  /** Brand tagline shown subtly at top of card. */
  topLabel?: string;
  /** Pattern overlay class (subtle texture). */
  patternClass?: string;
  /** Override for the bottom-large card name (else falls back to topLabel/short). */
  bottomLabel?: string;
  /** For dual-network cards, the secondary network shown alongside primary. */
  secondaryNetwork?: "rupay" | "visa" | "mastercard" | "amex";
};

export const CARD_STYLES: Record<string, CardStyle> = {
  amex_gold: {
    bgClass: "bg-gradient-to-br from-amber-500 via-yellow-600 to-amber-800",
    fgClass: "text-white",
    network: "amex",
    issuerLabel: "AMERICAN EXPRESS",
    topLabel: "GOLD CHARGE",
    patternClass: "card-pattern-diagonal",
  },
  amex_plat_travel: {
    bgClass: "bg-gradient-to-br from-slate-300 via-slate-400 to-slate-600",
    fgClass: "text-slate-900",
    network: "amex",
    issuerLabel: "AMERICAN EXPRESS",
    topLabel: "PLATINUM TRAVEL",
    patternClass: "card-pattern-platinum",
  },
  amex_mrcc: {
    bgClass: "bg-gradient-to-br from-indigo-900 via-blue-800 to-indigo-700",
    fgClass: "text-blue-50",
    network: "amex",
    issuerLabel: "AMERICAN EXPRESS",
    topLabel: "MEMBERSHIP REWARDS",
  },
  scapia: {
    bgClass: "bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-700",
    fgClass: "text-white",
    network: "visa",
    issuerLabel: "FEDERAL BANK",
    topLabel: "SCAPIA",
    patternClass: "card-pattern-waves",
  },
  idfc_indigo: {
    bgClass: "bg-gradient-to-br from-indigo-900 via-indigo-700 to-blue-800",
    fgClass: "text-white",
    network: "mastercard",
    secondaryNetwork: "rupay",
    issuerLabel: "IDFC FIRST · INDIGO",
    topLabel: "INDIGO 6E",
    patternClass: "card-pattern-dots",
  },
  bob_eterna: {
    bgClass: "bg-gradient-to-br from-zinc-900 via-zinc-800 to-neutral-900",
    fgClass: "text-amber-100",
    network: "visa",
    issuerLabel: "BOBCARD",
    topLabel: "ETERNA",
    patternClass: "card-pattern-platinum",
  },
  yes_kiwi: {
    bgClass: "bg-gradient-to-br from-emerald-600 via-lime-600 to-green-700",
    fgClass: "text-white",
    network: "rupay",
    issuerLabel: "YES BANK",
    topLabel: "KIWI NEON",
    bottomLabel: "YES BANK · KIWI NEON",
  },
  sbi_simplyclick: {
    bgClass: "bg-gradient-to-br from-violet-700 via-purple-700 to-pink-700",
    fgClass: "text-white",
    network: "visa",
    issuerLabel: "SBI CARD",
    topLabel: "SIMPLY CLICK",
    patternClass: "card-pattern-dots",
  },
  swiggy_blck: {
    bgClass: "bg-gradient-to-br from-black via-zinc-900 to-zinc-800",
    fgClass: "text-orange-300",
    network: "mastercard",
    issuerLabel: "HDFC BANK · SWIGGY",
    topLabel: "BLCK",
    patternClass: "card-pattern-glow",
  },
  hsbc_live_plus: {
    bgClass: "bg-gradient-to-br from-red-800 via-rose-700 to-red-950",
    fgClass: "text-white",
    network: "visa",
    issuerLabel: "HSBC",
    topLabel: "LIVE+",
    patternClass: "card-pattern-platinum",
  },
  amazon_pay_icici: {
    bgClass: "bg-gradient-to-br from-orange-500 via-amber-600 to-slate-800",
    fgClass: "text-white",
    network: "visa",
    issuerLabel: "ICICI BANK · AMAZON PAY",
    topLabel: "AMAZON PAY",
  },
  hdfc_visa_platinum_debit: {
    bgClass: "bg-gradient-to-br from-blue-900 via-indigo-800 to-slate-900",
    fgClass: "text-white",
    network: "visa",
    issuerLabel: "HDFC BANK · DEBIT",
    topLabel: "PLATINUM",
    patternClass: "card-pattern-platinum",
  },
};

export function getCardStyle(id: string): CardStyle {
  return CARD_STYLES[id] ?? {
    bgClass: "bg-gradient-to-br from-slate-700 to-slate-900",
    fgClass: "text-white",
    network: "visa",
    issuerLabel: "CARD",
  };
}
