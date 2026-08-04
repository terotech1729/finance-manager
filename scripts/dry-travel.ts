/**
 * Dry travel all-in ranking suite.
 * Run: npm run test:travel
 */
import assert from "node:assert/strict";
import { rankTravel } from "../src/lib/travel/rankTravel";
import { discoverFares, estimateFlightMarketFare } from "../src/lib/travel/fareDiscover";
import { searchPlaces } from "../src/lib/travel/places";
import type { TravelTripInput } from "../src/lib/travel/types";

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

const baseState = {
  today: "2026-08-04",
  bobCycleSpend5x: 0,
  primeMember: true,
  amazonPayIciciIssued: true,
};

console.log("Dry travel suite\n");

async function main() {
await check("place typeahead finds BLR / Delhi", () => {
  const blr = searchPlaces("blr", "flight");
  assert.ok(blr.some((p) => p.code === "BLR"), "BLR airport");
  const del = searchPlaces("delhi", "flight");
  assert.ok(del.some((p) => /del|delhi/i.test(p.city) || p.code === "DEL"));
  const stn = searchPlaces("ndls", "train");
  assert.ok(stn.some((p) => p.code === "NDLS"));
});

await check("discoverFares auto-fills platform fares (no paste)", async () => {
  const d = await discoverFares({
    mode: "flight",
    origin: "BLR",
    destination: "DEL",
    date: "2026-08-20",
    adults: 1,
    today: "2026-08-04",
  });
  assert.ok(d.marketFareInr > 1000, `market ${d.marketFareInr}`);
  assert.ok(Object.keys(d.fares).length >= 4, "expected multiple platform quotes");
  assert.ok(d.fares.amazon_flight > 0);
  assert.ok(d.fares.cleartrip_flight > 0);
  console.log(`      → market ₹${d.marketFareInr} · ${d.distanceKm} km · ${d.marketSource}`);
});

await check("same fare flight: ranks a complete platform + card stack", () => {
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

await check("discovered fares → rankTravel best all-in", async () => {
  const d = await discoverFares({
    mode: "flight",
    origin: "Bengaluru (BLR)",
    destination: "Delhi (DEL)",
    date: "2026-08-20",
    adults: 1,
    today: "2026-08-04",
  });
  const r = rankTravel(
    {
      mode: "flight",
      origin: "BLR",
      destination: "DEL",
      date: "2026-08-20",
      adults: 1,
      fares: d.fares,
      today: "2026-08-04",
    },
    baseState
  );
  assert.ok(r.best.platformId !== "none");
  assert.ok(r.best.netInr < d.marketFareInr + 500);
  console.log(`      → best ${r.best.platformLabel} net ₹${r.best.netInr.toFixed(0)}`);
});

await check("higher Amazon fare loses to cheaper Cleartrip when gap > earn", () => {
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

await check("Instant Discount override can beat bare cashback", () => {
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

await check("train: Amazon vs IRCTC with same fare prefers higher earn stack", () => {
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
  console.log(`      → best ${r.best.platformLabel} / ${r.best.cardId} net ₹${r.best.netInr.toFixed(0)}`);
});

await check("bus: RedBus vs Amazon with same fare ranks a complete solution", () => {
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

await check("no fares → placeholder + warning", () => {
  const r = rankTravel(
    {
      mode: "flight",
      origin: "BLR",
      destination: "DEL",
      date: "2026-08-20",
      adults: 1,
      today: "2026-08-04",
    },
    baseState
  );
  assert.equal(r.best.platformId, "none");
  assert.ok(r.warnings.some((w) => /fare|search/i.test(w)));
});

await check("Amex travel stack carries ifAmexNotAccepted when Amex wins", () => {
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

await check("flight estimate scales with distance", () => {
  const short = estimateFlightMarketFare(350, "2026-09-15", "economy", "2026-08-04");
  const long = estimateFlightMarketFare(1750, "2026-09-15", "economy", "2026-08-04");
  assert.ok(long > short + 500, `${long} vs ${short}`);
});

console.log(`\n${failed === 0 ? "OK" : "FAILED"} — travel dry suite`);
process.exit(failed === 0 ? 0 : 1);
}

main();
