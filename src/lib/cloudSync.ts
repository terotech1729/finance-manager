import { getSupabase, isSupabaseConfigured } from "./supabase";
import { exportAll, importAll, setStorageOnChange } from "./storage";

/**
 * Cloud sync against a single Supabase table `finance_data`:
 *   columns: user_id (uuid, PK, = auth.uid()), data (jsonb), updated_at (timestamptz)
 * Row-level security ensures each user only sees their own row.
 *
 * Strategy: localStorage stays the source of truth for the running session.
 *   - pull() on login: if a remote row exists, load it into localStorage.
 *   - push() (debounced) after any local change: upsert the full blob.
 */

const TABLE = "finance_data";
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let started = false;

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "offline";
let status: SyncStatus = isSupabaseConfigured ? "idle" : "offline";
const listeners = new Set<(s: SyncStatus) => void>();

export function onSyncStatus(fn: (s: SyncStatus) => void): () => void {
  listeners.add(fn);
  fn(status);
  return () => listeners.delete(fn);
}
function setStatus(s: SyncStatus) {
  status = s;
  listeners.forEach((l) => l(s));
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
  if (error) {
    setStatus("error");
    return { pulled: false, hadRemote: false };
  }
  if (data?.data) {
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
  const payload = JSON.parse(exportAll());
  const { error } = await sb.from(TABLE).upsert(
    { user_id: uid, data: payload, updated_at: new Date().toISOString() },
    { onConflict: "user_id" }
  );
  if (error) {
    setStatus("error");
    return false;
  }
  setStatus("synced");
  return true;
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { void pushToCloud(); }, 1500);
}

/**
 * Start sync once the user is authenticated: pull remote → if remote was empty,
 * seed it with whatever is local; then register a debounced push on every change.
 */
export async function startCloudSync(): Promise<void> {
  if (!isSupabaseConfigured || started) return;
  started = true;
  const { hadRemote } = await pullFromCloud();
  if (!hadRemote) {
    // First time on this account — seed the cloud with current local data.
    await pushToCloud();
  }
  setStorageOnChange(schedulePush);
}

export function stopCloudSync(): void {
  started = false;
  setStorageOnChange(null);
  if (pushTimer) clearTimeout(pushTimer);
  setStatus(isSupabaseConfigured ? "idle" : "offline");
}
