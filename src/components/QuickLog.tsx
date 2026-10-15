"use client";

import { useEffect, useState } from "react";
import { getCardById } from "@/lib/cards";
import { inr } from "@/lib/utils";
import type { SpendDraft } from "@/lib/ai/parseSpend";

/**
 * "2400 at Toit last night on Amex" → a filled-in transaction form.
 *
 * Always lands on the existing form rather than saving directly. The parse is good but
 * not reliable enough to write to a financial log unattended, and a wrong row costs more
 * to find later than the typing it saved. Anything the parser couldn't resolve is listed
 * so the gap is obvious before it is committed.
 */
export function QuickLog({ onDraft }: { onDraft: (d: SpendDraft) => void }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<SpendDraft | null>(null);

  useEffect(() => {
    fetch("/api/ai")
      .then((r) => r.json())
      .then((j) => setConfigured(!!j.configured))
      .catch(() => setConfigured(false));
  }, []);

  if (configured === false) return null;

  const parse = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "parse", text }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "could not parse");
      setPreview(json.draft as SpendDraft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not parse");
    } finally {
      setBusy(false);
    }
  };

  const card = preview?.cardId ? getCardById(preview.cardId) : null;

  return (
    <div className="card-shell">
      <div className="card-body space-y-3">
        <div className="label">Quick log</div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void parse();
          }}
        >
          <input
            className="input flex-1"
            placeholder='e.g. "2400 at Toit last night on MRCC"'
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={busy}
          />
          <button className="btn whitespace-nowrap" disabled={busy || !text.trim()}>
            {busy ? "Reading…" : "Parse"}
          </button>
        </form>

        {error && <div className="text-sm text-danger">{error}</div>}

        {preview && (
          <div className="space-y-2 border-t border-border pt-3">
            <div className="readout flex flex-wrap items-center gap-3 text-sm">
              <span className="text-fg">{preview.amount != null ? inr(preview.amount) : "— amount?"}</span>
              <span className="text-fg-muted">{preview.merchant || "— merchant?"}</span>
              <span className="pill pill-info">{preview.category}</span>
              <span className="pill">{card?.short ?? "— card?"}</span>
              <span className="text-[11px] text-fg-subtle">{preview.date}</span>
            </div>

            {preview.missing.length > 0 && (
              <div className="text-[11px] text-warning">
                Couldn&apos;t work out: {preview.missing.join(", ")} — fill it in below before saving.
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() => {
                  onDraft(preview);
                  setPreview(null);
                  setText("");
                }}
              >
                Use this
              </button>
              <button type="button" className="btn text-sm" onClick={() => setPreview(null)}>
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
