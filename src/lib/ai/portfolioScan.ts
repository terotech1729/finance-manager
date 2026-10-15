import { CARDS, effectiveCards } from "../cards";
import { askGrounded, extractJson, type AiSource } from "./client";
import type { Card } from "../types";
import type { Confidence, NewIntel } from "./intelStore";

type RawCandidate = {
  cardId?: string;
  cardName?: string;
  verdict?: string;
  summary?: string;
  detail?: string;
  gapFilled?: string;
  annualFee?: string;
  confidence?: string;
  sourceUrl?: string;
};

/**
 * Spend shape the recommendation is judged against.
 *
 * Passed in rather than inferred, because "should I get this card" is only answerable
 * against where the money actually goes. Without it the model reverts to reviewing cards
 * in the abstract, which is what every blog already does and is of no use here.
 */
export type SpendProfile = {
  monthlyTotalInr: number;
  topCategories: { category: string; monthlyInr: number }[];
  /** Commitments already soaking up spend — milestones in flight, fee waivers in reach. */
  committedInr: number;
};

function holdingLine(c: Card): string {
  return `- ${c.short} (${c.network}, fee ₹${c.annualFee}${c.feeWaiverAt ? `, waived at ₹${c.feeWaiverAt}` : ""}) — base ${c.baseRatePct}%, best ${c.bestRatePct}%, forex ${c.forexPct}%, lounge: ${c.loungeRule ?? "none"}`;
}

export function buildPortfolioPrompt(held: readonly Card[], spend: SpendProfile): string {
  const cats = spend.topCategories
    .map((t) => `  - ${t.category}: ~₹${Math.round(t.monthlyInr).toLocaleString("en-IN")}/mo`)
    .join("\n");

  return `You are advising on an Indian credit-card portfolio. Today is ${new Date().toISOString().slice(0, 10)}.

CARDS CURRENTLY HELD:
${held.map(holdingLine).join("\n")}

SPEND PROFILE:
- Total: ~₹${Math.round(spend.monthlyTotalInr).toLocaleString("en-IN")}/month
- Already committed to in-flight milestones and fee waivers: ~₹${Math.round(spend.committedInr).toLocaleString("en-IN")}
- Main categories:
${cats || "  - (not enough logged history yet)"}

Search the web for Indian credit cards currently open to new applicants, including cards launched or revamped in the last 12 months.

Answer two questions:
A. Is there a card NOT held that would genuinely improve this portfolio? For each, say which specific gap it fills.
B. Is any card HELD no longer worth its fee, given what the others already cover?

RULES — these are what make the answer useful rather than generic:
1. Marginal value only. A new card is worth having only if it beats the BEST card already held for that spend, on that spend. Do not recommend a card that merely duplicates existing coverage.
2. Account for cannibalisation. Spend moved to a new card is spend removed from an existing card's milestone or fee-waiver progress. With ₹${Math.round(spend.committedInr).toLocaleString("en-IN")} already committed, a card that diverts spend can be net-negative even at a higher headline rate.
3. Respect the fee. Quantify: roughly what annual return would this card produce on THIS spend profile, against its fee?
4. Do not recommend a card that is invite-only, discontinued, or requires a banking relationship the user has no sign of having.
5. If the portfolio is already well covered, say so and return few or no candidates. "Nothing to change" is a valuable and acceptable answer.
6. Be concrete about eligibility friction: a hard inquiry, an issuer cooling-off period, or an existing card with the same issuer.

Return ONLY a JSON array (no prose):
{
  "cardId": "<lowercase-slug, e.g. hdfc-infinia>",
  "cardName": "<full product name>",
  "verdict": "add" | "drop" | "watch",
  "summary": "<one sentence recommendation>",
  "detail": "<3-4 sentences: the gap it fills, rough annual value on this profile vs its fee, and the catch>",
  "gapFilled": "<short phrase, e.g. 'international lounge' or 'jewellery MCC'>",
  "annualFee": "<e.g. '₹12,500 + GST, waived at ₹10L'>",
  "confidence": "high" | "medium" | "low",
  "sourceUrl": "<best source URL>"
}

Return [] if nothing is worth changing.`;
}

const VALID_VERDICTS = new Set(["add", "drop", "watch"]);
const VALID_CONFIDENCE = new Set(["high", "medium", "low"]);

export function normaliseCandidate(raw: RawCandidate, extraSources: AiSource[]): NewIntel | null {
  if (!raw.summary || !raw.cardName) return null;
  const verdict = VALID_VERDICTS.has(raw.verdict ?? "") ? raw.verdict! : "watch";
  const confidence: Confidence = VALID_CONFIDENCE.has(raw.confidence ?? "")
    ? (raw.confidence as Confidence)
    : "low";

  const slug =
    raw.cardId?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") ||
    raw.cardName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const sources: AiSource[] = [];
  if (raw.sourceUrl) sources.push({ title: raw.cardName, url: raw.sourceUrl });
  sources.push(...extraSources.slice(0, 3));

  return {
    card_id: slug,
    card_name: raw.cardName,
    kind: verdict === "drop" ? "drop_suggestion" : "new_card",
    // Portfolio advice is a judgement call, not a fact to patch into the catalogue —
    // there is no field to change, so it is always informational.
    status: "advisory",
    direction: verdict === "drop" ? "devaluation" : "neutral",
    field: null,
    current_value: null,
    proposed_value: raw.annualFee ?? null,
    summary: `${verdict === "add" ? "Consider" : verdict === "drop" ? "Consider dropping" : "Watch"}: ${raw.summary}`,
    detail: [raw.detail, raw.gapFilled ? `Gap: ${raw.gapFilled}.` : ""].filter(Boolean).join(" "),
    effective_on: null,
    sources,
    confidence,
    // Re-running tomorrow should refresh the same candidate, not stack another copy.
    fingerprint: `portfolio::${slug}::${verdict}`,
  };
}

export type PortfolioScanResult = {
  model: string;
  findings: NewIntel[];
  rawText: string;
};

export async function runPortfolioScan(spend: SpendProfile): Promise<PortfolioScanResult> {
  // Read through the overlay so the advice is judged against terms as they stand today,
  // including anything accepted since the last deploy.
  const held = effectiveCards().filter((c) => c.status === "active");
  const ai = await askGrounded(buildPortfolioPrompt(held, spend), 12);
  const raw = extractJson<RawCandidate[]>(ai.text);
  const list = Array.isArray(raw) ? raw : [];

  const findings = list
    .map((r) => normaliseCandidate(r, ai.sources))
    .filter((f): f is NewIntel => f !== null);

  return { model: ai.model, findings, rawText: ai.text };
}

/** Catalogue ids, so the prompt can be checked against what is actually held. */
export const HELD_IDS = CARDS.filter((c) => c.status === "active").map((c) => c.id);
