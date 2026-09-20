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
import { CARDS } from "@/lib/cards";
import { inr, inrExact, nfmt, todayLocal } from "@/lib/utils";
import { buildBriefing, greeting, type BriefingItem } from "@/lib/briefing";
import type { Transaction, Holding } from "@/lib/types";
import type { Trip } from "@/lib/travel/itinerary/trips";
import type { Note } from "@/lib/notes";
import { Icon } from "@/components/Icons";

const AREA_META: Record<BriefingItem["area"], { label: string; icon: string }> = {
  money: { label: "Money", icon: "₹" },
  travel: { label: "Travel", icon: "✈" },
  notes: { label: "Notes", icon: "📝" },
};

const TONE_RING: Record<BriefingItem["tone"], string> = {
  urgent: "border-danger/40 bg-danger/[0.05]",
  opportunity: "border-success/40 bg-success/[0.05]",
  info: "border-border bg-bg-elevated",
};

function BriefingCard({ item }: { item: BriefingItem }) {
  const area = AREA_META[item.area];
  const pct = item.progress
    ? Math.min(100, Math.round((item.progress.current / Math.max(1, item.progress.target)) * 100))
    : null;

  return (
    <Link href={item.href} className={`block rounded-xl border p-4 transition-colors hover:border-accent ${TONE_RING[item.tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-fg-muted">
            <span>{area.icon}</span>
            {area.label}
          </div>
          <div className="mt-1 font-semibold text-fg">{item.title}</div>
          <p className="mt-0.5 text-sm text-fg-muted">{item.detail}</p>
        </div>
        <Icon.ArrowRight size={16} className="mt-1 shrink-0 text-fg-muted" />
      </div>
      {pct !== null && (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-chrome">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-1 text-[11px] text-fg-muted">{pct}% there</div>
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

  if (!state) return <div className="text-fg-muted">Loading…</div>;

  const loyaltyInr =
    state.amexMrPooled * 0.58 +
    state.indigoBluChips * 0.45 +
    state.scapiaCoins * 0.2 +
    state.kiwiCashback * 0.25 +
    state.sbiRp * 0.2 +
    state.bobRp * 0.25 +
    state.credCoins * 0.03 +
    state.cheqChips * 0.1;

  const monthKey = todayLocal().slice(0, 7);
  const spentThisMonth = txns
    .filter((t) => t.date.slice(0, 7) === monthKey)
    .reduce((a, t) => a + t.amount, 0);
  const activeCards = CARDS.filter((c) => c.status === "active").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-title">{greeting()}</h1>
          <p className="page-sub">
            {briefing.length === 0
              ? "Nothing needs your attention right now."
              : `${briefing.length} thing${briefing.length === 1 ? "" : "s"} worth a look today.`}
          </p>
        </div>
        <Link href="/recommend" className="btn-primary w-full sm:w-auto">
          <Icon.Zap size={16} /> What should I pay with?
        </Link>
      </div>

      {briefing.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Needs attention</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {briefing.map((item) => (
              <BriefingCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold">Where things stand</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Link href="/portfolio" className="stat-tile block transition-colors hover:border-accent">
            <div className="label">Net worth</div>
            <div className="mt-1 text-2xl font-bold">{inr(worth.total)}</div>
            <div className="mt-1 text-xs text-fg-muted">
              {worth.property > 0 ? `${inr(worth.market)} market + ${inr(worth.property)} property` : `${holdings.length} holdings`}
            </div>
          </Link>
          <Link href="/spend" className="stat-tile block transition-colors hover:border-accent">
            <div className="label">Spent this month</div>
            <div className="mt-1 text-2xl font-bold">{inr(spentThisMonth)}</div>
            <div className="mt-1 text-xs text-fg-muted">{monthKey}</div>
          </Link>
          <Link href="/redemptions" className="stat-tile block transition-colors hover:border-accent">
            <div className="label">Loyalty wallet</div>
            <div className="mt-1 text-2xl font-bold text-success">{inr(loyaltyInr)}</div>
            <div className="mt-1 text-xs text-fg-muted">{nfmt(state.amexMrPooled)} MR · {nfmt(state.indigoBluChips)} BluChips</div>
          </Link>
          <Link href="/cards" className="stat-tile block transition-colors hover:border-accent">
            <div className="label">Active cards</div>
            <div className="mt-1 text-2xl font-bold">{activeCards}</div>
            <div className="mt-1 text-xs text-fg-muted">tap to review benefits</div>
          </Link>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Jump back in</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: "/travel", icon: <Icon.Plane size={18} />, title: "Travel", sub: trips.length ? `${trips.length} trip${trips.length === 1 ? "" : "s"} planned` : "Plan a trip" },
            { href: "/notes", icon: <Icon.Note size={18} />, title: "Notes", sub: notes.length ? `${notes.length} note${notes.length === 1 ? "" : "s"}` : "Write something down" },
            { href: "/transactions", icon: <Icon.Transaction size={18} />, title: "Transactions", sub: `${txns.length} logged` },
            { href: "/milestones", icon: <Icon.Sparkles size={18} />, title: "Milestones", sub: "Spend gates & waivers" },
          ].map((s) => (
            <Link key={s.href} href={s.href} className="card-shell flex items-center gap-3 p-4 transition-colors hover:border-accent">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bg-chrome text-fg-muted">
                {s.icon}
              </div>
              <div className="min-w-0">
                <div className="font-medium">{s.title}</div>
                <div className="truncate text-xs text-fg-muted">{s.sub}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {txns.length > 0 && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-bold">Recent transactions</h2>
            <Link href="/transactions" className="flex items-center gap-1 text-sm text-fg-muted hover:text-fg">
              View all <Icon.ArrowRight size={14} />
            </Link>
          </div>
          <div className="card-shell">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wide text-fg-muted">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="text-left">Merchant</th>
                  <th className="text-left">Card</th>
                  <th className="text-right">Amount</th>
                  <th className="p-3 text-right">Reward</th>
                </tr>
              </thead>
              <tbody>
                {txns.slice(0, 5).map((t) => {
                  const card = CARDS.find((c) => c.id === t.cardId);
                  return (
                    <tr key={t.id} className="table-row">
                      <td className="p-3 text-fg-muted">
                        {new Date(t.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                      </td>
                      <td className="font-medium">{t.merchant}</td>
                      <td>
                        <Link href={`/cards/${t.cardId}`} className="pill-info hover:underline">
                          {card?.short ?? t.cardId}
                        </Link>
                      </td>
                      <td className="text-right">{inrExact(t.amount)}</td>
                      <td className="p-3 text-right text-success">{inrExact(t.rewardInr)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
