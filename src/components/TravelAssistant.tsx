"use client";

import { useMemo, useState } from "react";
import { loadState, addTransaction, saveState, type AppState } from "@/lib/storage";
import { buildRecommendInputFromState } from "@/lib/recommendInput";
import { applyCardSpend } from "@/lib/spendTracking";
import { rankTravel, defaultFareGrid } from "@/lib/travel/rankTravel";
import { TRAVEL_OFFERS } from "@/lib/travel/offers";
import type { TravelMode, TravelSolution, TravelTripInput } from "@/lib/travel/types";
import { inr, newId, todayLocal, localDateToISO } from "@/lib/utils";
import { getCardById } from "@/lib/cards";
import type { Transaction } from "@/lib/types";
import { toast } from "./Toast";
import { Icon } from "./Icons";
import { Callout } from "./Callout";

function routeName(cardId: string): string {
  const c = getCardById(cardId);
  if (c) return c.short;
  if (cardId === "upi") return "UPI";
  if (cardId === "yes_kiwi") return "Kiwi";
  if (cardId === "amazon_pay_icici") return "Amazon Pay ICICI";
  return cardId;
}

const MODES: { id: TravelMode; label: string }[] = [
  { id: "flight", label: "Flights" },
  { id: "train", label: "Trains" },
  { id: "bus", label: "Buses" },
];

type Props = { onLogged?: () => void };

