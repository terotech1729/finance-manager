"use client";

import { useMemo, useState } from "react";
import { loadState, addTransaction, saveState, type AppState } from "@/lib/storage";
import { buildRecommendInputFromState } from "@/lib/recommendInput";
import { applyCardSpend } from "@/lib/spendTracking";
import { rankTravel } from "@/lib/travel/rankTravel";
import { TRAVEL_OFFERS } from "@/lib/travel/offers";
import { getPlatformById } from "@/lib/travel/platforms";
import { placeLabel, type TravelPlace } from "@/lib/travel/places";
import type { FareDiscoveryResult } from "@/lib/travel/fareDiscover";
import type { TravelMode, TravelSolution, TravelTripInput } from "@/lib/travel/types";
import { inr, newId, todayLocal, localDateToISO } from "@/lib/utils";
import { getCardById } from "@/lib/cards";
import type { Transaction } from "@/lib/types";
import { toast } from "./Toast";
import { Icon } from "./Icons";
import { Callout } from "./Callout";
import { PlaceTypeahead } from "./PlaceTypeahead";

function routeName(cardId: string): string {
  const c = getCardById(cardId);
  if (c) return c.short;
  if (cardId === "upi") return "UPI";
  if (cardId === "yes_kiwi") return "Kiwi";
  if (cardId === "amazon_pay_icici") return "Amazon Pay ICICI";
  return cardId;
}

const MODES: { id: TravelMode; label: string; hint: string }[] = [
  { id: "flight", label: "Flights", hint: "Airports" },
  { id: "train", label: "Trains", hint: "Stations" },
  { id: "bus", label: "Buses", hint: "Cities" },
];

type Props = { onLogged?: () => void };

