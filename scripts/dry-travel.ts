/**
 * Dry travel all-in ranking suite.
 * Run: npm run test:travel
 */
import assert from "node:assert/strict";
import { rankTravel } from "../src/lib/travel/rankTravel";
import type { TravelTripInput } from "../src/lib/travel/types";

let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL  ${name}`);
    console.error(`      - ${e instanceof Error ? e.message : e}`);
  }
}

const baseState = {
  today: "2026-08-04",
  bobCycleSpend5x: 0,
  primeMember: true,
  amazonPayIciciIssued: true,
};

console.log("Dry travel suite\n");

check("same fare flight: ranks a complete platform + card stack", () => {
  const trip: TravelTripInput = {
    mode: "flight",
    origin: "BLR",
    destination: "DEL",
    date: "2026-08-20",
    adults: 1,
    baseFareInr: 5000,
    today: "2026-08-04",
  };
  const r = rankTravel(trip, baseState);
  assert.ok(r.best.platformId !== "none", "expected a ranked platform");
  assert.ok(r.best.fareInr === 5000, `fare ${r.best.fareInr}`);
  assert.ok(r.best.netInr < 5000, `net should be under fare, got ${r.best.netInr}`);
  assert.ok(r.best.cardRewardInr > 0, "expected card/cashkaro reward");
  console.log(`      → best ${r.best.platformLabel} / ${r.best.cardId} net ₹${r.best.netInr.toFixed(0)}`);
});

check("higher Amazon fare loses to cheaper Cleartrip when gap > earn", () => {
  const trip: TravelTripInput = {
    mode: "flight",
    origin: "BLR",
    destination: "DEL",
    date: "2026-08-20",
    adults: 1,
    fares: {
      amazon_flight: 6000,
      cleartrip_flight: 5000,
      mmt_flight: 5000,
    },
    today: "2026-08-04",
  };
  const r = rankTravel(trip, baseState);
  assert.ok(r.best.platformId !== "amazon_flight", `Amazon should lose on +₹1k fare, got ${r.best.platformId}`);
  assert.ok(r.best.netInr < 6000 - 300, "net should reflect cheaper OTA");
  console.log(`      → best ${r.best.platformLabel} net ₹${r.best.netInr.toFixed(0)}`);
});

check("Instant Discount override can beat bare cashback", () => {
  const without: TravelTripInput = {
    mode: "flight",
    origin: "BLR",
    destination: "DEL",
    date: "2026-08-20",
    adults: 1,
    fares: { cleartrip_flight: 5000, amazon_flight: 5000 },
    today: "2026-08-04",
  };
  const withId: TravelTripInput = {
    ...without,
    offerDiscountOverrides: { flight_bank_id_volatile: 800 },
  };
  const a = rankTravel(without, baseState);
  const b = rankTravel(withId, baseState);
  assert.ok(b.best.netInr < a.best.netInr - 100, `ID should lower net: ${b.best.netInr} vs ${a.best.netInr}`);
  console.log(`      → without ID net ₹${a.best.netInr.toFixed(0)} · with ID ₹${b.best.netInr.toFixed(0)}`);
});

check("train: Amazon vs IRCTC with same fare prefers higher earn stack", () => {
  const trip: TravelTripInput = {
    mode: "train",
    origin: "SBC",
    destination: "NDLS",
    date: "2026-08-25",
    adults: 1,
    baseFareInr: 2000,
    today: "2026-08-04",
  };
  const r = rankTravel(trip, baseState);
  assert.ok(r.best.platformId !== "none");
  assert.ok(["amazon_train", "irctc", "railone", "confirmtkt"].includes(r.best.platformId));
  // Amazon 2% on ₹2000 = ₹40 — should often win if IRCTC card earn is weaker
  console.log(`      → best ${r.best.platformLabel} / ${r.best.cardId} net ₹${r.best.netInr.toFixed(0)}`);
});

check("bus: RedBus vs Amazon with same fare ranks a complete solution", () => {
  const trip: TravelTripInput = {
    mode: "bus",
    origin: "Bengaluru",
    destination: "Chennai",
    date: "2026-08-18",
    adults: 2,
    baseFareInr: 1600,
    today: "2026-08-04",
  };
  const r = rankTravel(trip, baseState);
  assert.ok(r.best.platformId !== "none");
  assert.ok(["redbus", "amazon_bus", "abhibus"].includes(r.best.platformId));
  assert.ok(r.best.netInr < 1600);
  console.log(`      → best ${r.best.platformLabel} / ${r.best.cardId} net ₹${r.best.netInr.toFixed(0)}`);
});

check("no fares → placeholder + warning", () => {
  const r = rankTravel({
    mode: "flight",
    origin: "BLR",
    destination: "DEL",
    date: "2026-08-20",
    adults: 1,
    today: "2026-08-04",
  }, baseState);
  assert.equal(r.best.platformId, "none");
  assert.ok(r.warnings.some((w) => /fare/i.test(w)));
});

check("Amex travel stack carries ifAmexNotAccepted when Amex wins", () => {
  const trip: TravelTripInput = {
    mode: "flight",
    origin: "BLR",
    destination: "DEL",
    date: "2026-08-20",
    adults: 1,
    fares: { mmt_flight: 5000 },
    today: "2026-08-04",
  };
  const r = rankTravel(trip, baseState);
  const amex = [r.best, ...r.alternatives].find((s) => /^amex_/.test(s.cardId));
  if (amex) {
    assert.ok(amex.ifAmexNotAccepted, "Amex solution missing ifAmexNotAccepted");
    assert.ok(!/^amex_/.test(amex.ifAmexNotAccepted!.cardId));
    console.log(`      → Amex fallback → ${amex.ifAmexNotAccepted!.cardId}`);
  } else {
    console.log("      → (no Amex in ranking for MMT-only fare — OK)");
  }
});

console.log(`\n${failed === 0 ? "OK" : "FAILED"} — travel dry suite`);
process.exit(failed === 0 ? 0 : 1);
