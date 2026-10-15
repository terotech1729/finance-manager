import { CARDS } from "../cards";
import { ALL_CATEGORIES } from "../categorize";
import { askGrounded, extractJson } from "./client";

/**
 * Turns "2400 at Toit last night on Amex" into a transaction draft.
 *
 * Parsing only — the draft is always shown for confirmation before anything is saved.
 * The model picks a card and a category from fixed lists rather than inventing them, so
 * the worst case is a wrong choice from a valid set, not an unknown card id that would
 * quietly fail every downstream lookup.
 *
 * Reward figures are deliberately NOT asked for. Those come from the recommender once
 * the card and category are known; asking a model to compute them would replace an
 * exact answer with a plausible one.
 */

export type SpendDraft = {
  amount: number | null;
  merchant: string;
  category: string;
  cardId: string | null;
  date: string;
  channel: string;
  /** Anything the model couldn't resolve, so the form can highlight it. */
  missing: string[];
  note?: string;
};

const CHANNELS = ["online", "offline_pos", "upi", "upi_normal", "merchant_app", "foreign"];

// The portal's own category vocabulary, not an invented one. These exact strings are what
// the recommender keys its accelerated-earn rules off, so a near-miss like "dining" where
// the engine expects "dining / restaurants" would route the spend as uncategorised.
const CATEGORIES = ALL_CATEGORIES as readonly string[];

export function buildParsePrompt(text: string, today: string): string {
  const cards = CARDS.filter((c) => c.status === "active")
    .map((c) => `  ${c.id} — ${c.short} (${c.issuer}, ${c.network})`)
    .join("\n");

  return `Parse this spend note into structured data. Today is ${today}.

NOTE: "${text}"

Pick cardId from EXACTLY this list, or null if the note doesn't identify one:
${cards}

Pick category from EXACTLY this list (copy the string verbatim, including spaces and brackets):
${CATEGORIES.map((c) => `  ${c}`).join("\n")}
Pick channel from EXACTLY this list: ${CHANNELS.join(", ")}

Rules:
- "amex" alone is ambiguous when several Amex cards are held — pick null and list "cardId" in missing.
- Resolve relative dates ("last night", "yesterday", "on Tuesday") against today's date.
- Amounts may be written as 2.4k, 2,400, Rs 2400 or ₹2400. Return a plain number.
- If the note names a merchant you recognise, infer the category from it (Toit → dining, Blinkit → groceries).
- Do NOT guess an amount. If there is no number, set it null and list "amount" in missing.
- channel: a UPI payment is "upi"; a card swiped in person is "offline_pos"; a website is "online"; an in-app payment like Swiggy or Uber is "merchant_app".

Return ONLY this JSON object:
{
  "amount": <number or null>,
  "merchant": "<name, title case, or empty string>",
  "category": "<from the list>",
  "cardId": "<from the list, or null>",
  "date": "YYYY-MM-DD",
  "channel": "<from the list>",
  "missing": ["<field names you could not determine>"],
  "note": "<anything else worth keeping, or omit>"
}`;
}

const VALID_CARD_IDS = new Set(CARDS.map((c) => c.id));

/** Clamps a parsed draft to known-good values. */
export function sanitiseDraft(raw: unknown, today: string): SpendDraft {
  const r = (raw ?? {}) as Record<string, unknown>;
  const missing = new Set(Array.isArray(r.missing) ? r.missing.map(String) : []);

  const amount = typeof r.amount === "number" && Number.isFinite(r.amount) && r.amount > 0 ? r.amount : null;
  if (amount == null) missing.add("amount");

  // A card id outside the catalogue is worse than none: it would be saved against a
  // card that doesn't exist and silently skip every milestone counter.
  const cardId = typeof r.cardId === "string" && VALID_CARD_IDS.has(r.cardId) ? r.cardId : null;
  if (cardId == null) missing.add("cardId");

  const date = typeof r.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : today;
  const category =
    typeof r.category === "string" && CATEGORIES.includes(r.category) ? r.category : "general";
  const channel = typeof r.channel === "string" && CHANNELS.includes(r.channel) ? r.channel : "online";

  return {
    amount,
    merchant: typeof r.merchant === "string" ? r.merchant.slice(0, 80) : "",
    category,
    cardId,
    date,
    channel,
    missing: [...missing],
    note: typeof r.note === "string" ? r.note.slice(0, 200) : undefined,
  };
}

export async function parseSpendNote(text: string, today = new Date().toISOString().slice(0, 10)) {
  // No web search: this is pure text parsing and a search would only add latency.
  const ai = await askGrounded(buildParsePrompt(text, today), 0);
  const raw = extractJson<Record<string, unknown>>(ai.text);
  return { draft: sanitiseDraft(raw, today), model: ai.model };
}
