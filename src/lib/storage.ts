import type { Transaction, Investment, Holding, Contribution } from "./types";
import { thisMonthKey, newId } from "./utils";

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
  sbiYtdSpend: number;
  idfcYtdSpend: number;
  blckYtdSpend: number;
  scapiaMonthlySpend: number;
  kiwiNeonCycleSpend: number;
  // Calendar-month / cycle milestone counters
  goldThisMonthTxnsAt1k: number;
  mrccThisCycleTxnsAt1500: number;
  mrccThisCycleAmount: number;
  goldShopwiseUsedThisMonth: number;
  bobBogoUsedThisMonth: boolean; // BOB Eterna District BOGO movie used this calendar month
  // Welcome windows
  bobEternaIssueDate: string;
  bobWelcomeUnlocked: boolean;
  amazonPayIciciIssueDate: string;
  swiggyBlckIssueDate?: string;
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
  swiggyBlckIssued: boolean;
  amazonPayIciciIssued: boolean;
  primeMember: boolean;
  // Milestone hits
  milestonesHit: string[]; // [`${cardId}:${threshold}`]
  // Lounge usage YTD
  ptccLoungesUsed: number;
  ptccLoungesUsedThisQuarter: number;
};

export const DEFAULT_STATE: AppState = {
  ptccEligibleSpend: 177707,
  mrccCycleSpend: 33885,
  bobYtdSpend: 0,
  bobCycleSpend5x: 0,
  sbiYtdSpend: 91614,
  idfcYtdSpend: 508923,
  blckYtdSpend: 0,
  scapiaMonthlySpend: 44009,
  kiwiNeonCycleSpend: 11849,
  goldThisMonthTxnsAt1k: 6,
  mrccThisCycleTxnsAt1500: 4,
  mrccThisCycleAmount: 9600,
  goldShopwiseUsedThisMonth: 0,
  bobBogoUsedThisMonth: false,
  bobEternaIssueDate: "2026-05-27",
  bobWelcomeUnlocked: false,
  amazonPayIciciIssueDate: "2026-05-25",
  swiggyBlckIssueDate: undefined,
  amazonPayBalance: 3338,
  amazonWelcomeClaimed: [],
  giftCardRateOverrides: {},
  bills: {},
  monthKey: "2026-05",
  monthlyTxns: {},
  amexMrPooled: 127710,
  indigoBluChips: 14172,
  scapiaCoins: 7205,
  sbiRp: 2457,
  bobRp: 0,
  kiwiCashback: 1316,
  kiwiLifetimeEarned: 9825,
  credCoins: 1531012,
  cheqChips: 3846,
  swiggyBlckIssued: false,
  amazonPayIciciIssued: true,
  primeMember: true,
  milestonesHit: ["amex_plat_travel:190000", "idfc_indigo:200000", "idfc_indigo:500000"],
  ptccLoungesUsed: 1,
  ptccLoungesUsedThisQuarter: 1,
};

function isClient(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

// Change notification — cloud sync registers here to push after any local write.
let onChangeCb: (() => void) | null = null;
let suppressChange = false;
export function setStorageOnChange(fn: (() => void) | null): void {
  onChangeCb = fn;
}
function fireChange(): void {
  if (suppressChange) return;
  try { onChangeCb?.(); } catch { /* ignore */ }
}

export function loadState(): AppState {
  if (!isClient()) return DEFAULT_STATE;
  const raw = localStorage.getItem(KEYS.STATE);
  if (!raw) return DEFAULT_STATE;
  let st: AppState;
  try {
    st = { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATE;
  }
  // Auto-reset MONTHLY counters when the calendar month rolls over, so Amex/Scapia
  // monthly milestones aren't perpetually treated as "done" (the root cause of starvation).
  const mk = thisMonthKey();
  if (!st.monthKey) {
    // Migrating older state: adopt current month without wiping this month's progress.
    st = { ...st, monthKey: mk };
    localStorage.setItem(KEYS.STATE, JSON.stringify(st));
  } else if (st.monthKey !== mk) {
    st = {
      ...st,
      monthKey: mk,
      goldThisMonthTxnsAt1k: 0,
      mrccThisCycleTxnsAt1500: 0,
      mrccThisCycleAmount: 0,
      goldShopwiseUsedThisMonth: 0,
      scapiaMonthlySpend: 0,
      bobCycleSpend5x: 0,
    };
    localStorage.setItem(KEYS.STATE, JSON.stringify(st));
  }
  return st;
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
