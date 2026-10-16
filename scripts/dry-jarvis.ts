/**
 * Checks for the deterministic AI-adjacent modules: deadlines, anomalies, planner and
 * the spend parser's sanitiser.
 *
 * No network and no model. Everything here is the arithmetic and the clamping that must
 * hold regardless of what any model returns — which is precisely the part worth testing,
 * since the model's output is only ever a suggestion passing through these guards.
 *
 *   npm run test:jarvis
 */
import assert from "node:assert/strict";
import { DEFAULT_STATE, type AppState } from "../src/lib/storage";
import type { Transaction } from "../src/lib/types";
import { upcomingDeadlines, urgencyOf } from "../src/lib/deadlines";
import { findAnomalies } from "../src/lib/anomalies";
import { buildPlan, inferMonthlyCapacity } from "../src/lib/planner";
import { sanitiseDraft } from "../src/lib/ai/parseSpend";
import { buildContext } from "../src/lib/ai/ask";
import { normaliseOffer } from "../src/lib/ai/offerScan";
import { sbiUnipayReturnInr, SBI_RP_OPTIMAL_TXN_INR } from "../src/lib/billRoutes";

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`  FAIL ${name}`);
    console.log(`       ${e instanceof Error ? e.message : String(e)}`);
  }
}

const TODAY = new Date("2026-10-15T09:00:00+05:30");
const state: AppState = { ...DEFAULT_STATE };

console.log("\nDeadlines");

check("returns only dated items inside the window, sorted nearest first", () => {
  const ds = upcomingDeadlines(state, TODAY, 90);
  assert.ok(ds.length > 0, "expected at least one deadline from the seeded state");
  for (const d of ds) {
    assert.ok(d.daysLeft >= 0, `${d.id} is in the past (${d.daysLeft}d)`);
    assert.ok(d.daysLeft <= 90, `${d.id} is outside the 90-day window (${d.daysLeft}d)`);
  }
  const days = ds.map((d) => d.daysLeft);
  assert.deepEqual(days, [...days].sort((a, b) => a - b), "not sorted by proximity");
});

check("a tighter window is a strict subset of a wider one", () => {
  const wide = upcomingDeadlines(state, TODAY, 90).map((d) => d.id);
  const tight = upcomingDeadlines(state, TODAY, 20).map((d) => d.id);
  for (const id of tight) assert.ok(wide.includes(id), `${id} appears at 20d but not at 90d`);
  assert.ok(tight.length <= wide.length);
});

check("no duplicate ids", () => {
  const ids = upcomingDeadlines(state, TODAY, 365).map((d) => d.id);
  assert.equal(new Set(ids).size, ids.length, `duplicates: ${ids.join(", ")}`);
});

check("urgency tracks days remaining monotonically", () => {
  const rank = { critical: 0, soon: 1, watch: 2 } as const;
  const ds = upcomingDeadlines(state, TODAY, 365);
  let last = -1;
  for (const d of ds) {
    const r = rank[urgencyOf(d)];
    assert.ok(r >= last, `${d.id} at ${d.daysLeft}d ranks below a nearer deadline`);
    last = r;
  }
});

check("every deadline links somewhere and says what to do", () => {
  for (const d of upcomingDeadlines(state, TODAY, 365)) {
    assert.ok(d.href.startsWith("/"), `${d.id} has no in-app link`);
    assert.ok(d.action.length > 0, `${d.id} has no action text`);
    assert.equal(typeof d.title, "string");
  }
});

console.log("\nAnomalies");

const txnsFor = (rows: Partial<Transaction>[]): Transaction[] =>
  rows.map((r, i) => ({
    id: `t${i}`,
    date: "2026-10-10",
    merchant: "Test",
    category: "general",
    amount: 100,
    mode: "upi",
    ...r,
  })) as Transaction[];

check("catches a same-merchant same-amount double charge", () => {
  const found = findAnomalies(
    state,
    txnsFor([
      { merchant: "Swiggy", amount: 842, date: "2026-10-12" },
      { merchant: "Swiggy", amount: 842, date: "2026-10-12" },
    ])
  );
  assert.ok(found.some((a) => a.kind === "duplicate"), "no duplicate flagged");
});

check("does not flag a repeat charge on a different day", () => {
  const found = findAnomalies(
    state,
    txnsFor([
      { merchant: "Swiggy", amount: 842, date: "2026-10-02" },
      { merchant: "Swiggy", amount: 842, date: "2026-10-12" },
    ])
  );
  assert.ok(!found.some((a) => a.kind === "duplicate"), "flagged a legitimate repeat order");
});

check("an empty log produces no transaction-derived anomalies", () => {
  const found = findAnomalies(state, []);
  for (const a of found) {
    assert.notEqual(a.kind, "duplicate", "found a duplicate with no transactions");
    assert.notEqual(a.kind, "subscription_creep", "found creep with no transactions");
  }
});

