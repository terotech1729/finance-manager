/**
 * Daily sweep for live, time-limited offers on the cards held.
 *
 * Always advisory: an offer expires, so it must never be written into a card's baseline
 * terms the way a term change is.
 */
import { NextResponse } from "next/server";
import { AiNotConfiguredError } from "@/lib/ai/client";
import { runOfferScan } from "@/lib/ai/offerScan";
import { finishScanRun, insertFindings, isIntelStoreWritable, startScanRun } from "@/lib/ai/intelStore";
import { assertCronAuthorised } from "@/lib/ai/cronAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request) {
  const denied = assertCronAuthorised(req);
  if (denied) return denied;

  if (!isIntelStoreWritable()) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not set — the scan cannot store findings." },
      { status: 503 }
    );
  }

  let runId: number | null = null;
  try {
    const result = await runOfferScan();
    runId = await startScanRun("portfolio", result.model);
    const stored = await insertFindings(result.findings);
    await finishScanRun(runId, { status: "ok", findings: result.findings.length });
    return NextResponse.json({ ok: true, model: result.model, found: result.findings.length, stored });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "offer scan failed";
    await finishScanRun(runId, { status: "error", error: msg });
    return NextResponse.json({ ok: false, error: msg }, {
      status: e instanceof AiNotConfiguredError ? 503 : 500,
    });
  }
}
