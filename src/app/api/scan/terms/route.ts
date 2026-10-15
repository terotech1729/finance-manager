/**
 * Daily audit of held-card terms against what the issuers currently publish.
 *
 * Vercel Cron calls this each morning (see vercel.json). Findings land in `card_intel`:
 * anything that could change a recommendation waits for approval on /intel, while
 * narrative updates apply themselves. Safe to open in a browser to run it by hand.
 */
import { NextResponse } from "next/server";
import { CARDS } from "@/lib/cards";
import { AiNotConfiguredError } from "@/lib/ai/client";
import { runTermsScan, patchForFinding } from "@/lib/ai/termsScan";
import {
  finishScanRun,
  insertFindings,
  isIntelStoreWritable,
  mergeOverlay,
  startScanRun,
} from "@/lib/ai/intelStore";
import { assertCronAuthorised } from "@/lib/ai/cronAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Grounded search over nine cards is slow; the default 10s would cut it off mid-scan.
export const maxDuration = 300;

export async function GET(req: Request) {
  const denied = assertCronAuthorised(req);
  if (denied) return denied;

  if (!isIntelStoreWritable()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "SUPABASE_SERVICE_ROLE_KEY is not set. The scan needs it to write findings — " +
          "the anon key can only read them.",
      },
      { status: 503 }
    );
  }

  let runId: number | null = null;
  try {
    const result = await runTermsScan();
    runId = await startScanRun("terms", result.model);

    // Auto-applied rows must reach the overlay in the same request. A row marked
    // "applied" that never made it into card_overlay would claim the portal is current
    // when it isn't — worse than not applying at all.
    let applied = 0;
    for (const f of result.findings.filter((x) => x.status === "applied")) {
      const patch = patchForFinding(f, CARDS);
      if (!patch) continue;
      await mergeOverlay(f.card_id, patch);
      applied++;
    }

    const stored = await insertFindings(result.findings);
    await finishScanRun(runId, {
      status: "ok",
      cards_scanned: result.cardsScanned,
      findings: result.findings.length,
    });

    return NextResponse.json({
      ok: true,
      model: result.model,
      cardsScanned: result.cardsScanned,
      found: result.findings.length,
      stored,
      autoApplied: applied,
      awaitingReview: result.findings.filter((f) => f.status === "proposed").length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "terms scan failed";
    await finishScanRun(runId, { status: "error", error: msg });
    const status = e instanceof AiNotConfiguredError ? 503 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
