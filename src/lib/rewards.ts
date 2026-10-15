/**
 * The reward ledger — one place that turns raw point balances into rupees.
 *
 * This valuation used to live inline on the home page, which made the headline figure
 * impossible to audit and silently mixed two very different things: points with a
 * published conversion rate, and app currencies whose "value" is a guess. Each balance
 * now carries its own confidence and liquidity, and the headline total deliberately
 * excludes speculative balances so the number on the dashboard is one you'd actually
 * bet on.
 */
import type { AppState } from "./storage";
import { getCardById } from "./cards";

/**
 * How much to trust the rupee figure.
 *  - firm:        published, fixed conversion (5 Scapia coins = ₹1).
 *  - soft:        real but variable — depends on the redemption you pick.
 *  - speculative: no published rate; the number is an assumption, not a quote.
 */
export type RewardConfidence = "firm" | "soft" | "speculative";

/** What it takes to turn the balance into value. */
export type RewardLiquidity = "cash" | "voucher" | "travel" | "locked";

export type RewardBalanceRow = {
  key: keyof AppState & string;
  label: string;
  cardId?: string;
  units: number;
  unitName: string;
  unitValueInr: number;
  inrValue: number;
  confidence: RewardConfidence;
  liquidity: RewardLiquidity;
  /** Shown under the row — the redemption that justifies the rate. */
  redeemVia: string;
  /** Present only when something about the balance needs a caveat. */
  caveat?: string;
};

export type RewardLedger = {
  rows: RewardBalanceRow[];
  /** firm + soft only. The figure safe to show as "what your points are worth". */
  bankableInr: number;
  /** Speculative balances, surfaced separately rather than folded into the headline. */
  speculativeInr: number;
  /** Idle money already denominated in rupees (gift-card and wallet float). */
  idleCashInr: number;
  total: number;
};

/** Idle rupee balances — not points, but real money sitting unspent. */
function idleCash(state: AppState): { label: string; inr: number; note: string }[] {
  return [
    { label: "Amazon Pay balance", inr: state.amazonPayBalance ?? 0, note: "Spend on Amazon.in" },
    { label: "GyFTR balance", inr: state.gyftrBalance ?? 0, note: "HDFC debit voucher store" },
    { label: "Swiggy Money", inr: state.swiggyMoneyBalance ?? 0, note: "From Amex ShopWise coupons" },
  ].filter((r) => r.inr > 0);
}

export function buildRewardLedger(state: AppState): RewardLedger {
  const defs: Omit<RewardBalanceRow, "units" | "inrValue">[] = [
    {
      key: "amexMrPooled",
      label: "Amex Membership Rewards",
      cardId: "amex_mrcc",
      unitName: "MR",
      unitValueInr: 0.58,
      confidence: "soft",
      liquidity: "travel",
      redeemVia: "Airline/hotel transfer, or Gold Collection vouchers",
      caveat:
        "Amex ends MR pooling on 15 Nov 2026 — Gold and MRCC will hold separate balances with no transfer between them, so pool-dependent redemptions must be done before that date. Reward Multiplier closed on 30 Sep 2026. Statement credit is worth far less than transfers.",
    },
    {
      key: "indigoBluChips",
      label: "IndiGo BluChips",
      cardId: "idfc_indigo",
      unitName: "BluChips",
      unitValueInr: 0.45,
      confidence: "soft",
      liquidity: "travel",
      redeemVia: "IndiGo one-way base fare + fuel",
      caveat: "Value floats ₹0.40–0.60. Minimum 500, expires 24 months after earning.",
    },
    {
      key: "scapiaCoins",
      label: "Scapia coins",
      cardId: "scapia",
      unitName: "coins",
      unitValueInr: 0.2,
      confidence: "firm",
      liquidity: "travel",
      redeemVia: "Scapia app travel only — 5 coins = ₹1",
      caveat: "Not cashable. Dies with the card.",
    },
    {
      key: "sbiRp",
      label: "SBI Reward Points",
      cardId: "sbi_simplyclick",
      unitName: "RP",
      unitValueInr: 0.2,
      confidence: "firm",
      liquidity: "voucher",
      redeemVia: "SBI rewards catalogue",
    },
    {
      key: "bobRp",
      label: "BOB Reward Points",
      cardId: "bob_eterna",
      unitName: "RP",
      unitValueInr: 0.25,
      confidence: "firm",
      liquidity: "voucher",
      redeemVia: "BOBCARD rewards catalogue — never expire",
    },
    {
      key: "kiwiCashback",
      label: "Kiwi cashback",
      cardId: "yes_kiwi",
      unitName: "pts",
      unitValueInr: 0.25,
      confidence: "firm",
      liquidity: "cash",
      redeemVia: "Statement credit",
    },
    {
      key: "cheqChips",
      label: "CheQ chips",
      unitName: "chips",
      unitValueInr: 0.1,
      confidence: "speculative",
      liquidity: "locked",
      redeemVia: "CheQ app only",
      caveat: "No published conversion rate — the ₹0.10 here is an assumption.",
    },
    {
      key: "credCoins",
      label: "CRED coins",
      unitName: "coins",
      unitValueInr: 0.03,
      confidence: "speculative",
      liquidity: "locked",
      redeemVia: "CRED in-app offers, auctions and jackpots",
      caveat:
        "CRED's own terms describe coins as awarded for app usage, not a cashback currency — " +
        "they buy lottery entries and offer unlocks, not rupees. At ₹0.03 this balance would " +
        "imply 3% back on every bill paid, so treat the figure as unproven until a real " +
        "redemption confirms it.",
    },
  ];

  const rows: RewardBalanceRow[] = defs.map((d) => {
    const units = Number(state[d.key] ?? 0) || 0;
    return { ...d, units, inrValue: units * d.unitValueInr };
  });

  // A balance on a card that's no longer active is history — don't bank on it.
  const live = rows.filter((r) => !r.cardId || getCardById(r.cardId)?.status === "active");

  const bankableInr = live
    .filter((r) => r.confidence !== "speculative")
    .reduce((a, r) => a + r.inrValue, 0);
  const speculativeInr = live
    .filter((r) => r.confidence === "speculative")
    .reduce((a, r) => a + r.inrValue, 0);
  const idleCashInr = idleCash(state).reduce((a, r) => a + r.inr, 0);

  return {
    rows: live.filter((r) => r.units > 0).sort((a, b) => b.inrValue - a.inrValue),
    bankableInr,
    speculativeInr,
    idleCashInr,
    total: bankableInr + speculativeInr + idleCashInr,
  };
}

export { idleCash };
