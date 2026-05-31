/**
 * Redemption value ranges per loyalty currency (₹ per unit), with how-to notes.
 * Points are worth different amounts depending on how you redeem them, so we track
 * worst / typical / best and surface a RANGE in the UI instead of a single number.
 *
 * Researched May 2026 — verify live transfer-partner sweet spots before big redemptions.
 */
export type Redemption = {
  currency: string;
  cardIds: string[];
  worst: number;   // ₹/unit — e.g. cash/statement credit
  typical: number; // ₹/unit — common good redemption
  best: number;    // ₹/unit — sweet-spot transfer / premium redemption
  how: { label: string; value: number; note: string }[];
};

export const REDEMPTIONS: Redemption[] = [
  {
    currency: "Amex Membership Rewards (MR)",
    cardIds: ["amex_gold", "amex_plat_travel", "amex_mrcc"],
    worst: 0.40, typical: 0.58, best: 1.00,
    how: [
      { label: "Statement credit / cash", value: 0.40, note: "Simplest, lowest value." },
      { label: "Taj / 24K Gold / Amazon vouchers", value: 0.58, note: "Common 'good' baseline (used in this app's default %)." },
      { label: "Marriott Bonvoy transfer", value: 0.70, note: "Hotel nights at good cents-per-point; varies by property." },
      { label: "Airline transfer (sweet spots)", value: 1.00, note: "Business-class redemptions on partner programs can exceed ₹1/MR — highly variable, requires award availability." },
    ],
  },
  {
    currency: "IndiGo BluChips",
    cardIds: ["idfc_indigo"],
    worst: 0.40, typical: 0.45, best: 0.60,
    how: [
      { label: "IndiGo flights (off-peak)", value: 0.40, note: "Lower-demand routes/dates." },
      { label: "IndiGo flights (typical)", value: 0.45, note: "Default used in this app." },
      { label: "IndiGo flights (peak / book early)", value: 0.60, note: "Higher base fares = more value per BluChip; one-way base fare + fuel only." },
    ],
  },
  {
    currency: "Scapia Coins",
    cardIds: ["scapia"],
    worst: 0.20, typical: 0.20, best: 0.20,
    how: [
      { label: "Scapia-app travel (flights/hotels/buses)", value: 0.20, note: "Fixed 5 coins = ₹1. Travel-locked, no cash option." },
    ],
  },
  {
    currency: "Kiwi cashback",
    cardIds: ["yes_kiwi"],
    worst: 0.25, typical: 0.25, best: 0.25,
    how: [
      { label: "Cashable to bank", value: 0.25, note: "Fixed 1 Kiwi = ₹0.25, cashable — no variability." },
    ],
  },
  {
    currency: "SBI Reward Points",
    cardIds: ["sbi_simplyclick"],
    worst: 0.15, typical: 0.20, best: 0.25,
    how: [
      { label: "Statement credit", value: 0.15, note: "Lowest." },
      { label: "SBI rewards catalogue / vouchers", value: 0.25, note: "Best on select vouchers." },
    ],
  },
  {
    currency: "BOB Reward Points",
    cardIds: ["bob_eterna"],
    worst: 0.20, typical: 0.25, best: 0.25,
    how: [
      { label: "Catalogue / vouchers", value: 0.20, note: "Some catalogue items redeem slightly lower." },
      { label: "Statement credit (cashback)", value: 0.25, note: "Standard 1 RP = ₹0.25." },
    ],
  },
  {
    currency: "Amazon Pay ICICI cashback",
    cardIds: ["amazon_pay_icici"],
    worst: 1.00, typical: 1.00, best: 1.00,
    how: [
      { label: "Amazon Pay balance", value: 1.00, note: "Cashback, not points — fixed ₹1 = ₹1, spendable on Amazon / bills / partner merchants. No range." },
    ],
  },
  {
    currency: "Swiggy HDFC BLCK cashback",
    cardIds: ["swiggy_blck"],
    worst: 1.00, typical: 1.00, best: 1.00,
    how: [
      { label: "BLCK cashback (statement)", value: 1.00, note: "Cashback, not points — fixed ₹1 = ₹1. No range. (Card not yet issued.)" },
    ],
  },
  {
    currency: "CRED Coins",
    cardIds: [],
    worst: 0.02, typical: 0.03, best: 1.00,
    how: [
      { label: "Everyday burn (products/offers)", value: 0.03, note: "Realistically ₹0.02–0.05/coin." },
      { label: "Rare 'Kill the Bill' / 1:1 voucher drops", value: 1.00, note: "Occasional, capped — grab when seen." },
    ],
  },
  {
    currency: "CheQ Chips",
    cardIds: [],
    worst: 0.0, typical: 0.10, best: 0.10,
    how: [
      { label: "CC bill credit (cap ~1000 chips/mo)", value: 0.10, note: "≈₹0.10/chip against your card bill. NOT cashable to bank per current T&Cs." },
    ],
  },
];

export function findRedemption(cardId: string): Redemption | undefined {
  return REDEMPTIONS.find((r) => r.cardIds.includes(cardId));
}
