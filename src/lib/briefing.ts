/**
 * The daily briefing: what actually needs attention today, across money, travel and notes.
 *
 * Only things that are close enough to act on make the list. A milestone ₹4L away isn't
 * news; one ₹2,892 away is. Everything carries the number that makes it actionable and a
 * link to the place you'd do something about it.
 */
import {
  ANNUAL_MILESTONES,
  BOB_LOUNGE_GATE_INR,
  bobLoungeGateFor,
  nextQuarterLabel,
  nextQuarterStart,
  getCardById,
} from "./cards";
import { inr, thisMonthKey, toDateOnly } from "./utils";
import type { AppState } from "./storage";
import type { Note } from "./notes";
import { bookedProgress, type Trip } from "./travel/itinerary/trips";

export type BriefingArea = "money" | "travel" | "notes";
export type BriefingTone = "urgent" | "opportunity" | "info";

export type BriefingItem = {
  id: string;
  area: BriefingArea;
  tone: BriefingTone;
  title: string;
  detail: string;
  href: string;
  cta: string;
  /** Optional progress toward a gate, for a bar under the item. */
  progress?: { current: number; target: number };
  /** Higher sorts first. */
  weight: number;
};

/** SBI SimplyCLICK annual-fee waiver threshold. */
const SBI_FEE_WAIVER_INR = 100000;
const SBI_FEE_INR = 589;
/** HSBC Live+ annual-fee waiver threshold and what the waiver is worth. */
const LIVE_PLUS_WAIVER_INR = 200000;
const LIVE_PLUS_FEE_INR = 1179;
/** A spend gate is worth mentioning once it's within this much. */
const GATE_NEAR_INR = 30000;

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso}T00:00:00`).getTime();
  const b = new Date(`${toIso}T00:00:00`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.NaN;
  return Math.round((b - a) / 86400000);
}

/** YTD spend tracked for a card, matching the counters the milestones page shows. */
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

function moneyItems(s: AppState, today: string): BriefingItem[] {
  const out: BriefingItem[] = [];

  // —— Unpaid card bills for the current month ——
  const monthKey = thisMonthKey();
  const unpaid = Object.entries(s.bills ?? {})
    .filter(([key, b]) => key.endsWith(`:${monthKey}`) && !b.paid && b.billAmount > 0)
    .map(([key, b]) => ({ cardId: key.split(":")[0], amount: b.billAmount }));
  if (unpaid.length > 0) {
    const total = unpaid.reduce((a, b) => a + b.amount, 0);
    const names = unpaid.map((u) => getCardById(u.cardId)?.short ?? u.cardId).join(", ");
    out.push({
      id: "bills-unpaid",
      area: "money",
      tone: "urgent",
      title: `${unpaid.length} card bill${unpaid.length === 1 ? "" : "s"} still unpaid`,
      detail: `${inr(total)} outstanding on ${names}.`,
      href: "/bills",
      cta: "Open bills",
      weight: 100,
    });
  }

  // —— BOB quarterly lounge gate ——
  // This quarter's spend buys NEXT quarter's lounge access, so the threshold that matters
  // is the one in force then — ₹75k from Oct 2026, not the ₹40k you've already cleared.
  const bobQuarter = s.bobQuarterSpend ?? 0;
  const gate = bobLoungeGateFor(nextQuarterStart(new Date(`${today}T00:00:00`))) || BOB_LOUNGE_GATE_INR;
  if (bobQuarter > 0 && bobQuarter < gate) {
    const left = gate - bobQuarter;
    if (left <= GATE_NEAR_INR) {
      out.push({
        id: "bob-lounge",
        area: "money",
        tone: "opportunity",
        title: `${inr(left)} from unlimited lounge access`,
        detail: `BOB Eterna needs ${inr(gate)} this quarter to unlock unlimited domestic lounge for ${nextQuarterLabel()}.`,
        href: "/milestones",
        cta: "See milestones",
        progress: { current: bobQuarter, target: gate },
        weight: 85,
      });
    }
  }

  // —— SBI annual-fee waiver ——
  const sbiFee = s.sbiFeeWaiverSpend ?? 0;
  if (sbiFee > 0 && sbiFee < SBI_FEE_WAIVER_INR) {
    const left = SBI_FEE_WAIVER_INR - sbiFee;
    if (left <= GATE_NEAR_INR) {
      out.push({
        id: "sbi-waiver",
        area: "money",
        tone: "opportunity",
        title: `${inr(left)} from the SBI fee waiver`,
        detail: `Eligible retail of ${inr(SBI_FEE_WAIVER_INR)} reverses the ${inr(SBI_FEE_INR)} annual fee. Fuel, rent, govt and wallets don't count.`,
        href: "/milestones",
        cta: "See milestones",
        progress: { current: sbiFee, target: SBI_FEE_WAIVER_INR },
        weight: 80,
      });
    }
  }

  // —— HSBC Live+ annual-fee waiver ——
  const live = s.hsbcLivePlusYtdSpend ?? 0;
  if (live > 0 && live < LIVE_PLUS_WAIVER_INR) {
    const left = LIVE_PLUS_WAIVER_INR - live;
    if (left <= GATE_NEAR_INR) {
      out.push({
        id: "liveplus-waiver",
        area: "money",
        tone: "opportunity",
        title: `${inr(left)} from the HSBC Live+ fee waiver`,
        detail: `${inr(LIVE_PLUS_WAIVER_INR)} of annual spend saves the ${inr(LIVE_PLUS_FEE_INR)} fee.`,
        href: "/milestones",
        cta: "See milestones",
        progress: { current: live, target: LIVE_PLUS_WAIVER_INR },
        weight: 78,
      });
    }
  }

  // —— Any annual milestone within reach ——
  for (const m of ANNUAL_MILESTONES) {
    const ytd = ytdFor(m.cardId, s);
    if (ytd == null || ytd >= m.threshold || m.rewardValueInr < 500) continue;
    const left = m.threshold - ytd;
    if (left > GATE_NEAR_INR) continue;
    const card = getCardById(m.cardId);
    out.push({
      id: `ms-${m.cardId}-${m.threshold}`,
      area: "money",
      tone: "opportunity",
      title: `${inr(left)} from ${card?.short ?? m.cardId}'s ${inr(m.threshold)} milestone`,
      detail: `Unlocks ${m.reward} — worth about ${inr(m.rewardValueInr)}.`,
      href: "/milestones",
      cta: "See milestones",
      progress: { current: ytd, target: m.threshold },
      weight: 70 + Math.min(9, Math.round(m.rewardValueInr / 1000)),
    });
  }

  return out;
}

