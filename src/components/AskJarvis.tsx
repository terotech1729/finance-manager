"use client";

import { useEffect, useRef, useState } from "react";
import { loadState } from "@/lib/storage";

const SUGGESTIONS = [
  "What's my best card for a ₹2L laptop?",
  "How much lounge access do I actually have right now?",
  "What am I about to lose if I do nothing?",
  "Which milestone is worth chasing first?",
];

/**
 * Natural-language questions, answered from the portal's own computed figures.
 *
 * The state blob is posted with the question so the answer reflects what is on screen.
 * Nothing the model returns is written anywhere — this is a reading surface only, which
 * is why it needs no confirmation step.
 */
export function AskJarvis() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/ai")
      .then((r) => r.json())
      .then((j) => setConfigured(!!j.configured))
      .catch(() => setConfigured(false));
  }, []);

  // No key, no feature — better than a button that always fails.
  if (configured === false) return null;

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    setAnswer("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ask", text, state: loadState() }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "could not answer");
      setAnswer(json.answer as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not answer");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card-shell hud-brackets">
      <div className="card-body space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(q);
          }}
          className="flex gap-2"
        >
          <input
            ref={inputRef}
            className="input flex-1"
            placeholder="Ask Jarvis — anything about your cards, points or deadlines"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            disabled={busy}
          />
          <button className="btn-primary whitespace-nowrap" disabled={busy || !q.trim()}>
            {busy ? "Thinking…" : "Ask"}
          </button>
        </form>

        {!answer && !busy && (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className="pill pill-info text-[11px] hover:text-accent"
                onClick={() => {
                  setQ(s);
                  void ask(s);
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {error && <div className="text-sm text-danger">{error}</div>}

        {answer && (
          <div className="space-y-2">
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-fg">{answer}</div>
            <div className="text-[11px] text-fg-subtle">
              Answered from your live figures — the numbers come from the portal, not the model.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
