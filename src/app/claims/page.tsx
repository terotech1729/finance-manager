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
import Link from "next/link";

const URGENCY_LABEL: Record<BenefitUrgency, string> = {
  urgent: "Time-sensitive",
  open: "Claim / activate",
};

const URGENCY_CLASS: Record<BenefitUrgency, string> = {
  urgent: "bg-danger/15 text-danger border-danger/30",
  open: "bg-warning/15 text-warning border-warning/30",
};

type Filter = "all" | "unclaimed" | "claimed" | "urgent";

export default function ClaimsPage() {
  const [state, setState] = useState<AppState | null>(null);
  const [filter, setFilter] = useState<Filter>("unclaimed");
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
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return `${b.title} ${b.detail} ${b.cardLabel} ${b.how ?? ""}`.toLowerCase().includes(needle);
  };

  const filters: { id: Filter; label: string }[] = [
    { id: "unclaimed", label: `Open (${counts.unclaimed})` },
    { id: "claimed", label: `Done (${counts.claimed})` },
    { id: "urgent", label: `Urgent (${counts.urgent})` },
    { id: "all", label: "All" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Benefit claims</h1>
        <p className="text-fg-muted mt-1 text-sm leading-relaxed max-w-2xl">
          One-time vouchers, welcome bonuses, and activations you can check off once.
          Recurring perks (BOGO, lounges, monthly unlocks, Visa portal discounts) stay in{" "}
          <Link href="/recommend" className="text-accent hover:underline">Recommend</Link>
          {" · "}
          <Link href="/network-perks" className="text-accent hover:underline">Network perks</Link>
          {" · "}
          <Link href="/milestones" className="text-accent hover:underline">Milestones</Link>
          — not here.
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
          <div className="label">Done</div>
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
          mark each when confirmed in the issuer app.
        </Callout>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <input
          type="search"
          placeholder="Search vouchers & welcomes…"
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
                  {done}/{g.items.length} done
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
                            <span className="flex flex-wrap items-center gap-2">
                              <span className={`font-medium ${claimed ? "line-through text-fg-muted" : ""}`}>
                                {b.title}
                              </span>
                              <span
                                className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${URGENCY_CLASS[b.urgency]}`}
                              >
                                {URGENCY_LABEL[b.urgency]}
                              </span>
                              {b.valueHint && (
                                <span className="text-xs text-success font-medium">{b.valueHint}</span>
                              )}
                            </span>
                            <span className="block text-sm text-fg-muted mt-0.5 leading-relaxed">
                              {b.detail}
                            </span>
                          </span>
                        </label>
                        <button
                          type="button"
                          className="btn-ghost px-2 py-1 text-xs shrink-0"
                          onClick={() => setExpanded(open ? null : b.id)}
                          aria-expanded={open}
                        >
                          {open ? "Hide" : "How"}
                          <Icon.ArrowRight size={12} className={open ? "rotate-90 inline ml-0.5" : "inline ml-0.5"} />
                        </button>
                      </div>
                      {open && (
                        <div className="mt-3 ml-7 sm:ml-8 text-sm space-y-2 text-fg-muted">
                          {b.how && <p>{b.how}</p>}
                          {b.link && (
                            <a
                              href={b.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-accent hover:underline inline-flex items-center gap-1"
                            >
                              Open claim / activate link
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
