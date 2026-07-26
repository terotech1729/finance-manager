"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { recommend, type RecommendInput } from "@/lib/recommend";
import { detectCategory, ALL_CATEGORIES, ALL_CHANNELS, type ChannelType } from "@/lib/categorize";
import { findWelcomeOffer } from "@/lib/stacking";
import { addTransaction, loadState, loadTransactions, saveState, type AppState } from "@/lib/storage";
import { applyCardSpend } from "@/lib/spendTracking";
import { toast } from "./Toast";
import { getCardById } from "@/lib/cards";

function routeName(cardId: string): string {
  const c = getCardById(cardId);
  if (c) return c.short;
  if (cardId === "giftcard") return "Gift-card route";
  if (cardId === "upi") return "UPI (PhonePe/GPay)";
  if (cardId === "cash") return "Cash";
  if (cardId === "amazon_pay_balance") return "Amazon Pay balance";
  return cardId;
}
import { inr, newId, todayLocal, localDateToISO } from "@/lib/utils";
import type { Transaction, RouteOption } from "@/lib/types";
import { Icon } from "./Icons";
import { Callout } from "./Callout";

type Props = {
  onLogged?: () => void;
};

export function RecommendationWidget({ onLogged }: Props) {
  const [state, setStateLocal] = useState<AppState | null>(null);
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => todayLocal());
  const [clarificationAnswer, setClarificationAnswer] = useState<string | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [overrideCategory, setOverrideCategory] = useState<string>("");
  const [overrideChannel, setOverrideChannel] = useState<ChannelType | "">("");
  const [cashkaroOverride, setCashkaroOverride] = useState<string>("");
  const [amazonOrderCashback, setAmazonOrderCashback] = useState<string>("");
  const [movieTheatre, setMovieTheatre] = useState<"pvr" | "cinepolis" | "inox" | "other" | "">("");
  const [credGiftCardPct, setCredGiftCardPct] = useState<string>("");
  const [showAlts, setShowAlts] = useState(false);
  /** Which ranked route to log — 0 = best, 1+ = alternatives index + 1 conceptually; we store the route itself. */
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);

  useEffect(() => {
    // Always start from saved milestone counters (Milestones / Settings) — past truth for Recommend.
    setStateLocal(loadState());
  }, []);
  useEffect(() => {
    setClarificationAnswer(null);
    setMovieTheatre("");
    setCredGiftCardPct("");
    setCashkaroOverride("");
    setAmazonOrderCashback("");
    setSelectedRoute(null);
  }, [merchant]);

  const amt = Number((amount || "0").replace(/[^0-9.]/g, "")) || 0;
  const detection = useMemo(() => detectCategory(merchant), [merchant]);

  const finalCategory = overrideCategory ||
    (detection.clarification && clarificationAnswer
      ? detection.clarification.options.find((o) => o.value === clarificationAnswer)?.category ?? detection.category
      : detection.category);

  const finalChannel: ChannelType = (overrideChannel as ChannelType) ||
    (detection.clarification && clarificationAnswer
      ? detection.clarification.options.find((o) => o.value === clarificationAnswer)?.channel ?? detection.channel
      : detection.channel);

  useEffect(() => {
    setSelectedRoute(null);
  }, [finalCategory, amt, cashkaroOverride, amazonOrderCashback, credGiftCardPct, movieTheatre]);

  const needsClarification = !!detection.clarification && !clarificationAnswer && !overrideCategory;
  const merchantTooShort = merchant.trim().length < 2;
  const noAmount = !amt;

  const rec = useMemo(() => {
    if (!state || noAmount || merchantTooShort || needsClarification) return null;
    // Past first: re-read saved counters every ranking (edits on Milestones apply immediately).
    const fresh = loadState();
    const input: RecommendInput = {
      merchant: merchant.trim(),
      category: finalCategory,
      amount: amt,
      channel: finalChannel,
      isForeign: finalChannel === "foreign" || detection.forex,
      ptccEligibleSpend: fresh.ptccEligibleSpend,
      mrccCycleSpend: fresh.mrccCycleSpend,
      bobYtdSpend: fresh.bobYtdSpend,
      bobCycleSpend5x: fresh.bobCycleSpend5x,
      sbiYtdSpend: fresh.sbiYtdSpend,
      idfcYtdSpend: fresh.idfcYtdSpend,
      hsbcLivePlusYtdSpend: fresh.hsbcLivePlusYtdSpend,
      livePlusAccelCashbackUsedThisMonth: fresh.livePlusAccelCashbackUsedThisMonth,
      goldThisMonthTxnsAt1k: fresh.goldThisMonthTxnsAt1k,
      mrccThisCycleTxnsAt1500: fresh.mrccThisCycleTxnsAt1500,
      mrccThisCycleAmount: fresh.mrccThisCycleAmount,
      goldShopwiseUsedThisMonth: fresh.goldShopwiseUsedThisMonth,
      scapiaMonthlySpend: fresh.scapiaMonthlySpend,
      kiwiNeonCycleSpend: fresh.kiwiNeonCycleSpend,
      bobBogoUsedThisMonth: loadTransactions().some(
        (t) => t.cardId === "bob_eterna" && t.date.slice(0, 7) === date.slice(0, 7) &&
          (t.path === "district" || /district|bogo/i.test(`${t.merchant} ${t.category}`))
      ),
      amazonPayIciciIssued: fresh.amazonPayIciciIssued,
      primeMember: fresh.primeMember,
      amazonPayBalance: fresh.amazonPayBalance,
      amazonWelcomeClaimed: fresh.amazonWelcomeClaimed,
      giftCardRateOverrides: fresh.giftCardRateOverrides,
      cashkaroPctOverride: Number((cashkaroOverride || "").replace(/[^0-9.]/g, "")) || undefined,
      amazonOrderCashbackInr: Number((amazonOrderCashback || "").replace(/[^0-9.]/g, "")) || undefined,
      credGiftCardPctOverride: Number((credGiftCardPct || "").replace(/[^0-9.]/g, "")) || undefined,
      movieTheatre: movieTheatre || undefined,
      bobEternaIssueDate: fresh.bobEternaIssueDate,
      bobWelcomeUnlocked: fresh.bobWelcomeUnlocked,
      hsbcLivePlusIssueDate: fresh.hsbcLivePlusIssueDate,
      hsbcWelcomeClaimed: fresh.hsbcWelcomeClaimed,
      // Welcome progress = edited Live+ YTD (set on Milestones to your real ₹20k-window spend).
      hsbcLivePlusWelcomeSpend: fresh.hsbcLivePlusYtdSpend,
      today: localDateToISO(date),
    };
    return recommend(input);
  }, [merchant, finalCategory, amt, finalChannel, state, needsClarification, merchantTooShort, noAmount, detection.forex, date, cashkaroOverride, amazonOrderCashback, credGiftCardPct, movieTheatre]);

  const isAmazon = /amazon/i.test(merchant) || /amazon/i.test(finalCategory);
  const isMovie =
    /movie|event|bookmyshow|\bbms\b|district|pvr|inox|cinepolis|cinema/i.test(`${merchant} ${finalCategory}`);
  const isCredGcCandidate =
    isMovie ||
    /amazon|flipkart|myntra|ajio|nykaa|swiggy|zomato|cleartrip|croma|shopping|fashion|electronics|online/i.test(
      `${merchant} ${finalCategory}`
    );

  const credPctHint =
    movieTheatre === "cinepolis" ? "28" :
    movieTheatre === "pvr" || movieTheatre === "inox" ? "21" :
    isMovie ? "21–28" :
    "e.g. 5";

  const best = rec?.best;
  const alts = rec?.alternatives ?? [];
  const routeToLog = selectedRoute ?? best;

  const pathForRoute = (r: RouteOption): Transaction["path"] => {
    const l = r.label.toLowerCase();
    if (r.cardId === "giftcard" || l.includes("gift card")) return "dreamplug";
    if (l.includes("cashkaro")) return "cashkaro";
    if (l.includes("shopwise")) return "shopwise";
    if (l.includes("kiwi")) return "kiwi";
    if (l.includes("blck") || l.includes("hdfccc")) return "blck_coupon";
    // BOGO / District must set path=district so month-used detection works
    if (l.includes("district") || l.includes("bogo")) return "district";
    if (l.includes("amazon pay balance")) return "amazon_brand";
    return "direct";
  };

  const onLog = (route?: RouteOption) => {
    const chosen = route ?? routeToLog;
    if (!rec || !chosen || !state) return;
    const t: Transaction = {
      id: newId(),
      date: localDateToISO(date),
      merchant: merchant.trim() || finalCategory,
      category: finalCategory,
      amount: amt,
      channel: finalChannel,
      cardId: chosen.cardId,
      path: pathForRoute(chosen),
      effectivePct: chosen.effectivePct,
      rewardInr: chosen.totalRewardInr,
    };
    addTransaction(t);
    // Past counters are manual (Milestones) — bump them for this new spend, don't wipe from log.
    const next: AppState = { ...loadState() };
    applyCardSpend(next, chosen.cardId, amt, chosen.totalRewardInr, chosen.effectivePct);
    if (chosen.cardId === "amex_gold" && chosen.label.toLowerCase().includes("shopwise")) {
      next.goldShopwiseUsedThisMonth += amt;
    }
    if (chosen.cardId === "amazon_pay_icici" && chosen.label.toLowerCase().includes("balance")) {
      next.amazonPayBalance = Math.max(0, next.amazonPayBalance - Math.min(next.amazonPayBalance, amt));
    }
    if (chosen.cardId === "amazon_pay_icici" && chosen.label.toLowerCase().includes("welcome")) {
      const w = findWelcomeOffer(merchant.trim(), finalCategory, next.amazonWelcomeClaimed || []);
      if (w) next.amazonWelcomeClaimed = [...(next.amazonWelcomeClaimed || []), w.id];
    }
    setStateLocal(next);
    saveState(next);
    toast(`Logged ${inr(amt)} on ${routeName(chosen.cardId)} · ${inr(chosen.totalRewardInr)} reward`, "success");
    setAmount("");
    setMerchant("");
    setDate(todayLocal());
    setClarificationAnswer(null);
    setOverrideCategory("");
    setOverrideChannel("");
    setCashkaroOverride("");
    setAmazonOrderCashback("");
    setMovieTheatre("");
    setCredGiftCardPct("");
    setSelectedRoute(null);
    setShowOverride(false);
    setShowAlts(false);
    onLogged?.();
  };

  return (
    <div className="card-shell bg-gradient-to-br from-accent/10 via-bg-elevated to-bg-elevated border-accent/40 shadow-lg">
      <div className="card-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center text-accent">
            <Icon.Zap size={20} />
          </div>
          <div>
            <div className="font-semibold text-base">What are you about to spend on?</div>
            <div className="text-xs text-fg-muted mt-0.5">Just tell us the merchant + amount. We compare every route and pick the best.</div>
          </div>
        </div>
      </div>

      <div className="card-body space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_150px_auto] gap-3 items-stretch sm:items-end">
          <div className="min-w-0">
            <label className="label mb-1 block">What are you buying?</label>
            <input
              className="input"
              placeholder="e.g. Airtel, Amazon, Cleartrip…"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 sm:contents gap-3">
            <div className="min-w-0">
              <label className="label mb-1 block">Amount (₹)</label>
              <input
                className="input"
                placeholder="e.g. 899"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
              />
            </div>
            <div className="min-w-0">
              <label className="label mb-1 block">Date</label>
              <input
                type="date"
                className="input"
                value={date}
                max={todayLocal()}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="sm:self-end">
            <button className="btn-secondary text-sm w-full sm:w-auto whitespace-nowrap" onClick={() => setShowOverride((v) => !v)} type="button">
              {showOverride ? "Hide" : "Advanced ▾"}
            </button>
          </div>
        </div>
        {date !== todayLocal() && (
          <div className="text-xs text-warning">Back-dating to {new Date(`${date}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} — milestone/cycle counters still update from current state.</div>
        )}

        {merchant.trim().length >= 2 && (
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="text-fg-muted">Detected:</span>
            <span className="pill-info font-medium">{detection.prettyLabel}</span>
            <span className="text-fg-muted">·</span>
            <span className="pill-neutral text-xs">{ALL_CHANNELS.find((c) => c.value === finalChannel)?.label ?? finalChannel}</span>
            {detection.confidence === "low" && <span className="text-xs text-warning">(low confidence — using "general"; use Advanced to override)</span>}
          </div>
        )}

        {isAmazon && !merchantTooShort && (
          <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 border border-amber-300/60 dark:border-amber-700/40 space-y-2">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <Icon.Sparkles size={14} className="text-amber-600" />
              Amazon order — any extra offer at checkout?
            </div>
            <div className="text-xs text-fg-muted">
              Amazon shows order-level offers we can&apos;t see (e.g. <em>&quot;Cashback on orders above ₹1,398 → ₹200 to Amazon Pay Wallet&quot;</em>). The standard <b>5% Amazon Pay ICICI</b> cashback is already counted — only enter the <b>extra order cashback ₹</b> shown on the order/payment page. MRP discounts &amp; Prime delivery savings are the same on every card, so leave those out.
            </div>
            <div className="grid sm:grid-cols-[200px_1fr] gap-2 items-center">
              <input
                className="input"
                inputMode="numeric"
                placeholder="Extra cashback ₹ (e.g. 200)"
                value={amazonOrderCashback}
                onChange={(e) => setAmazonOrderCashback(e.target.value)}
              />
              <span className="text-xs text-fg-muted">Added to the Amazon Pay ICICI route (you bank it by paying via Amazon Pay).</span>
            </div>
          </div>
        )}

        {isMovie && !merchantTooShort && needsClarification && (
          <div className="text-xs text-fg-muted rounded-lg p-3 border border-dashed border-sky-300/60">
            Answer how many tickets above first — then pick the cinema chain and CRED gift-card % so we can rank BOGO vs CRED correctly.
          </div>
        )}

        {isMovie && !merchantTooShort && !needsClarification && (
          <div className="bg-sky-50 dark:bg-sky-950/20 rounded-lg p-3 border border-sky-300/60 dark:border-sky-700/40 space-y-3">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <Icon.Sparkles size={14} className="text-sky-600" />
              Cinema chain + CRED gift card?
            </div>
            <div className="text-xs text-fg-muted">
              CRED Store discounts differ by chain (often ~21% PVR, ~28% Cinepolis). On bigger bookings that % can beat BOB&apos;s District BOGO (₹250 cap). Pick the theatre, then enter the live % you see in CRED.
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                ["pvr", "PVR"],
                ["cinepolis", "Cinepolis"],
                ["inox", "INOX"],
                ["other", "Other / BMS only"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                    movieTheatre === value
                      ? "border-sky-500 bg-sky-100 dark:bg-sky-900/40 font-medium"
                      : "border-border hover:border-sky-400"
                  }`}
                  onClick={() => {
                    setMovieTheatre(value);
                    // Always refresh the chain default so switching PVR→Cinepolis updates 21→28
                    if (value === "cinepolis") setCredGiftCardPct("28");
                    else if (value === "pvr" || value === "inox") setCredGiftCardPct("21");
                    else setCredGiftCardPct("");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid sm:grid-cols-[180px_1fr] gap-2 items-center">
              <input
                className="input"
                inputMode="numeric"
                placeholder={`CRED GC % (e.g. ${credPctHint})`}
                value={credGiftCardPct}
                onChange={(e) => setCredGiftCardPct(e.target.value)}
              />
              <span className="text-xs text-fg-muted">
                Live % from CRED → Store. Leave blank to ignore the gift-card route.
              </span>
            </div>
          </div>
        )}

        {isCredGcCandidate && !isMovie && !merchantTooShort && (
          <div className="bg-sky-50 dark:bg-sky-950/20 rounded-lg p-3 border border-sky-300/60 dark:border-sky-700/40 space-y-2">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <Icon.Sparkles size={14} className="text-sky-600" />
              Buying via a CRED gift card?
            </div>
            <div className="text-xs text-fg-muted">
              If CRED Store has a discounted gift card for this brand, enter the live % — the recommender will rank that route against card + Cashkaro stacks.
            </div>
            <div className="grid sm:grid-cols-[180px_1fr] gap-2 items-center">
              <input
                className="input"
                inputMode="numeric"
                placeholder="CRED GC % (e.g. 5)"
                value={credGiftCardPct}
                onChange={(e) => setCredGiftCardPct(e.target.value)}
              />
              <span className="text-xs text-fg-muted">Leave blank if you&apos;re not using a CRED gift card.</span>
            </div>
          </div>
        )}

        {needsClarification && detection.clarification && (
          <div className="bg-bg-chrome rounded-lg p-3 border border-warning/40">
            <div className="text-sm font-semibold mb-2 flex items-center gap-1.5">
              <Icon.Sparkles size={14} className="text-warning" />
              {detection.clarification.question}
            </div>
            <div className="grid sm:grid-cols-3 gap-2">
              {detection.clarification.options.map((opt) => (
                <button key={opt.value} className="text-left p-2 rounded border border-border hover:border-accent hover:bg-bg-elevated transition-colors text-sm" onClick={() => setClarificationAnswer(opt.value)} type="button">
                  <div className="font-medium">{opt.label}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {showOverride && (
          <div className="bg-bg-chrome rounded-lg p-3 border border-border space-y-2">
            <div className="text-xs text-fg-muted">Override the auto-detected category and channel:</div>
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <label className="label mb-1 block">Category</label>
                <select className="input" value={overrideCategory} onChange={(e) => setOverrideCategory(e.target.value)}>
                  <option value="">— Use auto-detected —</option>
                  {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label mb-1 block">Payment channel</label>
                <select className="input" value={overrideChannel} onChange={(e) => setOverrideChannel(e.target.value as ChannelType | "")}>
                  <option value="">— Use auto-detected —</option>
                  {ALL_CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label mb-1 block">Live Cashkaro % (if you see a better rate)</label>
                <input
                  className="input"
                  inputMode="numeric"
                  placeholder="e.g. 7.5 (limited-time sale)"
                  value={cashkaroOverride}
                  onChange={(e) => setCashkaroOverride(e.target.value)}
                />
              </div>
              {!isCredGcCandidate && (
                <div>
                  <label className="label mb-1 block">CRED gift-card % (live)</label>
                  <input
                    className="input"
                    inputMode="numeric"
                    placeholder="e.g. 5"
                    value={credGiftCardPct}
                    onChange={(e) => setCredGiftCardPct(e.target.value)}
                  />
                </div>
              )}
            </div>
            <div className="text-xs text-fg-muted mt-2">Enter the actual Cashkaro rate you see on the merchant&apos;s Cashkaro page (limited-time sales aren&apos;t auto-detected) and the recommendation recalculates with it. Same for CRED Store gift-card discounts when the brand isn&apos;t auto-detected.</div>
          </div>
        )}

        {merchantTooShort && noAmount && (
          <div className="text-sm text-fg-muted text-center py-4 border border-dashed border-border rounded-lg">
            Type what you're buying (e.g. <em>Airtel recharge</em>, <em>Amazon</em>, <em>Cleartrip hotel</em>) and the amount.
          </div>
        )}

        {rec && best && routeToLog && (
          <div className="border-t-2 border-accent/30 pt-5 space-y-4">
            <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-start">
              <div>
                <div className="label text-success">
                  {selectedRoute && selectedRoute !== best ? "SELECTED ROUTE (not #1)" : "RECOMMENDED ROUTE"}
                </div>
                <div className="flex items-baseline gap-3 mt-1 flex-wrap">
                  <div className="text-2xl font-bold">{routeName(routeToLog.cardId)}</div>
                  <div className="text-sm text-fg-muted">{getCardById(routeToLog.cardId)?.name}</div>
                </div>
                <div className="text-sm font-medium text-accent mt-1">{routeToLog.label}</div>
                {selectedRoute && selectedRoute !== best && (
                  <button type="button" className="text-xs text-accent hover:underline mt-1" onClick={() => setSelectedRoute(null)}>
                    Reset to #1 recommendation
                  </button>
                )}
              </div>
              <div className="text-left sm:text-right shrink-0 w-full sm:w-auto">
                <div className="label">{rec.effectiveRange && routeToLog === best ? "Value (typical redemption)" : "Total value"}</div>
                <div className="text-2xl sm:text-3xl font-bold text-success">{routeToLog.effectivePct.toFixed(2)}%</div>
                <div className="text-xs text-fg-muted">≈ {inr(routeToLog.totalRewardInr)}{routeToLog.bonusRewardInr > 0 ? ` (${inr(routeToLog.baseRewardInr)} base + ${inr(routeToLog.bonusRewardInr)} milestone)` : ""}</div>
                {rec.effectiveRange && routeToLog === best && (
                  <div className="text-xs text-fg-muted mt-1">
                    Range <b className="text-fg">{rec.effectiveRange.worstPct.toFixed(2)}%</b>–<b className="text-success">{rec.effectiveRange.bestPct.toFixed(2)}%</b> by {rec.effectiveRange.currency.replace(/\s*\(.*\)/, "")} redemption
                    <Link href="/redemptions" className="text-accent hover:underline ml-1">details →</Link>
                  </div>
                )}
              </div>
            </div>

            {routeToLog.steps.length > 0 && (
              <div className="bg-bg-chrome rounded-lg p-4 border border-border">
                <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Icon.ArrowRight size={16} className="text-accent" />
                  Step-by-step: how to actually pay this
                </div>
                <ol className="space-y-2 text-sm">
                  {routeToLog.steps.map((step, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="shrink-0 w-5 h-5 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                      <span className="leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div>
              <div className="label">Why this card</div>
              <div className="text-sm text-fg-muted mt-0.5 leading-relaxed">{routeToLog.rationale}</div>
            </div>

            {routeToLog.pros.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {routeToLog.pros.map((p, i) => <span key={i} className="pill-success text-xs">{p}</span>)}
              </div>
            )}

            {routeToLog.cons.filter(Boolean).length > 0 && (
              <Callout tone="warning" title="Watch out for">
                <ul className="list-disc pl-4 space-y-0.5">
                  {routeToLog.cons.filter(Boolean).map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </Callout>
            )}

            {routeToLog.bestCasePct !== routeToLog.worstCasePct && (
              <div className="text-xs text-fg-muted">
                Range: <b className="text-fg">{routeToLog.worstCasePct.toFixed(2)}%</b> (worst, card reward only) → <b className="text-success">{routeToLog.bestCasePct.toFixed(2)}%</b> (best, full stack)
              </div>
            )}

            {rec.milestoneTip && (
              <div className="rounded-lg p-3 border border-info/40 bg-info-muted">
                <div className="flex items-start gap-2">
                  <Icon.Trophy size={16} className="text-info shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <span className="font-semibold text-info">Milestone tip — </span>
                    consider <b>{routeName(rec.milestoneTip.cardId)}</b> instead ({rec.milestoneTip.effectivePct.toFixed(2)}%): {rec.milestoneTip.note}
                  </div>
                </div>
              </div>
            )}

            {/* Alternatives — full ranked table with reasoning */}
            {alts.length > 0 && (
              <div className="border-t border-border pt-3">
                <button className="text-sm text-fg-muted hover:text-fg flex items-center gap-1.5" onClick={() => setShowAlts((v) => !v)} type="button">
                  <Icon.ArrowRight size={14} className={showAlts ? "rotate-90 transition-transform" : "transition-transform"} />
                  {showAlts ? "Hide" : "Why not the other routes?"} ({alts.length} ranked below)
                </button>
                {showAlts && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm border-separate border-spacing-y-1">
                      <thead className="text-fg-muted text-[11px] uppercase tracking-wide">
                        <tr>
                          <th className="text-left font-medium px-2 w-8">#</th>
                          <th className="text-left font-medium px-2">Card / instrument</th>
                          <th className="text-left font-medium px-2">Route (how to pay)</th>
                          <th className="text-right font-medium px-2 whitespace-nowrap">Return</th>
                          <th className="text-right font-medium px-2">Log</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alts.map((a, i) => (
                          <AltTableRow
                            key={`${a.cardId}-${a.label}-${i}`}
                            alt={a}
                            rank={i + 2}
                            selected={selectedRoute === a}
                            onSelect={() => setSelectedRoute(a)}
                            onLog={() => onLog(a)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button className="btn-secondary" onClick={() => { setMerchant(""); setAmount(""); setClarificationAnswer(null); setSelectedRoute(null); }}>Clear</button>
              <button className="btn-primary" onClick={() => onLog()}>
                <Icon.Plus size={16} /> Log {selectedRoute && selectedRoute !== best ? "selected" : "this"} expense
              </button>
            </div>
          </div>
        )}

        {!rec && !merchantTooShort && noAmount && (
          <div className="text-sm text-fg-muted text-center py-2">Enter the amount to see your best route.</div>
        )}
        {!rec && merchantTooShort && !noAmount && (
          <div className="text-sm text-fg-muted text-center py-2">Tell us what you're buying to get a recommendation.</div>
        )}
      </div>
    </div>
  );
}

function AltTableRow({
  alt,
  rank,
  selected,
  onSelect,
  onLog,
}: {
  alt: RouteOption;
  rank: number;
  selected?: boolean;
  onSelect?: () => void;
  onLog?: () => void;
}) {
  const cons = alt.cons.filter(Boolean);
  const notSuitable = alt.totalRewardInr < 1 || alt.effectivePct < 0.5;
  const reason = notSuitable ? (cons[0] ?? alt.rationale) : (alt.rationale || cons[0] || alt.pros[0] || "");
  return (
    <tr className={`align-top ${alt.feasible ? "" : "opacity-80"} ${selected ? "bg-accent/10" : ""}`}>
      <td className="px-2 py-2">
        <span className="inline-flex w-5 h-5 rounded-full bg-bg-elevated text-fg-muted text-xs font-bold items-center justify-center">{rank}</span>
      </td>
      <td className="px-2 py-2 font-medium whitespace-nowrap">{routeName(alt.cardId)}</td>
      <td className="px-2 py-2">
        <button type="button" className="text-left w-full" onClick={onSelect}>
          <div className="font-medium hover:text-accent">{alt.label}</div>
          {alt.feasibilityNote && <div className="text-xs text-danger mt-0.5">{alt.feasibilityNote}</div>}
          {reason && (
            <div className="text-xs text-fg-muted mt-0.5 leading-relaxed">
              <span className={notSuitable ? "text-warning font-medium" : "text-fg-muted"}>{notSuitable ? "Why not: " : "Note: "}</span>
              {reason}
            </div>
          )}
        </button>
      </td>
      <td className="px-2 py-2 text-right whitespace-nowrap">
        <div className="font-semibold">{alt.effectivePct.toFixed(2)}%</div>
        {alt.redemptionRange && (
          <div className="text-[10px] text-fg-muted">{alt.redemptionRange.worstPct.toFixed(1)}–{alt.redemptionRange.bestPct.toFixed(1)}%</div>
        )}
        <div className="text-xs text-fg-muted">{inr(alt.totalRewardInr)}</div>
      </td>
      <td className="px-2 py-2 text-right">
        <button type="button" className="text-xs text-accent hover:underline whitespace-nowrap" onClick={onLog}>
          Log
        </button>
      </td>
    </tr>
  );
}