export function TravelAssistant({ onLogged }: Props) {
  const [mode, setMode] = useState<TravelMode>("flight");
  const [origin, setOrigin] = useState<TravelPlace | null>(null);
  const [destination, setDestination] = useState<TravelPlace | null>(null);
  const [date, setDate] = useState(todayLocal());
  const [returnDate, setReturnDate] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [cabin, setCabin] = useState<"economy" | "premium" | "business">("economy");
  const [marketOverride, setMarketOverride] = useState("");
  const [indigoVoucher, setIndigoVoucher] = useState("");
  const [offerOverrides, setOfferOverrides] = useState<Record<string, string>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [searching, setSearching] = useState(false);
  const [discovery, setDiscovery] = useState<FareDiscoveryResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TravelSolution | null>(null);
  const [showAlts, setShowAlts] = useState(true);

  const onMode = (m: TravelMode) => {
    setMode(m);
    setOrigin(null);
    setDestination(null);
    setDiscovery(null);
    setSelected(null);
    setSearchError(null);
  };

  const swapOd = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  const stateExtras = useMemo(() => {
    const st = loadState();
    const bridge = buildRecommendInputFromState(st, {
      merchant: "travel",
      category: mode === "flight" ? "flight booking" : mode === "train" ? "train booking" : "bus booking",
      amount: 1000,
      channel: "online",
      today: localDateToISO(todayLocal()),
    });
    const { merchant: _m, category: _c, amount: _a, channel: _ch, ...rest } = bridge;
    return rest;
  }, [mode]);

  const volatileOffers = useMemo(
    () =>
      TRAVEL_OFFERS.filter((o) => {
        const modes = Array.isArray(o.mode) ? o.mode : [o.mode];
        return o.confidence === "volatile" && modes.includes(mode);
      }),
    [mode]
  );

  const runSearch = async () => {
    if (!origin || !destination) {
      toast("Pick origin and destination from the suggestions", "error");
      return;
    }
    setSearching(true);
    setSearchError(null);
    setSelected(null);
    try {
      const offerDiscountOverrides: Record<string, number> = {};
      for (const [id, raw] of Object.entries(offerOverrides)) {
        const n = Number((raw || "").replace(/[^0-9.]/g, ""));
        if (n > 0) offerDiscountOverrides[id] = n;
      }
      const override = Number((marketOverride || "").replace(/[^0-9.]/g, "")) || undefined;
      const body: TravelTripInput = {
        mode,
        origin: placeLabel(origin),
        destination: placeLabel(destination),
        date: localDateToISO(date),
        returnDate: returnDate ? localDateToISO(returnDate) : undefined,
        adults: Math.max(1, adults),
        children: Math.max(0, children),
        cabin: mode === "flight" ? cabin : undefined,
        baseFareInr: override,
        indigoBluChipVoucherInr: Number((indigoVoucher || "").replace(/[^0-9.]/g, "")) || undefined,
        offerDiscountOverrides: Object.keys(offerDiscountOverrides).length ? offerDiscountOverrides : undefined,
        today: localDateToISO(todayLocal()),
      };
      const res = await fetch("/api/travel/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setDiscovery(data as FareDiscoveryResult);
    } catch (e) {
      setDiscovery(null);
      setSearchError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const tripForRank: TravelTripInput | null = useMemo(() => {
    if (!discovery) return null;
    const offerDiscountOverrides: Record<string, number> = {};
    for (const [id, raw] of Object.entries(offerOverrides)) {
      const n = Number((raw || "").replace(/[^0-9.]/g, ""));
      if (n > 0) offerDiscountOverrides[id] = n;
    }
    return {
      mode: discovery.mode,
      origin: placeLabel(discovery.origin),
      destination: placeLabel(discovery.destination),
      date: localDateToISO(date),
      returnDate: returnDate ? localDateToISO(returnDate) : undefined,
      adults: Math.max(1, adults),
      children: Math.max(0, children),
      cabin: mode === "flight" ? cabin : undefined,
      fares: discovery.fares,
      indigoBluChipVoucherInr: Number((indigoVoucher || "").replace(/[^0-9.]/g, "")) || undefined,
      offerDiscountOverrides: Object.keys(offerDiscountOverrides).length ? offerDiscountOverrides : undefined,
      today: localDateToISO(todayLocal()),
    };
  }, [discovery, date, returnDate, adults, children, cabin, mode, offerOverrides, indigoVoucher]);

  const result = useMemo(
    () => (tripForRank ? rankTravel(tripForRank, stateExtras) : null),
    [tripForRank, stateExtras]
  );

  const best = result?.best;
  const routeToLog = selected ?? best;
  const hasResults = Boolean(result && best && best.platformId !== "none");

  const onLog = () => {
    if (!hasResults || !routeToLog || !tripForRank) return;
    const st = loadState();
    const t: Transaction = {
      id: newId(),
      date: tripForRank.date || localDateToISO(todayLocal()),
      merchant: `${routeToLog.platformLabel}: ${tripForRank.origin} → ${tripForRank.destination}`,
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

  const solutions = hasResults && result ? [result.best, ...result.alternatives] : [];

  return (
    <div className="space-y-5">
      {/* Search shell — booking-platform style */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[#0f172a] via-[#111827] to-[#0b1220]">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(700px 280px at 10% 0%, rgba(59,130,246,0.35), transparent 55%), radial-gradient(500px 240px at 90% 20%, rgba(16,185,129,0.18), transparent 50%)",
          }}
        />
        <div className="relative p-4 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-sky-300/80">Search &amp; save</div>
              <h2 className="text-xl sm:text-2xl font-semibold text-white mt-1">Book the lowest all-in trip</h2>
              <p className="text-sm text-slate-300/90 mt-1 max-w-xl">
                We pull market fares, apply Instant Discount + your card / Cashkaro stacks, and tell you where to checkout.
              </p>
            </div>
          </div>

          <div className="inline-flex rounded-full bg-black/30 p-1 border border-white/10">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`px-4 py-2 rounded-full text-sm transition-colors ${
                  mode === m.id ? "bg-white text-slate-900 font-semibold" : "text-slate-300 hover:text-white"
                }`}
                onClick={() => onMode(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 sm:p-4 backdrop-blur-sm">
            <div className="grid lg:grid-cols-[1fr_auto_1fr_1fr_1fr] gap-3 items-end">
              <PlaceTypeahead
                mode={mode}
                label="From"
                placeholder={mode === "flight" ? "City or airport" : mode === "train" ? "Station or city" : "City"}
                value={origin}
                onChange={setOrigin}
                excludeId={destination?.id}
              />
              <button
                type="button"
                className="hidden lg:inline-flex mb-1 h-10 w-10 items-center justify-center rounded-full border border-white/15 text-slate-200 hover:bg-white/10"
                onClick={swapOd}
                title="Swap"
                aria-label="Swap origin and destination"
              >
                ⇄
              </button>
              <PlaceTypeahead
                mode={mode}
                label="To"
                placeholder={mode === "flight" ? "City or airport" : mode === "train" ? "Station or city" : "City"}
                value={destination}
                onChange={setDestination}
                excludeId={origin?.id}
              />
              <div>
                <label className="label mb-1 block text-slate-400">Depart</label>
                <input className="input bg-black/20 border-white/15" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              {mode === "flight" ? (
                <div>
                  <label className="label mb-1 block text-slate-400">Return</label>
                  <input
                    className="input bg-black/20 border-white/15"
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
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
                  <div>
                    <label className="label mb-1 block text-slate-400">Kids</label>
                    <input
                      className="input bg-black/20 border-white/15"
                      type="number"
                      min={0}
                      value={children}
                      onChange={(e) => setChildren(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>
              )}
            </div>

            {mode === "flight" && (
              <div className="grid sm:grid-cols-3 gap-3 mt-3">
                <div className="grid grid-cols-2 gap-2">
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
                  <div>
                    <label className="label mb-1 block text-slate-400">Kids</label>
                    <input
                      className="input bg-black/20 border-white/15"
                      type="number"
                      min={0}
                      value={children}
                      onChange={(e) => setChildren(Number(e.target.value) || 0)}
                    />
                  </div>
                </div>
                <div>
                  <label className="label mb-1 block text-slate-400">Cabin</label>
                  <select
                    className="input bg-black/20 border-white/15"
                    value={cabin}
                    onChange={(e) => setCabin(e.target.value as typeof cabin)}
                  >
                    <option value="economy">Economy</option>
                    <option value="premium">Premium economy</option>
                    <option value="business">Business</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <button type="button" className="btn-primary w-full h-[42px]" onClick={runSearch} disabled={searching}>
                    <Icon.Search size={16} />
                    {searching ? "Searching…" : "Search best all-in"}
                  </button>
                </div>
              </div>
            )}

            {mode !== "flight" && (
              <div className="mt-3 flex justify-end">
                <button type="button" className="btn-primary min-w-[200px]" onClick={runSearch} disabled={searching}>
                  <Icon.Search size={16} />
                  {searching ? "Searching…" : "Search best all-in"}
                </button>
              </div>
            )}

            <div className="mt-3">
              <button
                type="button"
                className="text-xs text-slate-400 hover:text-slate-200"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? "Hide" : "Advanced"} · market fare override / BluChip voucher / Instant Discount
              </button>
              {showAdvanced && (
                <div className="mt-3 grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label mb-1 block text-slate-400">Market fare override ₹ (optional)</label>
                    <input
                      className="input bg-black/20 border-white/15"
                      inputMode="decimal"
                      placeholder="Only if you already know the sticker fare"
                      value={marketOverride}
                      onChange={(e) => setMarketOverride(e.target.value)}
                    />
                  </div>
                  {mode === "flight" && (
                    <div>
                      <label className="label mb-1 block text-slate-400">IndiGo BluChip voucher ₹</label>
                      <input
                        className="input bg-black/20 border-white/15"
                        inputMode="decimal"
                        placeholder="e.g. 5000 from IDFC milestone"
                        value={indigoVoucher}
                        onChange={(e) => setIndigoVoucher(e.target.value)}
                      />
                    </div>
                  )}
                  {volatileOffers.map((o) => (
                    <div key={o.id}>
                      <label className="label mb-1 block text-slate-400">{o.label}</label>
                      <input
                        className="input bg-black/20 border-white/15"
                        inputMode="decimal"
                        placeholder="Live Instant Discount ₹"
                        value={offerOverrides[o.id] ?? ""}
                        onChange={(e) => setOfferOverrides((prev) => ({ ...prev, [o.id]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {searchError && (
        <Callout tone="danger" title="Couldn’t search">
          {searchError}
        </Callout>
      )}

      {searching && (
        <div className="card-shell p-8 text-center text-fg-muted text-sm animate-pulse">
          Finding fares across platforms and ranking all-in stacks…
        </div>
      )}

      {hasResults && result && routeToLog && discovery && !searching && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="text-sm text-fg-muted">{discovery.summary}</div>
              <div className="text-xs text-fg-muted mt-0.5">
                Fare source:{" "}
                {discovery.marketSource === "travelpayouts"
                  ? "live flight calendar"
                  : "route estimate"}{" "}
                · ranked by net ₹ after rewards
              </div>
            </div>
            <button type="button" className="btn-secondary text-sm" onClick={runSearch}>
              Refresh search
            </button>
          </div>

          {(result.warnings.length > 0 || discovery.warnings.length > 0) && (
            <Callout tone="info" title="How fares were built">
              <ul className="list-disc pl-4 space-y-0.5 text-sm">
                {[...discovery.warnings, ...result.warnings].slice(0, 5).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </Callout>
          )}

          {/* Winner */}
          <div className="card-shell border-accent/40 bg-gradient-to-br from-accent/10 via-bg-elevated to-bg-elevated p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-accent font-semibold">Best all-in</div>
                <div className="text-2xl font-bold mt-1">{routeToLog.platformLabel}</div>
                <div className="text-sm text-fg-muted mt-1">Pay with {routeToLog.cardLabel}</div>
                {routeToLog.offerLabel && routeToLog.offerDiscountInr > 0 && (
                  <div className="text-xs text-success mt-1">
                    {routeToLog.offerLabel}: −{inr(routeToLog.offerDiscountInr)}
                  </div>
                )}
              </div>
              <div className="text-left sm:text-right">
                <div className="text-xs text-fg-muted uppercase tracking-wide">You effectively pay</div>
                <div className="text-3xl font-bold text-success mt-1">{inr(routeToLog.netInr)}</div>
                <div className="text-xs text-fg-muted mt-1">
                  Sticker {inr(routeToLog.fareInr)}
                  {routeToLog.offerDiscountInr > 0 ? ` − ID ${inr(routeToLog.offerDiscountInr)}` : ""}
                  {` − rewards ${inr(routeToLog.cardRewardInr)}`}
                </div>
              </div>
            </div>

            {routeToLog.steps.length > 0 && (
              <div className="mt-4 rounded-lg border border-border bg-bg-chrome/70 p-4">
                <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Icon.ArrowRight size={16} className="text-accent" />
                  Checkout
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
                {(routeToLog.url || discovery.quotes.find((q) => q.platformId === routeToLog.platformId)?.deepLink) && (
                  <a
                    href={
                      discovery.quotes.find((q) => q.platformId === routeToLog.platformId)?.deepLink ||
                      routeToLog.url
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex mt-4 btn-primary"
                  >
                    Open {routeToLog.platformLabel} →
                  </a>
                )}
              </div>
            )}

            {(routeToLog.ifCardNotAllowed || routeToLog.ifAmexNotAccepted) && (
              <div className="mt-3 grid sm:grid-cols-2 gap-3">
                {routeToLog.ifCardNotAllowed && (
                  <div className="rounded-lg p-3 border border-border bg-bg-chrome/60">
                    <div className="text-xs font-semibold uppercase text-fg-muted">If card not allowed</div>
                    <div className="text-sm text-accent font-medium mt-1">{routeToLog.ifCardNotAllowed.label}</div>
                  </div>
                )}
                {routeToLog.ifAmexNotAccepted && (
                  <div className="rounded-lg p-3 border border-warning/40 bg-warning/5">
                    <div className="text-xs font-semibold uppercase text-fg-muted">If Amex not accepted</div>
                    <div className="text-sm text-accent font-medium mt-1">{routeToLog.ifAmexNotAccepted.label}</div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button className="btn-secondary" type="button" onClick={onLog}>
                <Icon.Plus size={16} /> Log this booking
              </button>
            </div>
          </div>

          {/* Ranked list */}
          <div className="card-shell overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 border-b border-border text-left"
              onClick={() => setShowAlts((v) => !v)}
            >
              <span className="font-semibold text-sm">All platforms · ranked by net cost</span>
              <span className="text-xs text-fg-muted">{showAlts ? "Hide" : "Show"} · {solutions.length}</span>
            </button>
            {showAlts && (
              <div className="divide-y divide-border">
                {solutions.map((s, i) => {
                  const q = discovery.quotes.find((x) => x.platformId === s.platformId);
                  const platform = getPlatformById(s.platformId);
                  const active = (selected ?? best) === s || (!selected && i === 0);
                  return (
                    <div
                      key={`${s.platformId}-${s.cardId}-${i}`}
                      className={`p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${active ? "bg-accent/5" : ""}`}
                    >
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-bg-chrome border border-border flex items-center justify-center text-xs font-bold text-fg-muted shrink-0">
                          {i + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{s.platformLabel}</div>
                          <div className="text-xs text-fg-muted mt-0.5">
                            Sticker {inr(s.fareInr)} · {routeName(s.cardId)} {s.cardEffectivePct.toFixed(1)}%
                            {s.offerDiscountInr > 0 ? ` · ID −${inr(s.offerDiscountInr)}` : ""}
                          </div>
                          {platform?.notes && <div className="text-[11px] text-fg-muted mt-1">{platform.notes}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 sm:justify-end shrink-0">
                        <div className="text-right">
                          <div className="text-lg font-bold text-success">{inr(s.netInr)}</div>
                          <div className="text-[11px] text-fg-muted">net all-in</div>
                        </div>
                        <button type="button" className="btn-secondary text-xs px-3" onClick={() => setSelected(s)}>
                          Select
                        </button>
                        {(q?.deepLink || s.url) && (
                          <a
                            href={q?.deepLink || s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-primary text-xs px-3"
                          >
                            Book
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {!hasResults && !searching && !searchError && (
        <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
          <div className="text-fg font-medium">Search a route to compare platforms</div>
          <div className="text-sm text-fg-muted mt-1 max-w-md mx-auto">
            Pick From / To (suggestions appear as you type), set the date, then hit Search — we find fares and rank the cheapest all-in checkout.
          </div>
        </div>
      )}
    </div>
  );
}
