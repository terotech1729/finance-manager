import { getCardById, liveAnnualMilestones, nextQuarterStart, quarterLabel } from "./cards";
import type { AppState } from "./storage";
import { inr, toLocalISODate } from "./utils";

/**
 * Dated cliffs: things that stop being true on a particular day.
 *
 * Separate from the milestone nudges in briefing.ts, which are about *distance* — how
 * much more to spend. These are about *time*. A milestone ₹2,892 away is a different
 * problem from one that's reachable but whose window shuts in nine days, and the second
 * is the one that gets missed, because nothing about the number on screen changes as
 * the date approaches.
 */

export type DeadlineKind = "points" | "milestone" | "window" | "programme";

export type Deadline = {
  id: string;
  kind: DeadlineKind;
  title: string;
  detail: string;
  /** ISO date the thing lapses. */
  on: string;
  daysLeft: number;
  /** Rupees at stake, when quantifiable — drives ordering. */
  valueInr?: number;
  href: string;
  /** What to do about it, in one line. */
  action: string;
};

/**
 * Days you get to redeem Membership Rewards after closing an Amex card before the
 * balance on it is forfeited.
 *
 * This is the harshest clock in the portfolio and the easiest to miss, because closing a
 * card feels like the end of the admin rather than the start of a countdown. Amex's
 * Platinum Travel terms say the points "will get forfeited within 30 days of the
 * cancellation", and the Membership Rewards master terms add the sting: after
 * cancellation the points can ONLY go to a statement credit at 4 points to ₹1, so
 * transfer partners — where points are worth roughly twice that — are off the table the
 * moment the card closes.
 */
export const AMEX_CLOSURE_REDEEM_DAYS = 30;
/** Post-closure redemption is statement credit only, at 4 MR to ₹1. */
export const AMEX_CLOSURE_POINT_VALUE_INR = 0.25;

/**
 * The forfeiture clock on a closed Amex card, if a closure date is known.
 *
 * Returns null when `amexPtClosedOn` is unset rather than guessing a date — a wrong
 * countdown here is worse than none, since it would either manufacture false urgency or,
 * far worse, imply there is time left when the window has already shut.
 */
