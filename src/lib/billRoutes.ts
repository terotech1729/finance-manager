/**
 * How to pay a credit-card bill and get something back for it.
 *
 * Written as data rather than prose because the honest answer is mostly negative, and a
 * list of dead ends is only useful if it says *why* each one died — otherwise it reads as
 * an untested guess and gets re-tried every few months.
 *
 * The governing fact: card networks tag credit-card bill payments as MCC 6012
 * (financial institutions). Almost every Indian rewards programme excludes 6012, so the
 * default return on paying a card bill is zero, and anything above zero is a promotion
 * the platform funds itself and can withdraw without notice. Treat every rate here as
 * perishable.
 *
 * Returns are quoted on a ₹1,00,000 bill, because the headline percentages are nearly
 * all capped at a trivial absolute amount and only look meaningful on small payments.
 */

export type RouteStatus = "works" | "marginal" | "dead" | "trap";

export type BillRoute = {
  id: string;
  name: string;
  status: RouteStatus;
  /** Realistic return on a ₹1,00,000 bill, in rupees. Null when it is a lottery. */
  per1LInr: number | null;
  rate: string;
  detail: string;
  /** Why it is rated as it is — the part that stops it being re-tried pointlessly. */
  verdict: string;
  url?: string;
};

export const BILL_ROUTES: readonly BillRoute[] = [
  {
    id: "cheq",
    name: "CheQ",
    status: "works",
    per1LInr: 250,
    rate: "1% in CheQ Chips, 100 Chips ≈ ₹25",
    detail:
      "The only route paying a predictable rate on every payment rather than a scratch card. The 1% is in Chips, and 100 Chips redeem for ₹25 of cash discount or brand vouchers, so the honest cash-equivalent is well under the headline 1%.",
    verdict:
      "Good fallback, and the best option for any bill you are not routing through SBI Unipay. Pays something every single time, which nothing else here does.",
    url: "https://cheq.one/",
  },
  {
    id: "cred",
    name: "CRED",
    status: "marginal",
    per1LInr: null,
    rate: "Coins, plus occasional campaign cashback",
    detail:
      "Direct cashback has been effectively dormant through 2026 — typical reports are ₹1–5 per payment outside promotions. The real residual value is the voucher shelf (BigBasket, Instamart and similar at ₹50–100 off low minimums) and the brand discounts unlocked above ₹50k.",
    verdict:
      "Worth keeping installed for the vouchers and the payment reminders, not for cashback. Do not route a bill here expecting a return.",
    url: "https://cred.club/credit-card-bill-payment-online",
  },
  {
    id: "mobikwik",
    name: "MobiKwik (flat-code offers)",
    status: "marginal",
    per1LInr: 101,
    rate: "Flat ₹101 at ₹1.5L, ₹151 at ₹2.5L, ₹200 at ₹5L",
    detail:
      "The flat SAVE-series codes are deterministic, unlike FULLPAY. Cashback lands in the MobiKwik wallet, not a bank account, so it is only worth face value if the wallet gets spent. 250CASH runs to five redemptions a month on a ₹10,000 minimum.",
    verdict:
      "Usable on a large bill where a flat code clears its minimum. Wallet-locked and small, so treat as a bonus rather than a reason to route.",
    url: "https://www.mobikwik.com/offers/rechargeandbills",
  },
  {
    id: "mobikwik_fullpay",
    name: "MobiKwik FULLPAY",
    status: "trap",
    per1LInr: null,
    rate: "Advertised 'up to ₹200' — a scratch card",
    detail:
      "Was a reliable 1%. Now a lottery: reported outcomes cluster at ₹10–20 on bills of ₹4,400–₹10,000, with the ₹200 going to a handful of users. Also capped to roughly four uses a month, and SuperCash on card bills was cut to about ₹5 once a month.",
    verdict:
      "The 'up to ₹200' headline is doing a lot of work. Expect ₹10–20. Use a flat SAVE code instead — same app, known outcome.",
  },
  {
    id: "payzapp",
    name: "HDFC PayZapp",
    status: "dead",
    per1LInr: 11,
    rate: "Flat 11 CashPoints on ₹5,000+, once per offer period",
    detail:
      "HDFC credit-card bill payments stopped earning CashPoints in August 2026. Non-HDFC cards still get a flat ₹11 with the PZCCBILL coupon, but it is once per offer period and flat, so it is 0.22% at exactly ₹5,000 and a rounding error above that.",
    verdict:
      "Pointless for HDFC cards, which is most of the reason anyone opened the app. ₹11 once a month is not worth the extra step.",
    url: "https://v.hdfcbank.com/payzapp/payment-offers.html",
  },
  {
    id: "hdfc_debit_smartpay",
    name: "HDFC debit card via SmartPay / BillPay",
    status: "dead",
    per1LInr: 0,
    rate: "Zero since March 2026",
    detail:
      "This was a genuine 1% within the ₹750 monthly cap, and it is the route most blog articles still recommend. HDFC reclassified the transaction from MCC 4814 to 6012 in March 2026 and emailed customers that credit-card bill payments via debit cards no longer earn CashBack Points. No published term changed — only the MCC routing.",
    verdict:
      "Closed. Worse than neutral: these payments are also excluded from the ₹10,000 quarterly lounge gate, so routing a bill through the debit card builds nothing at all.",
    url: "https://www.cardforum.in/hdfc-bank-no-cashback-on-credit-card-bill-payments-via-debit-cards/",
  },
  {
    id: "debit_lounge_gate",
    name: "Card bills to farm the debit lounge gate",
    status: "trap",
    per1LInr: 0,
    rate: "Counts for nothing",
    detail:
      "A popular suggestion is to pay card bills on the HDFC debit card to clear ₹10,000 a quarter and unlock the lounge vouchers. HDFC's own lounge terms exclude credit-card bill payments and MCC 6010, 6011, 6012, 6211 and 7995 from the spend criteria, and users who tried it had the claim declined by support.",
    verdict:
      "Does not work and never did. Clear the ₹10,000 with telecom and utility spend instead, which also earns 1%.",
    url: "https://www.hdfc.bank.in/debit-cards/services/airport-lounge-access-on-debit-cards",
  },
  {
    id: "upi_bill",
    name: "UPI / PhonePe / Google Pay / Paytm",
    status: "dead",
    per1LInr: null,
    rate: "Scratch cards, typically ₹0–10",
    detail:
      "Bill payment over UPI is free and instant but carries no systematic reward. Paytm and PhonePe hand out scratch cards averaging a few rupees; the large advertised figures are new-user-only and once per lifetime.",
    verdict: "Use for convenience and speed. Do not count on a return.",
  },
  {
    id: "sbi_unipay",
    name: "SBI Unipay with your SBI debit card",
    status: "works",
    per1LInr: 250,
    rate: "0.25% guaranteed, 0.50% if the ₹1L bonus is monthly",
    detail:
      "2 SBI Reward Points per ₹200 of PoS and e-commerce spend at ₹0.25 a point, so 0.25% is the floor. Accrual is capped at 1,000 RP per transaction, which lands at exactly ₹1,00,000 — split anything larger or the excess earns nothing. Monthly ceiling is 10,000 RP (₹2,500), reached around ₹10L. A further 1,000-point bonus applies at ₹1 lakh, but SBI's product pages say per month while its rewards FAQ reads as per financial year. Points last 24 months, locked 30 days after posting, 2× in your birthday month.",
    verdict:
      "Your best route now the account exists, and the only one with no monthly cap worth worrying about. Both your Visa and Mastercard variants work — only non-SBI debit cards were removed. Keep every payment at or under ₹1,00,000.",
    url: "https://sbi.bank.in/web/personal-banking/cards/debit-card/sbi-rewardz",
  },
  {
    id: "sbi_elsewhere",
    name: "SBI debit card on MobiKwik / third-party apps",
    status: "trap",
    per1LInr: 0,
    rate: "Often zero despite the card being eligible",
    detail:
      "The reward depends on how the platform tags the transaction, not on the card. Users paying with an SBI debit card through MobiKwik report the merchant resolving to 'Mobikwik' and no points accruing at all. MCC 6540 (wallet load) is explicitly excluded from the milestone bonus.",
    verdict:
      "Use SBI's own Unipay portal, not a third-party app, when paying with the SBI debit card. Same card, same bill, but the points only reliably post on Unipay.",
  },
];

