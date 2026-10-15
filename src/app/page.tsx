"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  loadState,
  loadTransactions,
  loadHoldings,
  loadTrips,
  loadNotes,
  holdingValue,
  holdingTracksPnl,
  type AppState,
} from "@/lib/storage";
import { useDataVersion } from "@/lib/useLiveData";
import { CARDS, netCreditLimit } from "@/lib/cards";
import { inr, inrExact, todayLocal } from "@/lib/utils";
import { buildBriefing, greeting, type BriefingItem } from "@/lib/briefing";
import { buildRewardLedger } from "@/lib/rewards";
import { summariseLounges } from "@/lib/lounges";
import type { Transaction, Holding } from "@/lib/types";
import type { Trip } from "@/lib/travel/itinerary/trips";
import type { Note } from "@/lib/notes";
import { Icon } from "@/components/Icons";
import { ArcGauge, HudPanel, Readout } from "@/components/Hud";

const AREA_META: Record<BriefingItem["area"], { label: string; icon: string }> = {
  money: { label: "Money", icon: "₹" },
  travel: { label: "Travel", icon: "✈" },
  notes: { label: "Notes", icon: "▤" },
};

const TONE_RING: Record<BriefingItem["tone"], string> = {
  urgent: "border-danger/45 bg-danger/[0.06]",
  opportunity: "border-success/45 bg-success/[0.06]",
  info: "border-border bg-bg-elevated/70",
};

