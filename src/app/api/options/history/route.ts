/**
 * Day-by-day open interest for a watched underlying: the contracts building the most
 * open interest over the window, plus full series for any contracts you've pinned
 * (`?contracts=a,b`).
 */
import { NextResponse } from "next/server";
import { underlyingKey } from "@/lib/optionsSource";
import { accumulation, loadSnapshots, optionsStoreStatus } from "@/lib/optionsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") ?? "";
  if (!/^[A-Z_]+:[A-Z0-9._\-!]+$/i.test(symbol)) return NextResponse.json({ error: "bad symbol" }, { status: 400 });
  if (optionsStoreStatus() === "unconfigured") return NextResponse.json({ error: "Supabase is not configured." }, { status: 503 });

  const windowDays = Math.min(Math.max(Number(searchParams.get("days") ?? 30), 2), 120);
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const pinned = (searchParams.get("contracts") ?? "").split(",").filter(Boolean).slice(0, 50);

  try {
    const rows = await loadSnapshots(underlyingKey(symbol), since);
    const { days, top, byContract } = accumulation(rows, today, 40);
    return NextResponse.json(
      {
        days,
        top,
        pinned: pinned.map((c) => byContract.get(c)).filter(Boolean),
      },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=300" } },
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
