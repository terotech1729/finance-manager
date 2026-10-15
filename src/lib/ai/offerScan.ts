import { effectiveCards } from "../cards";
import { askGrounded, extractJson, type AiSource } from "./client";
import type { Confidence, NewIntel } from "./intelStore";

type RawOffer = {
  cardId?: string;
  merchant?: string;
  offer?: string;
  detail?: string;
  validTill?: string;
  minSpend?: string;
  confidence?: string;
  sourceUrl?: string;
};

/**
 * Time-boxed bank offers and portal rotations.
 *
 * Kept apart from the terms scan because the two have opposite shapes. A term change is
 * permanent and worth patching into the catalogue; an offer expires in a fortnight and
 * should never be written into a card's baseline. These are always advisory, and they
 * carry a validTill so a stale one can be aged out rather than quietly outliving itself.
 */
export function buildOfferPrompt(cardShorts: string[]): string {
  return `Find CURRENT, time-limited offers on these Indian credit cards. Today is ${new Date().toISOString().slice(0, 10)}.

CARDS: ${cardShorts.join(", ")}

Search the issuers' offer pages and the major reward portals (HDFC SmartBuy, Amex ShopWise, SBI Card offers, ICICI iShop, bank "offer zone" pages) plus current festival or seasonal campaigns.

RULES:
1. Only offers valid TODAY or starting soon. Expired offers are worthless here — do not include them.
2. Only offers on the cards listed. Skip everything else.
3. Include the minimum spend and the cap, since an uncapped-sounding offer usually isn't.
4. Skip anything requiring a card the user doesn't hold, or a banking relationship.
5. Prefer precision over volume. Five real offers beat twenty vague ones.

Return ONLY a JSON array:
{
  "cardId": "<card short name from the list>",
  "merchant": "<merchant or platform>",
  "offer": "<short, e.g. '10% instant discount up to ₹1,500'>",
  "detail": "<1-2 sentences including min spend, cap and how to claim>",
  "validTill": "YYYY-MM-DD or null",
  "minSpend": "<e.g. '₹5,000' or null>",
  "confidence": "high" | "medium" | "low",
  "sourceUrl": "<source URL>"
}

Return [] if there is nothing live worth acting on.`;
}

const VALID_CONFIDENCE = new Set(["high", "medium", "low"]);

export function normaliseOffer(raw: RawOffer, extraSources: AiSource[]): NewIntel | null {
  if (!raw.offer || !raw.merchant) return null;

  const confidence: Confidence = VALID_CONFIDENCE.has(raw.confidence ?? "")
    ? (raw.confidence as Confidence)
    : "low";

  const validTill = /^\d{4}-\d{2}-\d{2}$/.test(raw.validTill ?? "") ? raw.validTill! : null;
  // An offer that has already lapsed is noise, and the model does sometimes return one.
  if (validTill && new Date(validTill) < new Date()) return null;

  const sources: AiSource[] = [];
  if (raw.sourceUrl) sources.push({ title: raw.merchant, url: raw.sourceUrl });
  sources.push(...extraSources.slice(0, 2));

  const slug = `${raw.cardId ?? "card"}-${raw.merchant}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return {
    card_id: slug,
    card_name: raw.cardId ?? null,
    kind: "new_card",
    status: "advisory",
    direction: "revaluation",
    field: null,
    current_value: raw.minSpend ?? null,
    proposed_value: null,
    summary: `${raw.merchant}: ${raw.offer}`,
    detail: [raw.detail, raw.minSpend ? `Min spend ${raw.minSpend}.` : "", validTill ? `Valid till ${validTill}.` : ""]
      .filter(Boolean)
      .join(" "),
    effective_on: validTill,
    sources,
    confidence,
    fingerprint: `offer::${slug}::${validTill ?? "open"}`,
  };
}

export async function runOfferScan(): Promise<{ model: string; findings: NewIntel[] }> {
  const shorts = effectiveCards()
    .filter((c) => c.status === "active")
    .map((c) => c.short);

  const ai = await askGrounded(buildOfferPrompt(shorts), 10);
  const raw = extractJson<RawOffer[]>(ai.text);
  const list = Array.isArray(raw) ? raw : [];

  return {
    model: ai.model,
    findings: list.map((r) => normaliseOffer(r, ai.sources)).filter((f): f is NewIntel => f !== null),
  };
}
