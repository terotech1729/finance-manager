/**
 * Dry recommend + categorize suite for everyday spends.
 * Run: npm run test:recommend
 * Exits non-zero on any assertion failure.
 */
import assert from "node:assert/strict";
import { detectCategory } from "../src/lib/categorize";
import { recommend, type RecommendInput } from "../src/lib/recommend";

type Expect = {
  channel?: string;
  categoryIncludes?: string | RegExp;
  bestCard?: string | string[];
  bestLabelAvoid?: RegExp;
  bestLabelIncludes?: RegExp;
  /** Best route steps should mention POS swipe for offline dining */
  stepsMatch?: RegExp;
  /** Every credit-like route must carry ifCardNotAllowed */
  requireDeclinedFallback?: boolean;
  declinedFallbackIncludes?: RegExp;
};

type Case = {
  name: string;
  query: string;
  amount: number;
  expect: Expect;
  /** Optional extras merged into RecommendInput */
  input?: Partial<RecommendInput>;
};

const BASE: Partial<RecommendInput> = {
  today: "2026-08-04",
  hsbcLivePlusYtdSpend: 30000,
  livePlusAccelCashbackUsedThisMonth: 50,
  ptccEligibleSpend: 180000,
  mrccCycleSpend: 70000,
  mrccThisCycleTxnsAt1500: 4,
  mrccThisCycleAmount: 9000,
  bobYtdSpend: 40000,
  sbiYtdSpend: 30000,
  idfcYtdSpend: 800000,
};

