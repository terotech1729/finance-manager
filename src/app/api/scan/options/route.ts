/**
 * Daily option-chain snapshot for every watched underlying (see option_watch).
 *
 * Scheduled twice (vercel.json): after the NSE close and after the US close. Each run
 * snapshots every watched symbol; rows are keyed by trading day, so a market that
 * hasn't traded since the last run just overwrites the same day.
 */
import { NextResponse } from "next/server";
import { snapshotRows } from "@/lib/options";
import { loadChain } from "@/lib/optionsSource";
import { listWatch, optionsStoreStatus, upsertSnapshots } from "@/lib/optionsStore";
import { assertCronAuthorised } from "@/lib/ai/cronAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const denied = assertCronAuthorised(req);
  if (denied) return denied;
  if (optionsStoreStatus() !== "ok") {
    return NextResponse.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not set." }, { status: 503 });
  }

  let watch;
  try {
    watch = await listWatch();
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }

  const results: { symbol: string; day?: string; stored?: number; error?: string }[] = [];
  for (const w of watch) {
    try {
      const chain = await loadChain(w.symbol);
      if (!chain?.rows.length) {
        results.push({ symbol: w.symbol, error: "no options returned" });
        continue;
      }
      const stored = await upsertSnapshots(snapshotRows(chain));
      results.push({ symbol: w.symbol, day: chain.day, stored });
    } catch (e) {
      results.push({ symbol: w.symbol, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return NextResponse.json({ ok: results.every((r) => !r.error), results });
}
