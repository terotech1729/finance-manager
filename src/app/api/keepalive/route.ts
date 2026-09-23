/**
 * Keeps the Supabase project from being paused for inactivity.
 *
 * Free projects are paused after 7 days without database activity. The app only
 * reaches Supabase while a signed-in tab is open, so a quiet week gets the project
 * paused even though the portal is still in use locally. This writes one heartbeat
 * row and deletes anything older than a fortnight — genuine database traffic that
 * can't grow unbounded.
 *
 * Called by Vercel Cron daily (see vercel.json) and, independently, by a GitHub
 * Action so the heartbeat survives one of the two going away. Safe to open in a
 * browser to check it by hand.
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Rows older than this are deleted on every ping, so the table stays tiny. */
const RETAIN_DAYS = 14;

function creds(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Prefer a service-role key when one is configured; fall back to the anon key,
  // which the keepalive table's policies deliberately allow.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

export async function GET() {
  const c = creds();
  if (!c) {
    return NextResponse.json(
      { ok: false, error: "Supabase isn't configured — set NEXT_PUBLIC_SUPABASE_URL and a key." },
      { status: 503 }
    );
  }

  const headers = {
    apikey: c.key,
    Authorization: `Bearer ${c.key}`,
    "Content-Type": "application/json",
  };

  try {
    const pingedAt = new Date().toISOString();
    const insert = await fetch(`${c.url}/rest/v1/keepalive`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({ pinged_at: pingedAt, source: "vercel-cron" }),
      cache: "no-store",
    });

    if (!insert.ok) {
      const body = await insert.text();
      return NextResponse.json(
        { ok: false, step: "insert", status: insert.status, error: body.slice(0, 400) },
        { status: 502 }
      );
    }

    // Prune in the same request so the table can never accumulate.
    const cutoff = new Date(Date.now() - RETAIN_DAYS * 86400_000).toISOString();
    const prune = await fetch(
      `${c.url}/rest/v1/keepalive?pinged_at=lt.${encodeURIComponent(cutoff)}`,
      { method: "DELETE", headers, cache: "no-store" }
    );

    return NextResponse.json({
      ok: true,
      pingedAt,
      pruned: prune.ok,
      retainDays: RETAIN_DAYS,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "keepalive failed" },
      { status: 500 }
    );
  }
}
