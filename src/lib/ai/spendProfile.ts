import type { SpendProfile } from "./portfolioScan";
import type { Transaction } from "../types";

/**
 * Builds the spend shape the portfolio scan reasons against, from the synced blob.
 *
 * The cron has no signed-in session, so this reads `finance_data` with the service-role
 * key. That is a deliberate choice for a single-user deployment: without it the daily
 * advice would be generic, and generic card advice is exactly what the web is already
 * full of. Only aggregate totals leave this function — individual transactions are
 * never put in a prompt.
 */

const LOOKBACK_DAYS = 90;

export async function loadSpendProfile(): Promise<SpendProfile | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  // Most recently updated row: a personal deployment has exactly one.
  const res = await fetch(
    `${url.replace(/\/$/, "")}/rest/v1/finance_data?select=data&order=updated_at.desc&limit=1`,
    {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store",
    }
  );
  if (!res.ok) return null;

  const rows = (await res.json()) as { data?: { transactions?: Transaction[] } }[];
  const txns = rows?.[0]?.data?.transactions;
  if (!Array.isArray(txns) || txns.length === 0) return null;

  return summariseSpend(txns);
}

/** Aggregates a transaction log into monthly totals by category. */
export function summariseSpend(txns: Transaction[], today = new Date()): SpendProfile {
  const cutoff = new Date(today.getTime() - LOOKBACK_DAYS * 86400_000).toISOString().slice(0, 10);
  const recent = txns.filter((t) => (t.date ?? "") >= cutoff && t.amount > 0);

  const months = Math.max(1, LOOKBACK_DAYS / 30);
  const byCategory = new Map<string, number>();
  let total = 0;

  for (const t of recent) {
    total += t.amount;
    const cat = (t.category || "other").toLowerCase().trim();
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + t.amount);
  }

  const topCategories = [...byCategory.entries()]
    .map(([category, sum]) => ({ category, monthlyInr: sum / months }))
    .sort((a, b) => b.monthlyInr - a.monthlyInr)
    .slice(0, 8);

  return {
    monthlyTotalInr: total / months,
    topCategories,
    // Filled by the caller, which can see live milestone progress.
    committedInr: 0,
  };
}
