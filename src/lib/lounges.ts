/**
 * Structured lounge entitlements.
 *
 * `Card.loungeRule` is free text for display — it can't be summed, and it can't answer
 * "how many visits do I actually have right now?" because three of the entitlements are
 * gated on spend that may or may not have been met. This module turns those rules into
 * numbers the UI can total, and resolves each gate against live state so the headline
 * figure reflects what you could use today rather than what the brochure promises.
 */
import type { AppState } from "./storage";
import { SCAPIA_LOUNGE_CYCLE_INR } from "./storage";
import { bobLoungeGateFor, quarterLabel, nextQuarterLabel, getCardById } from "./cards";
import { inr } from "./utils";

export type LoungeScope = "domestic" | "international";

/** How an allowance refreshes — shown so a "2" reads as 2/year rather than 2/visit. */
export type LoungePeriod = "year" | "quarter" | "cycle";

export type LoungeGate = {
  /** Short human rule, e.g. "₹20,000 per billing cycle". */
  label: string;
  met: boolean;
  /** Progress toward the gate, for the ring. Omitted when the gate isn't measurable. */
  current?: number;
  target?: number;
  /** What happens when it's met — the gate is often forward-dated by a quarter. */
  unlocks?: string;
};

export type LoungeEntitlement = {
  cardId: string;
  cardShort: string;
  scope: LoungeScope;
  /** null = unlimited while the gate holds. */
  visits: number | null;
  period: LoungePeriod;
  /** Undefined = unconditional. */
  gate?: LoungeGate;
  note?: string;
};

export type LoungeScopeSummary = {
  /** Visits usable right now. Meaningless when `unlimited` is true. */
  visits: number;
  unlimited: boolean;
  sources: LoungeEntitlement[];
  /** Entitlements in this scope that are currently usable. */
  liveCount: number;
  /** Entitlements in this scope in total, including gated ones. */
  totalCount: number;
};

export type LoungeSummary = {
  domestic: LoungeScopeSummary;
  international: LoungeScopeSummary;
  /** Entitlements that exist but whose gate is currently unmet — the "could unlock" set. */
  locked: LoungeEntitlement[];
  all: LoungeEntitlement[];
};

/**
 * Builds the entitlement list from live state.
 *
 * Only active cards appear: a closed card's lounge access dies with it, and an applied
 * card hasn't been issued, so counting either would overstate the headline number.
 */
export function loungeEntitlements(state: AppState): LoungeEntitlement[] {
  const out: LoungeEntitlement[] = [];
  const push = (e: LoungeEntitlement) => {
    if (getCardById(e.cardId)?.status === "active") out.push(e);
  };

  // —— Scapia: unlimited domestic, but only once the cycle gate is cleared ——
  const scapiaSpend = state.scapiaMonthlySpend ?? 0;
  const scapiaMet = scapiaSpend >= SCAPIA_LOUNGE_CYCLE_INR;
  push({
    cardId: "scapia",
    cardShort: "Scapia",
    scope: "domestic",
    visits: null,
    period: "cycle",
    gate: {
      label: `${inr(SCAPIA_LOUNGE_CYCLE_INR)} per billing cycle`,
      met: scapiaMet,
      current: scapiaSpend,
      target: SCAPIA_LOUNGE_CYCLE_INR,
      unlocks: "activates on the next statement",
    },
    note: scapiaMet
      ? "Unlimited domestic while the cycle gate holds."
      : `${inr(SCAPIA_LOUNGE_CYCLE_INR - scapiaSpend)} more this cycle unlocks unlimited domestic.`,
  });

  // —— BOB Eterna: unlimited domestic, gated on the PRECEDING quarter ——
  // The gate rose from ₹40k to ₹75k on 1 Oct 2026, so resolve it per access-quarter.
  const now = new Date();
  const priorSpend = state.bobPriorQuarterSpend ?? 0;
  const thisQuarterSpend = state.bobQuarterSpend ?? 0;
  const gateNow = bobLoungeGateFor(now);
  const bobMet = priorSpend >= gateNow;
  push({
    cardId: "bob_eterna",
    cardShort: "BOB Eterna",
    scope: "domestic",
    visits: null,
    period: "quarter",
    gate: {
      // The gate that decides THIS quarter was last quarter's, but the bar tracks the
      // current quarter, because that's the one you can still act on.
      label: `${inr(gateNow)} in the preceding quarter`,
      met: bobMet,
      current: thisQuarterSpend,
      target: gateNow,
      unlocks: `this quarter's spend buys ${nextQuarterLabel(now)}`,
    },
    note: bobMet
      ? `Unlimited domestic for ${quarterLabel(now)}.`
      : `Last quarter fell short of ${inr(gateNow)}, so ${quarterLabel(now)} has no BOB lounge access.`,
  });

  // —— YES Kiwi Neon: up to 3/yr via Neon milestones ——
  push({
    cardId: "yes_kiwi",
    cardShort: "YES Bank Neon",
    scope: "domestic",
    visits: 3,
    period: "year",
    note: "Released by Neon milestone tiers, not a flat grant.",
  });

  // —— HSBC Live+: the only international access left after Amex PT closed ——
  push({
    cardId: "hsbc_live_plus",
    cardShort: "HSBC Live+",
    scope: "domestic",
    visits: 2,
    period: "year",
    // The pacing matters as much as the count: both visits can't be used on one trip.
    note: "2 per calendar year, but only 1 every 6 months — a second visit inside the same half-year is charged.",
  });
  push({
    cardId: "hsbc_live_plus",
    cardShort: "HSBC Live+",
    scope: "international",
    visits: 1,
    period: "year",
    note: "The portfolio's only international lounge access (added 1 Sep 2026).",
  });

  return out;
}

/** Totals the entitlements, resolving gates. Unmet gates contribute 0 and move to `locked`. */
export function summariseLounges(state: AppState): LoungeSummary {
  const all = loungeEntitlements(state);
  const live = all.filter((e) => !e.gate || e.gate.met);
  const locked = all.filter((e) => e.gate && !e.gate.met);

  const fold = (scope: LoungeScope): LoungeScopeSummary => {
    const inScope = all.filter((e) => e.scope === scope);
    const sources = live.filter((e) => e.scope === scope);
    return {
      // An unlimited source makes the count meaningless, so flag it instead of summing.
      unlimited: sources.some((e) => e.visits === null),
      visits: sources.reduce((n, e) => n + (e.visits ?? 0), 0),
      sources,
      liveCount: sources.length,
      totalCount: inScope.length,
    };
  };

  return { domestic: fold("domestic"), international: fold("international"), locked, all };
}
