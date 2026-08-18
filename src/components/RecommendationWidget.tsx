"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { recommend } from "@/lib/recommend";
import { buildRecommendInputFromState } from "@/lib/recommendInput";
import { detectCategory, ALL_CATEGORIES, ALL_CHANNELS, type ChannelType } from "@/lib/categorize";
import { findWelcomeOffer, findGiftCardDeals } from "@/lib/stacking";
import { addTransaction, loadState, loadTransactions, saveState, onStorageChange, type AppState } from "@/lib/storage";
import { applyCardSpend, recordShopwiseVouchers, GOLD_TXN_MIN_INR, MRCC_TXN_MIN_INR } from "@/lib/spendTracking";
import { toast } from "./Toast";
import { getCardById } from "@/lib/cards";

function routeName(cardId: string): string {
  const c = getCardById(cardId);
  if (c) return c.short;
  if (cardId === "giftcard") return "Movie / shopping GC";
  if (cardId === "upi") return "UPI (PhonePe/GPay)";
  if (cardId === "cash") return "Cash";
  if (cardId === "amazon_pay_balance") return "Amazon Pay balance";
  if (cardId === "hdfc_visa_platinum_debit") return "HDFC Platinum Debit";
  return cardId;
}
import { inr, newId, todayLocal, localDateToISO } from "@/lib/utils";
import type { Transaction, RouteOption } from "@/lib/types";
import type { MovieGiftCardLiveResult, MovieGiftCardOffer } from "@/lib/movieGiftCards";
import { catalogOffersForTheatre, rankMovieOffers } from "@/lib/movieGiftCards";
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
  const [movieTheatre, setMovieTheatre] = useState<"pvr" | "cinepolis" | "inox" | "bms" | "district" | "other" | "">("");
  const [indigoVoucher, setIndigoVoucher] = useState<string>("");
  const [credGiftCardPct, setCredGiftCardPct] = useState<string>("");
  const [movieGcLive, setMovieGcLive] = useState<MovieGiftCardLiveResult | null>(null);
  const [movieGcLoading, setMovieGcLoading] = useState(false);
  const [movieGcError, setMovieGcError] = useState<string | null>(null);
  const [showAlts, setShowAlts] = useState(false);
  /** Which ranked route to log — 0 = best, 1+ = alternatives index + 1 conceptually; we store the route itself. */
  const [selectedRoute, setSelectedRoute] = useState<RouteOption | null>(null);
  const [voucherUnits, setVoucherUnits] = useState("1");
  const [voucherFace, setVoucherFace] = useState("");
  /** How the Amex spend actually happened — milestones can be direct/online, not only ShopWise. */
  const [amexPayPath, setAmexPayPath] = useState<"direct" | "online" | "shopwise" | null>(null);

  useEffect(() => {
    // Always start from saved milestone counters (Milestones / Settings / Claims).
    setStateLocal(loadState());
    return onStorageChange(() => setStateLocal(loadState()));
  }, []);
  useEffect(() => {
    setClarificationAnswer(null);
    setMovieTheatre("");
    setCredGiftCardPct("");
    setCashkaroOverride("");
    setAmazonOrderCashback("");
    setIndigoVoucher("");
    setSelectedRoute(null);
    setAmexPayPath(null);
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

  const isMovie =
    /movie|event|bookmyshow|\bbms\b|district|pvr|inox|cinepolis|cinema|imax|insignia|4dx|luxe/i.test(
      `${merchant} ${finalCategory}`
    );

  // Live-fetch movie GC discounts when movies detected
  useEffect(() => {
    if (!isMovie || merchantTooShort || needsClarification) {
      setMovieGcLive(null);
      setMovieGcError(null);
      setMovieGcLoading(false);
      return;
    }
    const theatre = movieTheatre || "other";
    let cancelled = false;
    setMovieGcLoading(true);
    setMovieGcError(null);
    setMovieGcLive({
      fetchedAt: new Date().toISOString(),
      offers: catalogOffersForTheatre(theatre || "other"),
    });
    // Bust caches — GC % rotates on every platform; rank on current live state.
    fetch(
      `/api/movie-gift-cards?theatre=${encodeURIComponent(theatre || "other")}&_=${Date.now()}`,
      { cache: "no-store" }
    )
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<MovieGiftCardLiveResult>;
      })
      .then((data) => {
        if (cancelled) return;
        setMovieGcLive(data);
        setMovieGcLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setMovieGcError((e as Error).message || "Live fetch failed — using catalog");
        setMovieGcLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isMovie, merchantTooShort, needsClarification, movieTheatre, merchant, finalCategory]);

  const rec = useMemo(() => {
    if (!state || noAmount || merchantTooShort || needsClarification) return null;
    // Past first: re-read saved counters every ranking (edits on Milestones / Claims apply immediately).
    const fresh = loadState();
    const bobBogoUsedThisMonth = loadTransactions().some(
      (t) => t.cardId === "bob_eterna" && t.date.slice(0, 7) === date.slice(0, 7) &&
        (t.path === "district" || /district|bogo/i.test(`${t.merchant} ${t.category}`))
    );
    const livePlusBogoUsedThisMonth = loadTransactions().some(
      (t) => t.cardId === "hsbc_live_plus" && t.date.slice(0, 7) === date.slice(0, 7) &&
        /bogo|district|bookmyshow|\bbms\b|movie|cinema/i.test(`${t.path ?? ""} ${t.merchant} ${t.category}`)
    );
    const input = buildRecommendInputFromState(fresh, {
      merchant: merchant.trim(),
      category: finalCategory,
      amount: amt,
      channel: finalChannel,
      isForeign: finalChannel === "foreign" || detection.forex,
      today: localDateToISO(date),
      cashkaroPctOverride: Number((cashkaroOverride || "").replace(/[^0-9.]/g, "")) || undefined,
      amazonOrderCashbackInr: Number((amazonOrderCashback || "").replace(/[^0-9.]/g, "")) || undefined,
      indigoBluChipVoucherInr: Number((indigoVoucher || "").replace(/[^0-9.]/g, "")) || undefined,
      credGiftCardPctOverride: Number((credGiftCardPct || "").replace(/[^0-9.]/g, "")) || undefined,
      movieTheatre: movieTheatre || undefined,
      movieGiftCardOffers: isMovie ? movieGcLive?.offers : undefined,
      bobBogoUsedThisMonth,
      livePlusBogoUsedThisMonth,
    });
    return recommend(input);
  }, [merchant, finalCategory, amt, finalChannel, state, needsClarification, merchantTooShort, noAmount, detection.forex, date, cashkaroOverride, amazonOrderCashback, indigoVoucher, credGiftCardPct, movieTheatre, isMovie, movieGcLive]);

  const isAmazon = /amazon/i.test(merchant) || /amazon/i.test(finalCategory);
  const isSwiggy =
    /swiggy/i.test(merchant) || /swiggy/i.test(finalCategory);
  const isTravel =
    /hotel|flight|bus|train|travel|agoda|cleartrip|makemytrip|\bmmt\b|booking\.com|indigo|irctc|redbus/i.test(
      `${merchant} ${finalCategory}`
    );
  const isIndigoFlight =
    /indigo|6e\b/i.test(`${merchant} ${finalCategory}`) ||
    (/flight/i.test(finalCategory) && /indigo/i.test(merchant));
  // Only show CRED/CheQ override when catalog actually has a GC for this brand (not Swiggy/food).
  const hasCatalogGiftCard = findGiftCardDeals(merchant, finalCategory).length > 0;
  const isCredGcCandidate = isMovie || hasCatalogGiftCard;

  const rankedMovieOffers = useMemo(
    () => (movieGcLive?.offers ? rankMovieOffers(movieGcLive.offers) : []),
    [movieGcLive]
  );

  const credPctHint =
    movieTheatre === "bms" || movieTheatre === "district" ? "3.75" :
    isMovie ? "optional" :
    "e.g. 5";

  const best = rec?.best;
  const alts = rec?.alternatives ?? [];
  const routeToLog = selectedRoute ?? best;

  // Ask Direct/Online/ShopWise for whichever Amex route is selected to log (#1 or an alt).
  const amexCardId =
    routeToLog && /^amex_/.test(routeToLog.cardId) ? routeToLog.cardId : null;
  const isAmexLogging = !!amexCardId;
  const shopwiseSuggestedFace =
    amexCardId === "amex_mrcc"
      ? MRCC_TXN_MIN_INR
      : amexCardId === "amex_gold"
        ? GOLD_TXN_MIN_INR
        : amt >= 1
          ? Math.round(amt)
          : "";
  const shopwiseTxnMin =
    amexCardId === "amex_mrcc"
      ? MRCC_TXN_MIN_INR
      : amexCardId === "amex_gold"
        ? GOLD_TXN_MIN_INR
        : null;
  const shopwiseBalanceKind: "swiggy" | "amazon_pay" | "none" = isSwiggy
    ? "swiggy"
    : isAmazon
      ? "amazon_pay"
      : "none";

  // Suggest a path from the route label/channel, but always let the user confirm.
  useEffect(() => {
    if (!amexCardId || !routeToLog) {
      setAmexPayPath(null);
      return;
    }
    if (/shopwise/i.test(routeToLog.label)) setAmexPayPath("shopwise");
    else if (finalChannel === "offline_pos") setAmexPayPath("direct");
    else setAmexPayPath("online");
    setVoucherUnits("1");
    setVoucherFace(shopwiseSuggestedFace === "" ? "" : String(shopwiseSuggestedFace));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-seed when Amex route / channel flips
  }, [amexCardId, routeToLog?.label, finalChannel]);

  const pathForRoute = (r: RouteOption): Transaction["path"] => {
    const l = r.label.toLowerCase();
    if (/swiggy money/i.test(l)) return "amazon_brand"; // prepaid balance drain (reuse path bucket)
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

  const goldDone = state?.goldThisMonthTxnsAt1k ?? 0;
  const goldLeft = Math.max(0, 6 - goldDone);
  const mrccDone = state?.mrccThisCycleTxnsAt1500 ?? 0;
  const mrccLeft = Math.max(0, 4 - mrccDone);
  const swiggyBal = state?.swiggyMoneyBalance ?? 0;

  const shopwiseEarnPct = shopwiseBalanceKind === "amazon_pay" ? 4.03 : 5.8;

  const logShopwisePurchase = (cardId: string, chosen?: RouteOption) => {
    const units = Math.max(0, Math.floor(Number(voucherUnits) || 0));
    const face = Math.max(0, Math.round(Number(String(voucherFace).replace(/[^0-9.]/g, "")) || 0));
    if (units < 1 || face < 1) {
      toast("Enter ShopWise units and face ₹, then log", "error");
      return false;
    }
    const next: AppState = { ...loadState() };
    const balanceKind = shopwiseBalanceKind;
    const earnPct =
      chosen?.effectivePct && chosen.effectivePct > 0
        ? chosen.effectivePct
        : balanceKind === "amazon_pay"
          ? 4.03
          : shopwiseEarnPct;
    const res = recordShopwiseVouchers(next, {
      cardId,
      units,
      facePerUnit: face,
      balanceKind,
    });
    if (!res.ok) {
      toast(res.message ?? "Nothing to log", "error");
      return false;
    }
    const progressNote =
      cardId === "amex_gold"
        ? `Gold ${res.goldDone}/6 (${res.qualifyingTxns} counted${face < GOLD_TXN_MIN_INR ? `, face < ₹${GOLD_TXN_MIN_INR}` : ""})`
        : cardId === "amex_mrcc"
          ? `MRCC ${res.mrccTxnsDone}/4 ≥₹${MRCC_TXN_MIN_INR} · cycle ${inr(res.mrccAmount)}`
          : "Amex spend logged";
    // One txn per unit so monthly recompute / history counts milestones correctly.
    const rewardPer =
      chosen?.totalRewardInr && units > 0 ? chosen.totalRewardInr / units : face * (earnPct / 100);
    for (let i = 0; i < res.units; i++) {
      addTransaction({
        id: newId(),
        date: localDateToISO(date),
        merchant: `ShopWise${balanceKind === "swiggy" ? " Swiggy" : balanceKind === "amazon_pay" ? " Amazon Pay" : ""}`,
        category:
          balanceKind === "swiggy"
            ? "swiggy"
            : balanceKind === "amazon_pay"
              ? "amazon"
              : finalCategory || "gift card",
        amount: face,
        channel: "online",
        cardId,
        path: "shopwise",
        effectivePct: earnPct,
        rewardInr: rewardPer,
        notes: `${i + 1}/${res.units} · face ${inr(face)} → ${progressNote}`,
      });
    }
    setStateLocal(next);
    saveState(next);
    const balNote =
      balanceKind === "swiggy"
        ? ` · Swiggy Money ${inr(res.swiggyMoneyBalance)}`
        : balanceKind === "amazon_pay"
          ? ` · Amazon Pay ${inr(res.amazonPayBalance)}`
          : "";
    toast(
      `Logged ${res.units}× ${inr(face)} ShopWise on ${routeName(cardId)} · ${progressNote}${balNote}`,
      "success"
    );
    onLogged?.();
    return true;
  };

  const onLog = (route?: RouteOption) => {
    const chosen = route ?? routeToLog;
    if (!rec || !chosen || !state) return;
    const isAmexChosen = /^amex_/.test(chosen.cardId);
    const isSwiggyMoney = /swiggy money/i.test(chosen.label);

    // Amex: confirm Direct / Online / ShopWise — milestones aren't ShopWise-only.
    if (isAmexChosen) {
      if (!amexPayPath) {
        toast("How did you pay with Amex — Direct, Online, or ShopWise?", "error");
        return;
      }
      if (amexPayPath === "shopwise") {
        if (!logShopwisePurchase(chosen.cardId, chosen)) return;
        setAmount("");
        setSelectedRoute(null);
        return;
      }

      const channel =
        amexPayPath === "direct"
          ? ("offline_pos" as const)
          : finalChannel === "foreign"
            ? finalChannel
            : ("online" as const);
      const milestoneMin =
        chosen.cardId === "amex_mrcc"
          ? MRCC_TXN_MIN_INR
          : chosen.cardId === "amex_gold"
            ? GOLD_TXN_MIN_INR
            : null;
      const t: Transaction = {
        id: newId(),
        date: localDateToISO(date),
        merchant: merchant.trim() || finalCategory,
        category: finalCategory,
        amount: amt,
        channel,
        cardId: chosen.cardId,
        path: "direct",
        effectivePct: chosen.effectivePct,
        rewardInr: chosen.totalRewardInr,
        notes:
          milestoneMin != null && amt >= milestoneMin
            ? `Amex ${amexPayPath} · counts toward monthly txn milestone`
            : `Amex ${amexPayPath}`,
      };
      addTransaction(t);
      const next: AppState = { ...loadState() };
      applyCardSpend(
        next,
        chosen.cardId,
        amt,
        chosen.totalRewardInr,
        chosen.effectivePct,
        finalCategory,
        merchant.trim()
      );
      setStateLocal(next);
      saveState(next);
      toast(
        `Logged ${inr(amt)} on ${routeName(chosen.cardId)} (${amexPayPath}) · ${inr(chosen.totalRewardInr)} reward`,
        "success"
      );
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
      return;
    }

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
    const next: AppState = { ...loadState() };
    if (isSwiggyMoney) {
      next.swiggyMoneyBalance = Math.max(
        0,
        (next.swiggyMoneyBalance ?? 0) - Math.min(next.swiggyMoneyBalance ?? 0, amt)
      );
    } else {
      applyCardSpend(
        next,
        chosen.cardId,
        amt,
        chosen.totalRewardInr,
        chosen.effectivePct,
        finalCategory,
        merchant.trim()
      );
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
            <div className="text-xs text-fg-muted mt-0.5">
              Merchant + total checkout ₹ (not unit price). We compare every route and pick the best.
            </div>
          </div>
        </div>
      </div>

      <div className="card-body space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px_150px_auto] gap-3 items-end">
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
              <label className="label mb-1 block">Total ₹</label>
              <input
                className="input"
                placeholder={isMovie ? "e.g. 898" : "e.g. 899"}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                title="Full cart / checkout total for all items or tickets — not unit price"
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

        {(isAmazon || isTravel) && !merchantTooShort && (
          <div className="bg-amber-50 dark:bg-amber-950/20 rounded-lg p-3 border border-amber-300/60 dark:border-amber-700/40 space-y-2">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <Icon.Sparkles size={14} className="text-amber-600" />
              {isTravel && !isAmazon
                ? "Travel — any Amazon / first-booking extra ₹ at checkout?"
                : "Amazon order — any extra offer at checkout?"}
            </div>
            <div className="text-xs text-fg-muted">
              {isTravel ? (
                <>
                  We compare <b>Amazon travel</b> (ICICI 5%/3% flights&amp;hotels, ~2% bus/train), <b>Cashkaro → Agoda (~7% hotels only)</b>, MMT/Cleartrip flats, Scapia app, and airline/hotel direct.
                  Enter any <b>extra Amazon first-booking / wallet cashback ₹</b> shown at checkout (card % is already counted). Always fare-match platforms — a higher fare kills the %.
                </>
              ) : (
                <>
                  Amazon shows order-level offers we can&apos;t see (e.g. <em>&quot;Cashback on orders above ₹1,398 → ₹200 to Amazon Pay Wallet&quot;</em>). The standard <b>5% Amazon Pay ICICI</b> cashback is already counted — only enter the <b>extra order cashback ₹</b> shown on the order/payment page. MRP discounts &amp; Prime delivery savings are the same on every card, so leave those out.
                </>
              )}
            </div>
            <div className="grid sm:grid-cols-[200px_1fr] gap-2 items-center">
              <input
                className="input"
                inputMode="numeric"
                placeholder="Extra cashback ₹ (e.g. 200)"
                value={amazonOrderCashback}
                onChange={(e) => setAmazonOrderCashback(e.target.value)}
              />
              <span className="text-xs text-fg-muted">
                {isTravel ? "Added to the Amazon travel → ICICI route." : "Added to the Amazon Pay ICICI route."}
              </span>
            </div>
          </div>
        )}

        {(isIndigoFlight || (/flight/i.test(finalCategory) && isTravel)) && !merchantTooShort && (
          <div className="bg-sky-50 dark:bg-sky-950/20 rounded-lg p-3 border border-sky-300/60 dark:border-sky-700/40 space-y-2">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <Icon.Sparkles size={14} className="text-sky-600" />
              IndiGo BluChip voucher (optional)
            </div>
            <div className="text-xs text-fg-muted">
              IDFC Indigo milestone vouchers (often ₹5,000) cut the IndiGo payable and can flip the winner vs Amazon / OTAs. Enter the voucher ₹ you will apply.
            </div>
            <div className="grid sm:grid-cols-[200px_1fr] gap-2 items-center">
              <input
                className="input"
                inputMode="numeric"
                placeholder="Voucher ₹ (e.g. 5000)"
                value={indigoVoucher}
                onChange={(e) => setIndigoVoucher(e.target.value)}
              />
              <span className="text-xs text-fg-muted">Applied to IndiGo direct → IDFC Indigo routes only.</span>
            </div>
          </div>
        )}

        {isMovie && !merchantTooShort && needsClarification && (
          <div className="text-xs text-fg-muted rounded-lg p-3 border border-dashed border-sky-300/60">
            Answer how many tickets first — ₹ is the full booking total (not per ticket). Then pick the cinema chain.
          </div>
        )}

        {isMovie && !merchantTooShort && !needsClarification && (
          <div className="bg-sky-50 dark:bg-sky-950/20 rounded-lg p-3 border border-sky-300/60 dark:border-sky-700/40 space-y-3">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <Icon.Sparkles size={14} className="text-sky-600" />
              Cinema chain + live movie gift-card rates
              {movieGcLoading && <span className="text-xs font-normal text-fg-muted">· fetching…</span>}
            </div>
            <div className="text-xs text-fg-muted">
              Live-check CRED (Desidime), Woohoo, GyFTR &amp; Amazon at recommend time — rates rotate daily.
              <span className="block mt-1">
                <b>Insignia / Luxe</b> → PVR. <b>IMAX / 4DX</b> = format — pick the operator on BMS.
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                ["cinepolis", "Cinepolis"],
                ["pvr", "PVR"],
                ["inox", "INOX"],
                ["bms", "BMS"],
                ["district", "District"],
                ["other", "Not sure — show all"],
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
                    if (value === "bms" || value === "district") setCredGiftCardPct("3.75");
                    else setCredGiftCardPct("");
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {(rankedMovieOffers.length > 0 || movieGcLive?.offers?.some((o) => o.status === "unavailable")) && (
              <div className="rounded-md border border-sky-200/80 dark:border-sky-800/50 overflow-hidden bg-white/60 dark:bg-black/20">
                <div className="px-3 py-1.5 text-[11px] uppercase tracking-wide text-fg-muted border-b border-sky-200/60 dark:border-sky-800/40 flex justify-between gap-2">
                  <span>Where to buy the GC</span>
                  <span>
                    {movieGcLoading ? "updating…" : movieGcError ? "catalog fallback" : "live + catalog"}
                  </span>
                </div>
                <ul className="divide-y divide-sky-100 dark:divide-sky-900/40">
                  {rankedMovieOffers.slice(0, 6).map((o) => (
                    <li key={`${o.sourceId}-${o.brand}-${o.pct}`} className="px-3 py-2 flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium">
                          {o.sourceLabel} · {o.brandLabel}
                          {o.status === "live" && (
                            <span className="ml-1.5 text-[10px] uppercase text-success">live</span>
                          )}
                        </div>
                        <div className="text-xs text-fg-muted truncate">
                          {o.note}
                          {o.promoCode ? ` · code ${o.promoCode}` : ""}
                          {o.caveats?.[0] ? ` · ${o.caveats[0]}` : ""}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-semibold text-success">{o.pct}%</div>
                        <a
                          href={o.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-sky-700 dark:text-sky-300 hover:underline"
                        >
                          open
                        </a>
                      </div>
                    </li>
                  ))}
                  {(movieGcLive?.offers || [])
                    .filter((o) => o.status === "unavailable" || o.pct <= 0)
                    .slice(0, 2)
                    .map((o) => (
                      <li key={`na-${o.sourceId}-${o.brand}`} className="px-3 py-2 flex justify-between gap-3 text-sm opacity-70">
                        <div>
                          <div className="font-medium line-through decoration-rose-400/80">
                            {o.sourceLabel} · {o.brandLabel}
                          </div>
                          <div className="text-xs text-fg-muted">{o.note || "Unavailable"}</div>
                        </div>
                        <div className="text-xs text-rose-600 dark:text-rose-400 shrink-0">gone</div>
                      </li>
                    ))}
                </ul>
                {movieGcError && (
                  <div className="px-3 py-1.5 text-[11px] text-amber-700 dark:text-amber-300 border-t border-sky-200/60">
                    Live scrape issue: {movieGcError}. Ranking still uses catalog rates.
                  </div>
                )}
              </div>
            )}

            {(movieTheatre === "bms" || movieTheatre === "district") && (
              <div className="grid sm:grid-cols-[180px_1fr] gap-2 items-center">
                <input
                  className="input"
                  inputMode="decimal"
                  placeholder="CRED live % (optional)"
                  value={credGiftCardPct}
                  onChange={(e) => setCredGiftCardPct(e.target.value)}
                />
                <span className="text-xs text-fg-muted">
                  Only for thin CRED BMS/District GCs if still listed.
                </span>
              </div>
            )}
          </div>
        )}

        {state && isAmexLogging && amexCardId && (
          <div className="rounded-lg p-3 border space-y-3 border-accent/40 bg-accent/5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-semibold">
                {routeName(amexCardId)} · how are you paying?
                {amexCardId === "amex_gold" && (
                  <>
                    {" "}
                    <span className="text-accent">{goldDone}/6</span>
                    {goldLeft > 0 ? (
                      <span className="text-fg-muted font-normal">
                        {" "}
                        · {goldLeft} more ≥{inr(GOLD_TXN_MIN_INR)} this month
                      </span>
                    ) : (
                      <span className="text-success font-normal"> · done this month</span>
                    )}
                  </>
                )}
                {amexCardId === "amex_mrcc" && (
                  <>
                    {" "}
                    <span className="text-accent">{mrccDone}/4</span>
                    {mrccLeft > 0 ? (
                      <span className="text-fg-muted font-normal">
                        {" "}
                        · {mrccLeft} more ≥{inr(MRCC_TXN_MIN_INR)} this month
                      </span>
                    ) : (
                      <span className="text-success font-normal"> · 4-txn done</span>
                    )}
                    <span className="text-fg-muted font-normal">
                      {" "}
                      · cycle {inr(state.mrccThisCycleAmount ?? 0)}/₹20k
                    </span>
                  </>
                )}
                {amexCardId === "amex_plat_travel" && (
                  <span className="text-fg-muted font-normal">
                    {" "}
                    · PT eligible {inr(state.ptccEligibleSpend ?? 0)}
                  </span>
                )}
              </div>
              <div className="text-xs text-fg-muted">
                {(state.goldShopwiseUsedThisMonth ?? 0) > 0
                  ? `ShopWise used ${inr(state.goldShopwiseUsedThisMonth)}/₹10k`
                  : "Resets on the 1st of each month"}
              </div>
            </div>
            <p className="text-xs text-fg-muted leading-relaxed">
              Milestone txns can be Direct POS, Online, or ShopWise — pick what you actually used. ShopWise unlocks the voucher tracker.
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["direct", "Direct (POS)"],
                  ["online", "Online"],
                  ["shopwise", "ShopWise"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`px-3 py-1.5 rounded-md text-sm border transition ${
                    amexPayPath === value
                      ? "bg-accent text-white border-accent"
                      : "bg-bg-elevated border-border text-fg hover:border-accent/50"
                  }`}
                  onClick={() => setAmexPayPath(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {amexPayPath === "shopwise" && (
              <div className="space-y-2 pt-1 border-t border-border/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-medium text-fg">ShopWise vouchers bought</div>
                  <div className="text-xs text-fg-muted">
                    {shopwiseBalanceKind === "swiggy"
                      ? `Swiggy Money ${inr(swiggyBal)}`
                      : shopwiseBalanceKind === "amazon_pay"
                        ? `Amazon Pay ${inr(state.amazonPayBalance ?? 0)}`
                        : "Enter units × face ₹"}
                  </div>
                </div>
                {shopwiseTxnMin != null && (
                  <p className="text-xs text-fg-muted">
                    Each unit counts toward the milestone only if face ≥{inr(shopwiseTxnMin)}.
                  </p>
                )}
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="label mb-1 block text-xs">Units</label>
                    <input
                      className="input w-20"
                      type="number"
                      min={1}
                      value={voucherUnits}
                      onChange={(e) => setVoucherUnits(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label mb-1 block text-xs">Face ₹ each</label>
                    <input
                      className="input w-28"
                      inputMode="numeric"
                      placeholder={shopwiseTxnMin != null ? String(shopwiseTxnMin) : "amount"}
                      value={voucherFace}
                      onChange={(e) => setVoucherFace(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
            {amexPayPath && amexPayPath !== "shopwise" && (
              <p className="text-xs text-fg-muted">
                Logging will use the checkout amount ({amt > 0 ? inr(amt) : "enter ₹ above"}) as one {amexPayPath} Amex txn.
              </p>
            )}
          </div>
        )}

        {rec?.askLiveRates?.giftCard && !isMovie && !merchantTooShort && (
          <div className="bg-sky-50 dark:bg-sky-950/20 rounded-lg p-3 border border-sky-400/70 dark:border-sky-600/50 space-y-2">
            <div className="text-sm font-semibold flex items-center gap-1.5">
              <Icon.Sparkles size={14} className="text-sky-600" />
              Live gift-card % needed
            </div>
            <div className="text-xs text-fg-muted">{rec.askLiveRates.giftCard.message}</div>
            <div className="grid sm:grid-cols-[180px_1fr] gap-2 items-center">
              <input
                className="input"
                inputMode="decimal"
                placeholder={`Live GC % (e.g. ${rec.askLiveRates.giftCard.hintPct ?? "5"})`}
                value={credGiftCardPct}
                onChange={(e) => setCredGiftCardPct(e.target.value)}
              />
              <span className="text-xs text-fg-muted">
                {rec.askLiveRates.giftCard.label}
              </span>
            </div>
          </div>
        )}

        {isCredGcCandidate && !isMovie && !rec?.askLiveRates?.giftCard && !merchantTooShort && (
          <div className="bg-bg-chrome rounded-lg p-3 border border-border space-y-2">
            <div className="text-xs text-fg-muted">
              Optional: override CRED/CheQ gift-card % if the catalog rate looks wrong (Advanced also has Cashkaro override).
            </div>
            <div className="grid sm:grid-cols-[180px_1fr] gap-2 items-center">
              <input
                className="input"
                inputMode="decimal"
                placeholder="Override CRED GC %"
                value={credGiftCardPct}
                onChange={(e) => setCredGiftCardPct(e.target.value)}
              />
              <span className="text-xs text-fg-muted">Leave blank to use catalog.</span>
            </div>
          </div>
        )}        {needsClarification && detection.clarification && (
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
            Type what you&apos;re buying (e.g. <em>hotel</em>, <em>flight</em>, <em>Agoda</em>, <em>Amazon</em>, <em>Airtel recharge</em>) and the amount.
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
                {routeToLog.feasibilityNote && (
                  <div className="text-xs text-danger mt-1">{routeToLog.feasibilityNote}</div>
                )}
                {routeToLog.liquidity && (
                  <div className="text-xs text-fg-muted mt-1">
                    Liquidity:{" "}
                    <span className="font-medium text-fg">
                      {routeToLog.liquidity === "cash" ? "cash / statement" : routeToLog.liquidity === "flexible" ? "flexible points (Amex MR)" : "travel-locked"}
                    </span>
                  </div>
                )}
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

            {routeToLog.ifAmexNotAccepted && (
              <div className="rounded-lg p-4 border border-warning/40 bg-warning/5">
                <div className="text-sm font-semibold mb-1">If Amex not accepted</div>
                <div className="text-sm text-accent font-medium">{routeToLog.ifAmexNotAccepted.label}</div>
                <div className="text-xs text-fg-muted mt-1 leading-relaxed">{routeToLog.ifAmexNotAccepted.rationale}</div>
                {routeToLog.ifAmexNotAccepted.steps.length > 0 && (
                  <ol className="mt-2 space-y-1 text-sm text-fg-muted list-decimal pl-4">
                    {routeToLog.ifAmexNotAccepted.steps.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                )}
                <div className="text-xs text-fg-muted mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span>
                    Next-best ≈ {routeToLog.ifAmexNotAccepted.effectivePct.toFixed(2)}% via{" "}
                    {routeName(routeToLog.ifAmexNotAccepted.cardId)}
                  </span>
                  <button
                    type="button"
                    className="text-accent hover:underline"
                    onClick={() => {
                      const target =
                        (best &&
                          best.cardId === routeToLog.ifAmexNotAccepted!.cardId &&
                          best.label === routeToLog.ifAmexNotAccepted!.routeLabel &&
                          best) ||
                        alts.find(
                          (a) =>
                            a.cardId === routeToLog.ifAmexNotAccepted!.cardId &&
                            a.label === routeToLog.ifAmexNotAccepted!.routeLabel
                        );
                      if (target) setSelectedRoute(target);
                    }}
                  >
                    Select this route
                  </button>
                </div>
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
              <button
                className="btn-primary"
                onClick={() => onLog()}
                disabled={isAmexLogging && !amexPayPath}
              >
                <Icon.Plus size={16} />{" "}
                {isAmexLogging && amexPayPath === "shopwise"
                  ? `Log ${Math.max(1, Math.floor(Number(voucherUnits) || 1))}× ShopWise`
                  : isAmexLogging && amexPayPath
                    ? `Log Amex ${amexPayPath}`
                    : `Log ${selectedRoute && selectedRoute !== best ? "selected" : "this"} expense`}
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
          {alt.ifAmexNotAccepted && (
            <div className="text-xs text-fg-muted mt-0.5">
              <span className="font-medium text-warning">If Amex not accepted: </span>
              {alt.ifAmexNotAccepted.label}
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