function BriefingCard({ item }: { item: BriefingItem }) {
  const area = AREA_META[item.area];
  const pct = item.progress
    ? Math.min(100, Math.round((item.progress.current / Math.max(1, item.progress.target)) * 100))
    : null;

  return (
    <Link
      href={item.href}
      className={`hud-brackets block rounded-lg border p-4 transition-all hover:border-accent ${TONE_RING[item.tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="label flex items-center gap-1.5">
            <span>{area.icon}</span>
            {area.label}
          </div>
          <div className="mt-1.5 font-semibold text-fg">{item.title}</div>
          <p className="mt-0.5 text-sm text-fg-muted">{item.detail}</p>
        </div>
        <Icon.ArrowRight size={15} className="mt-1 shrink-0 text-accent/70" />
      </div>
      {pct !== null && (
        <div className="mt-3">
          <div className="bar">
            <div className="bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div className="readout mt-1 text-[10px] text-fg-muted">{pct}% COMPLETE</div>
        </div>
      )}
    </Link>
  );
}

export default function HomePage() {
  const [state, setState] = useState<AppState | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const dataVersion = useDataVersion();

  useEffect(() => {
    setState(loadState());
    setTxns(loadTransactions());
    setHoldings(loadHoldings());
    setTrips(loadTrips());
    setNotes(loadNotes());
  }, [dataVersion]);

  const briefing = useMemo(
    () => (state ? buildBriefing({ state, trips, notes, today: todayLocal() }) : []),
    [state, trips, notes]
  );

  const worth = useMemo(() => {
    const market = holdings.filter(holdingTracksPnl).reduce((a, h) => a + holdingValue(h), 0);
    const property = holdings.filter((h) => !holdingTracksPnl(h)).reduce((a, h) => a + holdingValue(h), 0);
    return { market, property, total: market + property };
  }, [holdings]);

  const ledger = useMemo(() => (state ? buildRewardLedger(state) : null), [state]);
  const lounges = useMemo(() => (state ? summariseLounges(state) : null), [state]);

  if (!state || !ledger || !lounges) return <div className="text-fg-muted">Initialising…</div>;

  const monthKey = todayLocal().slice(0, 7);
  const spentThisMonth = txns
    .filter((t) => t.date.slice(0, 7) === monthKey)
    .reduce((a, t) => a + t.amount, 0);
  const activeCards = CARDS.filter((c) => c.status === "active").length;
  const urgent = briefing.filter((b) => b.tone === "urgent").length;

  return (
    <div className="space-y-7">
      {/* ——— Status line ——— */}
      <div className="hud-brackets card-shell hud-scanlines overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
          <div className="min-w-0">
            <div className="label flex items-center gap-2">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${urgent ? "bg-danger" : "bg-success"} animate-flicker`} />
              Jarvis · {urgent ? `${urgent} item${urgent === 1 ? "" : "s"} need attention` : "all systems nominal"}
            </div>
            <h1 className="page-title mt-2 text-accent">{greeting()}</h1>
            <p className="page-sub">
              {briefing.length === 0
                ? "Nothing needs your attention right now."
                : `${briefing.length} thing${briefing.length === 1 ? "" : "s"} worth a look today.`}
            </p>
          </div>
          <Link href="/recommend" className="btn-primary w-full sm:w-auto">
            <Icon.Zap size={15} /> What should I pay with?
          </Link>
        </div>
      </div>

      {/* ——— Glanceable instruments ——— */}
      <HudPanel
        title="At a glance"
        action={
          <Link href="/lounges" className="font-mono text-[10px] uppercase tracking-wider text-fg-muted hover:text-accent">
            Lounge detail →
          </Link>
        }
      >
        <div className="flex flex-wrap items-start justify-center gap-7 sm:justify-start sm:gap-9">
          <Link href="/lounges" className="transition-opacity hover:opacity-80">
            <ArcGauge
              value={lounges.domestic.visits}
              ratio={lounges.domestic.totalCount ? lounges.domestic.liveCount / lounges.domestic.totalCount : 0}
              unlimited={lounges.domestic.unlimited}
              tone="cyan"
              label="Domestic lounge"
              caption={`${lounges.domestic.liveCount}/${lounges.domestic.totalCount} live`}
            />
          </Link>
          <Link href="/lounges" className="transition-opacity hover:opacity-80">
            <ArcGauge
              value={lounges.international.visits}
              ratio={
                lounges.international.totalCount
                  ? lounges.international.liveCount / lounges.international.totalCount
                  : 0
              }
              unlimited={lounges.international.unlimited}
              tone={lounges.international.visits > 0 || lounges.international.unlimited ? "gold" : "red"}
              label="International"
              caption={`${lounges.international.liveCount}/${lounges.international.totalCount} live`}
            />
          </Link>
          <Link href="/milestones" className="transition-opacity hover:opacity-80">
            <ArcGauge
              value={urgent}
              ratio={briefing.length ? urgent / briefing.length : 0}
              tone={urgent ? "red" : "green"}
              label="Urgent signals"
              caption={`of ${briefing.length} open`}
            />
          </Link>
        </div>
      </HudPanel>

      {briefing.length > 0 && (
        <section>
          <h2 className="label mb-3 text-accent">Needs attention</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {briefing.map((item) => (
              <BriefingCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="label mb-3 text-accent">Where things stand</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Readout
            label="Net worth"
            value={inr(worth.total)}
            href="/portfolio"
            sub={
              worth.property > 0
                ? `${inr(worth.market)} market + ${inr(worth.property)} property`
                : `${holdings.length} holdings`
            }
          />
          <Readout label="Spent this month" value={inr(spentThisMonth)} href="/spend" sub={monthKey} />
          <Readout
            label="Reward wallet"
            value={inr(ledger.bankableInr)}
            tone="green"
            href="/rewards"
            sub={
              ledger.speculativeInr > 0
                ? `+ ${inr(ledger.speculativeInr)} unproven, excluded`
                : `${ledger.rows.length} currencies`
            }
          />
          <Readout
            label="Active cards"
            value={activeCards}
            href="/cards"
            sub={`${inr(netCreditLimit())} total limit`}
          />
        </div>
      </section>

      <section>
        <h2 className="label mb-3 text-accent">Jump back in</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/travel", icon: <Icon.Plane size={17} />, title: "Travel", sub: trips.length ? `${trips.length} trip${trips.length === 1 ? "" : "s"} planned` : "Plan a trip" },
            { href: "/notes", icon: <Icon.Note size={17} />, title: "Notes", sub: notes.length ? `${notes.length} note${notes.length === 1 ? "" : "s"}` : "Write something down" },
            { href: "/transactions", icon: <Icon.Transaction size={17} />, title: "Transactions", sub: `${txns.length} logged` },
            { href: "/milestones", icon: <Icon.Sparkles size={17} />, title: "Milestones", sub: "Spend gates & waivers" },
          ].map((s) => (
            <Link key={s.href} href={s.href} className="card-shell flex items-center gap-3 p-3.5 transition-all hover:border-accent/60">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-border bg-bg-chrome text-accent">
                {s.icon}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium">{s.title}</div>
                <div className="truncate text-[11px] text-fg-muted">{s.sub}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {txns.length > 0 && (
        <HudPanel
          title="Recent transactions"
          action={
            <Link href="/transactions" className="font-mono text-[10px] uppercase tracking-wider text-fg-muted hover:text-accent">
              View all →
            </Link>
          }
        >
          <div className="scroll-x">
            <table className="w-full text-sm">
              <thead className="label">
                <tr>
                  <th className="py-2 text-left font-normal">Date</th>
                  <th className="text-left font-normal">Merchant</th>
                  <th className="text-left font-normal">Card</th>
                  <th className="text-right font-normal">Amount</th>
                  <th className="py-2 text-right font-normal">Reward</th>
                </tr>
              </thead>
              <tbody>
                {txns.slice(0, 5).map((t) => {
                  const card = CARDS.find((c) => c.id === t.cardId);
                  return (
                    <tr key={t.id} className="table-row">
                      <td className="readout py-2.5 text-[11px] text-fg-muted">
                        {new Date(t.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                      </td>
                      <td className="font-medium">{t.merchant}</td>
                      <td>
                        <Link href={`/cards/${t.cardId}`} className="pill-info hover:border-accent">
                          {card?.short ?? t.cardId}
                        </Link>
                      </td>
                      <td className="readout text-right">{inrExact(t.amount)}</td>
                      <td className="readout py-2.5 text-right text-success">{inrExact(t.rewardInr)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </HudPanel>
      )}
    </div>
  );
}
