/**
 * Dry journey planner — Pune → Rishikesh arrive-by scenarios.
 * Run: npx tsx scripts/dry-journey.ts
 */
import assert from "node:assert/strict";
import { planJourney, sleepOverlapMinutes } from "../src/lib/travel/journey/planJourney";

let failed = 0;

async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL  ${name}`);
    console.error(`      - ${e instanceof Error ? e.message : e}`);
  }
}

console.log("Dry journey suite\n");

async function main() {
  await check("sleep overlap counts overnight window", () => {
    // 22:00 → 07:00 should overlap 23–06 fully (7h = 420)
    const start = new Date(2026, 7, 10, 22, 0);
    const end = new Date(2026, 7, 11, 7, 0);
    const o = sleepOverlapMinutes(start, end, 23, 6);
    assert.ok(o >= 400 && o <= 430, `overlap ${o}`);
  });

  await check("Pune → Rishikesh arrive 5am expands via-BOM + direct tree", async () => {
    const r = await planJourney({
      origin: "Pune",
      destination: "Rishikesh",
      arriveBy: "2026-09-15T05:00",
      adults: 1,
      today: "2026-08-06",
    });
    assert.ok(r.best, "expected a best itinerary");
    assert.ok(r.alternatives.length >= 1, "expected alternatives");
    const all = [r.best!, ...r.alternatives];
    const paths = all.map((i) => i.pathLabel).join(" | ");
    console.log(`      → best ${r.best!.pathLabel} ₹${r.best!.totalCostInr} sleep ${r.best!.sleepScore}`);
    console.log(`      → paths: ${paths}`);
    assert.ok(
      all.some((i) => /BOM/i.test(i.pathLabel) || i.tags.includes("via-hub")),
      "expected a via-Mumbai style option in the tree"
    );
    assert.ok(
      all.some((i) => /DED|DEL/i.test(i.pathLabel)),
      "expected Dehradun or Delhi gateway"
    );
    // Day-before evening variant should score well on sleep
    const comfy = all.find((i) => i.tags.includes("day-before-evening"));
    if (comfy) {
      assert.ok(comfy.sleepScore >= 50, `day-before sleep ${comfy.sleepScore}`);
      console.log(`      → day-before ${comfy.pathLabel} sleep ${comfy.sleepScore}`);
    }
  });

  await check("sleep-weighted ranking prefers day-before over red-eye arrive-by", async () => {
    const r = await planJourney({
      origin: "Pune",
      destination: "Rishikesh",
      arriveBy: "2026-09-15T05:00",
      adults: 1,
      today: "2026-08-06",
      prefs: { costWeight: 0.25, timeWeight: 0.25, sleepWeight: 0.5 },
    });
    assert.ok(r.best);
    const all = [r.best!, ...r.alternatives];
    const dayBefore = all.filter((i) => i.tags.includes("day-before-evening"));
    const tight = all.filter((i) => i.tags.includes("arrive-by"));
    assert.ok(dayBefore.length >= 1, "expected day-before options");
    assert.ok(tight.length >= 1, "expected tight arrive-by options in the list");
    const bestDay = Math.max(...dayBefore.map((i) => i.score));
    const bestTight = Math.max(...tight.map((i) => i.score));
    assert.ok(bestDay >= bestTight, `day-before score ${bestDay} should beat arrive-by ${bestTight}`);
    assert.ok(r.best!.sleepScore >= 80, `best sleep ${r.best!.sleepScore}`);
    console.log(`      → best sleep ${r.best!.sleepScore}; day-before ${bestDay} vs arrive-by ${bestTight}`);
  });

  if (failed) {
    console.error(`\n${failed} failed`);
    process.exit(1);
  }
  console.log("\nAll journey checks passed");
}

main();
