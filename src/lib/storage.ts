import type { Transaction, Investment, Holding, Contribution } from "./types";
import { thisMonthKey, newId } from "./utils";
import { sbiFeeWaiverEligible } from "./spendTracking";

const KEYS = {
  TXNS: "ccm.transactions.v1",
  STATE: "ccm.state.v1",
  INVESTMENTS: "ccm.investments.v1",
  HOLDINGS: "ccm.holdings.v1",
} as const;

export type AppState = {
  // Per-card cycle tracking
  ptccEligibleSpend: number;
  mrccCycleSpend: number;
  bobYtdSpend: number;
  bobCycleSpend5x: number;
  sbiYtdSpend: number; // SimplyCLICK ONLINE voucher tracker (₹1L / ₹2L)
  sbiFeeWaiverSpend: number; // Eligible retail toward annual-fee reversal (fee-anniversary year)
  idfcYtdSpend: number;
  hsbcLivePlusYtdSpend: number;
  livePlusAccelCashbackUsedThisMonth: number;
  scapiaMonthlySpend: number;
  kiwiNeonCycleSpend: number;
  // Calendar-month / cycle milestone counters
  goldThisMonthTxnsAt1k: number;
  mrccThisCycleTxnsAt1500: number;
  mrccThisCycleAmount: number;
  goldShopwiseUsedThisMonth: number;
  /** Idle Swiggy Money from ShopWise ₹1k coupons (spend here before buying more). */
  swiggyMoneyBalance: number;
  bobBogoUsedThisMonth: boolean; // BOB Eterna District BOGO movie used this calendar month
  livePlusBogoUsedThisMonth: boolean; // HSBC Live+ District/BMS cinema BOGO used this calendar month
  // Welcome windows
  bobEternaIssueDate: string;
  bobWelcomeUnlocked: boolean;
  amazonPayIciciIssueDate: string;
  hsbcLivePlusIssueDate: string;
  hsbcWelcomeClaimed: boolean; // ₹1k welcome @ ₹25k/30d already credited
  // SBI SimplyCLICK period anchors (not calendar year)
  sbiFeeAnniversaryDate: string; // last / next fee post date (YYYY-MM-DD); waiver year runs from day after
  sbiOnlineYearStart: string; // start of current ONLINE voucher year (from statement reset)
  // Amazon Pay balance (idle gift-card money)
  amazonPayBalance: number;
  // Amazon Pay ICICI one-time welcome coupons already used (offer ids)
  amazonWelcomeClaimed: string[];
  // Live gift-card discount overrides, keyed by "STORE:Merchant" → % off (you enter from CRED/CheQ app)
  giftCardRateOverrides: Record<string, number>;
  // Credit-card bill / repayment tracker, keyed by "cardId:YYYY-MM"
  bills: Record<string, { billAmount: number; paid: boolean }>;
  // Calendar month the monthly counters belong to (auto-resets when the month rolls over).
  monthKey: string;
  // Calendar year for IDFC / HSBC Live+ annual counters (SBI uses its own keys below).
  yearKey?: string;
  // Amex Plat Travel membership year (boundary 3 Dec) for eligible-spend reset.
  ptccYearKey?: string;
  // Kiwi Neon membership year (boundary 1 Apr) for cycle-spend reset.
  kiwiYearKey?: string;
  // SBI online-voucher year key (from sbiOnlineYearStart MD).
  sbiOnlineYearKey?: string;
  // SBI fee-waiver year key (from sbiFeeAnniversaryDate MD).
  sbiFeeYearKey?: string;
  // Monthly counters (legacy, kept for compat)
  monthlyTxns: {
    [yearMonth: string]: {
      goldTxns: { count: number; amount: number };
      mrccTxns: { count: number; amount: number; total: number };
      scapiaSpend: number;
      kiwiSpend: number;
    };
  };
  // Reward balances
  amexMrPooled: number;
  indigoBluChips: number;
  scapiaCoins: number;
  sbiRp: number;
  bobRp: number;
  kiwiCashback: number;
  kiwiLifetimeEarned: number;
  credCoins: number;
  cheqChips: number;
  // Card states
  amazonPayIciciIssued: boolean;
  primeMember: boolean;
  // Milestone hits
  milestonesHit: string[]; // [`${cardId}:${threshold}`]
  // Lounge usage YTD
  ptccLoungesUsed: number;
  ptccLoungesUsedThisQuarter: number;
  // Debit / GyFTR (HDFC Visa Platinum debit — not credit)
  hdfcDebitIssueDate: string;
  gyftrBalance: number;
  hdfcDebitCashbackPts: number; // NetBanking cashback points ≈ ₹1
  hdfcDebitWelcomeGyftrClaimed: boolean; // ₹500/₹750 new-account GyFTR already received
  gyftrVouchers: { id: string; description: string; valueInr: number; expires: string; redeemed?: boolean; source?: string }[];
  /** Manual claim checklist (/claims) — benefit id → claimed. */
  benefitClaims: Record<string, boolean>;
};

