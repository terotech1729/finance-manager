"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ANNUAL_MILESTONES, MONTHLY_MILESTONES, getCardById } from "@/lib/cards";
import { loadState, saveState, recomputeCounters, type AppState } from "@/lib/storage";
import { inr, inrExact } from "@/lib/utils";
import { CheckpointedProgress } from "@/components/CheckpointedProgress";
import { Callout } from "@/components/Callout";
import { Icon } from "@/components/Icons";
import { toast } from "@/components/Toast";

const KIWI_NEON_MILESTONES = [
  { threshold: 50000, cashbackRate: 3, lounges: 1, retroactiveBonus: 1500 },
  { threshold: 100000, cashbackRate: 4, lounges: 2, retroactiveBonus: 4000 },
  { threshold: 150000, cashbackRate: 5, lounges: 3, retroactiveBonus: 7500 },
];

/** Editable counters that drive Recommend. Log is incomplete — these are the source of truth. */
type SpendField = {
  key: keyof AppState;
  cardId?: string;
  label: string;
  hint: string;
  max?: number;
};

const ANNUAL_FIELDS: SpendField[] = [
  { key: "ptccEligibleSpend", cardId: "amex_plat_travel", label: "Eligible cycle spend", hint: "Toward ₹4L / ₹7L (membership year)" },
  { key: "mrccCycleSpend", cardId: "amex_mrcc", label: "Fee-waiver cycle spend", hint: "Toward ₹90k / ₹1.5L annual waiver" },
  { key: "sbiYtdSpend", cardId: "sbi_simplyclick", label: "YTD spend", hint: "Toward ₹1L / ₹2L vouchers" },
  { key: "idfcYtdSpend", cardId: "idfc_indigo", label: "YTD spend", hint: "Toward BluChip voucher tiers" },
  { key: "bobYtdSpend", cardId: "bob_eterna", label: "Spend since issue", hint: "Toward ₹50k welcome + ₹5L annual" },
  { key: "hsbcLivePlusYtdSpend", cardId: "hsbc_live_plus", label: "YTD / welcome spend", hint: "Toward ₹20k/30d welcome + ₹2L fee waiver" },
];

const MONTHLY_FIELDS: SpendField[] = [
  { key: "goldThisMonthTxnsAt1k", cardId: "amex_gold", label: "≥₹1k txns this month", hint: "Need 6", max: 6 },
  { key: "mrccThisCycleTxnsAt1500", cardId: "amex_mrcc", label: "≥₹1.5k txns this month", hint: "Need 4 (big spend = 1 txn)", max: 4 },
  { key: "mrccThisCycleAmount", cardId: "amex_mrcc", label: "Total spend this month", hint: "Toward ₹20k monthly" },
  { key: "scapiaMonthlySpend", cardId: "scapia", label: "Spend this month", hint: "Lounge unlock @ ₹20k" },
  { key: "livePlusAccelCashbackUsedThisMonth", cardId: "hsbc_live_plus", label: "10% cashback used this month", hint: "Cap ₹1,200", max: 1200 },
  { key: "bobCycleSpend5x", cardId: "bob_eterna", label: "5× category spend this month", hint: "Cap ~₹33k / 5k RP" },
  { key: "kiwiNeonCycleSpend", cardId: "yes_kiwi", label: "Neon cycle spend (Apr–Mar)", hint: "Toward ₹50k / ₹1L / ₹1.5L" },
];

function NumInput({
  value,
  onChange,
  max,
}: {
  value: number;
  onChange: (n: number) => void;
  max?: number;
}) {
  return (
    <input
      className="input text-right tabular-nums max-w-[9.5rem]"
      inputMode="numeric"
      value={Number.isFinite(value) ? String(value) : "0"}
      onChange={(e) => {
        const n = Number(e.target.value.replace(/[^0-9.]/g, "")) || 0;
        onChange(max !== undefined ? Math.min(max, Math.max(0, n)) : Math.max(0, n));
      }}
    />
  );
}

