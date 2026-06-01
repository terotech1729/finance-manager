import type { InvestmentType, PaymentMethod } from "./types";

export const INVESTMENT_TYPES: { v: InvestmentType; l: string; icon: string }[] = [
  { v: "stocks", l: "Stocks (direct)", icon: "📈" },
  { v: "smallcase", l: "Smallcase", icon: "📊" },
  { v: "mutual_fund", l: "Mutual Fund", icon: "📑" },
  { v: "bonds", l: "Bonds / G-Sec", icon: "🏦" },
  { v: "crypto", l: "Crypto", icon: "₿" },
  { v: "fd", l: "Fixed Deposit", icon: "🔒" },
  { v: "rd", l: "Recurring Deposit", icon: "🔁" },
  { v: "gold", l: "Gold (digital / physical)", icon: "🪙" },
  { v: "real_estate", l: "Real Estate", icon: "🏠" },
  { v: "other", l: "Other", icon: "•" },
];

export const PAYMENT_METHODS: { v: PaymentMethod; l: string }[] = [
  { v: "upi", l: "UPI" },
  { v: "neft", l: "NEFT / Bank transfer" },
  { v: "net_banking", l: "Net banking" },
  { v: "card", l: "Card (rare for investments)" },
];

export function typeLabel(t: string): string {
  return INVESTMENT_TYPES.find((x) => x.v === t)?.l ?? t;
}

export function typeIcon(t: string): string {
  return INVESTMENT_TYPES.find((x) => x.v === t)?.icon ?? "•";
}