function travelItems(trips: Trip[], today: string): BriefingItem[] {
  const out: BriefingItem[] = [];
  const upcoming = trips
    .map((t) => ({ t, start: toDateOnly(t.startDate), days: daysBetween(today, toDateOnly(t.startDate)) }))
    .filter((x) => Number.isFinite(x.days) && x.days >= 0)
    .sort((a, b) => a.days - b.days);

  const next = upcoming[0];
  if (next) {
    const { booked, total } = bookedProgress(next.t);
    const pending = total - booked;
    const when =
      next.days === 0 ? "today" : next.days === 1 ? "tomorrow" : `in ${next.days} days`;
    out.push({
      id: `trip-${next.t.id}`,
      area: "travel",
      tone: pending > 0 && next.days <= 14 ? "urgent" : "info",
      title: `${next.t.name || "Trip"} starts ${when}`,
      detail:
        total === 0
          ? "Nothing planned yet — add the flights and stays you've found."
          : pending > 0
            ? `${pending} of ${total} item${total === 1 ? "" : "s"} still unbooked.`
            : `All ${total} items booked.`,
      href: "/travel",
      cta: "Open trip",
      progress: total > 0 ? { current: booked, target: total } : undefined,
      weight: pending > 0 && next.days <= 14 ? 95 : 60,
    });
  }

  return out;
}

function noteItems(notes: Note[]): BriefingItem[] {
  const pinned = notes.filter((n) => n.pinned);
  if (pinned.length === 0) return [];
  return [
    {
      id: "notes-pinned",
      area: "notes",
      tone: "info",
      title: `${pinned.length} pinned note${pinned.length === 1 ? "" : "s"}`,
      detail: pinned
        .slice(0, 3)
        .map((n) => n.title.trim() || "Untitled")
        .join(" · "),
      href: "/notes",
      cta: "Open notes",
      weight: 40,
    },
  ];
}

export function buildBriefing(input: {
  state: AppState;
  trips: Trip[];
  notes: Note[];
  today: string;
}): BriefingItem[] {
  return [
    ...moneyItems(input.state, input.today),
    ...travelItems(input.trips, input.today),
    ...noteItems(input.notes),
  ].sort((a, b) => b.weight - a.weight);
}

export function greeting(d: Date = new Date()): string {
  const h = d.getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
