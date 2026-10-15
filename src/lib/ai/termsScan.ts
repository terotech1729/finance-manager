import { CARDS } from "../cards";
import { sanitisePatch, type CardPatch } from "../cardOverlay";
import type { Card } from "../types";
import { askGrounded, extractJson, type AiSource } from "./client";
import type { Confidence, NewIntel } from "./intelStore";

/** What the model is asked to return, one object per change it finds. */
type RawFinding = {
  cardId?: string;
  field?: string;
  currentValue?: string;
  newValue?: string;
  direction?: string;
  summary?: string;
  detail?: string;
  effectiveOn?: string;
  confidence?: string;
  issuerUrl?: string;
};

/**
 * Fields the scan may propose, with the type the engine expects. Named explicitly in
 * the prompt so the model patches `forexPct: 1.99` rather than inventing a shape the
 * sanitiser would silently discard.
 */
const SCANNABLE_FIELDS = `
- annualFee (number, rupees incl. GST)
- feeWaiverAt (number, annual spend that waives the fee)
- forexPct (number, e.g. 1.99)
- creditLimit (number) — ONLY if the issuer changed the product's limit range, never the user's own limit
- loungeRule (string, short: e.g. "2 domestic/yr (1 per 6 months) + 1 international/yr")
- baseRatePct (number, headline base earn rate as a percentage)
- bestRatePct (number, best accelerated rate as a percentage)
- pointValue (number, rupees per point/mile)
- status (string: "active" | "closed" | "applied" | "future") — only if the product is WITHDRAWN from market
- notes (string) — the catch-all for exclusions, caps, milestones and promos
`.trim();

function cardBrief(c: Card): string {
  return [
    `- id: ${c.id}`,
    `  name: ${c.name} (${c.network}, ${c.issuer})`,
    `  annualFee: ${c.annualFee}, feeWaiverAt: ${c.feeWaiverAt ?? "none"}, forexPct: ${c.forexPct}`,
    `  baseRatePct: ${c.baseRatePct}, bestRatePct: ${c.bestRatePct}, pointValue: ${c.pointValue}`,
    `  loungeRule: ${c.loungeRule ?? "none"}`,
    `  notes: ${(c.notes ?? "").slice(0, 700)}`,
  ].join("\n");
}

export function buildTermsPrompt(cards: readonly Card[], since: string): string {
  return `You are auditing an Indian credit-card portfolio tracker against the issuers' CURRENT published terms.

Today is ${new Date().toISOString().slice(0, 10)}. Focus on changes announced or effective since ${since}, including changes announced now but effective later.

For EACH card below, search the web — prioritise the issuer's own site (MITC, service guide, "revision in charges", "important updates" pages), then reputable India card-tracking sources — and decide whether the stored values are still correct.

CARDS CURRENTLY TRACKED:
${cards.map(cardBrief).join("\n")}

FIELDS YOU MAY PROPOSE CHANGING:
${SCANNABLE_FIELDS}

RULES — read carefully, these matter more than completeness:
1. Report ONLY changes you can tie to a specific published source. If you cannot find a source, report nothing for that card. Silence is a correct answer.
2. Do NOT report a difference that is merely a rewording of the same rule. Only real changes in substance.
3. "creditLimit" in this data is the USER'S OWN sanctioned limit. Never propose changing it unless the issuer restructured the product's limit range.
4. Prefer the issuer's own URL as issuerUrl. Blogs and forums may inform you but must not be the only basis for a "high" confidence rating.
5. If an issuer has ANNOUNCED a future change, report it with its effectiveOn date rather than waiting for it to take effect.
6. confidence: "high" only with an issuer-domain source stating the change plainly. "medium" with credible secondary reporting. "low" for anything thinner.

Return ONLY a JSON array (no prose), each element:
{
  "cardId": "<the exact id from the list above>",
  "field": "<one of the fields listed, or null for an advisory note with no field>",
  "currentValue": "<what the tracker stores>",
  "newValue": "<the correct value — for numeric fields, digits only, e.g. 1.99>",
  "direction": "devaluation" | "revaluation" | "neutral",
  "summary": "<one sentence, plain English, no marketing language>",
  "detail": "<2-3 sentences: what changed, who it affects, what to do>",
  "effectiveOn": "YYYY-MM-DD or null",
  "confidence": "high" | "medium" | "low",
  "issuerUrl": "<the single best source URL>"
}

If nothing has changed for any card, return [].`;
}

const VALID_DIRECTIONS = new Set(["devaluation", "revaluation", "neutral"]);
const VALID_CONFIDENCE = new Set(["high", "medium", "low"]);

/**
 * A stable identity for a finding, so re-scanning the same unchanged fact tomorrow
 * updates one row instead of filing a duplicate. Deliberately excludes free text —
 * the model phrases the same change differently each run.
 */
export function fingerprintOf(cardId: string, field: string | null, newValue: string | null): string {
  return `${cardId}::${field ?? "advisory"}::${(newValue ?? "").trim().toLowerCase()}`;
}

/**
 * Decides whether a finding may apply itself.
 *
 * The dividing line is whether a wrong answer could cost money. Anything that feeds the
 * recommender — a rate, a fee, a markup, a lounge rule — waits for a human, because a
 * hallucinated 5% rate would quietly route every future spend to the wrong card and the
 * damage would be invisible. Narrative fields can't change a ranking, so they flow
 * straight through; that is what keeps the portal current without a redeploy.
 */
