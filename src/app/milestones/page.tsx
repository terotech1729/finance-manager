"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ANNUAL_MILESTONES, getCardById } from "@/lib/cards";
import { loadState, saveState, type AppState } from "@/lib/storage";
import { inrExact } from "@/lib/utils";
import { CheckpointedProgress } from "@/components/CheckpointedProgress";
import { Icon } from "@/components/Icons";

const KIWI_NEON_MILESTONES = [
  { threshold: 50000, cashbackRate: 3, lounges: 1 },
  { threshold: 100000, cashbackRate: 4, lounges: 2 },
  { threshold: 150000, cashbackRate: 5, lounges: 3 },
];

type SpendKey =
  | "ptccEligibleSpend"
  | "mrccCycleSpend"
  | "sbiYtdSpend"
  | "idfcYtdSpend"
  | "bobYtdSpend"
  | "hsbcLivePlusYtdSpend"
  | "kiwiNeonCycleSpend";

function spendKeyFor(cardId: string): SpendKey | null {
  if (cardId === "amex_plat_travel") return "ptccEligibleSpend";
  if (cardId === "amex_mrcc") return "mrccCycleSpend";
  if (cardId === "sbi_simplyclick") return "sbiYtdSpend";
  if (cardId === "idfc_indigo") return "idfcYtdSpend";
  if (cardId === "bob_eterna") return "bobYtdSpend";
  if (cardId === "hsbc_live_plus") return "hsbcLivePlusYtdSpend";
  if (cardId === "yes_kiwi") return "kiwiNeonCycleSpend";
  return null;
}

function EditableSpend({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="flex items-center gap-1 text-xs text-fg-muted">
      <span>Till date</span>
      <span className="text-fg-subtle">₹</span>
      <input
        className="input text-right tabular-nums py-1 px-2 text-sm font-semibold text-fg w-[7.5rem]"
        inputMode="numeric"
        value={Number.isFinite(value) ? String(Math.round(value)) : "0"}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
          onChange(Math.max(0, n));
        }}
        aria-label="Spend till date"
      />
    </label>
  );
}

export default function MilestonesPage() {
  const [state, setState] = useState<AppState | null>(null);
  useEffect(() => { setState(loadState()); }, []);
  if (!state) return <div className="text-fg-muted">Loading…</div>;

  const setSpend = (key: SpendKey, value: number, cardId?: string) => {
    const next: AppState = { ...state, [key]: value };
    // Keep hit flags in sync with the number you just typed (source of truth).
    if (cardId) {
      const thresholds = ANNUAL_MILESTONES.filter((m) => m.cardId === cardId).map((m) => m.threshold);
      const without = (next.milestonesHit || []).filter((h) => !h.startsWith(`${cardId}:`));
      const hit = thresholds.filter((t) => value >= t).map((t) => `${cardId}:${t}`);
      next.milestonesHit = [...without, ...hit];
    }
    if (key === "kiwiNeonCycleSpend") {
      // Kiwi uses its own thresholds (not ANNUAL_MILESTONES)
    }
    setState(next);
    saveState(next);
  };

  const grouped: Record<string, (typeof ANNUAL_MILESTONES)[number][]> = {};
  ANNUAL_MILESTONES.forEach((m) => {
    if (!grouped[m.cardId]) grouped[m.cardId] = [];
    grouped[m.cardId].push(m);
  });

  const kiwiSpend = state.kiwiNeonCycleSpend;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Icon.Trophy /> Milestones
        </h1>
        <p className="page-sub">
          Tap the till-date number to match your statement. Recommend uses these first.
        </p>
      </div>

      <section className="space-y-4">
        {Object.entries(grouped).map(([cardId, milestones]) => {
          const card = getCardById(cardId);
          const key = spendKeyFor(cardId);
          const spent = key ? Number(state[key] ?? 0) : 0;
          const sorted = [...milestones].sort((a, b) => a.threshold - b.threshold);
          const top = sorted[sorted.length - 1].threshold;
          const checkpoints = sorted.slice(0, -1).map((m) => ({
            value: m.threshold,
            hit: state.milestonesHit.includes(`${m.cardId}:${m.threshold}`) || spent >= m.threshold,
          }));
          return (
            <div key={cardId} className="card-shell">
              <div className="card-header gap-3 flex-wrap">
                <Link href={`/cards/${cardId}`} className="font-semibold hover:underline">
                  {card?.short ?? cardId}
                </Link>
                <div className="flex items-center gap-2 ml-auto">
                  {key ? (
                    <EditableSpend value={spent} onChange={(n) => setSpend(key, n, cardId)} />
                  ) : (
                    <span className="text-xs text-fg-muted">{inrExact(spent)}</span>
                  )}
                  <span className="text-xs text-fg-subtle">/ {inrExact(top)}</span>
                </div>
              </div>
              <div className="card-body space-y-4">
                <CheckpointedProgress
                  key={`${cardId}-${spent}`}
                  current={spent}
                  total={top}
                  checkpoints={checkpoints}
                  tone={spent >= top ? "success" : "info"}
                  fillFromCurrentOnly
                />
                <div className="space-y-1.5">
                  {sorted.map((m) => {
                    const hit = state.milestonesHit.includes(`${m.cardId}:${m.threshold}`) || spent >= m.threshold;
                    const close = !hit && spent >= m.threshold * 0.85;
                    return (
                      <div key={m.threshold} className="flex items-center justify-between text-sm gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {hit ? <span className="pill-success">Hit</span> :
                           close ? <span className="pill-warning">Close</span> :
                           <span className="pill-neutral">Pending</span>}
                          <span className="truncate">{inrExact(m.threshold)} → {m.reward}</span>
                        </div>
                        <span className="text-fg-muted shrink-0">{inrExact(m.rewardValueInr)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}

        <div className="card-shell">
          <div className="card-header gap-3 flex-wrap">
            <Link href="/cards/yes_kiwi" className="font-semibold hover:underline flex items-center gap-2">
              <Icon.Lounge /> YES Bank · Kiwi Neon
            </Link>
            <div className="flex items-center gap-2 ml-auto">
              <EditableSpend value={kiwiSpend} onChange={(n) => setSpend("kiwiNeonCycleSpend", n)} />
              <span className="text-xs text-fg-subtle">/ {inrExact(150000)}</span>
            </div>
          </div>
          <div className="card-body space-y-4">
            <CheckpointedProgress
              key={`kiwi-${kiwiSpend}`}
              current={kiwiSpend}
              total={150000}
              checkpoints={KIWI_NEON_MILESTONES.slice(0, -1).map((m) => ({
                value: m.threshold,
                hit: kiwiSpend >= m.threshold,
              }))}
              tone={kiwiSpend >= 50000 ? "success" : "info"}
              fillFromCurrentOnly
            />
            <div className="space-y-1.5">
              {KIWI_NEON_MILESTONES.map((m) => {
                const hit = kiwiSpend >= m.threshold;
                const close = !hit && kiwiSpend >= m.threshold * 0.85;
                return (
                  <div key={m.threshold} className="flex items-center justify-between text-sm gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {hit ? <span className="pill-success">Hit</span> :
                       close ? <span className="pill-warning">Close</span> :
                       <span className="pill-neutral">Pending</span>}
                      <span className="truncate">
                        {inrExact(m.threshold)} → {m.cashbackRate}% retro + {m.lounges} lounge{m.lounges > 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
