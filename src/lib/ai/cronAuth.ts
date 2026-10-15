import { NextResponse } from "next/server";

/**
 * Guards the scan endpoints.
 *
 * Unlike the other cron routes in this app, these cost money on every call — each one
 * runs a grounded model over a dozen web searches. A public URL that bills you per
 * request is an invitation, so the scans require a shared secret that Vercel Cron sends
 * automatically.
 *
 * Returns a response to send back when the caller is not authorised, or null to proceed.
 */
export function assertCronAuthorised(req: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  // Unset means local development: allow, but only off-Vercel. Failing open in
  // production would defeat the point of the check.
  if (!secret) {
    if (process.env.VERCEL) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "CRON_SECRET is not set. Add it to your Vercel environment variables — " +
            "Vercel Cron sends it automatically, and it stops anyone else from running " +
            "these paid scans.",
        },
        { status: 503 }
      );
    }
    return null;
  }

  const header = req.headers.get("authorization") ?? "";
  // Vercel Cron sends `Bearer <CRON_SECRET>`; ?key= is for running one by hand.
  const fromQuery = new URL(req.url).searchParams.get("key");
  if (header === `Bearer ${secret}` || fromQuery === secret) return null;

  return NextResponse.json({ ok: false, error: "Unauthorised" }, { status: 401 });
}
