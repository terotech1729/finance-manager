"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ANNUAL_MILESTONES, MONTHLY_MILESTONES, getCardById } from "@/lib/cards";
import { loadState, loadTransactions, type AppState } from "@/lib/storage";
import type { Transaction } from "@/lib/types";
import { CardVisual } from "@/components/CardVisual";
import { CheckpointedProgress } from "@/components/CheckpointedProgress";
import { Callout } from "@/components/Callout";
import { Icon } from "@/components/Icons";
import { inr, inrExact, nfmt } from "@/lib/utils";
import { notFound } from "next/navigation";

const CARD_TIPS: Record<string, { useFor: string[]; dontUseFor: string[]; primaryRole: string }> = {
  amex_gold: {
    primaryRole: "Utility autopay + monthly 6-txn milestone churn + ShopWise (Reward Multiplier 5×)",
    useFor: ["Utility bills (electricity, mobile, TV, broadband)", "ShopWise voucher purchases (Amazon Pay / Swiggy / Flipkart at 5.8%)", "Small recurring purchases ≥₹1K (fills 6-txn monthly milestone)"],
    dontUseFor: ["Fuel (no MR since 12 Jun 2025)", "Insurance / cash advance (excluded)", "International (3.5% forex; use Scapia)"],
  },
  amex_plat_travel: {
    primaryRole: "Big-ticket spend + push toward ₹4L / ₹7L milestone (+ Taj voucher)",
    useFor: ["Hotels direct (Taj, Marriott, etc.)", "Other airline tickets (non-IndiGo, non-Cleartrip via BLCK)", "Generic large spends (>₹5K)", "Use 8 free domestic lounge visits aggressively"],
    dontUseFor: ["Fuel / insurance / utilities / cash / merchant-EMI (excluded)", "International (3.5% forex)", "Cleartrip (use BLCK 19% off)"],
  },
  amex_mrcc: {
    primaryRole: "Monthly milestones (4×₹1.5K + ₹20K) + fee waiver via ₹1.5L annual",
    useFor: ["Mid-sized misc/online purchases (₹1.5K+ fills 4-txn monthly)", "Filler spends to hit ₹20K monthly", "Building toward ₹1.5L annual fee waiver"],
    dontUseFor: ["Same exclusions as PT (fuel/insurance/utilities/cash/merchant-EMI)", "Reward Multiplier (only 2× = 2.3% — worse than BOB Eterna)"],
  },
  scapia: {
    primaryRole: "International (0% forex) + 2% on all eligible spends (travel-locked coins) + lounge (≥₹20K/mo)",
    useFor: ["Foreign currency transactions (0% forex — saves ~3.5% vs Amex)", "Travel via Scapia app (20% coins = 4%)", "General domestic spends (10% coins = 2% value) — since you travel, the coins are usable"],
    dontUseFor: ["Utility/insurance/rent/fuel/wallet/gift-card/govt (excluded from coins)", "If you won't redeem coins on Scapia-app travel (they only redeem there)", "Don't fall below ₹20K/mo (lose lounge)"],
  },
  idfc_indigo: {
    primaryRole: "IndiGo flights (up to 22 BluChips/₹100 ≈ 9.9%) + low-forex backup (1.49%)",
    useFor: ["IndiGo flights via IndiGo app (up to 22 BluChips/₹100 ≈ 9.9% at ₹0.45/chip)", "International if Scapia rejected (1.49% forex)", "Mastercard golf benefit"],
    dontUseFor: ["UPI / insurance / utility / fuel / rent / wallet (only 0.5 BluChip/₹100 ≈ 0.23%)", "Cash / EMI (zero BluChips)", "Other spends earn 3 BluChips/₹100 ≈ 1.35% — better cards exist"],
  },
  bob_eterna: {
    primaryRole: "5× categories backup (dining/online) + lounge backup (₹40K/qtr)",
    useFor: ["Dining (offline) — 3.75% till 5K RP cycle cap", "Online merchants when Cashkaro applies", "Welcome ₹50K → 10K RP (₹2,500) within 60 days"],
    dontUseFor: ["Beyond 5K RP/cycle cap (drops to 0.75%)", "Fuel (no rewards)", "Tax / govt MCC (excluded)"],
  },
  yes_kiwi: {
    primaryRole: "UPI scan/pay (2% via Kiwi Neon) + milestone-based lounge unlocks",
    useFor: ["In-person UPI QR (kirana, autos, restaurants taking UPI only)", "Push toward Kiwi Neon ₹50K/₹1L/₹1.5L milestones for retroactive bumps + lounges"],
    dontUseFor: ["Online card-not-present transactions (low rate)", "International (3.5% forex)", "Categories where Kiwi isn't tracked"],
  },
  sbi_simplyclick: {
    primaryRole: "10× partner brands (Myntra/BMS/Cleartrip/Yatra/Apollo/Netmeds/Dominos/Tata CLiQ)",
    useFor: ["Online partner brands when not on Reward Multiplier or BLCK", "Already at ₹91K — push ₹8.4K more for ₹1L milestone (29.8% marginal)"],
    dontUseFor: ["Offline POS (0.25% wasted)", "Outside the 10× partner list (5× other online beats other cards rarely)", "Anything beyond 10K RP/month per category cap"],
  },
  swiggy_blck: {
    primaryRole: "Swiggy (10% direct) + Cleartrip (24% with HDFCCC) + 5% online merchants",
    useFor: ["Swiggy app (10% capped ₹1.5K/mo)", "Cleartrip hotels with HDFCCC coupon (24% effective)", "Cleartrip flights (11%)", "Nykaa with BLCK 5%-off (10%)", "Online merchants in BLCK 5% list (Amazon, Flipkart, Myntra, Ajio etc.)"],
    dontUseFor: ["Tax / govt / fuel / rent / wallet / EMI / forex (excluded)", "Beyond ₹1.5K/mo cap (drops to 1%)", "Min ₹249/txn for 10% Swiggy, ₹100 for 5% online"],
  },
  amazon_pay_icici: {
    primaryRole: "Amazon (5% Prime, uncapped) + low-forex backup (1.99%)",
    useFor: ["All Amazon purchases (5% Prime, no cap)", "Above Amex Gold ShopWise ₹10K/mo voucher cap, switch here", "Amazon Pay partner merchants (2%)", "International if Scapia rejected"],
    dontUseFor: ["Outside Amazon (only 1% other)", "Wallet load (1% fee post Jan 2026 if >₹5K)", "Try Cashkaro click-through anyway — worst case = 5% Prime"],
  },
};

