"use client";

import { useMemo, useState } from "react";
import { PlaceTypeahead } from "./PlaceTypeahead";
import { Callout } from "./Callout";
import { Icon } from "./Icons";
import type { TravelPlace } from "@/lib/travel/places";
import {
  buildItinerary,
  formatClock,
  suggestedNights,
  type ItineraryBlock,
  type ItineraryDay,
} from "@/lib/travel/itinerary/buildItinerary";
import { inr, todayLocal, localDateToISO } from "@/lib/utils";

const KIND_ICON: Record<string, string> = {
  sight: "🏛",
  nature: "🌿",
  trek: "🥾",
  temple: "🛕",
  market: "🛍",
  food: "🍽",
  museum: "🖼",
  viewpoint: "🌄",
  water: "🌊",
  wildlife: "🐅",
  adventure: "🪂",
  rest: "😴",
  travel: "🚗",
  meal: "🍽",
};

function dayHeading(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function BlockRow({ block }: { block: ItineraryBlock }) {
  const muted = block.kind === "meal";
  return (
    <li className="flex gap-3 text-sm">
      <div className="w-24 shrink-0 tabular-nums text-xs text-fg-muted pt-0.5">
        {formatClock(block.startMin)}
        <span className="opacity-50">–{formatClock(block.startMin + block.minutes)}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className={muted ? "text-fg-muted" : "font-medium text-fg"}>
          <span className="mr-1.5">{KIND_ICON[block.kind] ?? "•"}</span>
          {block.label}
          {block.costInr > 0 && (
            <span className="ml-2 text-xs font-normal text-fg-muted">{inr(block.costInr)}/head</span>
          )}
        </div>
        {block.detail && <div className="text-xs text-fg-muted mt-0.5">{block.detail}</div>}
      </div>
    </li>
  );
}

function DayCard({ day }: { day: ItineraryDay }) {
  return (
    <div className="rounded-xl border border-border bg-bg-elevated p-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
        <div>
          <span className="text-xs uppercase tracking-wide text-fg-muted">Day {day.index}</span>
          <span className="ml-2 text-sm text-fg-muted">{dayHeading(day.date)}</span>
          <div className="font-semibold text-fg mt-0.5">{day.title}</div>
        </div>
        {day.costInr > 0 && (
          <div className="text-xs text-fg-muted">
            entries {inr(day.costInr)}/head
          </div>
        )}
      </div>

      {day.notes.map((n, i) => (
        <div key={i} className="text-xs rounded-lg bg-black/5 dark:bg-white/5 px-3 py-2 text-fg-muted">
          {n}
        </div>
      ))}

      {day.blocks.length > 0 ? (
        <ol className="space-y-2.5">
          {day.blocks.map((b, i) => (
            <BlockRow key={i} block={b} />
          ))}
        </ol>
      ) : (
        <div className="text-sm text-fg-muted">Nothing scheduled — travel and settling in.</div>
      )}
    </div>
  );
}

export function TripPlanner() {
  const [destination, setDestination] = useState<TravelPlace | null>(null);
  const [startDate, setStartDate] = useState(todayLocal());
  const [nights, setNights] = useState(3);
  const [adults, setAdults] = useState(2);
  const [arriveTime, setArriveTime] = useState("10:00");
  const [departTime, setDepartTime] = useState("17:00");
  const [touchedNights, setTouchedNights] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Prefill nights from the guide the first time a destination is picked, but never
  // stomp on a number the user has already set themselves.
  const onPickDestination = (place: TravelPlace | null) => {
    setDestination(place);
    setSubmitted(false);
    if (place && !touchedNights) setNights(suggestedNights(place.id));
  };

  const plan = useMemo(() => {
    if (!destination || !submitted) return null;
    return buildItinerary({
      destination,
      nights,
      adults,
      startDate: localDateToISO(startDate),
      arriveTime,
      departTime,
    });
  }, [destination, submitted, nights, adults, startDate, arriveTime, departTime]);

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[#1a1206] via-[#0f172a] to-[#0b1220]">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(700px 280px at 15% 0%, rgba(245,158,11,0.26), transparent 55%), radial-gradient(500px 240px at 88% 30%, rgba(168,85,247,0.16), transparent 50%)",
          }}
        />
        <div className="relative p-4 sm:p-6 space-y-5">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-amber-300/80">Plan my days</div>
            <h2 className="text-xl sm:text-2xl font-semibold text-white mt-1">
              A day-by-day plan for where you land
            </h2>
            <p className="text-sm text-slate-300/90 mt-1 max-w-2xl">
              Groups sights by area so you aren&apos;t criss-crossing town, keeps sunrise points at sunrise,
              and trims to fit the nights you actually have.
            </p>
          </div>

          <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 sm:p-4 space-y-3">
            <PlaceTypeahead
              mode="any"
              label="Where are you going?"
              placeholder="Nainital, Coorg, Leh…"
              value={destination}
              onChange={onPickDestination}
            />
            <div className="grid sm:grid-cols-4 gap-3 items-end">
              <div>
                <label className="label mb-1 block text-slate-400">Arriving on</label>
                <input
                  className="input bg-black/20 border-white/15"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setSubmitted(false);
                  }}
                />
              </div>
              <div>
                <label className="label mb-1 block text-slate-400">Nights</label>
                <input
                  className="input bg-black/20 border-white/15"
                  type="number"
                  min={0}
                  max={21}
                  value={nights}
                  onChange={(e) => {
                    setTouchedNights(true);
                    setNights(Math.max(0, Math.min(21, Number(e.target.value) || 0)));
                    setSubmitted(false);
                  }}
                />
              </div>
              <div>
                <label className="label mb-1 block text-slate-400">Adults</label>
                <input
                  className="input bg-black/20 border-white/15"
                  type="number"
                  min={1}
                  value={adults}
                  onChange={(e) => setAdults(Math.max(1, Number(e.target.value) || 1))}
                />
              </div>
              <button
                type="button"
                className="btn-primary h-[42px]"
                onClick={() => setSubmitted(true)}
                disabled={!destination}
              >
                <Icon.Search size={16} />
                Build the plan
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label mb-1 block text-slate-400">Land at (first day)</label>
                <input
                  className="input bg-black/20 border-white/15"
                  type="time"
                  value={arriveTime}
                  onChange={(e) => setArriveTime(e.target.value)}
                />
              </div>
              <div>
                <label className="label mb-1 block text-slate-400">Leave by (last day)</label>
                <input
                  className="input bg-black/20 border-white/15"
                  type="time"
                  value={departTime}
                  onChange={(e) => setDepartTime(e.target.value)}
                />
              </div>
            </div>
            {!destination && (
              <p className="text-xs text-slate-400">
                Pick a destination from the suggestions — misspellings are fine.
              </p>
            )}
          </div>
        </div>
      </div>

      {plan && (
        <div className="space-y-4">
          {plan.vibe && (
            <div className="card-shell p-4">
              <div className="font-semibold text-fg">{plan.destination.city}</div>
              <p className="text-sm text-fg-muted mt-1">{plan.vibe}</p>
              <div className="grid sm:grid-cols-3 gap-3 mt-3 text-sm">
                {plan.seasonNote && (
                  <div>
                    <div className="label text-fg-muted">Season</div>
                    <div className="text-fg-muted mt-0.5">{plan.seasonNote}</div>
                  </div>
                )}
                {plan.localTransport && (
                  <div>
                    <div className="label text-fg-muted">Getting around</div>
                    <div className="text-fg-muted mt-0.5">{plan.localTransport}</div>
                  </div>
                )}
                <div>
                  <div className="label text-fg-muted">On-ground budget</div>
                  <div className="text-fg-muted mt-0.5">
                    About {inr(plan.estOnGroundInr)} for {adults} {adults === 1 ? "adult" : "adults"} — entries,
                    local transport and food. Excludes hotels and getting there.
                  </div>
                </div>
              </div>
            </div>
          )}

          {plan.warnings.map((w, i) => (
            <Callout key={i} tone="info" title="Worth knowing">
              {w}
            </Callout>
          ))}

          <div className="space-y-3">
            {plan.days.map((d) => (
              <DayCard key={d.index} day={d} />
            ))}
          </div>

          {plan.didntFit.length > 0 && (
            <div className="card-shell p-4">
              <div className="font-semibold text-fg text-sm">What another day or two would buy you</div>
              <ul className="text-sm text-fg-muted list-disc pl-4 mt-2 space-y-0.5">
                {plan.didntFit.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          )}

          {(plan.eat.length > 0 || plan.tips.length > 0) && (
            <div className="grid sm:grid-cols-2 gap-3">
              {plan.eat.length > 0 && (
                <div className="card-shell p-4">
                  <div className="font-semibold text-fg text-sm">Where to eat</div>
                  <ul className="text-sm text-fg-muted list-disc pl-4 mt-2 space-y-0.5">
                    {plan.eat.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
              {plan.tips.length > 0 && (
                <div className="card-shell p-4">
                  <div className="font-semibold text-fg text-sm">Before you go</div>
                  <ul className="text-sm text-fg-muted list-disc pl-4 mt-2 space-y-0.5">
                    {plan.tips.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <p className="text-xs text-fg-muted">
            Use <span className="text-fg">Get me there</span> to work out the route and arrival time, then come
            back and set them here.
          </p>
        </div>
      )}
    </div>
  );
}
