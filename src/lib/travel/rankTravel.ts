/**
 * Travel all-in ranker: platform fare − Instant Discount − card/Cashkaro stack rewards.
 * Reuses recommend() with platform-specific merchant strings.
 */
import { recommend, type RecommendInput } from "../recommend";
import { getCardById } from "../cards";
import { inr } from "../utils";
import { platformsForMode, getPlatformById } from "./platforms";
import { offersForPlatform, offerDiscountInr } from "./offers";
import type {
  TravelMode,
  TravelRankResult,
  TravelSolution,
  TravelTripInput,
  TravelPlatform,
} from "./types";

function resolveFare(trip: TravelTripInput, platformId: string): number | null {
  const abs = trip.fares?.[platformId];
  if (abs != null && Number.isFinite(abs) && abs > 0) return abs;
  const base = trip.baseFareInr;
  if (base != null && Number.isFinite(base) && base > 0) {
    const delta = trip.fareDeltas?.[platformId] ?? 0;
    const fare = base + delta;
    return fare > 0 ? fare : null;
  }
  return null;
}

function tripSummary(trip: TravelTripInput): string {
  const pax = trip.adults + (trip.children ?? 0);
  const ret = trip.returnDate ? ` · return ${trip.returnDate}` : "";
  return `${trip.mode}: ${trip.origin || "?"} → ${trip.destination || "?"} on ${trip.date || "?"}${ret} · ${pax} pax`;
}

function buildRecInput(
  platform: TravelPlatform,
  amount: number,
  trip: TravelTripInput,
  stateExtras?: Partial<RecommendInput>
): RecommendInput {
  return {
    merchant: platform.recommendMerchant,
    category: platform.recommendCategory,
    amount,
    channel: "online",
    today: trip.today,
    amazonOrderCashbackInr:
      platform.id.startsWith("amazon_") && trip.amazonOrderCashbackInr
        ? trip.amazonOrderCashbackInr
        : undefined,
    indigoBluChipVoucherInr:
      platform.id === "indigo_direct" && trip.indigoBluChipVoucherInr
        ? trip.indigoBluChipVoucherInr
        : undefined,
    primeMember: true,
    ...stateExtras,
  };
}

/** Keep recommend stacks that actually belong to this checkout platform. */
function routeMatchesPlatform(platform: TravelPlatform, route: { cardId: string; label: string }): boolean {
  const l = `${route.cardId} ${route.label}`.toLowerCase();
  const id = platform.id;
  if (id.startsWith("amazon_")) return route.cardId === "amazon_pay_icici" || /\bamazon\b/.test(l);
  if (id.includes("cleartrip")) return /cleartrip/.test(l);
  if (id.includes("mmt")) return /makemytrip|\bmmt\b|reward multiplier/.test(l);
  if (id.includes("easemytrip")) return /easemytrip|yatra|bob_eterna/.test(l) && !/cashkaro/.test(l);
  if (id.includes("indigo")) return /indigo|idfc/.test(l);
  if (id.includes("scapia")) return route.cardId === "scapia" || /scapia/.test(l);
  if (id.includes("redbus")) return /redbus/.test(l);
  if (id.includes("abhibus")) return /abhibus/.test(l) || (route.cardId === "bob_eterna" && !/agoda|cleartrip|mmt|amazon/.test(l));
  if (id === "irctc" || id === "railone" || id === "confirmtkt") {
    return !/amazon|agoda|cleartrip|makemytrip|redbus|indigo/.test(l);
  }
  return true;
}

function pickRouteForPlatform(
  platform: TravelPlatform,
  rec: ReturnType<typeof recommend>
): NonNullable<ReturnType<typeof recommend>["best"]> | null {
  const ranked = [rec.best, ...(rec.alternatives ?? [])].filter(Boolean) as NonNullable<
    ReturnType<typeof recommend>["best"]
  >[];
  const matched = ranked.filter((r) => r.feasible !== false && routeMatchesPlatform(platform, r));
  if (matched.length) {
    return matched.sort((a, b) => b.totalRewardInr - a.totalRewardInr)[0];
  }
  // Train/IRCTC: fall back to best non-OTA card/UPI from ranking
  if (platform.mode === "train" || platform.id.includes("abhibus")) {
    const fallback = ranked.find(
      (r) =>
        r.feasible !== false &&
        !/agoda|cleartrip|makemytrip|amazon travel|redbus/i.test(r.label)
    );
    if (fallback) return fallback;
  }
  return null;
}

