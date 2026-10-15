/**
 * Safety suite for the card-intelligence layer.
 * Run: npm run test:intel
 *
 * These assertions all guard the same boundary: untrusted model output reaching the
 * scoring engine. Everything here is pure — no network, no API key, no model call.
 */
import assert from "node:assert/strict";
import { getCardById, effectiveCards } from "../src/lib/cards";
import { hydrateCardOverlay, clearCardOverlay, sanitisePatch, isOverlaid } from "../src/lib/cardOverlay";
import { recommend } from "../src/lib/recommend";
import { autoApplicable, coerce, fingerprintOf, normaliseFinding } from "../src/lib/ai/termsScan";
import { extractJson } from "../src/lib/ai/client";
import { summariseSpend } from "../src/lib/ai/spendProfile";

let failed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL  ${name}\n      ${(e as Error).message}`);
  }
}

const cards = effectiveCards();
const bob = getCardById("bob_eterna")!;

check("overlay changes what the engine scores", () => {
  const fxReturn = () => {
    const r = recommend({
      amount: 100000, merchant: "Marriott Dubai", category: "hotel",
      channel: "foreign", isForeign: true, today: "2026-10-15",
    } as never);
    const rows = [r.best, ...(r.alternatives ?? [])].filter(Boolean);
    const row = rows.find((o) => o?.cardId === "bob_eterna");
    assert.ok(row, "BOB should be ranked on a foreign hotel spend");
    return row.totalRewardInr;
  };
  const before = fxReturn();
  hydrateCardOverlay({ bob_eterna: { forexPct: 0 } });
  const after = fxReturn();
  assert.equal(getCardById("bob_eterna")!.forexPct, 0, "overlay should change the card");
  assert.ok(after > before, `zero forex should improve the return (${before} → ${after})`);
  assert.ok(isOverlaid("bob_eterna"));
  clearCardOverlay();
  assert.equal(getCardById("bob_eterna")!.forexPct, 2, "clearing restores the compiled value");
});

check("sanitiser drops unknown keys, id writes and wrong types", () => {
  assert.deepEqual(sanitisePatch({ forexPct: 1.99 }, bob), { forexPct: 1.99 });
  assert.deepEqual(sanitisePatch({ forexPct: "1.99%" }, bob), {}, "string into a number field");
  assert.deepEqual(sanitisePatch({ id: "hacked" }, bob), {}, "id must never be patchable");
  assert.deepEqual(sanitisePatch({ nonsense: true }, bob), {}, "unknown key");
  assert.deepEqual(sanitisePatch(null, bob), {});
});

check("only non-scoring fields may auto-apply", () => {
  assert.equal(autoApplicable("notes", "high"), true);
  assert.equal(autoApplicable("notes", "low"), false);
  for (const f of ["forexPct", "annualFee", "status", "loungeRule", "baseRatePct"]) {
    assert.equal(autoApplicable(f, "high"), false, `${f} must require approval`);
  }
  assert.equal(autoApplicable(null, "high"), false);
});

check("coerce never turns a non-number into zero", () => {
  assert.equal(coerce("forexPct", "1.99%", bob), 1.99);
  assert.equal(coerce("annualFee", "₹1,179", bob), 1179);
  // The important one: Number("") is 0, and 0% forex is a real value a bad parse
  // would assert with total confidence.
  assert.equal(coerce("forexPct", "n/a", bob), null);
  assert.equal(coerce("forexPct", "unchanged", bob), null);
  assert.equal(coerce("loungeRule", "2 per year", bob), "2 per year");
});

check("fingerprints are stable across rephrasing", () => {
  assert.equal(
    fingerprintOf("bob_eterna", "forexPct", " 1.99 "),
    fingerprintOf("bob_eterna", "forexPct", "1.99")
  );
  assert.notEqual(
    fingerprintOf("bob_eterna", "forexPct", "1.99"),
    fingerprintOf("bob_eterna", "forexPct", "2.50")
  );
});

check("extractJson survives prose and code fences", () => {
  assert.deepEqual(extractJson('Here you go:\n```json\n[{"a":1}]\n```'), [{ a: 1 }]);
  assert.deepEqual(extractJson('I found: [{"b":2}] hope that helps'), [{ b: 2 }]);
  assert.equal(extractJson("no json at all"), null);
});

check("an unusable value is demoted to advisory, not proposed", () => {
  const junk = normaliseFinding(
    { cardId: "bob_eterna", field: "forexPct", newValue: "cheaper now", summary: "x", confidence: "high" },
    cards, []
  );
  assert.equal(junk?.status, "advisory", "must not offer an Apply button that would do nothing");
  assert.equal(junk?.field, null);
});

check("issuer-sourced findings keep high confidence; others are demoted", () => {
  const issuer = normaliseFinding(
    { cardId: "bob_eterna", field: "forexPct", newValue: "1.75", summary: "x",
      confidence: "high", issuerUrl: "https://www.bobcard.co.in/terms" },
    cards, []
  );
  assert.equal(issuer?.confidence, "high", "bobcard.co.in is Bank of Baroda's card domain");
  assert.equal(issuer?.status, "proposed", "a scoring field still needs approval");

  const blog = normaliseFinding(
    { cardId: "bob_eterna", field: "forexPct", newValue: "1.75", summary: "x",
      confidence: "high", issuerUrl: "https://randomblog.example/post" },
    cards, []
  );
  assert.equal(blog?.confidence, "medium", "a blog cannot support high confidence");
});

check("unknown cards and empty findings are dropped", () => {
  assert.equal(normaliseFinding({ cardId: "not_a_card", summary: "x" }, cards, []), null);
  assert.equal(normaliseFinding({ cardId: "bob_eterna" }, cards, []), null, "no summary");
});

check("spend profile uses recent transactions only", () => {
  const p = summariseSpend(
    [
      { id: "1", date: "2026-10-01", amount: 30000, category: "dining" },
      { id: "2", date: "2026-09-15", amount: 60000, category: "travel" },
      { id: "3", date: "2025-01-01", amount: 999999, category: "ancient" },
    ] as never,
    new Date("2026-10-15")
  );
  assert.ok(!p.topCategories.some((c) => c.category === "ancient"), "old spend must not count");
  assert.equal(p.topCategories[0].category, "travel", "sorted by size");
  assert.ok(p.monthlyTotalInr > 0 && p.monthlyTotalInr < 100000);
});

console.log(failed === 0 ? `\nOK — all intel checks passed` : `\nFAILED — ${failed} check(s)`);
process.exit(failed === 0 ? 0 : 1);