check("every anomaly carries a severity and a destination", () => {
  for (const a of findAnomalies(state, txnsFor([{ merchant: "Swiggy", amount: 842 }, { merchant: "Swiggy", amount: 842 }]))) {
    assert.ok(["high", "medium", "low"].includes(a.severity), `bad severity on ${a.id}`);
    assert.ok(a.href.startsWith("/"), `${a.id} has no link`);
  }
});

console.log("\nPlanner");

check("orders steps by marginal return, not by prize size", () => {
  const plan = buildPlan(state, 80000, TODAY);
  const eff = plan.steps.map((s) => s.efficiency);
  assert.deepEqual(eff, [...eff].sort((a, b) => b - a), "steps are not sorted by efficiency");
});

check("collectable is the sum of the step rewards", () => {
  const plan = buildPlan(state, 80000, TODAY);
  const reward = plan.steps.reduce((a, s) => a + s.rewardInr, 0);
  assert.ok(Math.abs(plan.collectableInr - reward) < 1, "collectable total disagrees with steps");
});

check("spend needed does not double-count a card's cumulative thresholds", () => {
  // Clearing ₹2L on a card also clears its ₹1L tier, so the naive sum of every step
  // overstates the spend required. The plan must take the largest per card instead.
  const plan = buildPlan(state, 80000, TODAY);
  const naive = plan.steps.reduce((a, s) => a + s.remainingInr, 0);
  const perCardMax = new Map<string, number>();
  for (const s of plan.steps) {
    perCardMax.set(s.cardId, Math.max(perCardMax.get(s.cardId) ?? 0, s.remainingInr));
  }
  const expected = [...perCardMax.values()].reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(plan.spendNeededInr - expected) < 1, "spend total disagrees with per-card maxima");
  assert.ok(plan.spendNeededInr <= naive + 1, "spend total exceeds the naive sum");
});

check("reachable and unreachable are disjoint", () => {
  const plan = buildPlan(state, 80000, TODAY);
  const reachable = new Set(plan.steps.map((s) => `${s.cardId}:${s.label}`));
  for (const u of plan.unreachable) {
    assert.ok(!reachable.has(`${u.cardId}:${u.label}`), `${u.cardShort} ${u.label} is in both lists`);
  }
});

check("zero capacity makes everything unreachable", () => {
  const plan = buildPlan(state, 0, TODAY);
  assert.equal(plan.steps.length, 0, "found collectable milestones with no spend capacity");
  assert.equal(plan.collectableInr, 0);
});

check("more capacity never collects less", () => {
  const low = buildPlan(state, 20000, TODAY).collectableInr;
  const high = buildPlan(state, 200000, TODAY).collectableInr;
  assert.ok(high >= low, `₹2L capacity collects ${high} but ₹20k collects ${low}`);
});

check("every unreachable milestone explains itself", () => {
  for (const u of buildPlan(state, 80000, TODAY).unreachable) {
    assert.ok(u.why.length > 0, `${u.cardShort} ${u.label} gives no reason`);
  }
});

check("inferred capacity is never negative", () => {
  assert.ok(inferMonthlyCapacity([]) >= 0);
  assert.ok(inferMonthlyCapacity(txnsFor([{ amount: 5000 }, { amount: -200 }])) >= 0);
});

console.log("\nSpend parser");

check("rejects a card id outside the catalogue", () => {
  const d = sanitiseDraft({ cardId: "hdfc_infinia_metal", amount: 500 }, "2026-10-15");
  assert.equal(d.cardId, null, "accepted a card the user doesn't hold");
  assert.ok(d.missing.includes("cardId"));
});

check("rejects a category outside the portal's vocabulary", () => {
  const d = sanitiseDraft({ category: "luxury yachts", amount: 500 }, "2026-10-15");
  assert.equal(d.category, "general", "accepted an invented category");
});

check("a missing amount is reported, not defaulted to zero", () => {
  const d = sanitiseDraft({ merchant: "Toit" }, "2026-10-15");
  assert.equal(d.amount, null, "invented an amount");
  assert.ok(d.missing.includes("amount"));
});

check("a non-positive amount is treated as missing", () => {
  for (const amount of [0, -500]) {
    const d = sanitiseDraft({ amount }, "2026-10-15");
    assert.equal(d.amount, null, `accepted ${amount} as an amount`);
  }
});

check("a malformed date falls back to today rather than being saved wrong", () => {
  for (const date of ["yesterday", "15/10/2026", "", null]) {
    const d = sanitiseDraft({ date, amount: 100 }, "2026-10-15");
    assert.equal(d.date, "2026-10-15", `accepted ${JSON.stringify(date)} as a date`);
  }
});

check("survives junk input without throwing", () => {
  for (const raw of [null, undefined, "not an object", 42, []]) {
    const d = sanitiseDraft(raw, "2026-10-15");
    assert.equal(d.amount, null);
    assert.equal(d.date, "2026-10-15");
  }
});

