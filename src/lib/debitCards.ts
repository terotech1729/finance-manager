/**
 * Debit products — separate from credit CARDS so net credit limit / recommend stay clean.
 */

export type DebitCard = {
  id: string;
  name: string;
  short: string;
  network: string;
  issuer: string;
  annualFee: number;
  status: "active" | "future";
  notes: string;
  /** Ongoing monthly cashback structure (points ≈ ₹1). */
  monthlyCashback: { rule: string; capInr: number }[];
  /** Time-bound / welcome campaigns (GyFTR etc.). */
  campaigns: {
    id: string;
    title: string;
    reward: string;
    how: string;
    claimUrl?: string;
    notes?: string;
  }[];
  perks: string[];
};

export const DEBIT_CARDS: readonly DebitCard[] = [
  {
    id: "hdfc_visa_platinum_debit",
    name: "HDFC Bank Visa Platinum Debit Card",
    short: "HDFC Platinum Debit",
    network: "Visa Platinum",
    issuer: "HDFC Bank",
    annualFee: 0, // LTF for this account (waived / lifetime free variant)
    status: "active",
    notes:
      "LTF for you. Debit on HDFC savings/salary. Cashback posts as points (≈₹1) in NetBanking/MobileBanking — separate from GyFTR campaign vouchers emailed after welcome/activation spends. No spend milestones exist on this card: the ₹10k/quarter lounge gate is the only threshold it has, and everything else is a flat capped rate.",
    monthlyCashback: [
      { rule: "1 pt / ₹100 on telecom & utilities (POS/ecom/contactless)", capInr: 750 },
      { rule: "1 pt / ₹200 on groceries, restaurants, apparel, entertainment", capInr: 750 },
      { rule: "5% Swiggy (up to 150 pts/mo)", capInr: 150 },
      { rule: "25% BookMyShow (up to 250 pts/mo)", capInr: 250 },
      { rule: "5 pts on intl spends ≥₹200 (up to 350 pts/mo)", capInr: 350 },
      { rule: "Shared account-level monthly cashback cap ≈ ₹750 pts across cards on the account", capInr: 750 },
      {
        // Confirmed by HDFC's own customer email and by the MCC 4814 → 6012 reclassification
        // in March 2026. Worth carrying as an explicit zero rather than an omission, because
        // the SmartPay + debit-card route was a well-known 1% trick and still reads as live
        // in most blog write-ups.
        rule: "Credit-card bill payments: ZERO — tagged MCC 6012 since Mar 2026, and excluded from the lounge gate too",
        capInr: 0,
      },
    ],
    campaigns: [
      {
        id: "dc_new_account_gyftr_750",
        title: "New account / new debit — GyFTR voucher",
        reward: "₹500 GyFTR (3× ≥₹500 txns) OR ₹750 GyFTR (5× ≥₹500 txns)",
        how: "POS / online / contactless only in account-opening month + next calendar month. ATM & UPI do NOT count. Voucher emailed/SMS’d (often via GyFTR) within ~90 days after the offer window ends.",
        claimUrl: "https://www.gyftr.com/rewards/hdfcbank-dc-campaigns/",
        notes:
          "This is the usual source of a ₹750 GyFTR credit in mail — not the monthly cashback-points pool. Claim with the promo code from the email before it expires.",
      },
      {
        id: "dc_milestone_amazon_legacy",
        title: "Issuance milestone (runs rotate)",
        reward: "Often Amazon / brand voucher (e.g. ₹1,000 @ ₹30k/90d on Platinum — confirm live T&Cs)",
        how: "POS + ecom within first ~90 days of issuance when the campaign is live for your sourcing period.",
        notes: "Promotional — not always on; check the email / SmartBuy debit offers for your cohort.",
      },
    ],
    perks: [
      "2 domestic lounge visits per calendar quarter (8/yr) — needs ₹10,000 qualifying spend in that quarter, and the voucher code claimed from the SMS/email link",
      "Up to ₹15L personal accident death cover, ₹3Cr international air accident cover, ₹2L fire & burglary, ₹2L travel insurance",
      "Higher daily shopping (~₹5L) & ATM (~₹1L) limits vs Classic (confirm on your plastic)",
      "Visa network offers (golf / lifestyle — see visa.co.in)",
      "PayZapp / SmartBuy promotional cashback windows (rotate)",
      "No-cost EMI on select merchants (electronics etc.) when offered",
      "Cash at POS up to small daily/monthly caps",
      "Fuel surcharge waiver often applies on select variants — verify MITC",
    ],
  },
];

export function getDebitCardById(id: string): DebitCard | undefined {
  return DEBIT_CARDS.find((c) => c.id === id);
}