export function autoApplicable(field: string | null, confidence: Confidence): boolean {
  if (!field) return false;
  // `notes` is the one patchable field no code path scores on — it renders on the card
  // page and nowhere else — so a wrong value misinforms but cannot misroute.
  if (field === "notes") return confidence !== "low";
  return false;
}

/**
 * Domains that count as "the issuer said so".
 *
 * Spelled out rather than derived from the issuer name, because the two rarely match:
 * Bank of Baroda publishes cards at bobcard.co.in, SBI Card at sbicard.com. Deriving
 * this would silently mark every genuine issuer citation as third-party and quietly
 * cap the whole scan at medium confidence.
 */
const ISSUER_DOMAINS: Record<string, string[]> = {
  "American Express": ["americanexpress.com"],
  "Federal Bank": ["federalbank.co.in", "scapia.cards"],
  "IDFC FIRST Bank": ["idfcfirstbank.com", "idfcfirst.bank.in"],
  "Bank of Baroda": ["bobcard.co.in", "bankofbaroda.in"],
  "YES Bank": ["yesbank.in", "yes.bank.in", "gokiwi.in"],
  "SBI Card": ["sbicard.com"],
  "ICICI Bank": ["icicibank.com"],
  HSBC: ["hsbc.co.in", "hsbc.com"],
};

function issuerDomain(card: Card, url: string): boolean {
  let host = "";
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  const domains = ISSUER_DOMAINS[card.issuer] ?? [];
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

/** Coerces one raw model object into a storable finding, or null if unusable. */
export function normaliseFinding(
  raw: RawFinding,
  cards: readonly Card[],
  extraSources: AiSource[]
): NewIntel | null {
  const card = cards.find((c) => c.id === raw.cardId);
  if (!card || !raw.summary) return null;

  const field = raw.field && raw.field !== "null" ? raw.field : null;
  const confidence: Confidence = VALID_CONFIDENCE.has(raw.confidence ?? "")
    ? (raw.confidence as Confidence)
    : "low";
  const direction = VALID_DIRECTIONS.has(raw.direction ?? "")
    ? (raw.direction as NewIntel["direction"])
    : "neutral";

  const sources: AiSource[] = [];
  if (raw.issuerUrl) sources.push({ title: `${card.issuer} — source`, url: raw.issuerUrl });
  sources.push(...extraSources.slice(0, 4));

  const fromIssuer = raw.issuerUrl ? issuerDomain(card, raw.issuerUrl) : false;
  const newValue = raw.newValue != null ? String(raw.newValue) : null;

  // A field change the sanitiser would reject is worse than useless: it would sit in the
  // queue offering an "Apply" button that silently does nothing. Demote it to advisory.
  const patch = field ? sanitisePatch({ [field]: coerce(field, newValue, card) }, card) : {};
  const applicable = field != null && Object.keys(patch).length > 0;
  const effConfidence: Confidence = fromIssuer
    ? confidence
    : confidence === "high"
      ? "medium"
      : confidence;

  return {
    card_id: card.id,
    card_name: card.short,
    kind: "term_change",
    status: !applicable
      ? "advisory"
      : autoApplicable(field, effConfidence)
        ? "applied"
        : "proposed",
    direction,
    field: applicable ? field : null,
    current_value: raw.currentValue ?? null,
    proposed_value: newValue,
    summary: raw.summary,
    detail: raw.detail ?? null,
    effective_on: /^\d{4}-\d{2}-\d{2}$/.test(raw.effectiveOn ?? "") ? raw.effectiveOn! : null,
    sources,
    confidence: effConfidence,
    fingerprint: fingerprintOf(card.id, applicable ? field : null, newValue),
  };
}

/** The overlay patch a finding would write, used on apply and for auto-applied rows. */
export function patchForFinding(finding: NewIntel, cards: readonly Card[]): CardPatch | null {
  const card = cards.find((c) => c.id === finding.card_id);
  if (!card || !finding.field) return null;
  const patch = sanitisePatch({ [finding.field]: coerce(finding.field, finding.proposed_value, card) }, card);
  return Object.keys(patch).length > 0 ? patch : null;
}

/** Casts a model's string value to the type the catalogue field holds. */
export function coerce(field: string, value: string | null, card: Card): unknown {
  if (value == null) return null;
  const current = (card as unknown as Record<string, unknown>)[field];
  if (typeof current === "number") {
    const digits = String(value).replace(/[^0-9.]/g, "");
    // Must check for "no digits at all" before Number(): Number("") is 0, so a model
    // answering "n/a" or "unchanged" would otherwise be read as a confident zero —
    // and 0 is a real, meaningful value for a forex markup or an annual fee.
    if (!/\d/.test(digits)) return null;
    const n = Number(digits);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof current === "boolean") return /^(true|yes)$/i.test(value);
  return value;
}

export type TermsScanResult = {
  model: string;
  cardsScanned: number;
  findings: NewIntel[];
  rawText: string;
};

/** Runs the grounded terms audit over every card still in hand. */
export async function runTermsScan(sinceDays = 120): Promise<TermsScanResult> {
  const cards = CARDS.filter((c) => c.status === "active" || c.status === "applied");
  const since = new Date(Date.now() - sinceDays * 86400_000).toISOString().slice(0, 10);

  const ai = await askGrounded(buildTermsPrompt(cards, since), 12);
  const raw = extractJson<RawFinding[]>(ai.text);
  const list = Array.isArray(raw) ? raw : [];

  const findings = list
    .map((r) => normaliseFinding(r, cards, ai.sources))
    .filter((f): f is NewIntel => f !== null);

  return { model: ai.model, cardsScanned: cards.length, findings, rawText: ai.text };
}

export type { CardPatch };
