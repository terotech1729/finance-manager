/** Travel assistant shared types (flights / trains / buses). */

export type TravelMode = "flight" | "train" | "bus";

export type OfferConfidence = "stable" | "typical" | "volatile";

export type TravelPlaceRef = {
  id: string;
  name: string;
  code?: string;
  city: string;
  kind: "airport" | "station" | "city";
};

export type TravelSearchParams = {
  origin: TravelPlaceRef;
  destination: TravelPlaceRef;
  date: string;
  returnDate?: string;
  adults: number;
  children: number;
  cabin?: "economy" | "premium" | "business";
};

export type TravelPlatform = {
  id: string;
  mode: TravelMode;
  label: string;
  /** Free-text merchant passed into recommend() */
  recommendMerchant: string;
  /** Category string for recommend / Cashkaro */
  recommendCategory: string;
  /** Optional Cashkaro store name for display */
  cashkaroMerchant?: string;
  /** How to open (deep-link or app steps) */
  openSteps: string[];
  /** Homepage / search URL when known */
  url?: string;
  /** Build a prefilled search deep-link */
  buildSearchUrl?: (p: TravelSearchParams) => string;
  notes?: string;
  /** Prefer showing in primary results */
  primary?: boolean;
  /** Typical ₹ delta vs market fare (convenience fee / undercut) */
  fareBiasInr?: number;
  /** Typical % delta vs market fare */
  fareBiasPct?: number;
};

export type TravelOffer = {
  id: string;
  mode: TravelMode | TravelMode[];
  /** Platform ids this offer applies to (empty = any in mode) */
  platformIds: string[];
  label: string;
  /** Instant discount % of fare (before card earn) */
  discountPct?: number;
  /** Flat Instant Discount ₹ */
  discountFlatInr?: number;
  /** Cap on Instant Discount ₹ */
  discountCapInr?: number;
  minFareInr?: number;
  /** If set, only stacks when paying with this cardId */
  cardId?: string;
  confidence: OfferConfidence;
  /** User should confirm live on checkout */
  confirmLive?: boolean;
  notes?: string;
  validUntil?: string; // ISO date
};

export type TravelTripInput = {
  mode: TravelMode;
  origin: string;
  destination: string;
  date: string; // YYYY-MM-DD
  returnDate?: string;
  adults: number;
  children?: number;
  /** Flight cabin hint */
  cabin?: "economy" | "premium" | "business";
  /** Train class hint */
  trainClass?: string;
  /** Base fare if platforms share inventory (trains) or parity starting point */
  baseFareInr?: number;
  /** Absolute fare per platform id (overrides base+delta) */
  fares?: Record<string, number>;
  /** Delta vs baseFare per platform id */
  fareDeltas?: Record<string, number>;
  /** Volatile offer overrides: offerId → live discount ₹ */
  offerDiscountOverrides?: Record<string, number>;
  /** Extra Amazon checkout cashback ₹ (flights/hotels first-booking style) */
  amazonOrderCashbackInr?: number;
  today?: string;
};

export type TravelSolution = {
  platformId: string;
  platformLabel: string;
  fareInr: number;
  offerId?: string;
  offerLabel?: string;
  offerDiscountInr: number;
  cardId: string;
  cardLabel: string;
  cardRewardInr: number;
  cardEffectivePct: number;
  /** Cashkaro portion already inside cardReward when route is CK stack; mirrored for UI */
  cashkaroNote?: string;
  /** All-in cost after discounts + rewards */
  netInr: number;
  /** (fare - net) / fare * 100 */
  allInPct: number;
  steps: string[];
  rationale: string;
  pros: string[];
  cons: string[];
  openSteps: string[];
  url?: string;
  ifCardNotAllowed?: {
    label: string;
    cardId: string;
    effectivePct: number;
    steps: string[];
    rationale: string;
  };
  ifAmexNotAccepted?: {
    label: string;
    cardId: string;
    routeLabel?: string;
    effectivePct: number;
    steps: string[];
    rationale: string;
  };
};

export type TravelRankResult = {
  mode: TravelMode;
  tripSummary: string;
  best: TravelSolution;
  alternatives: TravelSolution[];
  warnings: string[];
};
