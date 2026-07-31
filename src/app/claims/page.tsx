"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BENEFIT_CLAIMS,
  applyBenefitClaim,
  benefitCardGroups,
  isBenefitClaimed,
  type BenefitUrgency,
} from "@/lib/benefitClaims";
import { loadState, saveState, type AppState } from "@/lib/storage";
import { Callout } from "@/components/Callout";
import { Icon } from "@/components/Icons";

const URGENCY_LABEL: Record<BenefitUrgency, string> = {
  urgent: "Time-sensitive",
  open: "Claim / activate",
  ongoing: "Ongoing",
  info: "Know / keep",
};

const URGENCY_CLASS: Record<BenefitUrgency, string> = {
  urgent: "bg-danger/15 text-danger border-danger/30",
  open: "bg-warning/15 text-warning border-warning/30",
  ongoing: "bg-info/15 text-info border-info/30",
  info: "bg-bg-chrome text-fg-muted border-border",
};

type Filter = "all" | "unclaimed" | "claimed" | "urgent" | "ongoing" | "info";

export default function ClaimsPage() {
  const [state, setState] = useState<AppState | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setState(loadState());
  }, []);

  const groups = useMemo(() => benefitCardGroups(), []);

  const counts = useMemo(() => {
    if (!state) return { total: 0, claimed: 0, unclaimed: 0, urgent: 0 };
    let claimed = 0;
    let urgent = 0;
    for (const b of BENEFIT_CLAIMS) {
      if (isBenefitClaimed(b.id, state)) claimed++;
      else if (b.urgency === "urgent") urgent++;
    }
    return {
      total: BENEFIT_CLAIMS.length,
      claimed,
      unclaimed: BENEFIT_CLAIMS.length - claimed,
      urgent,
    };
  }, [state]);

  if (!state) return <div className="text-fg-muted">Loading…</div>;

  const toggle = (id: string, claimed: boolean) => {
    const patch = applyBenefitClaim(id, claimed, state);
    const next = { ...state, ...patch } as AppState;
    setState(next);
    saveState(next);
  };

  const showItem = (b: (typeof BENEFIT_CLAIMS)[number]) => {
    const claimed = isBenefitClaimed(b.id, state);
    if (filter === "claimed" && !claimed) return false;
    if (filter === "unclaimed" && claimed) return false;
    if (filter === "urgent" && b.urgency !== "urgent") return false;
    if (filter === "ongoing" && b.urgency !== "ongoing") return false;
    if (filter === "info" && b.urgency !== "info") return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return `${b.title} ${b.detail} ${b.cardLabel} ${b.how ?? ""}`.toLowerCase().includes(needle);
  };

  const filters: { id: Filter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "unclaimed", label: `Open (${counts.unclaimed})` },
    { id: "claimed", label: `Claimed (${counts.claimed})` },
    { id: "urgent", label: `Urgent (${counts.urgent})` },
    { id: "ongoing", label: "Ongoing" },
    { id: "info", label: "Info" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Benefit claims</h1>
        <p className="text-fg-muted mt-1 text-sm leading-relaxed max-w-2xl">
          Every known issuer / Visa benefit for your cards. Check off what you already claimed or activated —
          Recommend reads this checklist live (welcome pushes, Amazon coupons, GyFTR, MRCC enrollment, lounge rules).
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card-shell p-4">
          <div className="label">Total</div>
          <div className="text-2xl font-bold mt-1">{counts.total}</div>
        </div>
        <div className="card-shell p-4">
          <div className="label">Still open</div>
          <div className="text-2xl font-bold mt-1 text-warning">{counts.unclaimed}</div>
        </div>
        <div className="card-shell p-4">
          <div className="label">Claimed</div>
          <div className="text-2xl font-bold mt-1 text-success">{counts.claimed}</div>
        </div>
        <div className="card-shell p-4">
          <div className="label">Time-sensitive open</div>
          <div className="text-2xl font-bold mt-1 text-danger">{counts.urgent}</div>
        </div>
      </div>

      {counts.urgent > 0 && (
        <Callout tone="warning" title="Time-sensitive still open">
          Live+ welcome / vouchers, Indigo BluChip vouchers, GyFTR spend, and BOB FITPASS if still activatable —
          mark each as you confirm in the issuer app.
        </Callout>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="search"
          placeholder="Search benefits…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input flex-1 min-w-0"
        />
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filter === f.id
                  ? "bg-accent/20 text-accent border-accent/40"
                  : "bg-bg-elevated text-fg-muted border-border hover:text-fg"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-8">
        {groups.map((g) => {
          const items = g.items.filter(showItem);
          if (items.length === 0) return null;
          const done = g.items.filter((b) => isBenefitClaimed(b.id, state)).length;
          return (
            <section key={g.cardId}>
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <h2 className="text-lg font-bold">{g.cardLabel}</h2>
                <span className="text-xs text-fg-muted">
                  {done}/{g.items.length} claimed
                </span>
              </div>
              <div className="card-shell divide-y divide-border overflow-hidden">
                {items.map((b) => {
                  const claimed = isBenefitClaimed(b.id, state);
                  const open = expanded === b.id;
                  return (
                    <div
                      key={b.id}
                      className={`p-3 sm:p-4 transition-colors ${claimed ? "bg-success/5" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <label className="flex items-start gap-3 flex-1 min-w-0 cursor-pointer">
                          <input
                            type="checkbox"
                            className="mt-1 shrink-0 accent-[var(--accent)]"
                            checked={claimed}
                            onChange={(e) => toggle(b.id, e.target.checked)}
                          />
                          <span className="min-w-0">
                            <span
                              className={`block text-sm font-medium leading-snug ${
                                claimed ? "line-through text-fg-muted" : ""
                              }`}
                            >
                              {b.title}
                            </span>
                            <span className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span
                                className={`inline-flex text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded border ${URGENCY_CLASS[b.urgency]}`}
                              >
                                {URGENCY_LABEL[b.urgency]}
                              </span>
                              {b.valueHint && (
                                <span className="text-[11px] text-success font-medium">{b.valueHint}</span>
                              )}
                            </span>
                          </span>
                        </label>
                        <button
                          type="button"
                          className="btn-ghost text-xs shrink-0 px-2 py-1"
                          onClick={() => setExpanded(open ? null : b.id)}
                        >
                          {open ? "Hide" : "How"}
                          <Icon.ArrowRight
                            size={12}
                            className={`inline ml-1 transition-transform ${open ? "rotate-90" : ""}`}
                          />
                        </button>
                      </div>
                      {open && (
                        <div className="mt-3 ml-7 text-sm text-fg-muted space-y-2 leading-relaxed">
                          <p>{b.detail}</p>
                          {b.how && (
                            <p>
                              <span className="text-fg font-medium">How: </span>
                              {b.how}
                            </p>
                          )}
                          {b.link && (
                            <a
                              href={b.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-accent hover:underline text-xs font-medium"
                            >
                              Open claim link
                              <Icon.ArrowRight size={12} />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