const CASES: Case[] = [
  // —— Offline dining / POS ——
  {
    name: "offline restaurant → dining POS + Live+",
    query: "offline restaurant",
    amount: 840,
    expect: {
      channel: "offline_pos",
      categoryIncludes: /dining/,
      bestCard: "hsbc_live_plus",
      bestLabelAvoid: /dine with visa|live\+?\s*reserve|premium dining/i,
      stepsMatch: /swipe|tap|pos/i,
      requireDeclinedFallback: true,
      declinedFallbackIncludes: /kiwi|upi/i,
    },
  },
  {
    name: "street food stall → dining POS",
    query: "street food stall",
    amount: 250,
    expect: {
      channel: "offline_pos",
      categoryIncludes: /dining/,
      bestCard: "hsbc_live_plus",
      requireDeclinedFallback: true,
      // Below ₹500 Kiwi cashback → UPI/cash fallback
      declinedFallbackIncludes: /upi|cash|phonepe/i,
    },
  },
  {
    name: "dhaba card swipe",
    query: "dhaba card swipe",
    amount: 600,
    expect: {
      channel: "offline_pos",
      categoryIncludes: /dining/,
      bestCard: "hsbc_live_plus",
      stepsMatch: /swipe|tap|pos/i,
      requireDeclinedFallback: true,
      declinedFallbackIncludes: /kiwi/i,
    },
  },
  {
    name: "normal stall restaurant POS",
    query: "stall restaurant pos",
    amount: 400,
    expect: {
      channel: "offline_pos",
      categoryIncludes: /dining/,
      bestCard: "hsbc_live_plus",
      bestLabelAvoid: /dine with visa/i,
      requireDeclinedFallback: true,
    },
  },
  {
    name: "roadside eatery",
    query: "roadside eatery",
    amount: 350,
    expect: { channel: "offline_pos", categoryIncludes: /dining/, bestCard: "hsbc_live_plus" },
  },
  {
    name: "hotel buffet is dining not OTA hotel",
    query: "hotel food offline",
    amount: 1200,
    expect: { channel: "offline_pos", categoryIncludes: /dining/, bestCard: "hsbc_live_plus" },
  },
  {
    name: "restaurant UPI QR → UPI channel (Kiwi)",
    query: "restaurant upi",
    amount: 700,
    expect: {
      channel: "upi",
      categoryIncludes: /dining/,
      bestCard: ["yes_kiwi", "hsbc_live_plus"],
      requireDeclinedFallback: true,
    },
  },

  // —— Daily life offline ——
  {
    name: "kirana store offline POS",
    query: "kirana store",
    amount: 800,
    expect: {
      channel: "offline_pos",
      categoryIncludes: /grocer/,
      bestCard: "hsbc_live_plus",
      requireDeclinedFallback: true,
      declinedFallbackIncludes: /kiwi/i,
    },
  },
  {
    name: "medical store offline",
    query: "medical store offline",
    amount: 450,
    expect: { channel: "offline_pos", categoryIncludes: /pharmacy|chemist/i },
  },
  {
    name: "salon POS",
    query: "salon",
    amount: 900,
    expect: { channel: "offline_pos", categoryIncludes: /salon/, requireDeclinedFallback: true },
  },
  {
    name: "fuel pump",
    query: "petrol pump",
    amount: 2000,
    expect: { channel: "offline_pos", categoryIncludes: /fuel/ },
  },
  {
    name: "parking",
    query: "parking",
    amount: 100,
    expect: { channel: "offline_pos", categoryIncludes: /parking/ },
  },

  // —— Online daily (sanity) ——
  {
    name: "Swiggy small + Gold open → batch ShopWise ₹1k (milestone, no fee)",
    query: "Swiggy",
    amount: 400,
    expect: {
      channel: "merchant_app",
      bestCard: "amex_gold",
      bestLabelIncludes: /Batch ShopWise/i,
      bestLabelAvoid: /dine with visa/i,
      requireDeclinedFallback: true,
    },
    input: { goldMonthlyTxnsDone: 2, goldShopwiseUsedThisMonth: 0, swiggyMoneyBalance: 0 },
  },
  {
    name: "Swiggy with prepaid Money → redeem before more coupons",
    query: "Swiggy",
    amount: 374,
    expect: {
      bestCard: "giftcard",
      bestLabelIncludes: /Swiggy Money/i,
      requireDeclinedFallback: true,
    },
    input: { goldMonthlyTxnsDone: 2, swiggyMoneyBalance: 2000 },
  },
  {
    name: "Swiggy small + Gold done → Live+ food (no batch)",
    query: "Swiggy",
    amount: 400,
    expect: {
      channel: "merchant_app",
      bestCard: "hsbc_live_plus",
      bestLabelAvoid: /dine with visa|Batch ShopWise/i,
      requireDeclinedFallback: true,
    },
    input: { goldMonthlyTxnsDone: 6, goldShopwiseUsedThisMonth: 6000, swiggyMoneyBalance: 0 },
  },
  {
    name: "Amazon Now → Amazon Pay ICICI",
    query: "Amazon",
    amount: 1500,
    expect: { channel: "online", bestCard: "amazon_pay_icici", requireDeclinedFallback: true },
  },
  {
    name: "utility bill → Live+ 10% (not general 1.5%)",
    query: "utility bill",
    amount: 1000,
    expect: {
      categoryIncludes: /utility/,
      bestCard: "hsbc_live_plus",
      bestLabelIncludes: /10%|utilit/i,
      bestLabelAvoid: /1\.5%|Not an accelerated/i,
    },
    input: { livePlusAccelCashbackUsedThisMonth: 0, goldMonthlyTxnsDone: 6 },
  },
  {
    name: "Uber ride → Kiwi UPI",
    query: "Uber",
    amount: 280,
    expect: { channel: "upi", bestCard: ["yes_kiwi", "upi"] },
  },

  // —— Audit ship-blockers ——
  {
    name: "petrol → not SBI annual thin progress",
    query: "petrol pump",
    amount: 2000,
    expect: {
      channel: "offline_pos",
      categoryIncludes: /fuel/,
      bestCard: ["upi", "cash"],
      bestLabelAvoid: /simplyclick|annual milestone|build ₹/i,
    },
  },
  {
    name: "house rent → UPI/NEFT not SBI annual",
    query: "house rent",
    amount: 40000,
    expect: {
      categoryIncludes: /rent/,
      bestCard: ["upi", "cash"],
      bestLabelAvoid: /simplyclick|annual milestone/i,
    },
  },
  {
    name: "LIC insurance → not SBI annual",
    query: "LIC insurance",
    amount: 15000,
    expect: {
      categoryIncludes: /insurance/,
      bestLabelAvoid: /simplyclick — build|annual milestone/i,
    },
  },
  {
    name: "restaurant UPI under ₹500 → Kiwi 0% not 2%",
    query: "restaurant upi",
    amount: 400,
    expect: {
      channel: "upi",
      bestCard: ["yes_kiwi", "upi", "idfc_indigo"],
    },
    // Asserted below via custom check in runner for effectivePct === 0 when kiwi
  },
  {
    name: "Uber under ₹500 → Kiwi 0%",
    query: "Uber",
    amount: 280,
    expect: { channel: "upi", bestCard: ["yes_kiwi", "upi"] },
  },
  {
    name: "blinkit app → merchant_app groceries + Live+",
    query: "Blinkit",
    amount: 600,
    expect: {
      channel: "merchant_app",
      categoryIncludes: /grocer/,
      bestCard: "hsbc_live_plus",
    },
  },
  {
    name: "kirana upi → Kiwi not Live+ POS",
    query: "kirana upi",
    amount: 700,
    expect: {
      channel: "upi",
      bestCard: "yes_kiwi",
    },
  },
  {
    name: "Live+ accel cap full → not 10% dining",
    query: "offline restaurant",
    amount: 840,
    expect: {
      bestCard: ["hsbc_live_plus", "bob_eterna"],
      bestLabelAvoid: /10% on dining(?!.*cap full)/i,
    },
    input: { livePlusAccelCashbackUsedThisMonth: 1200 },
  },
  {
    name: "marriott buffet → dining POS not hotel stay",
    query: "marriott buffet dinner",
    amount: 3500,
    expect: {
      channel: "offline_pos",
      categoryIncludes: /dining/,
      bestCard: "hsbc_live_plus",
      bestLabelAvoid: /ihg|itc hotels|agoda|hotel direct/i,
    },
  },
  {
    name: "taj hotel booking stay → hotel direct (not dining)",
    query: "taj hotel booking",
    amount: 12000,
    expect: {
      channel: "online",
      categoryIncludes: /hotel/,
    },
  },
  {
    name: "fine dining restaurant → no Dine-with-Visa in top-3",
    query: "fine dining restaurant",
    amount: 2000,
    expect: {
      channel: "offline_pos",
      bestCard: "hsbc_live_plus",
      bestLabelAvoid: /dine with visa|live\+?\s*reserve/i,
    },
  },
  {
    name: "explicit dine with visa → premium route allowed",
    query: "dine with visa",
    amount: 3000,
    expect: {
      channel: "offline_pos",
      categoryIncludes: /dining/,
      requireDeclinedFallback: true,
    },
  },
  {
    name: "Swiggy Live+ beats MRCC annual thin when Gold done",
    query: "Swiggy",
    amount: 400,
    expect: {
      bestCard: "hsbc_live_plus",
      requireDeclinedFallback: true,
    },
    input: {
      mrcc20kEnrolled: false,
      mrccCycleSpend: 73708,
      goldMonthlyTxnsDone: 6,
      goldShopwiseUsedThisMonth: 6000,
    },
  },
  {
    name: "Amex PT near milestone → ifAmexNotAccepted is non-Amex",
    query: "offline restaurant",
    amount: 2000,
    expect: { requireDeclinedFallback: true },
    input: {
      ptccEligibleSpend: 399000,
    },
  },
  {
    name: "Amex PT at ₹1.84L targets 1.9L not 4L (stale hit ignored)",
    query: "offline restaurant",
    amount: 940,
    expect: {
      bestCard: "hsbc_live_plus",
      requireDeclinedFallback: true,
    },
    input: {
      ptccEligibleSpend: 184231,
      // Stale claim must not skip 1.9L when till-date is still below it
      milestonesHit: ["amex_plat_travel:190000"],
    },
  },
  {
    name: "IndiGo + BluChip voucher boosts IDFC route",
    query: "IndiGo flight",
    amount: 9600,
    expect: { bestCard: ["idfc_indigo", "amazon_pay_icici", "bob_eterna", "amex_gold"] },
    input: { indigoBluChipVoucherInr: 5000 },
  },
  {
    name: "₹2.2L phone — Amex PT unlocks 1.9L + 4L (not 1.9L only)",
    query: "new phone purchase",
    amount: 220000,
    expect: {
      bestCard: "amex_plat_travel",
    },
    input: {
      ptccEligibleSpend: 184231,
      idfcYtdSpend: 800000,
      sbiYtdSpend: 95000,
      hsbcLivePlusYtdSpend: 180000,
    },
  },
  {
    name: "phone purchase asks store (not low-confidence general)",
    query: "new phone purchase",
    amount: 50000,
    expect: {
      categoryIncludes: /electronics|phone|amazon/i,
    },
  },
  {
    name: "merchant upi payment → UPI rail + IDFC RuPay (not Amex)",
    query: "upi payment",
    amount: 6000,
    expect: {
      channel: "upi",
      categoryIncludes: /upi/,
      bestCard: "idfc_indigo",
      bestLabelAvoid: /amex|platinum travel|live\+|bob eterna/i,
    },
  },
  {
    name: "merchant VPA handle → UPI + RuPay capable",
    query: "shop@ybl",
    amount: 2500,
    expect: {
      channel: "upi",
      bestCard: ["idfc_indigo", "yes_kiwi"],
      bestLabelAvoid: /amex/i,
    },
  },
  {
    name: "offline hotel bill → offline POS checkout not online booking",
    query: "offline hotel bill",
    amount: 6000,
    expect: {
      channel: "offline_pos",
      categoryIncludes: /hotel checkout|offline/,
      bestLabelAvoid: /agoda|makemytrip|amazon travel|taj voucher|ota/i,
      stepsMatch: /front desk|reception|swipe|tap|pos/i,
      requireDeclinedFallback: true,
    },
  },
  {
    name: "hotel checkout offline → not Online CNP",
    query: "hotel checkout bill",
    amount: 8000,
    expect: {
      channel: "offline_pos",
      categoryIncludes: /hotel checkout/,
      bestLabelAvoid: /booking\.com|cleartrip hotels/i,
    },
  },
  {
    name: "small forex → Scapia/BOB beat Amex PT after markup (no big milestone)",
    query: "openai chatgpt usd",
    amount: 2000,
    expect: {
      channel: "foreign",
      bestCard: ["scapia", "bob_eterna"],
      bestLabelAvoid: /amex pt|platinum travel/i,
    },
  },
  {
    name: "large forex + Amex milestones can beat Scapia after netting 3.5%",
    query: "foreign hotel usd",
    amount: 220000,
    expect: {
      channel: "foreign",
      bestCard: ["amex_plat_travel", "bob_eterna", "scapia", "idfc_indigo"],
    },
    input: {
      ptccEligibleSpend: 184231,
      idfcYtdSpend: 800000,
    },
  },
  {
    name: "Kiwi Neon true-up — not 5% on the txn (₹2.2L past ₹1.5L)",
    query: "restaurant upi",
    amount: 220000,
    expect: {
      channel: "upi",
      bestCard: ["hsbc_live_plus", "amex_plat_travel", "bob_eterna", "yes_kiwi", "idfc_indigo"],
      bestLabelAvoid: /~5\.0%|5% with Neon|Neon completing milestone\)/i,
    },
    input: {
      kiwiNeonCycleSpend: 79243, // ₹20,757 short of ₹1L — big spend crosses 1L + 1.5L
      ptccEligibleSpend: 184231,
    },
  },
];

