"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ANNUAL_MILESTONES, MONTHLY_MILESTONES, getCardById } from "@/lib/cards";
import { loadState, type AppState } from "@/lib/storage";
import { inr, inrExact } from "@/lib/utils";
import { CheckpointedProgress } from "@/components/CheckpointedProgress";
import { Callout } from "@/components/Callout";
import { Icon } from "@/components/Icons";

const KIWI_NEON_MILESTONES = [
  { threshold: 50000, cashbackRate: 3, lounges: 1, retroactiveBonus: 1500 },
  { threshold: 100000, cashbackRate: 4, lounges: 2, retroactiveBonus: 4000 },
  { threshold: 150000, cashbackRate: 5, lounges: 3, retroactiveBonus: 7500 },
];

export default function MilestonesPage() {
  const [state, setState] = useState<AppState | null>(null);
  useEffect(() => { setState(loadState()); }, []);
  if (!state) return <div className="text-fg-muted">Loading…</div>;

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
        <p className="text-fg-muted mt-1">Annual + monthly milestones across the portfolio. Update spend on Settings.</p>
      </div>

      <Callout tone="warning" title="Tier 1 must-feed every month (~₹46K combined)">
        Amex Gold (₹6K via 6 txns) + Amex MRCC (₹20K) + Scapia (₹20K) = non-negotiable. Set utility autopay on Gold for 4 of the 6 txns.
      </Callout>

      <section>
        <h2 className="text-xl font-bold mb-4">Annual milestones</h2>
        <p className="text-sm text-fg-muted mb-3">Filled markers = milestone hit. Open circles = pending intermediate checkpoints.</p>
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
          <Icon.Lounge /> Kiwi Neon (Apr 1 → Mar 31 cycle)
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
                      <span>{inrExact(m.threshold)} → {m.cashbackRate}% retroactive ({inr(m.retroactiveBonus)}) + {m.lounges} domestic lounge{m.lounges > 1 ? "s" : ""}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <Callout tone="info">
              Marginal rate increases at thresholds. From ₹50K→₹100K, the next ₹50K earns at 5% effective. From ₹100K→₹150K, the next ₹50K earns at 7% effective. Push hard near each threshold.
            </Callout>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold mb-4">Monthly milestone playbook</h2>
        <div className="card-shell">
          <table className="w-full text-sm">
            <thead className="text-fg-muted text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left p-3">Card</th>
                <th className="text-left">Rule</th>
                <th className="text-right">Min Spend</th>
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
