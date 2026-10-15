"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HudPanel } from "@/components/Hud";
import { Callout } from "@/components/Callout";
import { Icon } from "@/components/Icons";
import { toast } from "@/components/Toast";
import type { IntelRow } from "@/lib/ai/intelStore";

const CONFIDENCE_PILL: Record<string, string> = {
  high: "pill-success",
  medium: "pill-info",
  low: "pill-warning",
};

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function FindingCard({
  row,
  busy,
  onDecide,
}: {
  row: IntelRow;
  busy: boolean;
  onDecide: (id: number, action: "accept" | "reject") => void;
}) {
  const pending = row.status === "proposed";
  const tone =
    row.direction === "devaluation" ? "text-danger" : row.direction === "revaluation" ? "text-success" : "text-fg";

  return (
    <div className="border-b border-border py-4 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${tone}`}>{row.card_name ?? row.card_id}</span>
          {row.direction && row.direction !== "neutral" && (
            <span className={`pill ${row.direction === "devaluation" ? "pill-danger" : "pill-success"}`}>
              {row.direction}
            </span>
          )}
          <span className={`pill ${CONFIDENCE_PILL[row.confidence] ?? "pill-warning"}`}>{row.confidence}</span>
        </div>
        <span className="text-[11px] text-fg-subtle">{timeAgo(row.created_at)}</span>
      </div>

      <div className="mt-1 text-sm text-fg">{row.summary}</div>
      {row.detail && <div className="mt-1 text-[13px] text-fg-muted">{row.detail}</div>}

      {row.field && (
        <div className="readout mt-2 inline-flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-fg-subtle">{row.field}</span>
          <span className="text-danger line-through">{row.current_value ?? "—"}</span>
          <span className="text-fg-subtle">→</span>
          <span className="text-success">{row.proposed_value ?? "—"}</span>
        </div>
      )}

      {row.effective_on && (
        <div className="mt-1 text-[11px] text-warning">Effective {row.effective_on}</div>
      )}

      {row.sources?.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {row.sources.slice(0, 3).map((s, i) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noreferrer noopener"
              className="pill pill-info text-[11px] hover:text-accent"
            >
              {(() => {
                try {
                  return new URL(s.url).hostname.replace(/^www\./, "");
                } catch {
                  return "source";
                }
              })()}
            </a>
          ))}
        </div>
      )}

      {pending && (
        <div className="mt-3 flex gap-2">
          <button className="btn-primary text-sm" disabled={busy} onClick={() => onDecide(row.id, "accept")}>
            Apply to portal
          </button>
          <button className="btn text-sm" disabled={busy} onClick={() => onDecide(row.id, "reject")}>
            Dismiss
          </button>
        </div>
      )}
      {row.status === "applied" && (
        <div className="mt-2 text-[11px] text-success">Applied — live in the portal</div>
      )}
      {row.status === "rejected" && <div className="mt-2 text-[11px] text-fg-subtle">Dismissed</div>}
    </div>
  );
}

export default function IntelPage() {
  const [rows, setRows] = useState<IntelRow[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/intel", { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "could not load findings");
      setRows(json.findings as IntelRow[]);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not load findings");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = useCallback(
    async (id: number, action: "accept" | "reject") => {
      setBusy(true);
      try {
        const res = await fetch("/api/intel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error ?? "could not update");
        toast(
          action === "accept" ? "Applied — reload to see it in recommendations" : "Dismissed",
          "success"
        );
        await load();
      } catch (e) {
        toast(e instanceof Error ? e.message : "could not update", "error");
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  const { pending, termChanges, portfolio } = useMemo(() => {
    const all = rows ?? [];
    return {
      pending: all.filter((r) => r.status === "proposed"),
      termChanges: all.filter((r) => r.kind === "term_change" && r.status !== "proposed"),
      portfolio: all.filter((r) => r.kind !== "term_change"),
    };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Intel</h1>
        <p className="mt-1 text-sm text-fg-muted">
          A daily grounded scan of what your issuers have changed, and whether the portfolio still
          holds up. Changes that could alter a recommendation wait here for your approval; applying
          one takes effect immediately, with no redeploy.
        </p>
      </div>

      {error && (
        <Callout tone="warning" title="Scan data unavailable">
          {error}. Check that the Supabase tables from <code>supabase-schema.sql</code> exist and that
          the scan has run at least once.
        </Callout>
      )}

      {rows === null ? (
        <div className="text-sm text-fg-muted">Loading…</div>
      ) : (
        <>
          <HudPanel title="Awaiting your decision" action={<span className="readout text-[11px] text-fg-muted">{pending.length} proposed</span>}>
            {pending.length === 0 ? (
              <div className="py-3 text-sm text-fg-muted">
                Nothing waiting. Term changes that can move a recommendation show up here first.
              </div>
            ) : (
              pending.map((r) => <FindingCard key={r.id} row={r} busy={busy} onDecide={decide} />)
            )}
          </HudPanel>

          <HudPanel title="Portfolio review" action={<span className="readout text-[11px] text-fg-muted">{portfolio.length} notes</span>}>
            {portfolio.length === 0 ? (
              <div className="py-3 text-sm text-fg-muted">
                No additions or drops suggested — the portfolio reads as well covered.
              </div>
            ) : (
              portfolio.map((r) => <FindingCard key={r.id} row={r} busy={busy} onDecide={decide} />)
            )}
          </HudPanel>

          <HudPanel title="Term history" action={<span className="readout text-[11px] text-fg-muted">{termChanges.length} recorded</span>}>
            {termChanges.length === 0 ? (
              <div className="py-3 text-sm text-fg-muted">No term changes recorded yet.</div>
            ) : (
              termChanges.map((r) => <FindingCard key={r.id} row={r} busy={busy} onDecide={decide} />)
            )}
          </HudPanel>
        </>
      )}

      <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
        <Icon.Sparkles size={12} />
        <span>
          Findings are produced by a web-grounded model and cite their sources. Treat a{" "}
          <span className="text-warning">low</span> confidence row as a lead to verify, not a fact.
          Need the underlying card page? <Link href="/cards" className="text-accent hover:underline">Cards</Link>.
        </span>
      </div>
    </div>
  );
}
