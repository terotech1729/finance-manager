import type { Card } from "./types";

/**
 * Runtime patches over the compiled card catalogue.
 *
 * `CARDS` in cards.ts is a compile-time constant, so until now every issuer change —
 * a raised lounge gate, a cut forex markup, a withdrawn milestone — meant editing code
 * and redeploying. Issuers change terms far more often than this app ships.
 *
 * The overlay closes that gap. The catalogue stays the baseline (and stays the single
 * source of truth for tests and for a cold server render); accepted findings from the
 * daily scan are stored in Supabase and merged on top at boot. Nothing here mutates
 * `CARDS` itself, so a failed or empty fetch simply leaves the compiled values in place.
 */

/** A partial Card — only the fields a scan actually proposed changing. */
export type CardPatch = Partial<Omit<Card, "id">>;

/**
 * Fields a patch is allowed to touch. Anything else in an incoming payload is dropped.
 *
 * This is a safety boundary, not a type convenience. Patches originate from a language
 * model reading issuer pages, and they reach the scoring engine; an unconstrained merge
 * would let a bad scan introduce arbitrary keys, or overwrite `id` and detach a card
 * from its transaction history.
 */
const PATCHABLE = new Set<keyof Card>([
  "name", "short", "network", "issuer", "creditLimit", "annualFee", "feeWaivable",
  "feeWaiverAt", "forexPct", "loungeRule", "status", "pointValue", "baseRatePct",
  "bestRatePct", "statementDay", "notes",
]);

let overlay: Readonly<Record<string, CardPatch>> = {};
let hydratedAt: number | null = null;

/** Strips unknown keys and type-mismatched values from an untrusted patch. */
export function sanitisePatch(raw: unknown, baseline: Card): CardPatch {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = k as keyof Card;
    if (!PATCHABLE.has(key)) continue;
    if (v === null || v === undefined) continue;
    // A patch may only replace a value with one of the same shape. Catches a model
    // returning "1.99%" where the engine divides by a number, which would otherwise
    // turn every forex calculation into NaN.
    if (typeof v !== typeof baseline[key]) continue;
    out[k] = v;
  }
  return out as CardPatch;
}

/**
 * Installs the overlay fetched from Supabase. Called once during boot, before the
 * first data page renders, so no screen ever shows pre-overlay numbers and then
 * silently changes them underneath the reader.
 */
export function hydrateCardOverlay(patches: Record<string, CardPatch>): void {
  overlay = patches;
  hydratedAt = Date.now();
}

export function clearCardOverlay(): void {
  overlay = {};
  hydratedAt = null;
}

export function overlayStatus(): { active: boolean; cards: number; hydratedAt: number | null } {
  return { active: Object.keys(overlay).length > 0, cards: Object.keys(overlay).length, hydratedAt };
}

/** The patch for one card, or undefined when the catalogue value is current. */
export function patchFor(cardId: string): CardPatch | undefined {
  return overlay[cardId];
}

/** Applies any overlay patch to a baseline catalogue entry. */
export function withOverlay(card: Card): Card {
  const p = overlay[card.id];
  return p ? { ...card, ...p } : card;
}

/** True when this card's displayed terms differ from what shipped in the bundle. */
export function isOverlaid(cardId: string): boolean {
  return Object.keys(overlay[cardId] ?? {}).length > 0;
}