export default function MilestonesPage() {
  const [state, setState] = useState<AppState | null>(null);
  useEffect(() => { setState(loadState()); }, []);
  if (!state) return <div className="text-fg-muted">Loading…</div>;

  const update = <K extends keyof AppState>(key: K, value: AppState[K]) => {
    const next = { ...state, [key]: value };
    setState(next);
    saveState(next);
  };

  const cardSpend = (id: string) =>
    id === "amex_plat_travel" ? state.ptccEligibleSpend :
    id === "amex_mrcc" ? state.mrccCycleSpend :
    id === "sbi_simplyclick" ? state.sbiYtdSpend :
    id === "idfc_indigo" ? state.idfcYtdSpend :
    id === "bob_eterna" ? state.bobYtdSpend :
    id === "hsbc_live_plus" ? state.hsbcLivePlusYtdSpend :
    0;

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
          Edit totals below to match your real statements. Recommend always uses these numbers first.
        </p>
      </div>

      <Callout tone="info" title="How Recommend uses this">
        Before every recommendation we load <b>these saved counters</b> (not a full rebuild from the incomplete txn log).
        Log new spends as usual — they add on top. Use <b>Rebuild from log</b> only if you want to wipe and re-derive from Transactions.
      </Callout>

      {/* ——— Editable past spend ——— */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-xl font-bold">Update spend (source of truth)</h2>
            <p className="text-sm text-fg-muted mt-0.5">All milestone cards — set where you actually are today.</p>
          </div>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => {
              const next = recomputeCounters();
              setState(next);
              toast("Rebuilt counters from logged transactions", "info");
            }}
          >
            Rebuild from log
          </button>
        </div>

        <div className="card-shell overflow-hidden">
          <div className="card-header">
            <div className="font-semibold">Annual / cycle spend</div>
            <span className="text-xs text-fg-muted">Fee waiver · welcome · voucher tiers</span>
          </div>
          <div className="divide-y divide-border">
            {ANNUAL_FIELDS.map((f) => {
              const card = f.cardId ? getCardById(f.cardId) : null;
              const val = Number(state[f.key] ?? 0);
              return (
                <div key={String(f.key)} className="px-3 sm:px-4 py-3 flex items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">{card?.short ?? f.label}</div>
                    <div className="text-xs text-fg-muted">{f.hint}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-fg-subtle hidden sm:inline">₹</span>
                    <NumInput value={val} onChange={(n) => update(f.key, n as never)} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card-shell overflow-hidden">
          <div className="card-header">
            <div className="font-semibold">This month / Neon cycle</div>
            <span className="text-xs text-fg-muted">Txn counts + monthly amount targets</span>
          </div>
          <div className="divide-y divide-border">
            {MONTHLY_FIELDS.map((f) => {
              const card = f.cardId ? getCardById(f.cardId) : null;
              const val = Number(state[f.key] ?? 0);
              const isTxn = f.key === "goldThisMonthTxnsAt1k" || f.key === "mrccThisCycleTxnsAt1500";
              return (
                <div key={String(f.key)} className="px-3 sm:px-4 py-3 flex items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">
                      {card?.short ?? "Card"} · {f.label}
                    </div>
                    <div className="text-xs text-fg-muted">{f.hint}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isTxn && <span className="text-xs text-fg-subtle hidden sm:inline">₹</span>}
                    <NumInput value={val} onChange={(n) => update(f.key, n as never)} max={f.max} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <Callout tone="warning" title="Tier 1 must-feed every month">
        Amex Gold (6× ≥₹1k) + Amex MRCC (4× ≥₹1.5k + ₹20k) + Scapia (₹20k lounge) — update the counters above so Recommend knows what&apos;s still open.
      </Callout>

      <section>
        <h2 className="text-xl font-bold mb-4">Annual milestones</h2>
        <div className="space-y-4">
          {Object.entries(grouped).map(([cardId, milestones]) => {
            const card = getCardById(cardId);
            const spent = cardSpend(cardId);
            const sorted = [...milestones].sort((a, b) => a.threshold - b.threshold);
            const top = sorted[sorted.length - 1].threshold;
            const checkpoints = sorted.slice(0, -1).map((m) => ({
              value: m.threshold,
              hit: state.milestonesHit.includes(`${m.cardId}:${m.threshold}`) || spent >= m.threshold,
            }));
            return (
              <div key={cardId} className="card-shell">
                <div className="card-header">
                  <Link href={`/cards/${cardId}`} className="font-semibold hover:underline">{card?.short ?? cardId}</Link>
                  <div className="text-xs text-fg-muted">{inrExact(spent)} / {inrExact(top)}</div>
                </div>
                <div className="card-body space-y-4">
                  <CheckpointedProgress
                    current={spent}
                    total={top}
                    checkpoints={checkpoints}
                    tone={spent >= top ? "success" : "info"}
                  />
                  <div className="space-y-1.5 pt-2">
                    {sorted.map((m) => {
                      const hit = state.milestonesHit.includes(`${m.cardId}:${m.threshold}`) || spent >= m.threshold;
                      const close = !hit && spent >= m.threshold * 0.85;
                      return (
                        <div key={m.threshold} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            {hit ? <span className="pill-success">Hit</span> :
                             close ? <span className="pill-warning">Close</span> :
                             <span className="pill-neutral">Pending</span>}
                            <span>{inrExact(m.threshold)} → {m.reward}</span>
                          </div>
                          <span className="text-fg-muted">{inrExact(m.rewardValueInr)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Icon.Lounge /> Kiwi Neon (Apr 1 → Mar 31)
        </h2>
        <div className="card-shell">
          <div className="card-header">
            <Link href="/cards/yes_kiwi" className="font-semibold hover:underline">YES Bank · Kiwi Neon</Link>
            <div className="text-xs text-fg-muted">{inrExact(kiwiSpend)} / {inrExact(150000)}</div>
          </div>
          <div className="card-body space-y-4">
            <CheckpointedProgress
              current={kiwiSpend}
              total={150000}
              checkpoints={KIWI_NEON_MILESTONES.slice(0, -1).map((m) => ({
                value: m.threshold,
                hit: kiwiSpend >= m.threshold,
              }))}
              tone={kiwiSpend >= 50000 ? "success" : "info"}
            />
            <div className="space-y-2 pt-2">
              {KIWI_NEON_MILESTONES.map((m) => {
                const hit = kiwiSpend >= m.threshold;
                const close = !hit && kiwiSpend >= m.threshold * 0.85;
                return (
                  <div key={m.threshold} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {hit ? <span className="pill-success">Hit</span> : close ? <span className="pill-warning">Close</span> : <span className="pill-neutral">Pending</span>}
                      <span>{inrExact(m.threshold)} → {m.cashbackRate}% retro + {m.lounges} lounge{m.lounges > 1 ? "s" : ""}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Monthly playbook (reference)</h2>
        <div className="card-shell overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-fg-muted text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left p-3">Card</th>
                <th className="text-left">Rule</th>
                <th className="text-right">Min</th>
                <th className="text-right p-3">Reward</th>
              </tr>
            </thead>
            <tbody>
              {MONTHLY_MILESTONES.map((m, i) => (
                <tr key={i} className="table-row">
                  <td className="p-3">
                    <Link href={`/cards/${m.cardId}`} className="font-medium hover:underline">{getCardById(m.cardId)?.short ?? m.cardId}</Link>
                  </td>
                  <td>{m.rule}</td>
                  <td className="text-right">{inrExact(m.minSpend)}</td>
                  <td className="text-right p-3 text-success">{inrExact(m.rewardInr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