export default function CardDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const card = getCardById(id);
  const [state, setState] = useState<AppState | null>(null);
  const [allTxns, setAllTxns] = useState<Transaction[]>([]);
  useEffect(() => {
    setState(loadState());
    setAllTxns(loadTransactions());
  }, []);
  if (!card) return notFound();
  const cardTxns = allTxns.filter((t) => t.cardId === id);
  const cardMilestones = ANNUAL_MILESTONES.filter((m) => m.cardId === id);
  const cardMonthly = MONTHLY_MILESTONES.filter((m) => m.cardId === id);
  const tips = CARD_TIPS[id];

  const cardYtdSpend = (() => {
    if (!state) return 0;
    return id === "amex_plat_travel" ? state.ptccEligibleSpend :
      id === "amex_mrcc" ? state.mrccCycleSpend :
      id === "sbi_simplyclick" ? state.sbiYtdSpend :
      id === "idfc_indigo" ? state.idfcYtdSpend :
      id === "bob_eterna" ? state.bobYtdSpend :
      id === "swiggy_blck" ? state.blckYtdSpend :
      id === "scapia" ? state.scapiaMonthlySpend :
      id === "yes_kiwi" ? state.kiwiNeonCycleSpend :
      0;
  })();

  const totalEarnedOnCard = cardTxns.reduce((acc, t) => acc + t.rewardInr, 0);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-fg-muted">
        <Link href="/" className="hover:text-fg">Dashboard</Link>
        <span>/</span>
        <Link href="/cards" className="hover:text-fg">Cards</Link>
        <span>/</span>
        <span className="text-fg">{card.short}</span>
      </div>

      {/* Hero: card + key info */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="max-w-md">
          <CardVisual card={card} size="lg" />
        </div>
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold">{card.name}</h1>
            <p className="text-fg-muted mt-1">{card.issuer} · {card.network}</p>
          </div>
          {card.notes && (
            <Callout tone="info">{card.notes}</Callout>
          )}
          {tips && (
            <div className="card-shell p-4">
              <div className="label mb-1">Primary role</div>
              <div className="text-sm font-medium">{tips.primaryRole}</div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="stat-tile">
              <div className="label">Credit limit</div>
              <div className="text-lg font-semibold mt-1">{card.creditLimit === 0 ? "No-preset" : inr(card.creditLimit)}</div>
            </div>
            <div className="stat-tile">
              <div className="label">Annual fee</div>
              <div className="text-lg font-semibold mt-1">
                {card.annualFee === 0 ? <span className="text-success">LTF</span> : inr(card.annualFee)}
                {card.feeWaivable && card.feeWaiverAt ? <span className="text-xs text-fg-muted ml-2">(waivable @ {inr(card.feeWaiverAt)})</span> : null}
              </div>
            </div>
            <div className="stat-tile">
              <div className="label">Forex markup</div>
              <div className="text-lg font-semibold mt-1">{card.forexPct === 0 ? <span className="text-success">0%</span> : `${card.forexPct}%`}</div>
            </div>
            <div className="stat-tile">
              <div className="label">Best earn rate</div>
              <div className="text-lg font-semibold mt-1 text-success">{card.bestRatePct}%</div>
            </div>
            {card.statementDay ? (
              <div className="stat-tile">
                <div className="label">Statement cuts</div>
                <div className="text-lg font-semibold mt-1">{card.statementDay}<sup>th</sup> of month</div>
              </div>
            ) : null}
            <div className="stat-tile">
              <div className="label">Lounge access</div>
              <div className="text-lg font-semibold mt-1">{card.loungeRule || "—"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Annual milestones (if any) */}
      {cardMilestones.length > 0 && state && (() => {
        const sorted = [...cardMilestones].sort((a, b) => a.threshold - b.threshold);
        const top = sorted[sorted.length - 1].threshold;
        const checkpoints = sorted.slice(0, -1).map((m) => ({
          value: m.threshold,
          hit: state.milestonesHit.includes(`${m.cardId}:${m.threshold}`) || cardYtdSpend >= m.threshold,
        }));
        return (
          <section>
            <h2 className="text-lg font-bold mb-3">Annual milestones</h2>
            <div className="card-shell p-4 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-fg-muted">Cycle progress</span>
                <span className="font-semibold">{inrExact(cardYtdSpend)} / {inrExact(top)}</span>
              </div>
              <CheckpointedProgress
                current={cardYtdSpend}
                total={top}
                checkpoints={checkpoints}
                tone={cardYtdSpend >= top ? "success" : "info"}
              />
              <div className="space-y-2 mt-2">
                {sorted.map((m) => {
                  const hit = state.milestonesHit.includes(`${m.cardId}:${m.threshold}`) || cardYtdSpend >= m.threshold;
                  const close = !hit && cardYtdSpend >= m.threshold * 0.85;
                  return (
                    <div key={m.threshold} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {hit ? <span className="pill-success">Hit</span> : close ? <span className="pill-warning">Close</span> : <span className="pill-neutral">Pending</span>}
                        <span>{inrExact(m.threshold)} → {m.reward}</span>
                      </div>
                      <span className="text-fg-muted">{inrExact(m.rewardValueInr)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })()}

      {/* Monthly milestones (if any) */}
      {cardMonthly.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-3">Monthly milestones</h2>
          <div className="card-shell">
            <table className="w-full text-sm">
              <thead className="text-fg-muted text-xs uppercase tracking-wide">
                <tr><th className="text-left p-3">Rule</th><th className="text-right">Min spend</th><th className="text-right p-3">Reward</th></tr>
              </thead>
              <tbody>
                {cardMonthly.map((m, i) => (
                  <tr key={i} className="table-row">
                    <td className="p-3">{m.rule}</td>
                    <td className="text-right">{inrExact(m.minSpend)}</td>
                    <td className="text-right p-3 text-success">{inrExact(m.rewardInr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Use for / Don't use for */}
      {tips && (
        <section className="grid md:grid-cols-2 gap-4">
          <div className="card-shell p-4 border-success/40 bg-success-muted">
            <div className="font-semibold text-success mb-2 flex items-center gap-2"><Icon.Zap size={16} />Use this card for</div>
            <ul className="text-sm space-y-1 list-disc pl-4">
              {tips.useFor.map((u, i) => <li key={i}>{u}</li>)}
            </ul>
          </div>
          <div className="card-shell p-4 border-danger/40 bg-danger-muted">
            <div className="font-semibold text-danger mb-2 flex items-center gap-2"><Icon.Shield size={16} />Don't use for</div>
            <ul className="text-sm space-y-1 list-disc pl-4">
              {tips.dontUseFor.map((u, i) => <li key={i}>{u}</li>)}
            </ul>
          </div>
        </section>
      )}

      {/* Transactions on this card */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-lg font-bold">Transactions on this card</h2>
          <div className="text-sm text-fg-muted">
            {cardTxns.length} txns · {inr(cardTxns.reduce((a, t) => a + t.amount, 0))} spent · <span className="text-success">{inr(totalEarnedOnCard)} earned</span>
          </div>
        </div>
        {cardTxns.length === 0 ? (
          <div className="card-shell p-8 text-center text-fg-muted">
            <Icon.Transaction className="mx-auto mb-2 opacity-50" size={32} />
            No transactions logged on this card yet.
            <div className="mt-3">
              <Link href="/transactions" className="btn-primary inline-flex">
                <Icon.Plus size={16} />
                Log a transaction
              </Link>
            </div>
          </div>
        ) : (
          <div className="card-shell">
            <table className="w-full text-sm">
              <thead className="text-fg-muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left">Merchant</th>
                  <th className="text-left">Category</th>
                  <th className="text-left">Path</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right p-3">Reward</th>
                </tr>
              </thead>
              <tbody>
                {cardTxns.map((t) => (
                  <tr key={t.id} className="table-row">
                    <td className="p-3 text-fg-muted">{new Date(t.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</td>
                    <td className="font-medium">{t.merchant}</td>
                    <td className="text-fg-muted">{t.category}</td>
                    <td><span className="pill-neutral">{t.path}</span></td>
                    <td className="text-right">{inrExact(t.amount)}</td>
                    <td className="text-right p-3 text-success">{inrExact(t.rewardInr)} <span className="text-xs text-fg-muted">({t.effectivePct.toFixed(1)}%)</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
