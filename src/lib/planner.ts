import { getCardById, liveAnnualMilestones } from "./cards";
import type { AppState } from "./storage";
import { inr } from "./utils";

/**
 * Where the next rupees of spend are worth the most.
 *
 * The recommender answers "best card for THIS purchase". This answers the other
 * question: given everything still in flight, which milestones are actually reachable
 * before their windows close, and in what order should spend fill them?
 *
 * The ordering that matters is return per rupee of *remaining* spend, not reward size.
 * A ₹5,000 voucher ₹600 away beats a ₹20,000 bonus ₹3L away, and sorting by reward
 * value — the intuitive choice — gets that exactly backwards.
 */

export type PlanStep = {
  cardId: string;
  cardShort: string;
  label: string;
  /** Spend still required to collect it. */
  remainingInr: number;
  rewardInr: number;
  /** Rupees returned per rupee of remaining spend. */
  efficiency: number;
  /** Days until the window shuts, when it has one. */
  daysLeft?: number;
  reachable: boolean;
  why: string;
};

export type Plan = {
  steps: PlanStep[];
  /** Total still collectable across every reachable milestone. */
  collectableInr: number;
  /** Spend needed to collect all of it. */
  spendNeededInr: number;
  /** Blended return if the whole plan is executed. */
  blendedPct: number;
  unreachable: PlanStep[];
};

/** Spend counted toward each card's annual milestones, matching the milestones page. */
function ytdFor(cardId: string, s: AppState): number | null {
  switch (cardId) {
    case "amex_mrcc":
      return s.mrccCycleSpend ?? 0;
    case "sbi_simplyclick":
      return s.sbiYtdSpend ?? 0;
    case "idfc_indigo":
      return s.idfcYtdSpend ?? 0;
    case "bob_eterna":
      return s.bobYtdSpend ?? 0;
    case "hsbc_live_plus":
      return s.hsbcLivePlusYtdSpend ?? 0;
    default:
      return null;
  }
}

function daysUntil(iso: string, today: Date): number {
  return Math.round(
    (new Date(`${iso}T00:00:00`).getTime() -
      new Date(`${today.toISOString().slice(0, 10)}T00:00:00`).getTime()) /
      86400_000
  );
}

/**
 * Builds the plan.
 *
 * `monthlyCapacity` is what you can realistically put on cards each month. Without it
 * every milestone looks reachable given enough time, which is how you end up chasing a
 * ₹5L target on ₹80k of monthly spend.
 */
export function buildPlan(s: AppState, monthlyCapacity: number, today = new Date()): Plan {
  const todayIso = today.toISOString().slice(0, 10);
  const steps: PlanStep[] = [];

  for (const m of liveAnnualMilestones(todayIso)) {
    const card = getCardById(m.cardId);
    if (!card || card.status !== "active") continue;

    const ytd = ytdFor(m.cardId, s);
    if (ytd == null) continue;

    const remaining = m.threshold - ytd;
    if (remaining <= 0) continue; // already collected
    if (m.rewardValueInr < 100) continue;

    // The binding window is whichever comes first: the issuer withdrawing the milestone,
    // or the end of the year the counter resets on.
    const yearEnd = `${today.getFullYear()}-12-31`;
    const deadline = m.endsOn && m.endsOn < yearEnd ? m.endsOn : yearEnd;
    const daysLeft = daysUntil(deadline, today);
    const monthsLeft = Math.max(0, daysLeft / 30);
    const capacity = monthlyCapacity * monthsLeft;

    const efficiency = m.rewardValueInr / remaining;
    const reachable = remaining <= capacity;

    steps.push({
      cardId: m.cardId,
      cardShort: card.short,
      label: m.reward,
      remainingInr: remaining,
      rewardInr: m.rewardValueInr,
      efficiency,
      daysLeft,
      reachable,
      why: reachable
        ? `${inr(remaining)} more returns ${inr(m.rewardValueInr)} — ${(efficiency * 100).toFixed(1)}% on the marginal spend.`
        : `Needs ${inr(remaining)} in ${Math.round(daysLeft)} days, but capacity over that window is about ${inr(Math.round(capacity))}. Not realistically reachable.`,
    });
  }

  // Highest marginal return first — that is the order spend should actually fill them in.
  steps.sort((a, b) => b.efficiency - a.efficiency);

  const reachable = steps.filter((s) => s.reachable);
  const unreachable = steps.filter((s) => !s.reachable);
  const collectableInr = reachable.reduce((n, s) => n + s.rewardInr, 0);

  // Each card's spend counter is independent, but a single card's thresholds are
  // cumulative: clearing ₹2L on SBI also clears its ₹1L. Taking the max per card
  // instead of the sum avoids double-counting the same rupees.
  const byCard = new Map<string, number>();
  for (const st of reachable) {
    byCard.set(st.cardId, Math.max(byCard.get(st.cardId) ?? 0, st.remainingInr));
  }
  const spendNeededInr = [...byCard.values()].reduce((a, b) => a + b, 0);

  return {
    steps: reachable,
    unreachable,
    collectableInr,
    spendNeededInr,
    blendedPct: spendNeededInr > 0 ? (collectableInr / spendNeededInr) * 100 : 0,
  };
}

/**
 * Average monthly card spend over the last few months, used as the capacity input.
 * Falls back to a modest default when there isn't enough history to infer one.
 */
export function inferMonthlyCapacity(
  txns: { date: string; amount: number; cardId?: string }[],
  today = new Date(),
  months = 3
): number {
  const cutoff = new Date(today.getTime() - months * 30 * 86400_000).toISOString().slice(0, 10);
  const recent = txns.filter((t) => t.date >= cutoff && t.amount > 0 && t.cardId);
  if (recent.length < 5) return 75000;
  return recent.reduce((n, t) => n + t.amount, 0) / months;
}