export const DEFAULT_STATE: AppState = {
  // Amex app PT: 1,82,961. MRCC from activity.csv (fee 28 Nov 2025 → now), ex payments/fee/GST.
  ptccEligibleSpend: 182961,
  mrccCycleSpend: 70895,
  bobYtdSpend: 0,
  bobCycleSpend5x: 0,
  // From SBI Jul-2026 ONLINE SPENDS SUMMARY (voucher year starting ~22 May 2026).
  sbiYtdSpend: 32762,
  // Eligible retail since day after Oct-2025 fee (excl. tax/rent/fees); ~₹616 short of ₹1L waiver.
  sbiFeeWaiverSpend: 99384,
  idfcYtdSpend: 508923,
  hsbcLivePlusYtdSpend: 0,
  livePlusAccelCashbackUsedThisMonth: 0,
  scapiaMonthlySpend: 44009,
  kiwiNeonCycleSpend: 11849,
  goldThisMonthTxnsAt1k: 0,
  mrccThisCycleTxnsAt1500: 4,
  mrccThisCycleAmount: 9600,
  goldShopwiseUsedThisMonth: 0,
  swiggyMoneyBalance: 0,
  bobBogoUsedThisMonth: false,
  livePlusBogoUsedThisMonth: false,
  bobEternaIssueDate: "2026-05-27",
  bobWelcomeUnlocked: false,
  amazonPayIciciIssueDate: "2026-05-25",
  hsbcLivePlusIssueDate: "2026-07-20",
  hsbcWelcomeClaimed: false,
  sbiFeeAnniversaryDate: "2025-10-21",
  sbiOnlineYearStart: "2026-05-22",
  amazonPayBalance: 3338,
  amazonWelcomeClaimed: [],
  giftCardRateOverrides: {},
  bills: {},
  monthKey: "2026-05",
  yearKey: "2026",
  ptccYearKey: "2025",
  kiwiYearKey: "2026",
  sbiOnlineYearKey: "2026",
  sbiFeeYearKey: "2025",
  monthlyTxns: {},
  amexMrPooled: 128532,
  indigoBluChips: 14172,
  scapiaCoins: 7205,
  sbiRp: 2457,
  bobRp: 0,
  kiwiCashback: 1316,
  kiwiLifetimeEarned: 9825,
  credCoins: 1531012,
  cheqChips: 3846,
  amazonPayIciciIssued: true,
  primeMember: true,
  milestonesHit: ["idfc_indigo:200000", "idfc_indigo:500000"],
  ptccLoungesUsed: 1,
  ptccLoungesUsedThisQuarter: 1,
  hdfcDebitIssueDate: "",
  gyftrBalance: 750,
  hdfcDebitCashbackPts: 0,
  hdfcDebitWelcomeGyftrClaimed: true,
  gyftrVouchers: [
    {
      id: "gyftr-hdfc-dc-750",
      description: "HDFC Debit new-account campaign (5× ≥₹500 POS/ecom)",
      valueInr: 750,
      expires: "",
      redeemed: false,
      source: "hdfc_visa_platinum_debit",
    },
  ],
  benefitClaims: {},
};

