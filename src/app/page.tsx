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
import type { LoungePeriod } from "@/lib/lounges";
import { upcomingDeadlines, urgencyOf } from "@/lib/deadlines";
import { findAnomalies } from "@/lib/anomalies";
import { buildPlan, inferMonthlyCapacity } from "@/lib/planner";
import { AskJarvis } from "@/components/AskJarvis";
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

type GaugeFocus = "domestic" | "international" | "urgent" | null;

const PERIOD_LABEL: Record<LoungePeriod, string> = {
  year: "per year",
  quarter: "per quarter",
  cycle: "per cycle",
};

/** A dial you can press. Selected state is on the wrapper so the gauge stays presentational. */
function GaugeButton({
  selected,
  onSelect,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`rounded-lg p-1 transition-all ${
        selected ? "bg-accent/10 ring-1 ring-accent/50" : "hover:opacity-80"
      }`}
    >
      {children}
    </button>
  );
}

export default function HomePage() {
  const [state, setState] = useState<AppState | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [focus, setFocus] = useState<GaugeFocus>(null);
  const dataVersion = useDataVersion();

  /** Press the open dial to close it, any other dial to switch straight to it. */
  const toggleFocus = (next: Exclude<GaugeFocus, null>) =>
    setFocus((cur) => (cur === next ? null : next));

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
  const deadlines = useMemo(() => (state ? upcomingDeadlines(state) : []), [state]);
  const anomalies = useMemo(() => (state ? findAnomalies(state, txns) : []), [state, txns]);
  // Capacity is inferred from logged history, so the plan reflects what you actually
  // spend rather than a guess at what you could.
  const plan = useMemo(
    () => (state ? buildPlan(state, inferMonthlyCapacity(txns)) : null),
    [state, txns]
  );

  if (!state || !ledger || !lounges || !plan) return <div className="text-fg-muted">Initialising…</div>;

  const urgentItems = briefing.filter((b) => b.tone === "urgent");
  // What the open dial should show. Kept beside the gauges rather than derived inside
  // them so the panel heading, the body and the "see all" link can never disagree about
  // which dial is open — the bug being fixed was exactly that mismatch.
  // Listed from `all`, not from `sources`: `sources` holds only the live entitlements,
  // but the dial's caption counts live *out of total*, so a 3/4 reading has to be able
  // to show the fourth, locked one or the breakdown contradicts the number above it.
  const focusDetail =
    focus === "international"
      ? {
          title: "International lounge — by card",
          href: "/lounges",
          linkLabel: "Lounge detail",
          sources: lounges.all.filter((e) => e.scope === "international"),
        }
      : focus === "urgent"
        ? { title: "Urgent signals", href: "/milestones", linkLabel: "All milestones", sources: [] }
        : {
            title: "Domestic lounge — by card",
            href: "/lounges",
            linkLabel: "Lounge detail",
            sources: focus === "domestic" ? lounges.all.filter((e) => e.scope === "domestic") : [],
          };

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

      {/* ——— Glanceable instruments ———
           Each gauge opens its own breakdown in place. They are buttons rather than
           links so that the detail always matches the dial you pressed, and so a second
           press can switch to a different dial instead of navigating away. */}
      <HudPanel
        title="At a glance"
        action={
          <Link href={focusDetail.href} className="font-mono text-[10px] uppercase tracking-wider text-fg-muted hover:text-accent">
            {focusDetail.linkLabel} →
          </Link>
        }
      >
        <div className="flex flex-wrap items-start justify-center gap-7 sm:justify-start sm:gap-9">
          <GaugeButton selected={focus === "domestic"} onSelect={() => toggleFocus("domestic")}>
            <ArcGauge
              value={lounges.domestic.visits}
              ratio={lounges.domestic.totalCount ? lounges.domestic.liveCount / lounges.domestic.totalCount : 0}
              unlimited={lounges.domestic.unlimited}
              tone="cyan"
              label="Domestic lounge"
              caption={`${lounges.domestic.liveCount}/${lounges.domestic.totalCount} live`}
            />
          </GaugeButton>
          <GaugeButton selected={focus === "international"} onSelect={() => toggleFocus("international")}>
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
          </GaugeButton>
          <GaugeButton selected={focus === "urgent"} onSelect={() => toggleFocus("urgent")}>
            <ArcGauge
              value={urgent}
              ratio={briefing.length ? urgent / briefing.length : 0}
              tone={urgent ? "red" : "green"}
              label="Urgent signals"
              caption={`of ${briefing.length} open`}
            />
          </GaugeButton>
        </div>

        {focus === null ? (
          <p className="mt-3 border-t border-border pt-3 text-[11px] text-fg-subtle">
            Tap any dial for its breakdown.
          </p>
        ) : (
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="label text-accent">{focusDetail.title}</span>
              <button
                type="button"
                className="font-mono text-[10px] uppercase tracking-wider text-fg-subtle hover:text-accent"
                onClick={() => setFocus(null)}
              >
                Close
              </button>
            </div>

            {focus === "urgent" ? (
              urgentItems.length === 0 ? (
                <p className="text-sm text-fg-muted">
                  Nothing urgent. The {briefing.length} open signal
                  {briefing.length === 1 ? " is" : "s are"} listed under “Needs attention”.
                </p>
              ) : (
                urgentItems.map((b) => (
                  <Link
                    key={b.id}
                    href={b.href}
                    className="block border-b border-border py-2 last:border-0 hover:opacity-80"
                  >
                    <div className="text-sm text-danger">{b.title}</div>
                    <div className="mt-0.5 text-[11px] text-fg-muted">{b.detail}</div>
                  </Link>
                ))
              )
            ) : focusDetail.sources.length === 0 ? (
              <p className="text-sm text-fg-muted">No {focus} lounge access on any card you hold.</p>
            ) : (
              focusDetail.sources.map((e) => {
                const live = !e.gate || e.gate.met;
                return (
                  <Link
                    key={`${e.cardId}-${e.scope}-${e.period}`}
                    href={`/cards/${e.cardId}`}
                    className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-0 hover:opacity-80"
                  >
                    <div className="min-w-0">
                      <span className="text-sm text-fg">{e.cardShort}</span>
                      <span className={`ml-2 text-[11px] ${live ? "text-success" : "text-warning"}`}>
                        {live ? "live" : `locked · needs ${e.gate?.label}`}
                      </span>
                    </div>
                    <span className="readout shrink-0 text-sm">
                      {e.visits === null ? "∞" : e.visits}
                      <span className="ml-1 text-[11px] text-fg-muted">{PERIOD_LABEL[e.period]}</span>
                    </span>
                  </Link>
                );
              })
            )}
          </div>
        )}
      </HudPanel>

      <AskJarvis />

      {deadlines.length > 0 && (
        <HudPanel
          title="Closing soon"
          action={
            <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">
              {deadlines.length} dated
            </span>
          }
        >
          {deadlines.slice(0, 5).map((d) => {
            const u = urgencyOf(d);
            return (
              <Link
                key={d.id}
                href={d.href}
                className="flex items-start justify-between gap-3 border-b border-border py-2.5 last:border-0 hover:opacity-80"
              >
                <div className="min-w-0">
                  <div className={`text-sm ${u === "critical" ? "text-danger" : u === "soon" ? "text-warning" : "text-fg"}`}>
                    {d.title}
                  </div>
                  <div className="mt-0.5 text-[11px] text-fg-muted">{d.action}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={`readout text-sm ${u === "critical" ? "text-danger" : "text-fg"}`}>
                    {d.daysLeft}d
                  </div>
                  {d.valueInr ? (
                    <div className="text-[11px] text-fg-subtle">{inr(d.valueInr)}</div>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </HudPanel>
      )}

      {plan.steps.length > 0 && (
        <HudPanel
          title="Worth chasing"
          action={
            <span className="font-mono text-[10px] uppercase tracking-wider text-fg-muted">
              {inr(plan.collectableInr)} collectable
            </span>
          }
        >
          <p className="mb-2 text-[11px] text-fg-muted">
            Ordered by return on the spend still required, not by prize size — a small reward
            close by beats a large one out of reach.
          </p>
          {plan.steps.slice(0, 5).map((s) => (
            <div key={`${s.cardId}-${s.label}`} className="flex items-baseline justify-between gap-3 border-b border-border py-2 last:border-0">
              <div className="min-w-0">
                <span className="text-sm text-fg">{s.cardShort}</span>
                <span className="ml-2 text-[11px] text-fg-muted">{s.label}</span>
              </div>
              <div className="shrink-0 text-right">
                <div className="readout text-sm text-success">{(s.efficiency * 100).toFixed(1)}%</div>
                <div className="text-[11px] text-fg-subtle">
                  {inr(s.remainingInr)} → {inr(s.rewardInr)}
                </div>
              </div>
            </div>
          ))}
        </HudPanel>
      )}

      {anomalies.length > 0 && (
        <HudPanel title="Worth a second look">
          {anomalies.slice(0, 4).map((a) => (
            <Link
              key={a.id}
              href={a.href}
              className="block border-b border-border py-2.5 last:border-0 hover:opacity-80"
            >
              <div className={`text-sm ${a.severity === "high" ? "text-danger" : "text-fg"}`}>{a.title}</div>
              <div className="mt-0.5 text-[11px] text-fg-muted">{a.detail}</div>
            </Link>
          ))}
        </HudPanel>
      )}

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
