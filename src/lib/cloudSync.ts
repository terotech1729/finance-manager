import { getSupabase, isSupabaseConfigured } from "./supabase";
import {
  clearAll,
  exportAll,
  getCachedOwner,
  importAll,
  notifyRemoteDataApplied,
  onStorageChange,
  setCachedOwner,
} from "./storage";

/**
 * Cloud sync against a single Supabase table `finance_data`:
 *   columns: user_id (uuid, PK, = auth.uid()), data (jsonb), updated_at (timestamptz)
 * Row-level security ensures each user only sees their own row.
 *
 * Strategy: localStorage stays the source of truth for the running session.
 *   - pull() on login (awaited before the app renders), then again whenever the
 *     tab regains focus or the refresh interval elapses, so a device that was
 *     left open still shows what you logged elsewhere.
 *   - push() (debounced) after any local change: upsert the full blob.
 *
 * Unpushed local edits always win: a refresh flushes the pending push instead of
 * pulling, so a background poll can never overwrite something you just typed.
 */

const TABLE = "finance_data";
const PUSH_DEBOUNCE_MS = 1500;
/** Background re-pull cadence while the tab is open and visible. */
const REFRESH_INTERVAL_MS = 60_000;
/** Skip a focus-triggered pull if we already pulled this recently. */
const REFRESH_MIN_GAP_MS = 10_000;
/**
 * "Local edits not yet in the cloud" marker. Kept in localStorage rather than a
 * module variable so every tab on this device agrees: otherwise tab B could pull
 * an older cloud blob over edits tab A has written but not yet pushed.
 */
const DIRTY_KEY = "ccm.sync.dirtyAt";

let pushTimer: ReturnType<typeof setTimeout> | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
let started = false;
let unsubStorage: (() => void) | null = null;
let unbindWindow: (() => void) | null = null;
let lastPullAt = 0;
let inFlight: Promise<unknown> | null = null;

function readDirty(): string | null {
  if (typeof localStorage === "undefined") return null;
  try { return localStorage.getItem(DIRTY_KEY); } catch { return null; }
}
function markDirty(): void {
  if (typeof localStorage === "undefined") return;
  try { localStorage.setItem(DIRTY_KEY, String(Date.now())); } catch { /* quota */ }
}
/** Clear only if nothing was written while the push was in flight. */
function clearDirtyIfUnchanged(stamp: string | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    if (readDirty() === stamp) localStorage.removeItem(DIRTY_KEY);
  } catch { /* ignore */ }
}

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";
let status: SyncStatus = isSupabaseConfigured ? "idle" : "offline";
let lastSyncedAt: number | null = null;
const listeners = new Set<(s: SyncStatus) => void>();

export function onSyncStatus(fn: (s: SyncStatus) => void): () => void {
  listeners.add(fn);
  fn(status);
  return () => listeners.delete(fn);
}
function setStatus(s: SyncStatus) {
  status = s;
  if (s === "synced") lastSyncedAt = Date.now();
  listeners.forEach((l) => l(s));
}

export function getSyncStatus(): SyncStatus {
  return status;
}
export function getLastSyncedAt(): number | null {
  return lastSyncedAt;
}

async function getUserId(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user?.id ?? null;
}

/** Pull the remote snapshot into localStorage (silent — won't re-trigger a push). */
export async function pullFromCloud(): Promise<{ pulled: boolean; hadRemote: boolean }> {
  const sb = getSupabase();
  const uid = await getUserId();
  if (!sb || !uid) return { pulled: false, hadRemote: false };
  setStatus("syncing");
  const { data, error } = await sb.from(TABLE).select("data").eq("user_id", uid).maybeSingle();
  lastPullAt = Date.now();
  if (error) {
    setStatus("error");
    return { pulled: false, hadRemote: false };
  }
  if (data?.data) {
    // Import remote blob as-is. Do NOT recomputeCounters() here — that rebuilds
    // annual till-dates from the (usually incomplete) txn log and wipes numbers
    // you typed on Milestones / Settings, then the next push locks the wipe into DB.
    // importAll(silent) notifies mounted pages without scheduling a push back.
    importAll(typeof data.data === "string" ? data.data : JSON.stringify(data.data), true);
    setStatus("synced");
    return { pulled: true, hadRemote: true };
  }
  setStatus("synced");
  return { pulled: false, hadRemote: false };
}