console.log("\nAsk context");

check("context contains real figures and no placeholders", () => {
  const ctx = buildContext(state, TODAY);
  assert.ok(ctx.includes("CARDS HELD"), "missing the card section");
  assert.ok(ctx.includes("LOUNGE ACCESS"), "missing the lounge section");
  assert.ok(ctx.includes("REWARD BALANCES"), "missing the reward section");
  assert.ok(!/\bundefined\b|\bNaN\b|\[object Object\]/.test(ctx), `context contains junk:\n${ctx}`);
});

check("context lists only cards actually held", () => {
  const ctx = buildContext(state, TODAY);
  assert.ok(!/Regalia/i.test(ctx), "a card that isn't held leaked into the context");
});

console.log("\nOffer normalisation");

check("drops an offer that has already expired", () => {
  const o = normaliseOffer(
    { cardId: "MRCC", merchant: "Amazon", offer: "10% off", validTill: "2020-01-01" },
    []
  );
  assert.equal(o, null, "kept a lapsed offer");
});

check("drops an offer with nothing to act on", () => {
  assert.equal(normaliseOffer({ merchant: "Amazon" }, []), null);
  assert.equal(normaliseOffer({ offer: "10% off" }, []), null);
});

check("an unrecognised confidence degrades to low rather than being trusted", () => {
  const o = normaliseOffer({ cardId: "MRCC", merchant: "Amazon", offer: "10% off", confidence: "certain" }, []);
  assert.ok(o);
  assert.equal(o.confidence, "low");
});

check("offers are never auto-applied", () => {
  const o = normaliseOffer({ cardId: "MRCC", merchant: "Amazon", offer: "10% off", confidence: "high" }, []);
  assert.ok(o);
  assert.equal(o.status, "advisory", "an offer was queued as a patch to card terms");
  assert.equal(o.field, null, "an offer named a patchable field");
});

console.log("\nSBI Unipay accrual");

check("caps at 1,000 points per transaction, so ₹1L is the most one payment can earn", () => {
  // The cap is the whole reason the split guidance exists; if this ever stops holding,
  // the advice on /debit becomes wrong rather than merely stale.
  for (const amt of [100000, 200000, 500000, 2000000]) {
    assert.equal(
      sbiUnipayReturnInr(amt, amt, false),
      250,
      `a single payment of ${amt} earned more than the ₹250 per-transaction ceiling`
    );
  }
});

check("splitting at ₹1L beats one lump payment, and by more as the bill grows", () => {
  let lastGap = -1;
  for (const amt of [150000, 200000, 300000, 500000]) {
    const one = sbiUnipayReturnInr(amt, amt, false);
    const split = sbiUnipayReturnInr(amt, SBI_RP_OPTIMAL_TXN_INR, false);
    assert.ok(split > one, `splitting ${amt} did not beat paying it in one go`);
    const gap = split - one;
    assert.ok(gap > lastGap, `the penalty for not splitting should grow with the bill`);
    lastGap = gap;
  }
});

check("no chunk size beats ₹1L", () => {
  const best = sbiUnipayReturnInr(300000, SBI_RP_OPTIMAL_TXN_INR, false);
  for (const chunk of [10000, 25000, 50000, 75000, 125000, 150000, 300000]) {
    assert.ok(
      sbiUnipayReturnInr(300000, chunk, false) <= best,
      `chunking at ${chunk} beat the ₹1L chunk, so the recommended split is wrong`
    );
  }
});

check("the monthly ceiling binds and never pays beyond ₹2,500", () => {
  for (const amt of [1000000, 1500000, 5000000]) {
    assert.equal(sbiUnipayReturnInr(amt, SBI_RP_OPTIMAL_TXN_INR, false), 2500);
  }
});

check("the disputed milestone is additive and never subtracts", () => {
  for (const amt of [50000, 100000, 250000]) {
    const lo = sbiUnipayReturnInr(amt, SBI_RP_OPTIMAL_TXN_INR, false);
    const hi = sbiUnipayReturnInr(amt, SBI_RP_OPTIMAL_TXN_INR, true);
    assert.ok(hi >= lo, `including the milestone reduced the return at ${amt}`);
  }
  // Below ₹1L there is no bonus either way, so the range must collapse.
  assert.equal(
    sbiUnipayReturnInr(50000, SBI_RP_OPTIMAL_TXN_INR, true),
    sbiUnipayReturnInr(50000, SBI_RP_OPTIMAL_TXN_INR, false)
  );
});

check("degenerate inputs return zero rather than NaN", () => {
  for (const [spend, chunk] of [[0, 100000], [-5000, 100000], [100000, 0], [100000, -1]]) {
    const r = sbiUnipayReturnInr(spend, chunk, true);
    assert.ok(Number.isFinite(r), `non-finite return for spend=${spend} chunk=${chunk}`);
    assert.equal(r, 0);
  }
});

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
