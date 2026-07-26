"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadState, loadTransactions, loadHoldings, holdingInvested, holdingValue, type AppState } from "@/lib/storage";
import { CARDS } from "@/lib/cards";
import { inr, inrExact, nfmt } from "@/lib/utils";
import type { Transaction, Holding } from "@/lib/types";
import { CardVisual } from "@/components/CardVisual";
import { Icon } from "@/components/Icons";

type CurrencyTile = {
  label: string;
  units: number;
  unitName: string;
  inrValue: number;
  hint?: string;
  cardId?: string;
};

export default function DashboardPage() {
  const [state, setState] = useState<AppState | null>(null);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  useEffect(() => {
    setState(loadState());
    setTxns(loadTransactions());
    setHoldings(loadHoldings());
  }, []);
  if (!state) return <div className="text-fg-muted">Loading…</div>;

  const currencies: CurrencyTile[] = [
    { label: "Amex Membership Rewards", units: state.amexMrPooled, unitName: "MR", inrValue: state.amexMrPooled * 0.58, hint: "@ Taj 24K Gold redemption (₹0.58/MR)", cardId: "amex_plat_travel" },
    { label: "IndiGo BluChips", units: state.indigoBluChips, unitName: "BluChips", inrValue: state.indigoBluChips * 0.45, hint: "≈ ₹0.45/BluChip on IndiGo flights (dynamic ₹0.40–0.60)", cardId: "idfc_indigo" },
    { label: "Scapia Coins", units: state.scapiaCoins, unitName: "coins", inrValue: state.scapiaCoins * 0.2, hint: "5 coins = ₹1 (Scapia-app travel only)", cardId: "scapia" },
    { label: "Kiwi Cashback (cycle)", units: state.kiwiCashback, unitName: "Kiwis", inrValue: state.kiwiCashback * 0.25, hint: `1 Kiwi = ₹0.25 (cashable). Lifetime: ${inr(state.kiwiLifetimeEarned)}`, cardId: "yes_kiwi" },
    { label: "SBI Reward Points", units: state.sbiRp, unitName: "RP", inrValue: state.sbiRp * 0.2, hint: "1 RP = ₹0.20", cardId: "sbi_simplyclick" },
    { label: "BOB Reward Points", units: state.bobRp, unitName: "RP", inrValue: state.bobRp * 0.25, hint: "1 RP = ₹0.25 (cashback)", cardId: "bob_eterna" },
    { label: "CRED Coins", units: state.credCoins, unitName: "coins", inrValue: state.credCoins * 0.03, hint: "Realistic ₹0.02-0.05/coin. Kill-the-Bill rare ₹1/coin." },
    { label: "CheQ Chips", units: state.cheqChips, unitName: "chips", inrValue: state.cheqChips * 0.10, hint: "1 chip ≈ ₹0.10 vs CC bill (cap 1000/mo). NOT cashable to bank." },
  ];

  const totalLifetimeSavings = currencies.reduce((acc, c) => acc + c.inrValue, 0);
  const totalRewardsThisYear = txns.reduce((acc, t) => acc + t.rewardInr, 0);
  const totalInvested = holdings.reduce((acc, h) => acc + holdingInvested(h), 0);
  const totalPortfolioValue = holdings.reduce((acc, h) => acc + holdingValue(h), 0);
  const totalSpentThisYear = txns.reduce((acc, t) => acc + t.amount, 0);

  return (
    <div className="space-y-8">
      {/* Hero header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="page-title">Welcome back</h1>
          <p className="page-sub">Your personal finance command center</p>
        </div>
        <Link href="/recommend" className="btn-primary w-full sm:w-auto">
          <Icon.Zap size={16} /> Recommend a route
        </Link>
      </div>

      {/* Primary CTA banner */}
      <Link href="/recommend" className="block">
        <div className="card-shell p-4 sm:p-5 bg-gradient-to-br from-accent/10 via-bg-elevated to-bg-elevated border-accent/40 hover:border-accent transition-colors flex items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center text-accent shrink-0">
              <Icon.Zap size={20} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold">About to spend on something?</div>
              <div className="text-sm text-fg-muted mt-0.5">Optimal card + route — Cashkaro, gift-cards & stacks compared.</div>
            </div>
          </div>
          <Icon.ArrowRight size={18} className="text-fg-muted shrink-0 hidden sm:block" />
        </div>
      </Link>

      {/* Lifetime stats hero */}
      <section className="grid md:grid-cols-3 gap-3">
        <div className="card-shell p-5 bg-gradient-to-br from-success/10 via-bg-elevated to-bg-elevated border-success/30">
          <div className="label">Total wallet value (loyalty)</div>
          <div className="text-2xl sm:text-3xl font-bold mt-1 text-success">{inr(totalLifetimeSavings)}</div>
          <div className="text-xs text-fg-muted mt-1">Sum of all loyalty currencies at best-case redemption</div>
        </div>
        <div className="card-shell p-5 bg-gradient-to-br from-accent/10 via-bg-elevated to-bg-elevated border-accent/30">
          <div className="label">Logged YTD CC spend</div>
          <div className="text-2xl sm:text-3xl font-bold mt-1">{inr(totalSpentThisYear)}</div>
          <div className="text-xs text-fg-muted mt-1">{txns.length} txns · {inr(totalRewardsThisYear)} earned in rewards</div>
        </div>
        <div className="card-shell p-5 bg-gradient-to-br from-info/10 via-bg-elevated to-bg-elevated border-info/30">
          <div className="label">Portfolio value</div>
          <div className="text-2xl sm:text-3xl font-bold mt-1 text-info">{inr(totalPortfolioValue)}</div>
          <div className="text-xs text-fg-muted mt-1">{inr(totalInvested)} invested across {holdings.length} holding{holdings.length === 1 ? "" : "s"} · <Link href="/investments" className="underline">manage</Link></div>
        </div>
      </section>

      {/* Loyalty currencies grid */}
      <section>
        <h2 className="text-lg font-bold mb-3">Loyalty currencies</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {currencies.map((c) => {
            const Wrap = c.cardId
              ? ({ children }: { children: React.ReactNode }) => <Link href={`/cards/${c.cardId}`} className="block">{children}</Link>
              : ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
            return (
              <Wrap key={c.label}>
                <div className="stat-tile h-full hover:border-accent transition-colors">
                  <div className="label">{c.label}</div>
                  <div className="text-xl font-bold mt-1">{nfmt(c.units)}<span className="text-xs text-fg-muted ml-1 font-normal">{c.unitName}</span></div>
                  <div className="text-xs text-success font-medium mt-0.5">≈ {inr(c.inrValue)}</div>
                  {c.hint ? <div className="text-xs text-fg-muted mt-1">{c.hint}</div> : null}
                </div>
              </Wrap>
            );
          })}
        </div>
      </section>

      {/* Card grid */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Your Cards</h2>
            <p className="text-sm text-fg-muted mt-0.5">Click any card to see its transactions, milestones, and benefits</p>
          </div>
          <Link href="/cards" className="text-sm text-fg-muted hover:text-fg flex items-center gap-1">
            View all <Icon.ArrowRight size={14} />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CARDS.filter((c) => c.status === "active").map((c) => (
            <CardVisual key={c.id} card={c} href={`/cards/${c.id}`} size="md" />
          ))}
        </div>
      </section>

      {/* Recent transactions */}
      {txns.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xl font-bold">Recent transactions</h2>
            <Link href="/transactions" className="text-sm text-fg-muted hover:text-fg flex items-center gap-1">
              View all <Icon.ArrowRight size={14} />
            </Link>
          </div>
          <div className="card-shell">
            <table className="w-full text-sm">
              <thead className="text-fg-muted text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left">Merchant</th>
                  <th className="text-left">Card</th>
                  <th className="text-right">Amount</th>
                  <th className="text-right p-3">Reward</th>
                </tr>
              </thead>
              <tbody>
                {txns.slice(0, 5).map((t) => {
                  const card = CARDS.find((c) => c.id === t.cardId);
                  return (
                    <tr key={t.id} className="table-row">
                      <td className="p-3 text-fg-muted">{new Date(t.date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</td>
                      <td className="font-medium">{t.merchant}</td>
                      <td>
                        <Link href={`/cards/${t.cardId}`} className="pill-info hover:underline">{card?.short ?? t.cardId}</Link>
                      </td>
                      <td className="text-right">{inrExact(t.amount)}</td>
                      <td className="text-right text-success p-3">{inrExact(t.rewardInr)}</td>
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