function isClient(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

// Change notification — cloud sync + UI (Recommend) subscribe after any local write.
const changeListeners = new Set<() => void>();
let suppressChange = false;
/** @deprecated Prefer onStorageChange — kept for cloudSync start/stop. */
export function setStorageOnChange(fn: (() => void) | null): void {
  changeListeners.clear();
  if (fn) changeListeners.add(fn);
}
/** Subscribe to localStorage state/txn writes. Returns unsubscribe. */
export function onStorageChange(fn: () => void): () => void {
  changeListeners.add(fn);
  return () => { changeListeners.delete(fn); };
}
function fireChange(): void {
  if (suppressChange) return;
  for (const fn of [...changeListeners]) {
    try { fn(); } catch { /* ignore */ }
  }
}

// ----- Membership-period keys (drive automatic counter resets) -----
function calYearKey(d = new Date()): string { return String(d.getFullYear()); }
function ptYearKey(d = new Date()): string {
  // Amex Plat Travel membership year boundary: 3 Dec.
  const y = d.getFullYear();
  return String(d >= new Date(y, 11, 3) ? y : y - 1);
}
function kiwiNeonYearKey(d = new Date()): string {
  // Kiwi Neon membership year boundary: 1 Apr.
  const y = d.getFullYear();
  return String(d >= new Date(y, 3, 1) ? y : y - 1);
}
/** Period key from an anniversary MM-DD (or full ISO date). Year = start year of current period. */
function anniversaryYearKey(anniversaryIso: string, d = new Date()): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(anniversaryIso.trim());
  if (!m) return calYearKey(d);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  const y = d.getFullYear();
  const boundary = new Date(y, mm - 1, dd);
  return String(d >= boundary ? y : y - 1);
}