function solutionFromRoute(
  platform: TravelPlatform,
  fareInr: number,
  offerDiscount: number,
  offerLabel: string | undefined,
  offerId: string | undefined,
  route: NonNullable<ReturnType<typeof recommend>["best"]>,
  warnings: string[]
): TravelSolution {
  const reward = route.totalRewardInr;
  const net = Math.max(0, fareInr - offerDiscount - reward);
  const allInPct = fareInr > 0 ? ((fareInr - net) / fareInr) * 100 : 0;
  const short = getCardById(route.cardId)?.short ?? route.cardId;

  const steps = [
    ...platform.openSteps,
    ...(offerDiscount > 0
      ? [`Apply Instant Discount / coupon (~${inr(offerDiscount)}) at checkout if still live`]
      : []),
    ...route.steps,
    `All-in: fare ${inr(fareInr)} − discount ${inr(offerDiscount)} − rewards ${inr(reward)} ≈ net ${inr(net)}`,
  ];

  if (platform.notes?.toLowerCase().includes("fare")) {
    warnings.push(`${platform.label}: ${platform.notes}`);
  }

  return {
    platformId: platform.id,
    platformLabel: platform.label,
    fareInr,
    offerId,
    offerLabel,
    offerDiscountInr: offerDiscount,
    cardId: route.cardId,
    cardLabel: `${short} — ${route.label}`,
    cardRewardInr: reward,
    cardEffectivePct: route.effectivePct,
    cashkaroNote: route.cashkaroSuggested ? "Cashkaro included in card route stack" : undefined,
    netInr: net,
    allInPct,
    steps,
    rationale: [
      `Book on ${platform.label} at ${inr(fareInr)}`,
      offerDiscount > 0 ? `− ${inr(offerDiscount)} Instant Discount / coupon` : null,
      `Pay via: ${route.label} (~${route.effectivePct.toFixed(2)}% / ${inr(reward)})`,
      `Net cost ≈ ${inr(net)} (${allInPct.toFixed(2)}% effective value vs fare)`,
      route.rationale,
    ]
      .filter(Boolean)
      .join(". "),
    pros: [
      ...route.pros,
      offerDiscount > 0 ? `Instant Discount ${inr(offerDiscount)}` : "",
      platform.notes ?? "",
    ].filter(Boolean),
    cons: [
      ...route.cons,
      "Always fare-match platforms — a higher base fare can wipe % wins",
    ].filter(Boolean),
    openSteps: platform.openSteps,
    url: platform.url,
    ifCardNotAllowed: route.ifCardNotAllowed,
    ifAmexNotAccepted: route.ifAmexNotAccepted,
  };
}

/**
 * Rank complete travel solutions for a trip.
 * @param stateExtras — portal counters from buildRecommendInputFromState (optional in dry tests)
 */
