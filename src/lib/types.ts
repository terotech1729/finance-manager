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
  path: "direct" | "shopwise" | "cashkaro" | "kiwi" | "district" | "blck_coupon" | "dreamplug" | "amazon_brand";
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
  milestoneTip?: {
    cardId: string;
    label: string;
    effectivePct: number;
    note: string;
    giveUpPct: number; // how much raw return you'd sacrifice vs the top pick
  };
};