export function loadState(): AppState {
  if (!isClient()) return DEFAULT_STATE;
  const raw = localStorage.getItem(KEYS.STATE);
  if (!raw) return DEFAULT_STATE;
  let st: AppState;
  try {
    st = { ...DEFAULT_STATE, ...JSON.parse(raw) };
    if (!st.benefitClaims || typeof st.benefitClaims !== "object") st.benefitClaims = {};
  } catch {
    return DEFAULT_STATE;
  }

  // Auto-reset period counters when their period rolls over, so milestones aren't
  // perpetually treated as "done" (the root cause of Amex monthly starvation).
  const mk = thisMonthKey();
  const yk = calYearKey();
  const pk = ptYearKey();
  const kk = kiwiNeonYearKey();
  const sbiOnlineStart = st.sbiOnlineYearStart || DEFAULT_STATE.sbiOnlineYearStart;
  const sbiFeeAnn = st.sbiFeeAnniversaryDate || DEFAULT_STATE.sbiFeeAnniversaryDate;
  // Fee-waiver year starts the day AFTER the fee posts (spend after 21 Oct counts to next waiver).
  const feeBoundary = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sbiFeeAnn.trim());
    if (!m) return sbiFeeAnn;
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1);
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${dt.getFullYear()}-${mm}-${dd}`;
  })();
  const sok = anniversaryYearKey(sbiOnlineStart);
  const sfk = anniversaryYearKey(feeBoundary);
  let changed = false;

  // One-time migrate old calendar-year SBI default when statement fields first merge.
  if (st.sbiYtdSpend === 91614) {
    st.sbiYtdSpend = DEFAULT_STATE.sbiYtdSpend;
    st.sbiFeeWaiverSpend = DEFAULT_STATE.sbiFeeWaiverSpend;
    st.sbiFeeAnniversaryDate = DEFAULT_STATE.sbiFeeAnniversaryDate;
    st.sbiOnlineYearStart = DEFAULT_STATE.sbiOnlineYearStart;
    changed = true;
  }

  // MONTHLY (calendar month) — only reset calendar-month fields.
  // Do NOT reset mrccCycleSpend here: that tracks fee-waiver annual progress (₹90k/₹1.5L).
  if (!st.monthKey) { st.monthKey = mk; changed = true; }
  else if (st.monthKey !== mk) {
    st.monthKey = mk;
    st.goldThisMonthTxnsAt1k = 0;
    st.mrccThisCycleTxnsAt1500 = 0;
    st.mrccThisCycleAmount = 0;
    st.goldShopwiseUsedThisMonth = 0;
    st.scapiaMonthlySpend = 0;
    st.bobCycleSpend5x = 0;
    st.livePlusAccelCashbackUsedThisMonth = 0;
    changed = true;
  }
  // ANNUAL — calendar year (IDFC / HSBC Live+ only; SBI has its own anniversary keys)
  if (!st.yearKey) { st.yearKey = yk; changed = true; }
  else if (st.yearKey !== yk) {
    st.yearKey = yk;
    st.idfcYtdSpend = 0;
    st.hsbcLivePlusYtdSpend = 0;
    changed = true;
  }
  // Amex Plat Travel membership year (3 Dec)
  if (!st.ptccYearKey) { st.ptccYearKey = pk; changed = true; }
  else if (st.ptccYearKey !== pk) {
    st.ptccYearKey = pk;
    st.ptccEligibleSpend = 0;
    st.ptccLoungesUsed = 0;
    st.ptccLoungesUsedThisQuarter = 0;
    changed = true;
  }
  // Kiwi Neon membership year (1 Apr)
  if (!st.kiwiYearKey) { st.kiwiYearKey = kk; changed = true; }
  else if (st.kiwiYearKey !== kk) {
    st.kiwiYearKey = kk;
    st.kiwiNeonCycleSpend = 0;
    changed = true;
  }
  // SBI online voucher year (~22 May from statement reset May→Jun 2026)
  if (!st.sbiOnlineYearKey) { st.sbiOnlineYearKey = sok; changed = true; }
  else if (st.sbiOnlineYearKey !== sok) {
    st.sbiOnlineYearKey = sok;
    st.sbiYtdSpend = 0;
    changed = true;
  }
  // SBI fee-waiver year (day after fee anniversary, currently ~22 Oct)
  if (!st.sbiFeeYearKey) { st.sbiFeeYearKey = sfk; changed = true; }
  else if (st.sbiFeeYearKey !== sfk) {
    st.sbiFeeYearKey = sfk;
    st.sbiFeeWaiverSpend = 0;
    changed = true;
  }

  if (changed) localStorage.setItem(KEYS.STATE, JSON.stringify(st));

  // Drop stale milestone claims where till-date spend is still below the threshold
  // (keeps Recommend aligned with the Milestones page).
  {
    const spendByCard: Record<string, number> = {
      amex_plat_travel: st.ptccEligibleSpend ?? 0,
      amex_mrcc: st.mrccCycleSpend ?? 0,
      sbi_simplyclick: st.sbiYtdSpend ?? 0,
      idfc_indigo: st.idfcYtdSpend ?? 0,
      bob_eterna: st.bobYtdSpend ?? 0,
      hsbc_live_plus: st.hsbcLivePlusYtdSpend ?? 0,
    };
    const before = st.milestonesHit ?? [];
    const cleaned = before.filter((key) => {
      const [cardId, thrRaw] = key.split(":");
      const thr = Number(thrRaw);
      if (!cardId || !Number.isFinite(thr)) return true;
      const spent = spendByCard[cardId];
      if (spent == null) return true;
      return spent >= thr;
    });
    if (cleaned.length !== before.length) {
      st.milestonesHit = cleaned;
      localStorage.setItem(KEYS.STATE, JSON.stringify(st));
    }
  }

  return st;
}

/**
 * Derive log-based milestone/spend counters without writing to localStorage.
 * Prefer this before ranking so recommend never trusts a stale counter cache.
 * NOTE: only reflects spend logged in the app (not pre-app seeded statement history).
 */
export function deriveCountersFromLog(st: AppState = loadState(), txns: Transaction[] = loadTransactions()): AppState {
  const mk = thisMonthKey();
  const yk = calYearKey();
  const pk = ptYearKey();
  const kk = kiwiNeonYearKey();
  const sbiOnlineStart = st.sbiOnlineYearStart || DEFAULT_STATE.sbiOnlineYearStart;
  const sbiFeeAnn = st.sbiFeeAnniversaryDate || DEFAULT_STATE.sbiFeeAnniversaryDate;
  const feeBoundaryMd = (() => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sbiFeeAnn.trim());
    if (!m) return sbiFeeAnn;
    const dt = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1);
    return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  })();
  const sok = anniversaryYearKey(sbiOnlineStart);
  const sfk = anniversaryYearKey(feeBoundaryMd);
  const next: AppState = {
    ...st,
    ptccEligibleSpend: 0,
    mrccCycleSpend: 0,
    mrccThisCycleAmount: 0,
    mrccThisCycleTxnsAt1500: 0,
    bobYtdSpend: 0,
    bobCycleSpend5x: 0,
    sbiYtdSpend: 0,
    sbiFeeWaiverSpend: 0,
    idfcYtdSpend: 0,
    hsbcLivePlusYtdSpend: 0,
    livePlusAccelCashbackUsedThisMonth: 0,
    scapiaMonthlySpend: 0,
    goldThisMonthTxnsAt1k: 0,
    goldShopwiseUsedThisMonth: 0,
    kiwiNeonCycleSpend: 0,
  };

  for (const t of txns) {
    if (!t.cardId || !t.amount) continue;
    const d = new Date(t.date);
    const inMonth = t.date.slice(0, 7) === mk;
    const inYear = t.date.slice(0, 4) === yk;
    const inPt = ptYearKey(d) === pk;
    const inKiwi = kiwiNeonYearKey(d) === kk;
    const inSbiOnline = anniversaryYearKey(sbiOnlineStart, d) === sok;
    const inSbiFee = anniversaryYearKey(feeBoundaryMd, d) === sfk;
    const amt = t.amount;
    switch (t.cardId) {
      case "amex_plat_travel": if (inPt) next.ptccEligibleSpend += amt; break;
      case "amex_mrcc":
        // Fee-waiver progress = membership / renewal year (manual till-date preferred; log uses calendar as approx).
        if (inYear) next.mrccCycleSpend += amt;
        if (inMonth) {
          next.mrccThisCycleAmount += amt;
          if (amt >= 1500) next.mrccThisCycleTxnsAt1500 = Math.min(4, next.mrccThisCycleTxnsAt1500 + 1);
        }
        break;
      case "bob_eterna":
        next.bobYtdSpend += amt;
        // 5× headroom is monthly; approximate with all BOB spends this month.
        if (inMonth) next.bobCycleSpend5x += amt;
        break;
      case "sbi_simplyclick":
        if (inSbiOnline) next.sbiYtdSpend += amt;
        if (inSbiFee && sbiFeeWaiverEligible(t.category || "", t.merchant || "")) next.sbiFeeWaiverSpend += amt;
        break;
      case "idfc_indigo": if (inYear) next.idfcYtdSpend += amt; break;
      case "hsbc_live_plus": {
        if (inYear) next.hsbcLivePlusYtdSpend += amt;
        if (inMonth && ((t.effectivePct ?? 0) >= 9 || (t.rewardInr ?? 0) >= amt * 0.09)) {
          next.livePlusAccelCashbackUsedThisMonth += Math.min(amt * 0.1, t.rewardInr || amt * 0.1);
        }
        break;
      }
      case "scapia": if (inMonth) next.scapiaMonthlySpend += amt; break;
      case "amex_gold":
        if (inMonth && amt >= 1000) next.goldThisMonthTxnsAt1k = Math.min(6, next.goldThisMonthTxnsAt1k + 1);
        if (inMonth && t.path === "shopwise") next.goldShopwiseUsedThisMonth += amt;
        break;
      case "yes_kiwi": if (inKiwi) next.kiwiNeonCycleSpend += amt; break;
    }
  }
  if (next.bobYtdSpend >= 50000) next.bobWelcomeUnlocked = true;
  return next;
}

/** Live+ welcome progress: sum of Live+ txns dated within [issue, issue+30d]. */
export function getLivePlusWelcomeSpend(st: AppState = loadState(), txns: Transaction[] = loadTransactions()): number {
  const issue = st.hsbcLivePlusIssueDate;
  if (!issue) return 0;
  const start = new Date(issue).getTime();
  if (!Number.isFinite(start)) return 0;
  const end = start + 30 * 24 * 60 * 60 * 1000;
  let sum = 0;
  for (const t of txns) {
    if (t.cardId !== "hsbc_live_plus" || !t.amount) continue;
    const ms = new Date(t.date).getTime();
    if (ms >= start && ms <= end) sum += t.amount;
  }
  return sum;
}

/**
 * Rebuild spend / milestone counters from the transaction log and persist.
 * WARNING: this overwrites annual till-dates (PT / MRCC / SBI / IDFC / etc.) with
 * log-only sums. Use only when you intend to discard statement-seeded / manually
 * edited Milestones numbers. Loyalty balances and issuance dates are kept.
 */
export function recomputeCounters(): AppState {
  const next = deriveCountersFromLog();
  saveState(next);
  return next;
}

export function saveState(s: AppState): void {
  if (!isClient()) return;
  localStorage.setItem(KEYS.STATE, JSON.stringify(s));
  fireChange();
}

export function loadTransactions(): Transaction[] {
  if (!isClient()) return [];
  const raw = localStorage.getItem(KEYS.TXNS);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveTransactions(t: Transaction[]): void {
  if (!isClient()) return;
  localStorage.setItem(KEYS.TXNS, JSON.stringify(t));
  fireChange();
}

export function addTransaction(t: Transaction): Transaction[] {
  const all = loadTransactions();
  all.unshift(t);
  saveTransactions(all);
  return all;
}

export function updateTransaction(id: string, patch: Partial<Transaction>): Transaction[] {
  const all = loadTransactions().map((t) => (t.id === id ? { ...t, ...patch, id: t.id } : t));
  saveTransactions(all);
  return all;
}

export function deleteTransaction(id: string): Transaction[] {
  const all = loadTransactions().filter((t) => t.id !== id);
  saveTransactions(all);
  return all;
}

export function loadInvestments(): Investment[] {
  if (!isClient()) return [];
  const raw = localStorage.getItem(KEYS.INVESTMENTS);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function saveInvestments(arr: Investment[]): void {
  if (!isClient()) return;
  localStorage.setItem(KEYS.INVESTMENTS, JSON.stringify(arr));
  fireChange();
}

export function addInvestment(inv: Investment): Investment[] {
  const all = loadInvestments();
  all.unshift(inv);
  saveInvestments(all);
  return all;
}

export function deleteInvestment(id: string): Investment[] {
  const all = loadInvestments().filter((i) => i.id !== id);
  saveInvestments(all);
  return all;
}

// ---------------- Holdings (positions) ----------------
// Each holding is one asset; SIPs / top-ups accumulate as contributions so the
// same smallcase/fund/stock remains a single line that grows over time.

export function holdingInvested(h: Holding): number {
  return (h.contributions ?? []).reduce((a, c) => a + (c.amount || 0), 0);
}

// Current "value" of a holding. For real estate this is NET EQUITY (property value − outstanding loan),
// which keeps gains sensible (right after purchase, equity ≈ down payment ≈ ~0% gain).
export function holdingValue(h: Holding): number {
  if (h.type === "real_estate" && h.realEstate) {
    const pv = h.realEstate.propertyValue ?? holdingInvested(h);
    return pv - (h.realEstate.loanAmount ?? 0);
  }
  return h.currentValue ?? holdingInvested(h);
}

// Whether the user has supplied a market value (so we can show P/L instead of just cost).
export function holdingHasValue(h: Holding): boolean {
  if (h.type === "real_estate") return h.realEstate?.propertyValue != null;
  return h.currentValue != null;
}

function migrateInvestmentsToHoldings(legacy: Investment[]): Holding[] {
  const map = new Map<string, Holding>();
  // Oldest first so contribution order reads naturally.
  const ordered = [...legacy].sort((a, b) => a.date.localeCompare(b.date));
  for (const inv of ordered) {
    const name = (inv.asset || "").trim() || `${inv.type} (unnamed)`;
    const key = `${inv.type}::${name.toLowerCase()}::${(inv.platform || "").toLowerCase()}`;
    let h = map.get(key);
    if (!h) {
      h = { id: newId(), name, type: inv.type, platform: inv.platform, contributions: [], notes: inv.notes };
      map.set(key, h);
    }
    h.contributions.push({ id: inv.id || newId(), date: inv.date, amount: inv.amount, paymentMethod: inv.paymentMethod, note: inv.notes });
  }
  return [...map.values()];
}

export function loadHoldings(): Holding[] {
  if (!isClient()) return [];
  const raw = localStorage.getItem(KEYS.HOLDINGS);
  if (raw) {
    try { return JSON.parse(raw); } catch { return []; }
  }
  // One-time migration of legacy flat investments into grouped holdings.
  const legacy = loadInvestments();
  if (legacy.length === 0) return [];
  const migrated = migrateInvestmentsToHoldings(legacy);
  saveHoldings(migrated);
  return migrated;
}

export function saveHoldings(arr: Holding[]): void {
  if (!isClient()) return;
  localStorage.setItem(KEYS.HOLDINGS, JSON.stringify(arr));
  fireChange();
}

export function addHolding(h: Holding): Holding[] {
  const all = loadHoldings();
  all.unshift(h);
  saveHoldings(all);
  return all;
}

export function updateHolding(id: string, patch: Partial<Holding>): Holding[] {
  const all = loadHoldings().map((h) => (h.id === id ? { ...h, ...patch } : h));
  saveHoldings(all);
  return all;
}

export function deleteHolding(id: string): Holding[] {
  const all = loadHoldings().filter((h) => h.id !== id);
  saveHoldings(all);
  return all;
}

export function addContribution(holdingId: string, c: Contribution): Holding[] {
  const all = loadHoldings().map((h) =>
    h.id === holdingId ? { ...h, contributions: [...(h.contributions ?? []), c] } : h
  );
  saveHoldings(all);
  return all;
}

export function deleteContribution(holdingId: string, contribId: string): Holding[] {
  const all = loadHoldings().map((h) =>
    h.id === holdingId ? { ...h, contributions: (h.contributions ?? []).filter((c) => c.id !== contribId) } : h
  );
  saveHoldings(all);
  return all;
}

export function exportAll(): string {
  return JSON.stringify({
    state: loadState(),
    transactions: loadTransactions(),
    investments: loadInvestments(),
    holdings: loadHoldings(),
  }, null, 2);
}

export function importAll(json: string, silent = false): boolean {
  try {
    const parsed = JSON.parse(json);
    if (silent) suppressChange = true;
    try {
      if (parsed.state) saveState({ ...DEFAULT_STATE, ...parsed.state });
      if (Array.isArray(parsed.transactions)) saveTransactions(parsed.transactions);
      if (Array.isArray(parsed.investments)) saveInvestments(parsed.investments);
      if (Array.isArray(parsed.holdings)) {
        saveHoldings(parsed.holdings);
      } else if (Array.isArray(parsed.investments) && parsed.investments.length > 0) {
        // Older payload without holdings: build them from the flat investments.
        saveHoldings(migrateInvestmentsToHoldings(parsed.investments));
      }
    } finally {
      if (silent) suppressChange = false;
    }
    return true;
  } catch {
    return false;
  }
}

export function clearAll(): void {
  if (!isClient()) return;
  localStorage.removeItem(KEYS.STATE);
  localStorage.removeItem(KEYS.TXNS);
  localStorage.removeItem(KEYS.INVESTMENTS);
  localStorage.removeItem(KEYS.HOLDINGS);
}
