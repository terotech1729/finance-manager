/**
 * Supabase persistence for option tracking (server-only): the watchlist of underlyings
 * the daily job snapshots, and one row per contract per trading day.
 *
 * Day-over-day open interest is the only public footprint of someone building a
 * position — a single day's chain can't tell a one-off from steady accumulation.
 */
import type { Accumulation, HistoryPoint, OptType, SnapshotRow } from "./options";

export type WatchRow = { symbol: string; underlying: string; label: string | null; added_at?: string };

function base(): { url: string; key: string; writable: boolean } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = service || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url: url.replace(/\/$/, ""), key, writable: !!service };
}

export function optionsStoreStatus(): "ok" | "read-only" | "unconfigured" {
  const b = base();
  return !b ? "unconfigured" : b.writable ? "ok" : "read-only";
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const b = base();
  if (!b) throw new Error("Supabase is not configured.");
  const res = await fetch(`${b.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: b.key,
      Authorization: `Bearer ${b.key}`,
      "Content-Type": "application/json",
      ...((init.headers as Record<string, string>) ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = (await res.text()).slice(0, 300);
    if (res.status === 404 || /does not exist|schema cache/i.test(body)) {
      throw new Error("Option tracking tables are missing — run the option_* section of supabase-schema.sql in Supabase.");
    }
    throw new Error(`Supabase ${res.status} on ${path.split("?")[0]}: ${body}`);
  }
  return res;
}

export async function listWatch(): Promise<WatchRow[]> {
  const res = await rest("option_watch?select=symbol,underlying,label,added_at&order=added_at.asc");
  return (await res.json()) as WatchRow[];
}

export async function addWatch(row: WatchRow): Promise<void> {
  await rest("option_watch?on_conflict=symbol", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
}

export async function removeWatch(symbol: string): Promise<void> {
  await rest(`option_watch?symbol=eq.${encodeURIComponent(symbol)}`, { method: "DELETE" });
}

export async function upsertSnapshots(rows: SnapshotRow[]): Promise<number> {
  for (let i = 0; i < rows.length; i += 500) {
    await rest("option_snapshots?on_conflict=day,contract", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 500)),
    });
  }
  return rows.length;
}

type Stored = { day: string; contract: string; type: OptType; expiry: string; strike: number; volume: number; oi: number; last: number | null };

export async function loadSnapshots(underlying: string, sinceDay: string): Promise<Stored[]> {
  const out: Stored[] = [];
  const page = 1000;
  for (let from = 0; from < 60_000; from += page) {
    const res = await rest(
      `option_snapshots?underlying=eq.${encodeURIComponent(underlying)}&day=gte.${sinceDay}` +
        `&select=day,contract,type,expiry,strike,volume,oi,last&order=day.asc,contract.asc`,
      { headers: { Range: `${from}-${from + page - 1}`, "Range-Unit": "items" } },
    );
    const rows = (await res.json()) as Stored[];
    out.push(...rows.map((r) => ({ ...r, strike: Number(r.strike), last: r.last == null ? null : Number(r.last) })));
    if (rows.length < page) break;
  }
  return out;
}

/**
 * Contracts whose open interest grew the most across the stored days — positions being
 * built rather than traded in and out. Only unexpired contracts seen on 2+ days count.
 */
export function accumulation(rows: Stored[], today: string, limit = 40): { days: string[]; top: Accumulation[]; byContract: Map<string, Accumulation> } {
  const days = Array.from(new Set(rows.map((r) => r.day))).sort();
  const map = new Map<string, Accumulation>();
  for (const r of rows) {
    const a = map.get(r.contract) ?? {
      contract: r.contract, type: r.type, expiry: r.expiry, strike: r.strike,
      oiStart: r.oi, oiEnd: r.oi, oiChange: 0, totalVolume: 0, days: 0, series: [] as HistoryPoint[],
    };
    a.series.push({ day: r.day, volume: r.volume, oi: r.oi, last: r.last });
    a.oiEnd = r.oi;
    a.totalVolume += r.volume;
    a.days += 1;
    map.set(r.contract, a);
  }
  for (const a of map.values()) {
    a.oiStart = a.series[0].oi;
    a.oiChange = a.oiEnd - a.oiStart;
  }
  const top = Array.from(map.values())
    .filter((a) => a.days >= 2 && a.expiry >= today && a.oiChange > 0)
    .sort((a, b) => b.oiChange - a.oiChange)
    .slice(0, limit);
  return { days, top, byContract: map };
}
