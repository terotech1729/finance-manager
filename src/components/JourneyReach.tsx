"use client";

import { useState } from "react";
import { PlaceTypeahead } from "./PlaceTypeahead";
import { Callout } from "./Callout";
import { Icon } from "./Icons";
import { placeLabel, type TravelPlace } from "@/lib/travel/places";
import type { JourneyItinerary, JourneyPlanResult } from "@/lib/travel/journey/types";
import { inr, todayLocal, localDateToISO } from "@/lib/utils";
import { toast } from "./Toast";

function fmtWhen(iso: string): string {
  const [d, t] = iso.split("T");
  return `${d} ${t || ""}`.trim();
}

function hrs(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h <= 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function ItineraryCard({
  it,
  rank,
  highlight,
}: {
  it: JourneyItinerary;
  rank: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 space-y-3 ${
        highlight ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-bg-elevated"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-xs text-fg-muted">
            #{rank}
            {highlight ? " · recommended" : ""} · score {it.score} · reality {it.realityPct}%
          </div>
          <div className="font-semibold text-fg mt-0.5">{it.pathLabel}</div>
          <div className="text-sm text-fg-muted">{it.label}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold tabular-nums">{inr(it.totalCostInr)}</div>
          <div className="text-xs text-fg-muted">
            {hrs(it.totalDurationMin)} · sleep {it.sleepScore}/100
          </div>
          <div className="text-[11px] text-fg-muted mt-0.5">
            transport {inr(it.transportCostInr)}
            {it.stayCostInr > 0 ? ` + stay ${inr(it.stayCostInr)}` : " · no hotel"}
          </div>
        </div>
      </div>

      <ol className="space-y-2 border-t border-border pt-3">
        {it.legs.map((leg, i) => (
          <li key={leg.id || i} className="flex gap-3 text-sm">
            <div className="w-16 shrink-0 text-xs uppercase tracking-wide text-fg-muted pt-0.5">
              {leg.mode}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-fg">
                {placeLabel(leg.from)} → {placeLabel(leg.to)}
                {leg.carrier ? <span className="text-fg-muted font-normal"> · {leg.carrier}</span> : null}
              </div>
              <div className="text-xs text-fg-muted">
                {fmtWhen(leg.departAt)} → {fmtWhen(leg.arriveAt)} · {hrs(leg.durationMin)} ·{" "}
                {inr(leg.costInr)}
                {leg.scheduleSource === "live"
                  ? " · live timetable"
                  : leg.scheduleSource === "catalog"
                    ? " · catalog"
                    : " · est. timing"}
              </div>
              {leg.note && <div className="text-xs text-fg-muted mt-0.5">{leg.note}</div>}
              {leg.overnightSleep && (
                <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5">
                  Sleep on this leg — counts as hotel substitute
                </div>
              )}
              {!leg.overnightSleep && leg.sleepOverlapMin > 30 && (
                <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  ~{hrs(leg.sleepOverlapMin)} in your sleep window
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      {it.stayNote && (
        <div className="text-xs rounded-lg bg-black/5 dark:bg-white/5 px-3 py-2 text-fg-muted">
          Stay: {it.stayNote}
          {it.stayCostInr > 0 ? ` · ${inr(it.stayCostInr)}` : ""}
        </div>
      )}

      {it.why.length > 0 && (
        <ul className="text-xs text-fg-muted list-disc pl-4 space-y-0.5">
          {it.why.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      {it.warnings.length > 0 && (
        <ul className="text-xs text-amber-700 dark:text-amber-300 list-disc pl-4 space-y-0.5">
          {it.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function JourneyReach() {
  const [origin, setOrigin] = useState<TravelPlace | null>(null);
  const [destination, setDestination] = useState<TravelPlace | null>(null);
  const [arriveDate, setArriveDate] = useState(todayLocal());
  const [arriveTime, setArriveTime] = useState("05:00");
  const [adults, setAdults] = useState(1);
  const [protectSleep, setProtectSleep] = useState(true);
  const [allowOvernightBus, setAllowOvernightBus] = useState(true);
  const [includeStay, setIncludeStay] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<JourneyPlanResult | null>(null);

  const runPlan = async () => {
    if (!destination) {
      toast("Pick a destination from suggestions", "error");
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const arriveBy = `${localDateToISO(arriveDate)}T${arriveTime}`;
      const res = await fetch("/api/travel/journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: origin ? placeLabel(origin) : "Pune",
          destination: placeLabel(destination),
          arriveBy,
          adults: Math.max(1, adults),
          today: localDateToISO(todayLocal()),
          prefs: {
            includeStayCost: includeStay,
            allowOvernightAsStay: allowOvernightBus,
            ...(protectSleep
              ? { sleepWeight: 0.4, costWeight: 0.35, timeWeight: 0.25, avoidOvernightSurface: !allowOvernightBus }
              : { sleepWeight: 0.15, costWeight: 0.5, timeWeight: 0.35, avoidOvernightSurface: false }),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Plan failed");
      setResult(data as JourneyPlanResult);
    } catch (e) {
      setResult(null);
      setError(e instanceof Error ? e.message : "Plan failed");
    } finally {
      setSearching(false);
    }
  };

  const list = result?.best ? [result.best, ...result.alternatives] : [];

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[#0c1a17] via-[#0f172a] to-[#0b1220]">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(700px 280px at 15% 0%, rgba(16,185,129,0.28), transparent 55%), radial-gradient(500px 240px at 90% 30%, rgba(56,189,248,0.16), transparent 50%)",
          }}
        />
        <div className="relative p-4 sm:p-6 space-y-5">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-emerald-300/80">Reach by</div>
            <h2 className="text-xl sm:text-2xl font-semibold text-white mt-1">
              Best route tree to your deadline
            </h2>
            <p className="text-sm text-slate-300/90 mt-1 max-w-2xl">
              We only suggest flights with live market departure times, plus known train/bus catalog services.
              All-in includes hotel nights when you arrive early — or overnight bus as a sleep/hotel substitute
              (e.g. Delhi → Rishikesh).
            </p>
          </div>

          <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 sm:p-4 space-y-3">
            <div className="grid lg:grid-cols-2 gap-3">
              <PlaceTypeahead
                mode="bus"
                label="From (home base)"
                placeholder="Pune"
                value={origin}
                onChange={setOrigin}
                excludeId={destination?.id}
              />
              <PlaceTypeahead
                mode="bus"
                label="Destination"
                placeholder="Rishikesh, Manali…"
                value={destination}
                onChange={setDestination}
                excludeId={origin?.id}
              />
            </div>
            <div className="grid sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="label mb-1 block text-slate-400">Arrive by date</label>
                <input
                  className="input bg-black/20 border-white/15"
                  type="date"
                  value={arriveDate}
                  onChange={(e) => setArriveDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label mb-1 block text-slate-400">Time</label>
                <input
                  className="input bg-black/20 border-white/15"
                  type="time"
                  value={arriveTime}
                  onChange={(e) => setArriveTime(e.target.value)}
                />
              </div>
              <div>
                <label className="label mb-1 block text-slate-400">Adults</label>
                <input
                  className="input bg-black/20 border-white/15"
                  type="number"
                  min={1}
                  value={adults}
                  onChange={(e) => setAdults(Number(e.target.value) || 1)}
                />
              </div>
              <button type="button" className="btn-primary h-[42px]" onClick={runPlan} disabled={searching}>
                <Icon.Search size={16} />
                {searching ? "Exploring routes…" : "Plan routes"}
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={protectSleep}
                  onChange={(e) => setProtectSleep(e.target.checked)}
                  className="rounded border-white/20"
                />
                Prefer routes that don’t wreck night sleep (23:00–06:00)
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeStay}
                  onChange={(e) => setIncludeStay(e.target.checked)}
                  className="rounded border-white/20"
                />
                Include hotel stay in all-in when you arrive early
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowOvernightBus}
                  onChange={(e) => setAllowOvernightBus(e.target.checked)}
                  className="rounded border-white/20"
                />
                Allow overnight bus/train as sleep (skip hotel — e.g. Delhi→Rishikesh)
              </label>
            </div>
            {!origin && (
              <p className="text-xs text-slate-400">Home base defaults to Pune if From is empty.</p>
            )}
          </div>
        </div>
      </div>

      {error && (
        <Callout tone="danger" title="Couldn’t plan">
          {error}
        </Callout>
      )}

      {searching && (
        <div className="card-shell p-8 text-center text-fg-muted text-sm animate-pulse">
          Expanding route tree (direct + via hubs), pricing flight legs, scoring sleep…
        </div>
      )}

      {result && !searching && (
        <div className="space-y-4">
          <div className="text-sm text-fg-muted">{result.summary}</div>
          {result.warnings.length > 0 && (
            <Callout tone="info" title="How this tree works">
              <ul className="list-disc pl-4 space-y-0.5 text-sm">
                {result.warnings.slice(0, 4).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </Callout>
          )}
          {list.length === 0 ? (
            <Callout tone="danger" title="No viable itinerary">
              Try a later arrive-by time, or a destination with airport gateways in our graph.
            </Callout>
          ) : (
            <div className="space-y-3">
              {list.map((it, i) => (
                <ItineraryCard key={it.id} it={it} rank={i + 1} highlight={i === 0} />
              ))}
            </div>
          )}
          <p className="text-xs text-fg-muted">
            Next step: pick a flight leg above and use <span className="text-fg">Book trip</span> mode to rank
            Instant Discount + card stacks for that exact O→D.
          </p>
        </div>
      )}
    </div>
  );
}