export function TravelAssistant({ onLogged }: Props) {
  const [mode, setMode] = useState<TravelMode>("flight");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState(todayLocal());
  const [returnDate, setReturnDate] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [cabin, setCabin] = useState<"economy" | "premium" | "business">("economy");
  const [baseFare, setBaseFare] = useState("");
  const [fareInputs, setFareInputs] = useState<Record<string, string>>({});
  const [amazonCb, setAmazonCb] = useState("");
  const [offerOverrides, setOfferOverrides] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<TravelSolution | null>(null);
  const [showAlts, setShowAlts] = useState(false);

  const grid = useMemo(() => defaultFareGrid(mode), [mode]);

  // Reset fare grid keys when mode changes
  const onMode = (m: TravelMode) => {
    setMode(m);
    setFareInputs({});
    setSelected(null);
    setShowAlts(false);
  };

  const trip: TravelTripInput = useMemo(() => {
    const fares: Record<string, number> = {};
    for (const [id, raw] of Object.entries(fareInputs)) {
      const n = Number((raw || "").replace(/[^0-9.]/g, ""));
      if (n > 0) fares[id] = n;
    }
    const base = Number((baseFare || "").replace(/[^0-9.]/g, "")) || undefined;
    const offerDiscountOverrides: Record<string, number> = {};
    for (const [id, raw] of Object.entries(offerOverrides)) {
      const n = Number((raw || "").replace(/[^0-9.]/g, ""));
      if (n > 0) offerDiscountOverrides[id] = n;
    }
    return {
      mode,
      origin: origin.trim(),
      destination: destination.trim(),
      date: localDateToISO(date),
      returnDate: returnDate ? localDateToISO(returnDate) : undefined,
      adults: Math.max(1, adults),
      children: Math.max(0, children),
      cabin: mode === "flight" ? cabin : undefined,
      baseFareInr: base,
      fares: Object.keys(fares).length ? fares : undefined,
      amazonOrderCashbackInr: Number((amazonCb || "").replace(/[^0-9.]/g, "")) || undefined,
      offerDiscountOverrides: Object.keys(offerDiscountOverrides).length ? offerDiscountOverrides : undefined,
      today: localDateToISO(todayLocal()),
    };
  }, [mode, origin, destination, date, returnDate, adults, children, cabin, baseFare, fareInputs, amazonCb, offerOverrides]);

  const stateExtras = useMemo(() => {
    const st = loadState();
    const bridge = buildRecommendInputFromState(st, {
      merchant: "travel",
      category: mode === "flight" ? "flight booking" : mode === "train" ? "train booking" : "bus booking",
      amount: 1000,
      channel: "online",
      today: trip.today,
    });
    // Strip merchant/amount — rankTravel sets those per platform
    const {
      merchant: _m,
      category: _c,
      amount: _a,
      channel: _ch,
      ...rest
    } = bridge;
    return rest;
  }, [mode, trip.today]);

  const result = useMemo(() => rankTravel(trip, stateExtras), [trip, stateExtras]);
  const best = result.best;
  const routeToLog = selected ?? best;
  const hasFares = (best.fareInr > 0 || (result.alternatives?.length ?? 0) > 0) && best.platformId !== "none";

  const volatileOffers = useMemo(
    () =>
      TRAVEL_OFFERS.filter((o) => {
        const modes = Array.isArray(o.mode) ? o.mode : [o.mode];
        return o.confidence === "volatile" && modes.includes(mode);
      }),
    [mode]
  );

  const onLog = () => {
    if (!hasFares || routeToLog.platformId === "none") return;
    const st = loadState();
    const t: Transaction = {
      id: newId(),
      date: trip.date || localDateToISO(todayLocal()),
      merchant: `${routeToLog.platformLabel}: ${trip.origin} → ${trip.destination}`,
      category:
        mode === "flight" ? "flight booking" : mode === "train" ? "train booking" : "bus booking",
      amount: routeToLog.fareInr,
      channel: "online",
      cardId: routeToLog.cardId,
      path: /cashkaro/i.test(routeToLog.cardLabel) ? "cashkaro" : "direct",
      effectivePct: routeToLog.allInPct,
      rewardInr: routeToLog.cardRewardInr + routeToLog.offerDiscountInr,
      notes: `Travel all-in net ${inr(routeToLog.netInr)} · ${routeToLog.cardLabel}`,
    };
    addTransaction(t);
    const next: AppState = { ...st };
    applyCardSpend(
      next,
      routeToLog.cardId,
      routeToLog.fareInr,
      routeToLog.cardRewardInr,
      routeToLog.cardEffectivePct,
      t.category,
      t.merchant
    );
    saveState(next);
    toast(`Logged ${inr(routeToLog.fareInr)} via ${routeToLog.platformLabel}`, "success");
    onLogged?.();
  };

  return (
    <div className="space-y-4">
      <div className="card-shell bg-gradient-to-br from-info/10 via-bg-elevated to-bg-elevated border-info/30">
        <div className="card-header">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-info/20 flex items-center justify-center text-info">
              <Icon.Plane size={20} />
            </div>
            <div>
              <div className="font-semibold text-base">Travel assistant</div>
              <div className="text-xs text-fg-muted mt-0.5">
                Compare platforms all-in (fare − Instant Discount − card / Cashkaro) — then pay the winner.
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Mode tabs */}
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  mode === m.id
                    ? "border-accent bg-accent/15 text-fg font-medium"
                    : "border-border text-fg-muted hover:border-accent/50"
                }`}
                onClick={() => onMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label mb-1 block">From</label>
              <input
                className="input"
                placeholder={mode === "flight" ? "BLR / Bengaluru" : mode === "train" ? "SBC / Bengaluru" : "City"}
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
              />
            </div>
            <div>
              <label className="label mb-1 block">To</label>
              <input
                className="input"
                placeholder={mode === "flight" ? "DEL / Delhi" : mode === "train" ? "NDLS / Delhi" : "City"}
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
              />
            </div>
            <div>
              <label className="label mb-1 block">Date</label>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            {mode === "flight" && (
              <div>
                <label className="label mb-1 block">Return (optional)</label>
                <input className="input" type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label mb-1 block">Adults</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={adults}
                  onChange={(e) => setAdults(Number(e.target.value) || 1)}
                />
              </div>
              <div>
                <label className="label mb-1 block">Children</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  value={children}
                  onChange={(e) => setChildren(Number(e.target.value) || 0)}
                />
              </div>
            </div>
            {mode === "flight" && (
              <div>
                <label className="label mb-1 block">Cabin</label>
                <select className="input" value={cabin} onChange={(e) => setCabin(e.target.value as typeof cabin)}>
                  <option value="economy">Economy</option>
                  <option value="premium">Premium economy</option>
                  <option value="business">Business</option>
                </select>
              </div>
            )}
          </div>

          <Callout tone="info" title="Fares (hybrid — you paste what you see)">
            We don&apos;t scrape OTAs. Enter a <b>base fare</b> (shared inventory) and/or per-platform totals.
            Ranking uses fare − Instant Discount − Recommend card/Cashkaro stacks.
          </Callout>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label mb-1 block">Base fare ₹ (optional)</label>
              <input
                className="input"
                inputMode="decimal"
                placeholder="e.g. 4500 — applied to platforms without their own fare"
                value={baseFare}
                onChange={(e) => setBaseFare(e.target.value)}
              />
            </div>
            {(mode === "flight" || mode === "train" || mode === "bus") && (
              <div>
                <label className="label mb-1 block">Amazon extra checkout cashback ₹</label>
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder="First-booking / wallet offer if shown"
                  value={amazonCb}
                  onChange={(e) => setAmazonCb(e.target.value)}
                />
              </div>
            )}
          </div>

          <div>
            <div className="label mb-2">Platform fares ₹</div>
            <div className="grid sm:grid-cols-2 gap-2">
              {grid.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <span className={`text-xs w-40 shrink-0 ${p.primary ? "text-fg font-medium" : "text-fg-muted"}`}>
                    {p.label}
                  </span>
                  <input
                    className="input"
                    inputMode="decimal"
                    placeholder={baseFare ? "override / blank = base" : "fare ₹"}
                    value={fareInputs[p.id] ?? ""}
                    onChange={(e) => setFareInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>

          {volatileOffers.length > 0 && (
            <div>
              <div className="label mb-2">Live Instant Discount overrides (optional)</div>
              <div className="grid sm:grid-cols-2 gap-2">
                {volatileOffers.map((o) => (
                  <div key={o.id}>
                    <div className="text-xs text-fg-muted mb-1">{o.label}</div>
                    <input
                      className="input"
                      inputMode="decimal"
                      placeholder="Live ID ₹ at checkout"
                      value={offerOverrides[o.id] ?? ""}
                      onChange={(e) => setOfferOverrides((prev) => ({ ...prev, [o.id]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {hasFares && (
        <div className="card-shell space-y-4 p-4">
          <div className="text-xs text-fg-muted">{result.tripSummary}</div>

          {result.warnings.length > 0 && (
            <Callout tone="warning" title="Notes">
              <ul className="list-disc pl-4 space-y-0.5 text-sm">
                {result.warnings.slice(0, 6).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </Callout>
          )}

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <div className="label">Best complete solution</div>
              <div className="text-2xl font-bold mt-1">{routeToLog.platformLabel}</div>
              <div className="text-sm text-accent font-medium mt-1">{routeToLog.cardLabel}</div>
              {routeToLog.offerLabel && routeToLog.offerDiscountInr > 0 && (
                <div className="text-xs text-fg-muted mt-1">
                  + {routeToLog.offerLabel}: −{inr(routeToLog.offerDiscountInr)}
                </div>
              )}
            </div>
            <div className="text-left sm:text-right">
              <div className="label">Net all-in cost</div>
              <div className="text-2xl sm:text-3xl font-bold text-success">{inr(routeToLog.netInr)}</div>
              <div className="text-xs text-fg-muted">
                Fare {inr(routeToLog.fareInr)}
                {routeToLog.offerDiscountInr > 0 ? ` − ID ${inr(routeToLog.offerDiscountInr)}` : ""}
                {` − rewards ${inr(routeToLog.cardRewardInr)}`} · value {routeToLog.allInPct.toFixed(2)}%
              </div>
            </div>
          </div>

          {routeToLog.steps.length > 0 && (
            <div className="bg-bg-chrome rounded-lg p-4 border border-border">
              <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Icon.ArrowRight size={16} className="text-accent" />
                Checkout steps
              </div>
              <ol className="space-y-2 text-sm">
                {routeToLog.steps.map((step, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
              {routeToLog.url && (
                <a
                  href={routeToLog.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 text-sm text-accent hover:underline"
                >
                  Open {routeToLog.platformLabel} →
                </a>
              )}
            </div>
          )}

          <div>
            <div className="label">Why this stack</div>
            <div className="text-sm text-fg-muted mt-0.5 leading-relaxed">{routeToLog.rationale}</div>
          </div>

          {routeToLog.pros.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {routeToLog.pros.map((p, i) => (
                <span key={i} className="pill-success text-xs">
                  {p}
                </span>
              ))}
            </div>
          )}

          {routeToLog.cons.filter(Boolean).length > 0 && (
            <Callout tone="warning" title="Watch out for">
              <ul className="list-disc pl-4 space-y-0.5">
                {routeToLog.cons.filter(Boolean).map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </Callout>
          )}

          {routeToLog.ifCardNotAllowed && (
            <div className="rounded-lg p-4 border border-border bg-bg-chrome/60">
              <div className="text-sm font-semibold mb-1">If card not allowed</div>
              <div className="text-sm text-accent font-medium">{routeToLog.ifCardNotAllowed.label}</div>
              <div className="text-xs text-fg-muted mt-1">{routeToLog.ifCardNotAllowed.rationale}</div>
            </div>
          )}

          {routeToLog.ifAmexNotAccepted && (
            <div className="rounded-lg p-4 border border-warning/40 bg-warning/5">
              <div className="text-sm font-semibold mb-1">If Amex not accepted</div>
              <div className="text-sm text-accent font-medium">{routeToLog.ifAmexNotAccepted.label}</div>
              <div className="text-xs text-fg-muted mt-1">{routeToLog.ifAmexNotAccepted.rationale}</div>
            </div>
          )}

          {result.alternatives.length > 0 && (
            <div className="border-t border-border pt-3">
              <button
                className="text-sm text-fg-muted hover:text-fg flex items-center gap-1.5"
                onClick={() => setShowAlts((v) => !v)}
                type="button"
              >
                <Icon.ArrowRight size={14} className={showAlts ? "rotate-90 transition-transform" : "transition-transform"} />
                {showAlts ? "Hide" : "Other complete solutions"} ({result.alternatives.length})
              </button>
              {showAlts && (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-sm border-separate border-spacing-y-1">
                    <thead className="text-fg-muted text-[11px] uppercase tracking-wide">
                      <tr>
                        <th className="text-left font-medium px-2 w-8">#</th>
                        <th className="text-left font-medium px-2">Platform</th>
                        <th className="text-left font-medium px-2">Pay with</th>
                        <th className="text-right font-medium px-2">Net</th>
                        <th className="text-right font-medium px-2">Pick</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.alternatives.map((a, i) => (
                        <tr
                          key={`${a.platformId}-${a.cardId}-${i}`}
                          className={`align-top ${selected === a ? "bg-accent/10" : ""}`}
                        >
                          <td className="px-2 py-2 text-fg-muted">{i + 2}</td>
                          <td className="px-2 py-2 font-medium">{a.platformLabel}</td>
                          <td className="px-2 py-2 text-xs text-fg-muted">
                            {routeName(a.cardId)} · {a.cardEffectivePct.toFixed(1)}%
                            {a.offerDiscountInr > 0 ? ` · ID −${inr(a.offerDiscountInr)}` : ""}
                          </td>
                          <td className="px-2 py-2 text-right font-semibold whitespace-nowrap">{inr(a.netInr)}</td>
                          <td className="px-2 py-2 text-right">
                            <button type="button" className="text-xs text-accent hover:underline" onClick={() => setSelected(a)}>
                              Select
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              className="btn-secondary"
              type="button"
              onClick={() => {
                setSelected(null);
                setFareInputs({});
                setBaseFare("");
                setAmazonCb("");
                setOfferOverrides({});
              }}
            >
              Clear fares
            </button>
            <button className="btn-primary" type="button" onClick={onLog}>
              <Icon.Plus size={16} /> Log this booking
            </button>
          </div>
        </div>
      )}

      {!hasFares && (
        <div className="text-sm text-fg-muted text-center py-6 border border-dashed border-border rounded-lg">
          Enter origin / destination and at least one fare (base or platform) to rank complete solutions.
        </div>
      )}
    </div>
  );
}
