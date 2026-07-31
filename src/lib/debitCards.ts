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
      "LTF for you. Debit on HDFC savings/salary. Cashback posts as points (≈₹1) in NetBanking/MobileBanking — separate from GyFTR campaign vouchers emailed after welcome/activation spends.",
    monthlyCashback: [
      { rule: "1 pt / ₹100 on telecom & utilities (POS/ecom/contactless)", capInr: 750 },
      { rule: "1 pt / ₹200 on groceries, restaurants, apparel, entertainment", capInr: 750 },
      { rule: "5% Swiggy (up to 150 pts/mo)", capInr: 150 },
      { rule: "25% BookMyShow (up to 250 pts/mo)", capInr: 250 },
      { rule: "5 pts on intl spends ≥₹200 (up to 350 pts/mo)", capInr: 350 },
      { rule: "Shared account-level monthly cashback cap ≈ ₹750 pts across cards on the account", capInr: 750 },
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