export function amexClosureDeadline(s: AppState, today = new Date()): Deadline | null {
  const closedOn = s.amexPtClosedOn;
  if (!closedOn || !/^\d{4}-\d{2}-\d{2}$/.test(closedOn)) return null;

  const closed = new Date(`${closedOn}T00:00:00`);
  if (!Number.isFinite(closed.getTime())) return null;

  const deadline = new Date(closed);
  deadline.setDate(deadline.getDate() + AMEX_CLOSURE_REDEEM_DAYS);
  // toLocalISODate, not toISOString: the latter renders an IST midnight as the previous
  // day in UTC, which would show the window shutting 24 hours early.
  const on = toLocalISODate(deadline);
  const daysLeft = Math.ceil((deadline.getTime() - today.getTime()) / 86400_000);

  const atRisk = s.amexPtMrAtClosure ?? 0;
  const lapsed = daysLeft < 0;

  return {
    id: "amex-pt-closure-forfeiture",
    kind: "points",
    title: lapsed
      ? "Amex PT points window has closed"
      : `Amex PT points forfeit in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
    detail: lapsed
      ? `The 30 days from closing Platinum Travel on ${closedOn} ran out on ${on}. Anything still sitting on that card is gone — confirm against your statement and raise it with Amex immediately if the balance looks wrong.`
      : `Closed ${closedOn}, so the 30-day redemption window ends ${on}. Post-closure these can only go to a statement credit at 4 points to ₹1 — transfers are already unavailable.`,
    on,
    daysLeft: Math.max(0, daysLeft),
    valueInr: atRisk > 0 ? Math.round(atRisk * AMEX_CLOSURE_POINT_VALUE_INR) : undefined,
    href: "/rewards",
    action: lapsed
      ? "Verify the balance against your statement"
      : "Redeem as statement credit today — nothing else is available",
  };
}

/**
 * Programme-level cutoffs that aren't derivable from state — an issuer announced a date
 * and it simply arrives. Kept here as data so the home page can count down to them
 * without anyone remembering to check.
 *
 * These expire by themselves: anything already past is filtered out, so a stale entry
 * disappears rather than nagging.
 */
export const PROGRAMME_CUTOFFS: {
  id: string;
  on: string;
  title: string;
  detail: string;
  action: string;
  href: string;
  /** Rupees at stake. Named in full rather than `valueOf`, which would shadow
   * Object.prototype.valueOf and silently return the object itself. */
  valueInrOf?: (s: AppState) => number;
}[] = [
  {
    id: "amex-mr-pooling-ends",
    on: "2026-11-15",
    title: "Amex stops pooling Membership Rewards",
    detail:
      "From this date Gold and MRCC hold separate MR balances with no transfers between them. " +
      "Any redemption that depends on the combined balance has to be done before it.",
    action: "Redeem or transfer anything that needs the pooled balance",
    href: "/rewards",
    valueInrOf: (s) => Math.round((s.amexMrPooled ?? 0) * 0.58),
  },
  // The MRCC 50% fee waiver isn't listed here: it carries an `endsOn` in
  // ANNUAL_MILESTONES, so withdrawnMilestones() already derives it with the live
  // shortfall attached. Repeating it as a fixed entry would show it twice.
  {
    id: "live-plus-myntra-promo",
    on: "2026-10-31",
    title: "Live+ 10% on Myntra ends",
    detail: "Myntra drops to the 1.5% marketplace rate alongside Amazon and Flipkart.",
    action: "Front-load any planned Myntra spend",
    href: "/recommend",
  },
];

function daysUntil(iso: string, today: Date): number {
  const target = new Date(`${iso}T00:00:00`).getTime();
  const now = new Date(today.toISOString().slice(0, 10) + "T00:00:00").getTime();
  return Math.round((target - now) / 86400_000);
}

/** Period counters whose window closes, with the spend already banked against them. */
function periodWindows(s: AppState, today: Date): Deadline[] {
  const out: Deadline[] = [];
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const endOfMonthIso = endOfMonth.toISOString().slice(0, 10);
  const monthLeft = daysUntil(endOfMonthIso, today);

  // Amex monthly milestones reset on the 1st; partial progress is simply lost.
  const gold = getCardById("amex_gold");
  if (gold?.status === "active") {
    const done = s.goldThisMonthTxnsAt1k ?? 0;
    if (done > 0 && done < 6) {
      out.push({
        id: "gold-monthly-txns",
        kind: "window",
        title: `Amex Gold: ${6 - done} more transactions ≥₹1,000`,
        detail: `${done}/6 done this month. The count resets on the 1st and partial progress earns nothing.`,
        on: endOfMonthIso,
        daysLeft: monthLeft,
        valueInr: 580,
        href: "/milestones",
        action: `Make ${6 - done} small purchases of ₹1,000+ before month end`,
      });
    }
  }

  const mrcc = getCardById("amex_mrcc");
  if (mrcc?.status === "active") {
    const txns = s.mrccThisCycleTxnsAt1500 ?? 0;
    if (txns > 0 && txns < 4) {
      out.push({
        id: "mrcc-monthly-txns",
        kind: "window",
        title: `Amex MRCC: ${4 - txns} more transactions ≥₹1,500`,
        detail: `${txns}/4 done this month. Resets on the 1st.`,
        on: endOfMonthIso,
        daysLeft: monthLeft,
        valueInr: 580,
        href: "/milestones",
        action: `Make ${4 - txns} purchases of ₹1,500+ before month end`,
      });
    }
    const amt = s.mrccThisCycleAmount ?? 0;
    if (amt > 0 && amt < 20000) {
      out.push({
        id: "mrcc-monthly-20k",
        kind: "window",
        title: `Amex MRCC: ${inr(20000 - amt)} short of the ₹20,000 month`,
        detail: `${inr(amt)} logged this month. The bonus needs ₹20,000 in a calendar month and doesn't carry over.`,
        on: endOfMonthIso,
        daysLeft: monthLeft,
        valueInr: 580,
        href: "/milestones",
        action: `Route ${inr(20000 - amt)} more to MRCC this month`,
      });
    }
  }

  // BOB lounge: this quarter's spend decides next quarter's access, so the deadline is
  // the quarter boundary rather than any date tied to a trip.
  const bob = getCardById("bob_eterna");
  if (bob?.status === "active") {
    const spend = s.bobQuarterSpend ?? 0;
    const gate = 75000;
    const qEnd = new Date(nextQuarterStart(today).getTime() - 86400_000);
    const qEndIso = qEnd.toISOString().slice(0, 10);
    if (spend < gate) {
      out.push({
        id: "bob-lounge-quarter",
        kind: "window",
        title: `BOB lounge: ${inr(gate - spend)} short for next quarter`,
        detail:
          `${inr(spend)} of ${inr(gate)} in ${quarterLabel(today)}. This quarter's spend is what buys ` +
          `unlimited domestic lounge access next quarter — miss it and there is no access at all.`,
        on: qEndIso,
        daysLeft: daysUntil(qEndIso, today),
        valueInr: 2500,
        href: "/lounges",
        action: `Route ${inr(gate - spend)} to BOB before the quarter ends`,
      });
    }
  }

  // Scapia's lounge unlock runs on its own statement cycle, not the calendar month.
  const scapia = getCardById("scapia");
  if (scapia?.status === "active") {
    const spend = s.scapiaMonthlySpend ?? 0;
    if (spend > 0 && spend < 20000) {
      const cycleEnd = new Date(today.getFullYear(), today.getMonth() + (today.getDate() > 24 ? 1 : 0), 24);
      const iso = cycleEnd.toISOString().slice(0, 10);
      out.push({
        id: "scapia-cycle",
        kind: "window",
        title: `Scapia: ${inr(20000 - spend)} short of the lounge gate`,
        detail: `${inr(spend)} this billing cycle (25th→24th). Privileges apply from the next statement.`,
        on: iso,
        daysLeft: daysUntil(iso, today),
        valueInr: 2500,
        href: "/lounges",
        action: `Route ${inr(20000 - spend)} to Scapia before the 24th`,
      });
    }
  }

  return out;
}

