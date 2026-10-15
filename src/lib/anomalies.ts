import { getCardById } from "./cards";
import type { AppState } from "./storage";
import type { Transaction } from "./types";
import { inr } from "./utils";

/**
 * Things in the transaction log that look wrong.
 *
 * Deliberately rule-based rather than model-driven. Every check here is an exact
 * statement about the data — two identical amounts at one merchant on one day, a
 * subscription that costs more than it did last month, a fee waiver that won't be
 * reached at the current rate. A model would phrase these more fluently and get them
 * wrong occasionally, which is the wrong trade for something that tells you to go
 * argue with your bank.
 */

export type AnomalySeverity = "high" | "medium" | "low";

export type AnomalyKind = "duplicate" | "subscription_creep" | "off_pace_waiver" | "wasted_spend";

export type Anomaly = {
  id: string;
  kind: AnomalyKind;
  severity: AnomalySeverity;
  title: string;
  detail: string;
  /** Money implicated, for ordering. */
  amountInr: number;
  txnIds: string[];
  href: string;
  action: string;
};

const DUPLICATE_WINDOW_DAYS = 3;
/** Below this a repeated charge is more likely two coffees than a double-charge. */
const DUPLICATE_MIN_INR = 300;

function dayDiff(a: string, b: string): number {
  return Math.abs(
    (new Date(`${a.slice(0, 10)}T00:00:00`).getTime() -
      new Date(`${b.slice(0, 10)}T00:00:00`).getTime()) /
      86400_000
  );
}

function normMerchant(m: string): string {
  return (m || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Same merchant, same amount, within a few days — the classic double-charge shape. */
export function findDuplicates(txns: Transaction[]): Anomaly[] {
  const out: Anomaly[] = [];
  const byKey = new Map<string, Transaction[]>();

  for (const t of txns) {
    if (t.amount < DUPLICATE_MIN_INR) continue;
    const key = `${normMerchant(t.merchant)}::${Math.round(t.amount)}`;
    if (!key.startsWith("::")) byKey.set(key, [...(byKey.get(key) ?? []), t]);
  }

  for (const [, group] of byKey) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (dayDiff(prev.date, cur.date) > DUPLICATE_WINDOW_DAYS) continue;
      out.push({
        id: `dup-${prev.id}-${cur.id}`,
        kind: "duplicate",
        severity: cur.amount >= 5000 ? "high" : "medium",
        title: `Possible double charge at ${cur.merchant}`,
        detail:
          `${inr(cur.amount)} appears twice — ${prev.date.slice(0, 10)} and ${cur.date.slice(0, 10)}. ` +
          `If you only bought once, this is worth disputing.`,
        amountInr: cur.amount,
        txnIds: [prev.id, cur.id],
        href: "/transactions",
        action: "Check the statement and raise a dispute if it's wrong",
      });
    }
  }
  return out;
}

/** Recurring merchants whose latest charge is meaningfully above the prior norm. */
export function findSubscriptionCreep(txns: Transaction[]): Anomaly[] {
  const out: Anomaly[] = [];
  const byMerchant = new Map<string, Transaction[]>();

  for (const t of txns) {
    const k = normMerchant(t.merchant);
    if (!k) continue;
    byMerchant.set(k, [...(byMerchant.get(k) ?? []), t]);
  }

  for (const [, group] of byMerchant) {
    // Needs a real history: three prior charges to establish what "normal" is.
    if (group.length < 4) continue;
    const sorted = [...group].sort((a, b) => a.date.localeCompare(b.date));

    // Monthly-ish cadence, otherwise it's ordinary repeat shopping rather than a plan.
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) gaps.push(dayDiff(sorted[i - 1].date, sorted[i].date));
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    if (avgGap < 20 || avgGap > 40) continue;

    const latest = sorted[sorted.length - 1];
    const priors = sorted.slice(0, -1);
    const baseline = priors.reduce((s, t) => s + t.amount, 0) / priors.length;
    if (baseline <= 0) continue;

    const jump = (latest.amount - baseline) / baseline;
    if (jump < 0.15 || latest.amount - baseline < 50) continue;

    out.push({
      id: `creep-${latest.id}`,
      kind: "subscription_creep",
      severity: jump >= 0.5 ? "high" : "low",
      title: `${latest.merchant} went up ${Math.round(jump * 100)}%`,
      detail:
        `Now ${inr(latest.amount)} against a ${inr(Math.round(baseline))} average over ` +
        `${priors.length} prior charges. Renewals often reprice quietly.`,
      amountInr: latest.amount - baseline,
      txnIds: [latest.id],
      href: "/transactions",
      action: "Confirm the new price is one you still want",
    });
  }
  return out;
}

