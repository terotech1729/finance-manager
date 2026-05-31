"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { recommend, type RecommendInput } from "@/lib/recommend";
import { detectCategory, ALL_CATEGORIES, ALL_CHANNELS, type ChannelType } from "@/lib/categorize";
import { findWelcomeOffer } from "@/lib/stacking";
import { addTransaction, loadState, saveState, type AppState } from "@/lib/storage";
import { getCardById } from "@/lib/cards";

function routeName(cardId: string): string {
  const c = getCardById(cardId);
  if (c) return c.short;
  if (cardId === "giftcard") return "Gift-card route";
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
  const [showAlts, setShowAlts] = useState(false);

  useEffect(() => { setStateLocal(loadState()); }, []);
  useEffect(() => { setClarificationAnswer(null); }, [merchant]);

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

  const needsClarification = !!detection.clarification && !clarificationAnswer && !overrideCategory;
  const merchantTooShort = merchant.trim().length < 2;
  const noAmount = !amt;

  const rec = useMemo(() => {
    if (!state || noAmount || merchantTooShort || needsClarification) return null;
    const input: RecommendInput = {
      merchant: merchant.trim(),
      category: finalCategory,
      amount: amt,
      channel: finalChannel,
      isForeign: finalChannel === "foreign" || detection.forex,
      ptccEligibleSpend: state.ptccEligibleSpend,
      mrccCycleSpend: state.mrccCycleSpend,
      bobYtdSpend: state.bobYtdSpend,
      bobCycleSpend5x: state.bobCycleSpend5x,
      sbiYtdSpend: state.sbiYtdSpend,
      goldThisMonthTxnsAt1k: state.goldThisMonthTxnsAt1k,
      mrccThisCycleTxnsAt1500: state.mrccThisCycleTxnsAt1500,
      mrccThisCycleAmount: state.mrccThisCycleAmount,
      goldShopwiseUsedThisMonth: state.goldShopwiseUsedThisMonth,
      scapiaMonthlySpend: state.scapiaMonthlySpend,
      kiwiNeonCycleSpend: state.kiwiNeonCycleSpend,
      bobBogoUsedThisMonth: state.bobBogoUsedThisMonth,
      swiggyBlckIssued: state.swiggyBlckIssued,
      amazonPayIciciIssued: state.amazonPayIciciIssued,
      primeMember: state.primeMember,
      amazonPayBalance: state.amazonPayBalance,
      amazonWelcomeClaimed: state.amazonWelcomeClaimed,
      giftCardRateOverrides: state.giftCardRateOverrides,
      bobEternaIssueDate: state.bobEternaIssueDate,
      bobWelcomeUnlocked: state.bobWelcomeUnlocked,
      today: localDateToISO(date),
    };
    return recommend(input);
  }, [merchant, finalCategory, amt, finalChannel, state, needsClarification, merchantTooShort, noAmount, detection.forex, date]);

  const best = rec?.best;
  const alts = rec?.alternatives ?? [];

  const onLog = () => {
    if (!rec || !best || !state) return;
    const t: Transaction = {
      id: newId(),
      date: localDateToISO(date),
      merchant: merchant.trim() || finalCategory,
      category: finalCategory,
      amount: amt,
      channel: finalChannel,
      cardId: best.cardId,
      path: best.cardId === "giftcard" || best.label.toLowerCase().includes("gift card") ? "dreamplug" :
            best.label.toLowerCase().includes("cashkaro") ? "cashkaro" :
            best.label.toLowerCase().includes("shopwise") ? "shopwise" :
            best.label.toLowerCase().includes("kiwi") ? "kiwi" :
            best.label.toLowerCase().includes("blck") || best.label.toLowerCase().includes("hdfccc") ? "blck_coupon" :
            best.label.toLowerCase().includes("district") ? "district" :
            best.label.toLowerCase().includes("amazon pay balance") ? "amazon_brand" :
            "direct",
      effectivePct: best.effectivePct,
      rewardInr: best.totalRewardInr,
    };
    addTransaction(t);
    const next: AppState = { ...state };
    if (best.cardId === "amex_plat_travel") next.ptccEligibleSpend += amt;
    if (best.cardId === "amex_mrcc") {
      next.mrccCycleSpend += amt;
      next.mrccThisCycleAmount += amt;
      if (amt >= 1500) next.mrccThisCycleTxnsAt1500 = Math.min(4, next.mrccThisCycleTxnsAt1500 + 1);
    }
    if (best.cardId === "bob_eterna") {
      next.bobYtdSpend += amt;
      if (next.bobYtdSpend >= 50000) next.bobWelcomeUnlocked = true;
    }
    if (best.cardId === "sbi_simplyclick") next.sbiYtdSpend += amt;
    if (best.cardId === "idfc_indigo") next.idfcYtdSpend += amt;
    if (best.cardId === "swiggy_blck") next.blckYtdSpend += amt;
    if (best.cardId === "scapia") next.scapiaMonthlySpend += amt;
    if (best.cardId === "amex_gold") {
      if (amt >= 1000) next.goldThisMonthTxnsAt1k = Math.min(6, next.goldThisMonthTxnsAt1k + 1);
      if (best.label.toLowerCase().includes("shopwise")) next.goldShopwiseUsedThisMonth += amt;
    }
    if (best.cardId === "bob_eterna" && best.label.toLowerCase().includes("bogo")) {
      next.bobBogoUsedThisMonth = true;
    }
    if (best.cardId === "amazon_pay_icici" && best.label.toLowerCase().includes("balance")) {
      next.amazonPayBalance = Math.max(0, next.amazonPayBalance - Math.min(next.amazonPayBalance, amt));
    }
    if (best.cardId === "yes_kiwi") {
      next.kiwiNeonCycleSpend += amt;
      next.kiwiCashback += best.totalRewardInr / 0.25;
      next.kiwiLifetimeEarned += best.totalRewardInr;
    }
    // Mark a one-time Amazon welcome coupon as used (only when the chosen route is the
    // Amazon Pay ICICI welcome — NOT when BOB's "welcome push" was picked).
    if (best.cardId === "amazon_pay_icici" && best.label.toLowerCase().includes("welcome")) {
      const w = findWelcomeOffer(merchant.trim(), finalCategory, next.amazonWelcomeClaimed || []);
      if (w) next.amazonWelcomeClaimed = [...(next.amazonWelcomeClaimed || []), w.id];
    }
    setStateLocal(next);
    saveState(next);
    setAmount("");
    setMerchant("");
    setDate(todayLocal());
    setClarificationAnswer(null);
    setOverrideCategory("");
    setOverrideChannel("");
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
        <div className="grid sm:grid-cols-[1fr_140px_150px_auto] gap-3 items-end">
          <div>
            <label className="label mb-1 block">What are you buying?</label>
            <input
              className="input text-base"
              placeholder="e.g. Airtel recharge, Amazon, Cleartrip hotel, BESCOM bill…"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="label mb-1 block">Amount (₹)</label>
            <input
              className="input text-base"
              placeholder="e.g. 899"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="label mb-1 block">Date</label>
            <input
              type="date"
              className="input text-base"
              value={date}
              max={todayLocal()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div>
            <button className="btn-secondary text-xs whitespace-nowrap" onClick={() => setShowOverride((v) => !v)} type="button">
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
            </div>
          </div>
        )}

        {merchantTooShort && noAmount && (
          <div className="text-sm text-fg-muted text-center py-4 border border-dashed border-border rounded-lg">
            Type what you're buying (e.g. <em>Airtel recharge</em>, <em>Amazon</em>, <em>Cleartrip hotel</em>) and the amount.
          </div>
        )}

        {rec && best && (
          <div className="border-t-2 border-accent/30 pt-5 space-y-4">
            <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-start">
              <div>
                <div className="label text-success">RECOMMENDED ROUTE</div>
                <div className="flex items-baseline gap-3 mt-1 flex-wrap">
                  <div className="text-2xl font-bold">{routeName(best.cardId)}</div>
                  <div className="text-sm text-fg-muted">{getCardById(best.cardId)?.name}</div>
                </div>
                <div className="text-sm font-medium text-accent mt-1">{best.label}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="label">{rec.effectiveRange ? "Value (typical redemption)" : "Total value"}</div>
                <div className="text-3xl font-bold text-success">{best.effectivePct.toFixed(2)}%</div>
                <div className="text-xs text-fg-muted">≈ {inr(best.totalRewardInr)}{best.bonusRewardInr > 0 ? ` (${inr(best.baseRewardInr)} base + ${inr(best.bonusRewardInr)} milestone)` : ""}</div>
                {rec.effectiveRange && (
                  <div className="text-xs text-fg-muted mt-1">
                    Range <b className="text-fg">{rec.effectiveRange.worstPct.toFixed(2)}%</b>–<b className="text-success">{rec.effectiveRange.bestPct.toFixed(2)}%</b> by {rec.effectiveRange.currency.replace(/\s*\(.*\)/, "")} redemption
                    <Link href="/redemptions" className="text-accent hover:underline ml-1">details →</Link>
                  </div>
                )}
              </div>
            </div>

            {best.steps.length > 0 && (
              <div className="bg-bg-chrome rounded-lg p-4 border border-border">
                <div className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Icon.ArrowRight size={16} className="text-accent" />
                  Step-by-step: how to actually pay this
                </div>
                <ol className="space-y-2 text-sm">
                  {best.steps.map((step, i) => (
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
              <div className="text-sm text-fg-muted mt-0.5 leading-relaxed">{best.rationale}</div>
            </div>

            {best.pros.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {best.pros.map((p, i) => <span key={i} className="pill-success text-xs">{p}</span>)}
              </div>
            )}

            {best.cons.filter(Boolean).length > 0 && (
              <Callout tone="warning" title="Watch out for">
                <ul className="list-disc pl-4 space-y-0.5">
                  {best.cons.filter(Boolean).map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </Callout>
            )}

            {best.bestCasePct !== best.worstCasePct && (
              <div className="text-xs text-fg-muted">
                Range: <b className="text-fg">{best.worstCasePct.toFixed(2)}%</b> (worst, card reward only) → <b className="text-success">{best.bestCasePct.toFixed(2)}%</b> (best, full stack)
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
                        </tr>
                      </thead>
                      <tbody>
                        {alts.map((a, i) => <AltTableRow key={i} alt={a} rank={i + 2} />)}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button className="btn-secondary" onClick={() => { setMerchant(""); setAmount(""); setClarificationAnswer(null); }}>Clear</button>
              <button className="btn-primary" onClick={onLog}><Icon.Plus size={16} /> Log this expense</button>
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

function AltTableRow({ alt, rank }: { alt: RouteOption; rank: number }) {
  const cons = alt.cons.filter(Boolean);
  const notSuitable = alt.totalRewardInr < 1 || alt.effectivePct < 0.5;
  const reason = notSuitable ? (cons[0] ?? alt.rationale) : (alt.rationale || cons[0] || alt.pros[0] || "");
  return (
    <tr className={`align-top ${alt.feasible ? "" : "opacity-80"}`}>
      <td className="px-2 py-2">
        <span className="inline-flex w-5 h-5 rounded-full bg-bg-elevated text-fg-muted text-xs font-bold items-center justify-center">{rank}</span>
      </td>
      <td className="px-2 py-2 font-medium whitespace-nowrap">{routeName(alt.cardId)}</td>
      <td className="px-2 py-2">
        <div className="font-medium">{alt.label}</div>
        {alt.feasibilityNote && <div className="text-xs text-danger mt-0.5">{alt.feasibilityNote}</div>}
        {reason && (
          <div className="text-xs text-fg-muted mt-0.5 leading-relaxed">
            <span className={notSuitable ? "text-warning font-medium" : "text-fg-muted"}>{notSuitable ? "Why not: " : "Note: "}</span>
            {reason}
          </div>
        )}
      </td>
      <td className="px-2 py-2 text-right whitespace-nowrap">
        <div className="font-semibold">{alt.effectivePct.toFixed(2)}%</div>
        <div className="text-xs text-fg-muted">{inr(alt.totalRewardInr)}</div>
      </td>
    </tr>
  );
}