export function rankTravel(
  trip: TravelTripInput,
  stateExtras?: Partial<RecommendInput>
): TravelRankResult {
  const warnings: string[] = [];
  const platforms = platformsForMode(trip.mode);
  const solutions: TravelSolution[] = [];

  if (!trip.origin?.trim() || !trip.destination?.trim()) {
    warnings.push("Enter origin and destination for a clear trip summary (ranking still uses fares).");
  }
  if (!trip.date) {
    warnings.push("Enter travel date.");
  }

  const anyFare = platforms.some((p) => resolveFare(trip, p.id) != null);
  if (!anyFare) {
    warnings.push("Search a route so we can discover fares and rank all-in cost.");
  }

  for (const platform of platforms) {
    const fare = resolveFare(trip, platform.id);
    if (fare == null) continue;

    const offers = offersForPlatform(platform, trip.today);
    const volatile = offers.filter((o) => o.confidence === "volatile" && o.confirmLive);
    for (const v of volatile) {
      const ov = trip.offerDiscountOverrides?.[v.id];
      if (ov == null || ov <= 0) {
        // soft warning once per offer id
        if (!warnings.some((w) => w.includes(v.id))) {
          warnings.push(`Optional: enter live Instant Discount ₹ for “${v.label}” if checkout shows one.`);
        }
      }
    }

    // Charged amount after Instant Discount (card earn on reduced amount when ID applies)
    const discountCandidates: { offerId?: string; offerLabel?: string; discount: number; forceCardId?: string }[] = [
      { discount: 0 },
    ];
    for (const o of offers) {
      const d = offerDiscountInr(o, fare, trip.offerDiscountOverrides?.[o.id]);
      if (d > 0) {
        discountCandidates.push({
          offerId: o.id,
          offerLabel: o.label,
          discount: d,
          forceCardId: o.cardId,
        });
      }
    }
    // IndiGo BluChip voucher — only on IndiGo direct checkout
    if (platform.id === "indigo_direct" && trip.indigoBluChipVoucherInr && trip.indigoBluChipVoucherInr > 0) {
      const v = Math.min(trip.indigoBluChipVoucherInr, fare);
      discountCandidates.push({
        offerId: "indigo_bluchip_voucher",
        offerLabel: "IndiGo BluChip voucher",
        discount: v,
        forceCardId: "idfc_indigo",
      });
    }

    // Dedupe by discount amount + force card
    const seen = new Set<string>();
    for (const cand of discountCandidates) {
      const key = `${cand.discount}:${cand.forceCardId ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const charged = Math.max(1, fare - cand.discount);
      const rec = recommend(buildRecInput(platform, charged, trip, stateExtras));
      let route = pickRouteForPlatform(platform, rec);
      if (!route) continue;

      // If offer requires a card, prefer that card's ranked route when present
      if (cand.forceCardId) {
        const pool = [rec.best, ...(rec.alternatives ?? [])].filter(Boolean) as NonNullable<
          ReturnType<typeof recommend>["best"]
        >[];
        const forced = pool.find(
          (r) => r.cardId === cand.forceCardId && r.feasible !== false && routeMatchesPlatform(platform, r)
        );
        if (forced) route = forced;
      }

      solutions.push(
        solutionFromRoute(
          platform,
          fare,
          cand.discount,
          cand.offerLabel,
          cand.offerId,
          route,
          warnings
        )
      );
    }
  }

  // Also try full-fare recommend without ID for each platform (already included as discount:0)

  solutions.sort((a, b) => {
    if (a.netInr !== b.netInr) return a.netInr - b.netInr;
    return b.allInPct - a.allInPct;
  });

  // Dedupe near-identical platform+card+net
  const deduped: TravelSolution[] = [];
  const used = new Set<string>();
  for (const s of solutions) {
    const k = `${s.platformId}::${s.cardId}::${Math.round(s.netInr)}`;
    if (used.has(k)) continue;
    used.add(k);
    deduped.push(s);
  }

  if (!deduped.length) {
    // Placeholder so UI can still render
    const empty: TravelSolution = {
      platformId: "none",
      platformLabel: "Search a route",
      fareInr: 0,
      offerDiscountInr: 0,
      cardId: "upi",
      cardLabel: "—",
      cardRewardInr: 0,
      cardEffectivePct: 0,
      netInr: 0,
      allInPct: 0,
      steps: ["Pick origin & destination, then Search — we discover fares and rank checkout stacks"],
      rationale: "No fares discovered yet.",
      pros: [],
      cons: [],
      openSteps: [],
    };
    return {
      mode: trip.mode,
      tripSummary: tripSummary(trip),
      best: empty,
      alternatives: [],
      warnings,
    };
  }

  // Deduplicate warnings
  const uniqWarnings = [...new Set(warnings)];

  return {
    mode: trip.mode,
    tripSummary: tripSummary(trip),
    best: deduped[0],
    alternatives: deduped.slice(1),
    warnings: uniqWarnings,
  };
}

export function defaultFareGrid(mode: TravelMode): { id: string; label: string; primary?: boolean }[] {
  return platformsForMode(mode).map((p) => ({ id: p.id, label: p.label, primary: p.primary }));
}

export { getPlatformById, platformsForMode };