/** Push the full local blob to the cloud (upsert). */
export async function pushToCloud(): Promise<boolean> {
  const sb = getSupabase();
  const uid = await getUserId();
  if (!sb || !uid) return false;
  setStatus("syncing");
  const stamp = readDirty();
  const payload = JSON.parse(exportAll());
  const { error } = await sb.from(TABLE).upsert(
    { user_id: uid, data: payload, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) {
    setStatus("error");
    return false;
  }
  clearDirtyIfUnchanged(stamp);
  setStatus("synced");
  return true;
}

function schedulePush() {
  markDirty();
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void runExclusive(() => pushToCloud());
  }, PUSH_DEBOUNCE_MS);
}

/** Serialize pull/push so a poll can't interleave with an in-progress write. */
async function runExclusive<T>(fn: () => Promise<T>): Promise<T> {
  while (inFlight) {
    try { await inFlight; } catch { /* previous op already reported status */ }
  }
  const p = fn();
  inFlight = p;
  try {
    return await p;
  } finally {
    if (inFlight === p) inFlight = null;
  }
}

/**
 * Bring this device up to date. If we're holding unpushed local edits, those are
 * newer than anything in the cloud — flush them instead of pulling over them.
 */
export async function refreshFromCloud(opts: { force?: boolean } = {}): Promise<void> {
  if (!isSupabaseConfigured || !started) return;
  if (!opts.force && Date.now() - lastPullAt < REFRESH_MIN_GAP_MS) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  await runExclusive(async () => {
    if (readDirty() || pushTimer) {
      if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
      await pushToCloud();
      return;
    }
    await pullFromCloud();
  });
}

function bindAutoRefresh() {
  if (typeof window === "undefined") return;

  const onVisible = () => {
    if (document.visibilityState === "visible") void refreshFromCloud();
  };
  const onFocus = () => { void refreshFromCloud(); };
  const onOnline = () => { void refreshFromCloud({ force: true }); };
  // Note: no pull on cross-tab `storage` events. Another tab's write is already
  // in this device's localStorage, and the cloud copy may still be behind it —
  // pulling here would overwrite fresh data with a stale blob. The UI picks up
  // cross-tab writes directly (see useDataVersion).

  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onFocus);
  window.addEventListener("online", onOnline);
  refreshTimer = setInterval(() => {
    if (document.visibilityState === "visible") void refreshFromCloud();
  }, REFRESH_INTERVAL_MS);

  unbindWindow = () => {
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onFocus);
    window.removeEventListener("online", onOnline);
    if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
  };
}

/**
 * Start sync once the user is authenticated: pull remote → if remote was empty,
 * seed it with whatever is local; then register a debounced push on every change
 * plus focus/interval re-pulls. Await this before rendering data pages.
 */
export async function startCloudSync(): Promise<void> {
  if (!isSupabaseConfigured || started) return;
  started = true;

  // Shared device: if the cache belongs to a different account, drop it before
  // pulling — otherwise the previous user's numbers show, and (when the new
  // account has no remote row yet) get pushed into their row.
  const uid = await getUserId();
  if (uid && getCachedOwner() && getCachedOwner() !== uid) {
    clearAll();
    notifyRemoteDataApplied();
  }
  setCachedOwner(uid);

  const { hadRemote } = await runExclusive(() => pullFromCloud());
  if (!hadRemote) {
    // First time on this account — seed the cloud with current local data.
    await runExclusive(() => pushToCloud());
  }
  unsubStorage = onStorageChange((origin) => {
    // "remote" = the blob we just imported from cloud/another tab; pushing it
    // back would be a no-op echo and would mark us dirty for no reason.
    if (origin === "remote") return;
    schedulePush();
  });
  bindAutoRefresh();
}

export function stopCloudSync(): void {
  started = false;
  lastPullAt = 0;
  unsubStorage?.();
  unsubStorage = null;
  unbindWindow?.();
  unbindWindow = null;
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  setStatus(isSupabaseConfigured ? "idle" : "offline");
}

/**
 * Sign out safely: flush anything still pending so the last edits aren't lost,
 * then wipe the local cache so the next person on this device starts clean.
 */
export async function signOutAndClear(): Promise<void> {
  const sb = getSupabase();
  if (pushTimer) { clearTimeout(pushTimer); pushTimer = null; }
  if (readDirty()) {
    try { await runExclusive(() => pushToCloud()); } catch { /* still sign out */ }
  }
  stopCloudSync();
  clearAll();
  setCachedOwner(null);
  try { localStorage.removeItem(DIRTY_KEY); } catch { /* ignore */ }
  await sb?.auth.signOut();
}
