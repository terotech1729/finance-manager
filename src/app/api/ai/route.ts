/**
 * Browser-facing AI endpoints: parse a spend note, or answer a question about the
 * portfolio.
 *
 * Both take the caller's state in the request body rather than reading it server-side.
 * The portal keeps localStorage as the source of truth for the running session, so the
 * browser holds the freshest numbers — and this way the route stays stateless and never
 * needs the service-role key.
 */
import { NextResponse } from "next/server";
import { AiNotConfiguredError, detectProvider } from "@/lib/ai/client";
import { parseSpendNote } from "@/lib/ai/parseSpend";
import { askJarvis } from "@/lib/ai/ask";
import type { AppState } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Caps the prompt-injection surface and keeps a runaway client from burning tokens. */
const MAX_INPUT_CHARS = 1000;

export async function GET() {
  // Lets the UI hide the AI affordances when no key is set, rather than offering a
  // button that always errors.
  return NextResponse.json({ ok: true, configured: detectProvider() !== null });
}

export async function POST(req: Request) {
  let body: { action?: string; text?: string; state?: AppState };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Expected a JSON body." }, { status: 400 });
  }

  const text = (body.text ?? "").trim();
  if (!text) return NextResponse.json({ ok: false, error: "Nothing to process." }, { status: 400 });
  if (text.length > MAX_INPUT_CHARS) {
    return NextResponse.json(
      { ok: false, error: `Keep it under ${MAX_INPUT_CHARS} characters.` },
      { status: 400 }
    );
  }

  try {
    if (body.action === "parse") {
      const { draft, model } = await parseSpendNote(text);
      return NextResponse.json({ ok: true, draft, model });
    }

    if (body.action === "ask") {
      if (!body.state) {
        return NextResponse.json(
          { ok: false, error: "Ask needs the current state to answer from." },
          { status: 400 }
        );
      }
      const result = await askJarvis(text, body.state);
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json(
      { ok: false, error: "Unknown action — expected 'parse' or 'ask'." },
      { status: 400 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "request failed";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: e instanceof AiNotConfiguredError ? 503 : 500 }
    );
  }
}