let failed = 0;

function cardLikelyHasForex(cardId: string): boolean {
  return ["amex_gold", "amex_plat_travel", "amex_mrcc", "idfc_indigo", "bob_eterna", "hsbc_live_plus", "sbi_simplyclick", "yes_kiwi", "amazon_pay_icici"].includes(cardId);
}

function runCase(c: Case) {
  const det = detectCategory(c.query);
  const errors: string[] = [];

  if (c.expect.channel && det.channel !== c.expect.channel) {
    errors.push(`channel: got ${det.channel}, want ${c.expect.channel}`);
  }
  if (c.expect.categoryIncludes) {
    const ok =
      typeof c.expect.categoryIncludes === "string"
        ? det.category.toLowerCase().includes(c.expect.categoryIncludes.toLowerCase())
        : c.expect.categoryIncludes.test(det.category);
    if (!ok) errors.push(`category: got "${det.category}", want match ${c.expect.categoryIncludes}`);
  }

  const input: RecommendInput = {
    merchant: c.query,
    category: det.category,
    amount: c.amount,
    channel: det.channel,
    isForeign: det.channel === "foreign" || !!det.forex,
    ...BASE,
    ...c.input,
  } as RecommendInput;

  const rec = recommend(input);
  assert.ok(rec.best, "missing best route");
  const best = rec.best!;
  const rows = [best, ...(rec.alternatives ?? [])];

  if (c.expect.bestCard) {
    const allowed = Array.isArray(c.expect.bestCard) ? c.expect.bestCard : [c.expect.bestCard];
    if (!allowed.includes(best.cardId)) {
      errors.push(`bestCard: got ${best.cardId} (${best.label}), want one of [${allowed.join(", ")}]`);
    }
  }
  if (c.expect.bestLabelAvoid && c.expect.bestLabelAvoid.test(best.label)) {
    errors.push(`bestLabelAvoid: label matched forbidden pattern: ${best.label}`);
  }
  if (c.expect.bestLabelIncludes && !c.expect.bestLabelIncludes.test(best.label)) {
    errors.push(`bestLabelIncludes: label "${best.label}" did not match ${c.expect.bestLabelIncludes}`);
  }
  if (c.expect.stepsMatch) {
    const steps = best.steps.join(" | ");
    if (!c.expect.stepsMatch.test(steps)) {
      errors.push(`stepsMatch: steps "${steps}" did not match ${c.expect.stepsMatch}`);
    }
  }
  if (c.expect.requireDeclinedFallback) {
    const creditRows = rows.filter((r) => !["upi", "cash", "amazon_pay_balance"].includes(r.cardId));
    for (const r of creditRows.slice(0, 8)) {
      if (!r.ifCardNotAllowed) {
        errors.push(`ifCardNotAllowed missing on ${r.cardId} / ${r.label}`);
      }
    }
  }
  if (c.expect.declinedFallbackIncludes && best.ifCardNotAllowed) {
    const blob = `${best.ifCardNotAllowed.label} ${best.ifCardNotAllowed.rationale}`;
    if (!c.expect.declinedFallbackIncludes.test(blob)) {
      errors.push(`declinedFallback: "${blob}" did not match ${c.expect.declinedFallbackIncludes}`);
    }
  }
  // Never show Dine-with-Visa as #1/#2 for generic offline dining queries
  if (/stall|dhaba|eatery|offline restaurant|normal restaurant|street food|fine dining restaurant/i.test(c.query)) {
    const premium = rows.slice(0, 3).filter((r) => /dine with visa|live\+?\s*reserve|premium dining/i.test(r.label));
    if (premium.length) {
      errors.push(`premium dining leaked into top-3: ${premium.map((p) => p.label).join(" | ")}`);
    }
  }
  // Explicit premium dining portal words → allow Dine-with-Visa / Live+ Reserve in top ranks
  if (/dine with visa|live\+?\s*reserve|dinewithtimesprime/i.test(c.query)) {
    const premium = rows.filter((r) => /dine with visa|live\+?\s*reserve|premium dining|dinewithtimesprime/i.test(r.label));
    if (!premium.length) {
      errors.push(`expected premium dining route for "${c.query}" but none ranked`);
    }
  }
  // Every Amex route must expose a non-Amex next-best (POS/apps often reject Amex)
  for (const r of rows.filter((x) => /^amex_/.test(x.cardId))) {
    if (!r.ifAmexNotAccepted) {
      errors.push(`Amex route missing ifAmexNotAccepted: ${r.label}`);
    } else if (/^amex_/.test(r.ifAmexNotAccepted.cardId)) {
      errors.push(`ifAmexNotAccepted still points at Amex: ${r.ifAmexNotAccepted.cardId}`);
    }
  }
  // Sub-₹500 Kiwi must not advertise 2%
  if (c.amount < 500 && best.cardId === "yes_kiwi" && best.effectivePct >= 1.5) {
    errors.push(`Kiwi under ₹500 scored ${best.effectivePct}% — must be 0%`);
  }
  // Fuel/rent/insurance: no thin annual milestone as #1
  if (/petrol|fuel|house rent|insurance/i.test(c.query)) {
    if (/build ₹|annual milestone/i.test(best.label) && !/completes/i.test(best.label)) {
      errors.push(`reward-dead category crowned thin annual: ${best.label}`);
    }
  }

  // Amex PT must chase the next unpaid threshold from till-date spend (not a stale 4L jump)
  if (/targets 1\.9L/i.test(c.name)) {
    const pt = rows.find((r) => r.cardId === "amex_plat_travel");
    if (!pt) {
      errors.push("expected an Amex PT route in the ranking");
    } else {
      const blob = `${pt.label} ${pt.rationale} ${pt.pros.join(" ")}`;
      if (!/1[,.]?90|190,?000|₹1\.9/i.test(blob)) {
        errors.push(`Amex PT should reference 1.9L milestone, got: ${pt.label} | ${pt.rationale}`);
      }
      if (/4[,.]?00,?000|₹4\.0|build ₹4/i.test(blob) && !/1[,.]?90/i.test(blob)) {
        errors.push(`Amex PT incorrectly jumped to 4L: ${pt.label}`);
      }
    }
  }
  // Large phone spend must credit BOTH 1.9L and 4L Amex PT unlocks
  if (/unlocks 1\.9L \+ 4L/i.test(c.name)) {
    const pt = rows.find((r) => r.cardId === "amex_plat_travel");
    if (!pt) errors.push("expected Amex PT on large phone spend");
    else {
      const blob = `${pt.label} ${pt.rationale} ${pt.pros.join(" ")}`;
      if (!/1[,.]?90|190,?000/i.test(blob) || !/4[,.]?00,?000|₹4/i.test(blob)) {
        errors.push(`Amex PT should cite both 1.9L and 4L, got: ${pt.label} | ${pt.rationale}`);
      }
      if (pt.bonusRewardInr < 8000) {
        errors.push(`Amex PT milestone bonus too small (want ≥₹8.75k for 1.9L+4L): ${pt.bonusRewardInr}`);
      }
    }
    // Ranked list should be descending by ₹ return among feasible rows
    const feasible = rows.filter((r) => r.feasible !== false);
    for (let i = 1; i < Math.min(feasible.length, 6); i++) {
      if (feasible[i].totalRewardInr > feasible[i - 1].totalRewardInr + 50) {
        errors.push(
          `rank not descending by ₹ return: #${i} ${feasible[i - 1].cardId} ₹${feasible[i - 1].totalRewardInr.toFixed(0)} < #${i + 1} ${feasible[i].cardId} ₹${feasible[i].totalRewardInr.toFixed(0)}`
        );
        break;
      }
    }
  }
  // Forex: every non-Scapia credit route should show forex netting; Amex must not ignore 3.5%
  if (/forex/i.test(c.name) || det.channel === "foreign" && /usd|foreign|openai/i.test(c.query)) {
    const fxRows = rows.filter((r) => !["scapia", "upi", "cash"].includes(r.cardId) && r.feasible !== false);
    for (const r of fxRows.slice(0, 5)) {
      const blob = `${r.label} ${r.cons.join(" ")}`;
      if (!/forex|markup/i.test(blob) && cardLikelyHasForex(r.cardId)) {
        errors.push(`forex netting missing on ${r.cardId}: ${r.label}`);
      }
    }
    if (/small forex/i.test(c.name)) {
      const pt = rows.find((r) => r.cardId === "amex_plat_travel");
      if (pt && best.cardId === "amex_plat_travel") {
        errors.push(`small forex should not crown Amex PT (net ₹${Number(pt.totalRewardInr).toFixed(0)})`);
      }
    }
    if (/large forex/i.test(c.name)) {
      const pt = rows.find((r) => r.cardId === "amex_plat_travel");
      if (!pt) errors.push("expected Amex PT row on large forex");
      else if (!/3\.5%|net after/i.test(`${pt.label} ${pt.cons.join(" ")}`)) {
        errors.push(`large forex Amex should show 3.5% netting: ${pt.label}`);
      }
      // Dual milestone ₹8750 − 3.5% of 220k (₹7700) ≈ +₹1250 net → should beat Scapia 0
      if (pt && pt.bonusRewardInr >= 8000 && pt.totalRewardInr <= 0) {
        errors.push(`Amex with dual milestones should stay net-positive after 3.5%: got ₹${pt.totalRewardInr}`);
      }
    }
  }
  // Neon: 5% is YTD true-up, not rate on this txn; after ₹1.5L remainder is 2%
  if (/Neon true-up/i.test(c.name)) {
    const kiwi = rows.find((r) => r.cardId === "yes_kiwi");
    if (!kiwi) errors.push("expected Kiwi row");
    else {
      if (kiwi.effectivePct >= 4.9) {
        errors.push(`Kiwi scored ${kiwi.effectivePct}% — must not treat txn as flat ~5% Neon`);
      }
      // Expected ~3.69%: 2% on 2.2L + true-ups capped at 5% on first ₹1.5L only
      if (kiwi.effectivePct > 4.0 || kiwi.totalRewardInr > 10000) {
        errors.push(`Kiwi too high after true-up fix: ${kiwi.effectivePct}% / ₹${kiwi.totalRewardInr.toFixed(0)}`);
      }
      if (Math.abs(kiwi.baseRewardInr - 220000 * 0.02) > 1) {
        errors.push(`Kiwi base should be 2% instant (₹4400), got ₹${kiwi.baseRewardInr.toFixed(0)}`);
      }
      if (!/true-up|already earned|2% after/i.test(`${kiwi.label} ${kiwi.rationale} ${kiwi.pros.join(" ")} ${kiwi.cons.join(" ")}`)) {
        errors.push(`Kiwi copy should explain true-up, got: ${kiwi.label} | ${kiwi.rationale}`);
      }
    }
  }
  // IndiGo voucher should land on IDFC with voucher in the label/pros
  if (/BluChip voucher/i.test(c.name)) {
    const idfc = rows.find((r) => r.cardId === "idfc_indigo" && /voucher/i.test(`${r.label} ${r.pros.join(" ")}`));
    if (!idfc) errors.push("expected IDFC Indigo route mentioning BluChip voucher");
    else if (idfc.bonusRewardInr < 4000) errors.push(`voucher bonus too small: ${idfc.bonusRewardInr}`);
  }

  if (errors.length) {
    failed++;
    console.error(`FAIL  ${c.name}`);
    for (const e of errors) console.error(`      - ${e}`);
  } else {
    console.log(`PASS  ${c.name}  →  ${det.channel}/${det.category}  best=${best.cardId} ${best.effectivePct.toFixed(2)}%`);
  }
}

console.log(`Dry recommend suite — ${CASES.length} cases\n`);
for (const c of CASES) {
  try {
    runCase(c);
  } catch (err) {
    failed++;
    console.error(`FAIL  ${c.name}`);
    console.error(`      - ${err instanceof Error ? err.message : err}`);
  }
}

console.log(`\n${failed === 0 ? "OK" : "FAILED"} — ${CASES.length - failed}/${CASES.length} passed`);
process.exit(failed === 0 ? 0 : 1);
