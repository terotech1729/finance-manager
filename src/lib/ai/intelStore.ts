import type { CardPatch } from "../cardOverlay";
import type { AiSource } from "./client";

/**
 * Supabase reads/writes for the scan tables, over the REST API.
 *
 * Server-side only. Writes go through the service-role key, which bypasses row-level
 * security — the scan has no signed-in user to act as, and card terms aren't per-user
 * data. Reads fall back to the anon key so the browser can show findings without one.
 */

export type IntelKind = "term_change" | "new_card" | "drop_suggestion";
export type IntelStatus = "proposed" | "applied" | "rejected" | "advisory";
export type Confidence = "high" | "medium" | "low";

export type IntelRow = {
  id: number;
  card_id: string;
  card_name: string | null;
  kind: IntelKind;
  status: IntelStatus;
  direction: "devaluation" | "revaluation" | "neutral" | null;
  field: string | null;
  current_value: string | null;
  proposed_value: string | null;
  summary: string;
  detail: string | null;
  effective_on: string | null;
  sources: AiSource[];
  confidence: Confidence;
  fingerprint: string | null;
  created_at: string;
  decided_at: string | null;
};

export type NewIntel = Omit<IntelRow, "id" | "created_at" | "decided_at">;

function base(): { url: string; key: string; writable: boolean } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = service || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key, writable: !!service };
}

function headers(key: string, extra: Record<string, string> = {}) {
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
}

export function isIntelStoreWritable(): boolean {
  return base()?.writable ?? false;
}

async function rest<T>(path: string, init: RequestInit): Promise<T> {
  const b = base();
  if (!b) throw new Error("Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and a key.");
  const res = await fetch(`${b.url}/rest/v1/${path}`, {
    ...init,
    headers: headers(b.key, (init.headers as Record<string, string>) ?? {}),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase ${res.status} on ${path}: ${(await res.text()).slice(0, 300)}`);
  const body = await res.text();
  return (body ? JSON.parse(body) : null) as T;
}

export async function startScanRun(kind: "terms" | "portfolio", model: string): Promise<number | null> {
  try {
    const rows = await rest<{ id: number }[]>("scan_runs", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({ kind, model, status: "running" }),
    });
    return rows?.[0]?.id ?? null;
  } catch {
    // A missing audit row must never abort the scan it is auditing.
    return null;
  }
}

export async function finishScanRun(
  id: number | null,
  patch: { status: "ok" | "error"; cards_scanned?: number; findings?: number; error?: string }
): Promise<void> {
  if (id == null) return;
  try {
    await rest(`scan_runs?id=eq.${id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...patch, finished_at: new Date().toISOString() }),
    });
  } catch {
    /* audit only */
  }
}

/**
 * Inserts findings, ignoring any whose fingerprint is already on file.
 *
 * The scan re-reads the same issuer pages every day, so without this a single
 * devaluation would reappear as a fresh "new finding" every morning until its
 * effective date passed. Postgres enforces it via the unique index on fingerprint;
 * `merge-duplicates` turns the conflict into a silent skip.
 */
export async function insertFindings(rows: NewIntel[]): Promise<number> {
  if (rows.length === 0) return 0;
  const inserted = await rest<{ id: number }[]>("card_intel?on_conflict=fingerprint", {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify(rows),
  });
  return inserted?.length ?? 0;
}

export async function listIntel(status?: IntelStatus): Promise<IntelRow[]> {
  const q = status ? `&status=eq.${status}` : "";
  return (await rest<IntelRow[]>(`card_intel?select=*${q}&order=created_at.desc&limit=200`, {
    method: "GET",
  })) ?? [];
}

export async function setIntelStatus(id: number, status: IntelStatus): Promise<void> {
  await rest(`card_intel?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status, decided_at: new Date().toISOString() }),
  });
}

export async function readOverlay(): Promise<Record<string, CardPatch>> {
  const rows =
    (await rest<{ card_id: string; patch: CardPatch }[]>("card_overlay?select=card_id,patch", {
      method: "GET",
    })) ?? [];
  return Object.fromEntries(rows.map((r) => [r.card_id, r.patch]));
}

/** Merges one field into a card's patch, preserving fields accepted earlier. */
export async function mergeOverlay(cardId: string, patch: CardPatch): Promise<void> {
  const existing = await rest<{ patch: CardPatch }[]>(
    `card_overlay?select=patch&card_id=eq.${encodeURIComponent(cardId)}`,
    { method: "GET" }
  );
  const merged = { ...(existing?.[0]?.patch ?? {}), ...patch };
  await rest("card_overlay?on_conflict=card_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ card_id: cardId, patch: merged, updated_at: new Date().toISOString() }),
  });
}
