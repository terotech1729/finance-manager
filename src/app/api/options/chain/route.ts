/**
 * Option chain for one underlying: per-expiry totals, today's unusual contracts across
 * all expiries, and the full strike ladder for one expiry (`?expiry=`, default the
 * nearest one with volume). The ladder is per-expiry because NVDA alone lists ~5,000
 * contracts — too much to ship to a phone at once.
 */
import { NextResponse } from "next/server";
import { flagUnusual, summariseExpiries } from "@/lib/options";
import { loadChain } from "@/lib/optionsSource";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol") ?? "";
  if (!/^[A-Z_]+:[A-Z0-9._\-!]+$/i.test(symbol)) {
    return NextResponse.json({ error: "bad symbol" }, { status: 400 });
  }

  let chain;
  try {
    chain = await loadChain(symbol);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
  if (!chain || !chain.rows.length) {
    return NextResponse.json({ available: false }, { headers: { "Cache-Control": "public, s-maxage=600" } });
  }

  const expiries = summariseExpiries(chain.rows);
  const wanted = searchParams.get("expiry");
  const expiry =
    (wanted && expiries.some((e) => e.exp === wanted) && wanted) ||
    expiries.find((e) => e.callVol + e.putVol > 0)?.exp ||
    expiries[0].exp;

  const { rows, ...meta } = chain;
  return NextResponse.json(
    {
      available: true,
      ...meta,
      expiries,
      expiry,
      unusual: flagUnusual(chain).slice(0, 60),
      rows: rows.filter((r) => r.exp === expiry).sort((a, b) => a.k - b.k || a.t.localeCompare(b.t)),
    },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" } },
  );
}
