/**
 * Daily portfolio review: is any card worth adding, and is any held card worth dropping?
 *
 * Runs after the terms scan (see vercel.json) so it judges the portfolio against terms
 * as they stand today rather than as they stood at the last deploy. Everything it
 * produces is advisory — it never patches the catalogue.
 */
import { NextResponse } from "next/server";
import { AiNotConfiguredError } from "@/lib/ai/client";
import { runPortfolioScan, type SpendProfile } from "@/lib/ai/portfolioScan";
import { loadSpendProfile } from "@/lib/ai/spendProfile";
import {
  finishScanRun,
  insertFindings,
  isIntelStoreWritable,
  startScanRun,
} from "@/lib/ai/intelStore";
import { assertCronAuthorised } from "@/lib/ai/cronAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Used when there is no logged history yet, so the scan still returns something useful. */
const FALLBACK_PROFILE: SpendProfile = {
  monthlyTotalInr: 100000,
  topCategories: [],
  committedInr: 0,
};

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
    const profile = (await loadSpendProfile()) ?? FALLBACK_PROFILE;
    const result = await runPortfolioScan(profile);
    runId = await startScanRun("portfolio", result.model);

    const stored = await insertFindings(result.findings);
    await finishScanRun(runId, { status: "ok", findings: result.findings.length });

    return NextResponse.json({
      ok: true,
      model: result.model,
      usedRealSpend: profile !== FALLBACK_PROFILE,
      monthlySpendInr: Math.round(profile.monthlyTotalInr),
      found: result.findings.length,
      stored,
      adds: result.findings.filter((f) => f.kind === "new_card").length,
      drops: result.findings.filter((f) => f.kind === "drop_suggestion").length,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "portfolio scan failed";
    await finishScanRun(runId, { status: "error", error: msg });
    const status = e instanceof AiNotConfiguredError ? 503 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
