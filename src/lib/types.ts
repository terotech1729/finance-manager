export type Card = {
  id: string;
  name: string;
  short: string;
  network: string;
  issuer: string;
  creditLimit: number; // 0 = no preset
  annualFee: number;
  feeWaivable: boolean;
  feeWaiverAt?: number;
  forexPct: number;
  loungeRule?: string;
  notes?: string;
  status: "active" | "applied" | "future";
  pointValue: number; // ₹ per point at best redemption
  baseRatePct: number;
  bestRatePct: number;
  cycleEnd?: string; // ISO date for milestone cycle end
  statementDay?: number; // day of month statement cuts
};

export type AnnualMilestone = {
  cardId: string;
  threshold: number;
  reward: string;
  rewardValueInr: number;
  hit: boolean;
  notes?: string;
};

export type MonthlyMilestone = {
  cardId: string;
  rule: string;
  rewardMr?: number;
  rewardInr: number;
  minSpend: number;
  achievedThisMonth?: boolean;
};

export type Voucher = {
  id: string;
  cardId: string;
  description: string;
  valueInr: number;
  expires: string; // ISO date
  redeemed?: boolean;
};

export type RewardBalance = {
  cardId: string;
  units: number;
  unitName: string; // "MR", "BluChips", "RP", "Coins", etc.
  unitValueInr: number;
  inrValue: number;
};

export type Transaction = {
  id: string;
  date: string; // ISO
  merchant: string;
  category: string;
  amount: number;
  channel: "online" | "offline_pos" | "upi" | "upi_normal" | "merchant_app" | "foreign";
  cardId: string;
  path: "direct" | "shopwise" | "cashkaro" | "kiwi" | "district" | "blck_coupon" | "dreamplug" | "amazon_brand" | "manual";
  effectivePct: number;
  rewardInr: number;
  notes?: string;
};

export type InvestmentType = "smallcase" | "stocks" | "mutual_fund" | "bonds" | "crypto" | "fd" | "rd" | "gold" | "real_estate" | "other";

export type Investment = {
  id: string;
  date: string; // ISO
  amount: number;
  type: InvestmentType;
  asset?: string; // specific name e.g. "Smallcase: All Weather Investing", "Reliance Industries"
  platform?: string; // e.g. "Zerodha", "Groww"
  paymentMethod?: "upi" | "neft" | "net_banking" | "card";
  notes?: string;
};

export type PaymentMethod = "upi" | "neft" | "net_banking" | "card";

// A single money-in event (SIP, lump sum, opening balance) attached to a holding.
export type Contribution = {
  id: string;
  date: string; // ISO
  amount: number;
  paymentMethod?: PaymentMethod;
  note?: string;
};

// Real-estate specific loan/equity details (only used when type === "real_estate").
export type RealEstateDetails = {
  propertyValue?: number; // market value as of currentValueDate
  downPayment?: number; // equity you put in upfront
  loanAmount?: number; // outstanding loan principal (liability)
  lender?: string; // bank / NBFC
  interestRate?: number; // % p.a.
  emi?: number; // monthly EMI
  tenureMonths?: number; // remaining/total tenure in months
};

// A position you hold in one asset. Periodic SIPs / top-ups accumulate as contributions,
// so the same smallcase/fund/stock stays a single line that grows over time.
export type Holding = {
  id: string;
  name: string; // e.g. "Large and Midcap Tracker", "Reliance Industries"
  type: InvestmentType;
  platform?: string; // e.g. "Smallcase", "Zerodha", "Groww"
  contributions: Contribution[]; // cost basis = sum of these (for RE: down payment + principal you've paid)
  currentValue?: number; // latest market value (manually updated) for P/L (non-real-estate)
  currentValueDate?: string; // ISO of last value update
  realEstate?: RealEstateDetails; // populated for type === "real_estate"
  notes?: string;
};

export type CashkaroRate = {
  merchant: string;
  category?: string;
  rate: string; // human-readable e.g. "5%" or "1-5%"
  minRate: number; // min %
  maxRate: number; // max %
  flatInr?: number; // flat ₹ reward (e.g. Amazon recharge ≈ ₹1.5), used instead of %
  zone: "reliable" | "try" | "shopwise" | "na";
  notes?: string;
};

export type RouteOption = {
  cardId: string;
  label: string;
  effectivePct: number;
  baseRewardInr: number;
  bonusRewardInr: number;
  totalRewardInr: number;
  feasible: boolean;
  feasibilityNote?: string;
  pros: string[];
  cons: string[];
  cashkaroSuggested: boolean;
  worstCasePct: number;
  bestCasePct: number;
  steps: string[];
  rationale: string;
  // How usable the reward is — affects ranking (locked < flexible < cash).
  liquidity?: "cash" | "flexible" | "locked";
  // Redemption-value range for points rewards (shown per row in the alternatives table).
  redemptionRange?: { worstPct: number; bestPct: number };
};

export type RecommendationResult = {
  card: Card;
  path: string;
  effectivePct: number;
  worstCasePct: number;
  bestCasePct: number;
  rewardInr: number;
  rationale: string;
  caveats: string[];
  cashkaroSuggested: boolean;
  best?: RouteOption;
  alternatives?: RouteOption[];
  // Redemption-value range for points-based routes (Amex MR / BluChips / SBI RP).
  effectiveRange?: { worstPct: number; typicalPct: number; bestPct: number; currency: string };
  milestoneTip?: {
    cardId: string;
    label: string;
    effectivePct: number;
    note: string;
    giveUpPct: number; // how much raw return you'd sacrifice vs the top pick
  };
  /** Open claim / activate reminders from Benefit claims + live card rules. */
  claimTips?: string[];
  /**
   * App-gated rates (CRED/CheQ Store, Kiwi campaigns) — do not rank GC stacks until the user
   * enters the live % they see. Cashkaro is refreshed daily separately.
   */
  askLiveRates?: {
    giftCard?: { label: string; hintPct?: string; message: string };
  };
};
