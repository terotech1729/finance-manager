/**
 * Read the scan findings, and accept or reject the ones awaiting a decision.
 *
 * Accepting is what makes the portal self-updating: the change is written to
 * `card_overlay` and merged over the compiled catalogue on the next load, so an issuer
 * change reaches the scoring engine without a code change or a deploy.
 */
import { NextResponse } from "next/server";
import { CARDS } from "@/lib/cards";
import { sanitisePatch } from "@/lib/cardOverlay";
import { coerce } from "@/lib/ai/termsScan";
import { listIntel, mergeOverlay, readOverlay, setIntelStatus, type IntelRow } from "@/lib/ai/intelStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [rows, overlay] = await Promise.all([listIntel(), readOverlay()]);
    return NextResponse.json({ ok: true, findings: rows, overlay });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "could not read findings" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  let body: { id?: number; action?: "accept" | "reject" };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Expected a JSON body." }, { status: 400 });
  }

  const { id, action } = body;
  if (typeof id !== "number" || (action !== "accept" && action !== "reject")) {
    return NextResponse.json(
      { ok: false, error: "Send { id: number, action: 'accept' | 'reject' }." },
      { status: 400 }
    );
  }

  try {
    if (action === "reject") {
      await setIntelStatus(id, "rejected");
      return NextResponse.json({ ok: true, status: "rejected" });
    }

    // Re-read the row rather than trusting anything the client sent: the request only
    // names an id, so a tampered body can't smuggle in a value that was never scanned.
    const row = (await listIntel()).find((r: IntelRow) => r.id === id);
    if (!row) return NextResponse.json({ ok: false, error: "No such finding." }, { status: 404 });
    if (!row.field) {
      return NextResponse.json(
        { ok: false, error: "This finding is advisory — there is no field to apply." },
        { status: 400 }
      );
    }

    const card = CARDS.find((c) => c.id === row.card_id);
    if (!card) {
      return NextResponse.json({ ok: false, error: `Unknown card ${row.card_id}.` }, { status: 400 });
    }

    const patch = sanitisePatch({ [row.field]: coerce(row.field, row.proposed_value, card) }, card);
    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { ok: false, error: `"${row.proposed_value}" isn't a valid value for ${row.field}.` },
        { status: 400 }
      );
    }

    await mergeOverlay(row.card_id, patch);
    await setIntelStatus(id, "applied");
    return NextResponse.json({ ok: true, status: "applied", patch });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "could not update finding" },
      { status: 500 }
    );
  }
}