/** Annual milestones the issuer is withdrawing on a known date. */
function withdrawnMilestones(today: Date): Deadline[] {
  const todayIso = today.toISOString().slice(0, 10);
  return liveAnnualMilestones(todayIso)
    .filter((m) => m.endsOn)
    .map((m) => {
      const card = getCardById(m.cardId);
      return {
        id: `ms-ends-${m.cardId}-${m.threshold}`,
        kind: "milestone" as const,
        title: `${card?.short ?? m.cardId}: ${m.reward} is being withdrawn`,
        detail: `Worth ${inr(m.rewardValueInr)} at ${inr(m.threshold)} of spend. ${m.notes ?? ""}`.trim(),
        on: m.endsOn!,
        daysLeft: daysUntil(m.endsOn!, today),
        valueInr: m.rewardValueInr,
        href: "/milestones",
        action: `Clear ${inr(m.threshold)} before ${m.endsOn}`,
      };
    });
}

/** Everything with a date attached, soonest first, past entries dropped. */
export function upcomingDeadlines(s: AppState, today = new Date(), horizonDays = 120): Deadline[] {
  const programme: Deadline[] = PROGRAMME_CUTOFFS.map((c) => ({
    id: c.id,
    kind: "programme" as const,
    title: c.title,
    detail: c.detail,
    on: c.on,
    daysLeft: daysUntil(c.on, today),
    valueInr: c.valueInrOf?.(s),
    href: c.href,
    action: c.action,
  }));

  const closure = amexClosureDeadline(s, today);

  return [...programme, ...withdrawnMilestones(today), ...periodWindows(s, today), ...(closure ? [closure] : [])]
    .filter((d) => d.daysLeft >= 0 && d.daysLeft <= horizonDays)
    .sort((a, b) => a.daysLeft - b.daysLeft || (b.valueInr ?? 0) - (a.valueInr ?? 0));
}

/** Urgency band, used for colour and for deciding what reaches the home page. */
export function urgencyOf(d: Deadline): "critical" | "soon" | "watch" {
  if (d.daysLeft <= 7) return "critical";
  if (d.daysLeft <= 30) return "soon";
  return "watch";
}
