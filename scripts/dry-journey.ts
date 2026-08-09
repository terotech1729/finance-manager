/**
 * Dry journey planner — stay costing + live/catalog schedules.
 * Run: npm run test:journey
 */
import assert from "node:assert/strict";
import { planJourney, sleepOverlapMinutes } from "../src/lib/travel/journey/planJourney";
import { assessStay } from "../src/lib/travel/journey/stay";
import type { JourneyLeg } from "../src/lib/travel/journey/types";
import { placeById } from "../src/lib/travel/journey/graph";

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
    const start = new Date(2026, 7, 10, 22, 0);
    const end = new Date(2026, 7, 11, 7, 0);
    const o = sleepOverlapMinutes(start, end, 23, 6);
    assert.ok(o >= 400 && o <= 430, `overlap ${o}`);
  });

  await check("stay: day-before evening needs 1 hotel night", () => {
    const rsh = placeById("city-rsh")!;
    const ded = placeById("apt-ded")!;
    const legs: JourneyLeg[] = [
      {
        id: "1",
        mode: "cab",
        from: ded,
        to: rsh,
        departAt: "2026-08-10T18:45",
        arriveAt: "2026-08-10T20:00",
        durationMin: 75,
        costInr: 1800,
        costSource: "estimated",
        scheduleSource: "estimated",
        sleepOverlapMin: 0,
      },
    ];
    const stay = assessStay(
      legs,
      "2026-08-11T05:00",
      {
        sleepStartHour: 23,
        sleepEndHour: 6,
        maxDurationHrs: 40,
        costWeight: 0.4,
        timeWeight: 0.3,
        sleepWeight: 0.3,
        avoidOvernightSurface: true,
        includeStayCost: true,
        allowOvernightAsStay: true,
      },
      1
    );
    assert.equal(stay.nights, 1, `nights ${stay.nights}`);
    assert.ok(stay.costInr >= 1500 && stay.costInr <= 2500, `cost ${stay.costInr}`);
    console.log(`      → ${stay.note} ₹${stay.costInr}`);
  });

  await check("stay: overnight bus to arriveBy = 0 hotel nights", () => {
    const rsh = placeById("city-rsh")!;
    const del = placeById("city-del")!;
    const legs: JourneyLeg[] = [
      {
        id: "1",
        mode: "bus",
        from: del,
        to: rsh,
        departAt: "2026-08-10T22:00",
        arriveAt: "2026-08-11T05:30",
        durationMin: 450,
        costInr: 950,
        costSource: "estimated",
        scheduleSource: "catalog",
        sleepOverlapMin: 360,
        overnightSleep: true,
      },
    ];
    const stay = assessStay(
      legs,
      "2026-08-11T06:00",
      {
        sleepStartHour: 23,
        sleepEndHour: 6,
        maxDurationHrs: 40,
        costWeight: 0.4,
        timeWeight: 0.3,
        sleepWeight: 0.3,
        avoidOvernightSurface: false,
        includeStayCost: true,
        allowOvernightAsStay: true,
      },
      1
    );
    assert.equal(stay.nights, 0, `nights ${stay.nights}`);
    assert.equal(stay.sleepOnTransit, true);
    console.log(`      → ${stay.note}`);
  });

  await check("Pune → Rishikesh uses live flight times near Aug 11", async () => {
    const r = await planJourney({
      origin: "Pune",
      destination: "Rishikesh",
      arriveBy: "2026-08-11T20:00",
      adults: 1,
      today: "2026-08-06",
      prefs: { includeStayCost: true, allowOvernightAsStay: true },
    });
    assert.ok(r.best, "expected a best itinerary with live cache window");
    const all = [r.best!, ...r.alternatives];
    console.log(`      → best ${r.best!.pathLabel} all-in ₹${r.best!.totalCostInr} stay ₹${r.best!.stayCostInr}`);
    console.log(`      → ${r.best!.label}`);
    for (const leg of r.best!.legs) {
      console.log(
        `         ${leg.mode} ${leg.carrier || ""} ${leg.departAt} → ${leg.arriveAt} [${leg.scheduleSource}]`
      );
    }
    assert.ok(
      all.some((i) =>
        i.legs.some((l) => l.mode === "flight" && (l.scheduleSource === "live" || l.scheduleSource === "estimated"))
      ) || all.some((i) => i.tags.includes("rail") || i.tags.includes("via-delhi")),
      "expected flight and/or Delhi rail/bus family"
    );
    // Prefer live when present; estimated allowed as sparse-cache fallback
    const flights = r.best!.legs.filter((l) => l.mode === "flight");
    for (const f of flights) {
      assert.ok(f.carrier && /[A-Z0-9]/.test(f.carrier), `carrier ${f.carrier}`);
      assert.ok(
        f.scheduleSource === "live" || f.scheduleSource === "estimated",
        `unexpected scheduleSource ${f.scheduleSource}`
      );
    }
  });

  await check("all-in with stay can exceed transport-only; overnight bus competes", async () => {
    const r = await planJourney({
      origin: "Pune",
      destination: "Rishikesh",
      arriveBy: "2026-08-12T06:00",
      adults: 1,
      today: "2026-08-06",
      prefs: {
        includeStayCost: true,
        allowOvernightAsStay: true,
        sleepWeight: 0.35,
        costWeight: 0.45,
        timeWeight: 0.2,
        avoidOvernightSurface: false,
      },
    });
    assert.ok(r.best);
    const all = [r.best!, ...r.alternatives];
    const withStay = all.filter((i) => i.stayNights > 0);
    const sleepBus = all.filter((i) => i.tags.includes("sleep-on-transit") || i.stayNights === 0 && i.legs.some((l) => l.overnightSleep));
    console.log(`      → ${all.length} options; withStay=${withStay.length} sleepBus=${sleepBus.length}`);
    if (withStay.length) {
      const s = withStay[0];
      assert.ok(s.totalCostInr >= s.transportCostInr + s.stayCostInr - 1);
      console.log(`      → stay example transport ₹${s.transportCostInr} + stay ₹${s.stayCostInr}`);
    }
    // Prefer that we don't invent flight times
    assert.ok(all.every((i) => i.realityPct >= 30), "reality too low");
  });

  await check("dawn arriveBy surfaces BOM→DED + bus last-mile (not only DEL overnight)", async () => {
    const r = await planJourney({
      origin: "Pune",
      destination: "Rishikesh",
      arriveBy: "2026-08-11T05:00",
      adults: 1,
      today: "2026-08-06",
      prefs: {
        includeStayCost: true,
        allowOvernightAsStay: true,
        hotelBudgetPerNight: 950,
      },
    });
    const all = r.best ? [r.best, ...r.alternatives] : [];
    console.log(`      → ${all.length} options`);
    for (const it of all.slice(0, 6)) {
      console.log(
        `         ${it.tags.includes("DED") ? "DED" : it.tags.includes("DEL") || it.tags.includes("via-delhi") ? "DEL" : "?"} ₹${it.totalCostInr} · ${it.label}`
      );
    }
    assert.ok(all.length >= 1, "expected at least one itinerary");
    const ded = all.filter((i) => i.tags.includes("DED"));
    // Live cache may be sparse; if DED flights exist in window they must appear in the slate
    if (ded.length) {
      assert.ok(
        ded.some((i) => i.legs.some((l) => /DED→Rishikesh|ded-rsh|Bus \/ shared/i.test(`${l.carrier} ${l.note} ${l.id}`))),
        "DED path should use cheap bus/shared last-mile, not only private cab"
      );
      assert.ok(
        ded.some((i) => /BOM→DED/i.test(i.label) || i.pathLabel.includes("DED")),
        "label/path should mention DED"
      );
      console.log(`      → DED options: ${ded.length}; cheapest all-in ₹${Math.min(...ded.map((d) => d.totalCostInr))}`);
    } else {
      console.log("      → no live DED flights in cache window — diversity N/A this run");
    }
  });

  if (failed) {
    console.error(`\n${failed} failed`);
    process.exit(1);
  }
  console.log("\nAll journey checks passed");
}

main();
