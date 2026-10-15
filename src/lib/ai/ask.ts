import { effectiveCards } from "../cards";
import { summariseLounges } from "../lounges";
import { buildRewardLedger } from "../rewards";
import { upcomingDeadlines } from "../deadlines";
import { buildPlan } from "../planner";
import type { AppState } from "../storage";
import { askGrounded } from "./client";
import { inr } from "../utils";

/**
 * Natural-language questions about the portfolio.
 *
 * The model never calculates. Every number in the context below is computed by the same
 * code that renders the portal — the recommender, the lounge ledger, the reward ledger,
 * the planner — and the model's only job is to select from it and explain it in prose.
 *
 * That split is the whole design. A language model asked "what's my best card for a ₹2L
 * laptop" will produce a confident, fluent, wrong answer, because the real answer depends
 * on milestone positions and credit limits it cannot see. Handing it the computed answer
 * and asking it to narrate keeps the arithmetic exact and uses the model for the part it
 * is actually good at.
 */

export type AskResult = { answer: string; model: string; contextLines: number };

/** A compact, factual snapshot of the portfolio as the engine currently sees it. */
export function buildContext(state: AppState, today = new Date()): string {
  const lines: string[] = [];
  const cards = effectiveCards().filter((c) => c.status === "active");

  lines.push("CARDS HELD (live terms):");
  for (const c of cards) {
    lines.push(
      `- ${c.short}: base ${c.baseRatePct}%, best ${c.bestRatePct}%, forex ${c.forexPct}%, ` +
        `limit ${c.creditLimit > 0 ? inr(c.creditLimit) : "no preset limit"}, ` +
        `fee ${inr(c.annualFee)}${c.feeWaiverAt ? ` (waived at ${inr(c.feeWaiverAt)})` : ""}`
    );
  }

  const lounges = summariseLounges(state);
  lines.push("", "LOUNGE ACCESS:");
  lines.push(
    `- Domestic: ${lounges.domestic.unlimited ? "unlimited" : lounges.domestic.visits} visits live ` +
      `(${lounges.domestic.liveCount} of ${lounges.domestic.totalCount} entitlements unlocked)`
  );
  lines.push(
    `- International: ${lounges.international.unlimited ? "unlimited" : lounges.international.visits} visits live`
  );
  for (const l of lounges.locked) lines.push(`- LOCKED: ${l.cardShort} — ${l.note ?? "gate not met"}`);

  const ledger = buildRewardLedger(state);
  lines.push("", "REWARD BALANCES:");
  for (const b of ledger.rows) {
    lines.push(
      `- ${b.label}: ${Math.round(b.units).toLocaleString("en-IN")} ${b.unitName} ≈ ${inr(b.inrValue)} ` +
        `(${b.confidence} confidence, ${b.liquidity})`
    );
  }
  lines.push(`- Bankable total: ${inr(ledger.bankableInr)}`);

  const deadlines = upcomingDeadlines(state, today, 90);
  if (deadlines.length) {
    lines.push("", "DEADLINES (next 90 days):");
    for (const d of deadlines.slice(0, 8)) {
      lines.push(`- in ${d.daysLeft}d — ${d.title}${d.valueInr ? ` (${inr(d.valueInr)})` : ""}`);
    }
  }

  const plan = buildPlan(state, 80000, today);
  if (plan.steps.length) {
    lines.push("", "MILESTONES STILL COLLECTABLE:");
    for (const s of plan.steps.slice(0, 8)) {
      lines.push(
        `- ${s.cardShort}: ${inr(s.remainingInr)} more → ${inr(s.rewardInr)} ` +
          `(${(s.efficiency * 100).toFixed(1)}% marginal) — ${s.label}`
      );
    }
    lines.push(`- Total collectable: ${inr(plan.collectableInr)} for ${inr(plan.spendNeededInr)} of spend`);
  }
  if (plan.unreachable.length) {
    lines.push("", "MILESTONES OUT OF REACH THIS YEAR:");
    for (const s of plan.unreachable.slice(0, 5)) lines.push(`- ${s.cardShort}: ${s.why}`);
  }

  return lines.join("\n");
}

export async function askJarvis(question: string, state: AppState, today = new Date()): Promise<AskResult> {
  const context = buildContext(state, today);

  const prompt = `You are Jarvis, the assistant inside a personal credit-card portal. Answer the user's question using ONLY the data below, which was computed by the portal itself moments ago.

${context}

QUESTION: ${question}

Rules:
1. Use the numbers above exactly. Do not recalculate, re-derive or round them differently.
2. If the data doesn't contain the answer, say so plainly and name which page of the portal would have it. Do not fill the gap from general knowledge about Indian credit cards — the user's actual position is what matters and it is above.
3. Lead with the answer in one sentence, then the reasoning.
4. Be concise and specific. No marketing language, no hedging, no bulleted restatement of the data.
5. Address the user as "sir" only if it reads naturally; never force it.`;

  const ai = await askGrounded(prompt, 0);
  return { answer: ai.text.trim(), model: ai.model, contextLines: context.split("\n").length };
}