/**
 * Fee waivers that won't be reached at the current run rate.
 *
 * Distance alone doesn't say whether a waiver is in trouble — ₹1L to go is comfortable
 * in April and hopeless in December. This compares what's left against the pace set so
 * far, so it only fires when the maths genuinely no longer works.
 */
export function findOffPaceWaivers(s: AppState, today = new Date()): Anomaly[] {
  const out: Anomaly[] = [];
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 1).getTime()) / 86400_000) + 1;
  const daysLeft = 365 - dayOfYear;
  if (daysLeft <= 0 || dayOfYear < 60) return out;

  const checks: { cardId: string; spend: number; target: number; fee: number; label: string }[] = [
    { cardId: "hsbc_live_plus", spend: s.hsbcLivePlusYtdSpend ?? 0, target: 200000, fee: 1179, label: "HSBC Live+" },
  ];

  for (const c of checks) {
    const card = getCardById(c.cardId);
    if (card?.status !== "active") continue;
    if (c.spend >= c.target) continue;

    const pacePerDay = c.spend / dayOfYear;
    const projected = c.spend + pacePerDay * daysLeft;
    if (projected >= c.target) continue;

    const needPerDay = (c.target - c.spend) / daysLeft;
    out.push({
      id: `pace-${c.cardId}`,
      kind: "off_pace_waiver",
      severity: "medium",
      title: `${c.label} fee waiver is off pace`,
      detail:
        `${inr(c.spend)} of ${inr(c.target)} with ${daysLeft} days left. At the current rate you'd ` +
        `finish around ${inr(Math.round(projected))}, so the ${inr(c.fee)} fee would be charged. ` +
        `Clearing it needs about ${inr(Math.round(needPerDay))} a day from here.`,
      amountInr: c.fee,
      txnIds: [],
      href: "/milestones",
      action: `Route more spend to ${c.label}, or accept the fee`,
    });
  }
  return out;
}

/** A card earning nothing because every recent swipe landed on an excluded category. */
export function findWastedSpend(txns: Transaction[]): Anomaly[] {
  const recent = txns.filter((t) => t.amount > 0).slice(-120);
  const zeroEarning = recent.filter((t) => t.rewardInr <= 0 && t.amount >= 2000 && t.cardId);
  if (zeroEarning.length < 3) return [];

  const total = zeroEarning.reduce((s, t) => s + t.amount, 0);
  return [
    {
      id: "wasted-spend",
      kind: "wasted_spend",
      severity: total >= 100000 ? "high" : "low",
      title: `${inr(total)} of recent spend earned nothing`,
      detail:
        `${zeroEarning.length} transactions of ₹2,000+ returned zero rewards. Usually an excluded ` +
        `category (rent, fuel, wallet, jewellery) or a card that doesn't earn there.`,
      amountInr: total,
      txnIds: zeroEarning.slice(0, 5).map((t) => t.id),
      href: "/spend",
      action: "Check whether another card would have earned on these",
    },
  ];
}

export function findAnomalies(s: AppState, txns: Transaction[], today = new Date()): Anomaly[] {
  return [
    ...findDuplicates(txns),
    ...findSubscriptionCreep(txns),
    ...findOffPaceWaivers(s, today),
    ...findWastedSpend(txns),
  ].sort((a, b) => {
    const rank = { high: 0, medium: 1, low: 2 };
    return rank[a.severity] - rank[b.severity] || b.amountInr - a.amountInr;
  });
}