export const SBI_RP_VALUE_INR = 0.25;
export const SBI_RP_MILESTONE_INR = 100000;
export const SBI_RP_MILESTONE_POINTS = 1000;

/**
 * SBI caps accrual at 1,000 Reward Points PER TRANSACTION, and base earn is 2 RP per
 * ₹200 — so the cap is reached at exactly ₹1,00,000 in one payment and every rupee above
 * that in the same transaction earns nothing.
 *
 * This is the single most important number here and the easiest to lose money to: a
 * ₹2,00,000 bill paid in one go earns ₹250, while the same bill paid as two payments of
 * ₹1,00,000 earns ₹500.
 */
export const SBI_RP_PER_TXN_CAP_POINTS = 1000;
export const SBI_RP_OPTIMAL_TXN_INR = 100000;

/** Ceiling across a calendar month, per customer ID, inclusive of birthday bonus. */
export const SBI_RP_MONTHLY_CAP_POINTS = 10000;

/**
 * Rupee value of SBI Rewardz from routing `spendInr` through Unipay in one month,
 * split into payments of `perTxnInr` each.
 *
 * `includeMilestone` is deliberately a parameter rather than an assumption. SBI's own
 * product pages for Rewardz and the Virtual Debit Card both say the 1,000-point bonus is
 * for ₹1 lakh "in a month", while the detailed rewards FAQ is read by the card forums as
 * ₹1 lakh per financial year. Those give materially different answers and cannot both be
 * right, so the caller decides and the UI shows the range until a real statement settles
 * it.
 */
export function sbiUnipayReturnInr(
  spendInr: number,
  perTxnInr = SBI_RP_OPTIMAL_TXN_INR,
  includeMilestone = true
): number {
  if (spendInr <= 0 || perTxnInr <= 0) return 0;

  const whole = Math.floor(spendInr / perTxnInr);
  const remainder = spendInr - whole * perTxnInr;
  const pointsFor = (amt: number) => Math.min(SBI_RP_PER_TXN_CAP_POINTS, Math.floor(amt / 200) * 2);

  let points = whole * pointsFor(perTxnInr) + pointsFor(remainder);
  if (includeMilestone && spendInr >= SBI_RP_MILESTONE_INR) points += SBI_RP_MILESTONE_POINTS;

  return Math.min(SBI_RP_MONTHLY_CAP_POINTS, points) * SBI_RP_VALUE_INR;
}

/** Routes worth actually using, best first. */
export function liveRoutes(): BillRoute[] {
  return BILL_ROUTES.filter((r) => r.status === "works" || r.status === "marginal").sort(
    (a, b) => (b.per1LInr ?? 0) - (a.per1LInr ?? 0)
  );
}

/** Routes that are closed or actively misleading — kept so they aren't re-tried. */
export function deadRoutes(): BillRoute[] {
  return BILL_ROUTES.filter((r) => r.status === "dead" || r.status === "trap");
}
