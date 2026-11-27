/**
 * Watchlist of underlyings whose option chains are snapshotted daily. Adding one also
 * takes today's snapshot straight away, so its history starts now rather than tonight.
 */
import { NextResponse } from "next/server";
import { snapshotRows } from "@/lib/options";
import { loadChain, underlyingKey } from "@/lib/optionsSource";
import { addWatch, listWatch, optionsStoreStatus, removeWatch, upsertSnapshots } from "@/lib/optionsStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_WATCH = 25;
const SYMBOL_RE = /^[A-Z_]+:[A-Z0-9._\-!]+$/i;

export async function GET() {
  const status = optionsStoreStatus();
  if (status === "unconfigured") return NextResponse.json({ status, watch: [] });
  try {
    return NextResponse.json({ status, watch: await listWatch() });
  } catch (e) {
    return NextResponse.json({ status, watch: [], error: e instanceof Error ? e.message : String(e) });
  }
}

export async function POST(req: Request) {
  if (optionsStoreStatus() !== "ok") {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set — tracking can't be saved." }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as { symbol?: string; label?: string };
  const symbol = body.symbol ?? "";
  if (!SYMBOL_RE.test(symbol)) return NextResponse.json({ error: "bad symbol" }, { status: 400 });

  try {
    const current = await listWatch();
    if (!current.some((w) => w.symbol === symbol) && current.length >= MAX_WATCH) {
      return NextResponse.json({ error: `Watchlist is full (${MAX_WATCH}). Remove one first.` }, { status: 400 });
    }
    const chain = await loadChain(symbol);
    if (!chain?.rows.length) return NextResponse.json({ error: "No listed options for this stock." }, { status: 400 });
    await addWatch({ symbol, underlying: underlyingKey(symbol), label: body.label?.slice(0, 120) ?? null });
    const stored = await upsertSnapshots(snapshotRows(chain));
    return NextResponse.json({ ok: true, stored, day: chain.day });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}

export async function DELETE(req: Request) {
  if (optionsStoreStatus() !== "ok") return NextResponse.json({ error: "read-only" }, { status: 503 });
  const symbol = new URL(req.url).searchParams.get("symbol") ?? "";
  if (!SYMBOL_RE.test(symbol)) return NextResponse.json({ error: "bad symbol" }, { status: 400 });
  try {
    await removeWatch(symbol);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
