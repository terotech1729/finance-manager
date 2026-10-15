"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadState, type AppState } from "@/lib/storage";
import { useDataVersion } from "@/lib/useLiveData";
import { buildRewardLedger, idleCash, type RewardBalanceRow } from "@/lib/rewards";
import { HudPanel, Readout } from "@/components/Hud";
import { Callout } from "@/components/Callout";
import { inr, nfmt } from "@/lib/utils";

const LIQUIDITY_LABEL: Record<RewardBalanceRow["liquidity"], string> = {
  cash: "Cashable",
  voucher: "Vouchers",
  travel: "Travel only",
  locked: "App-locked",
};

const CONFIDENCE_PILL: Record<RewardBalanceRow["confidence"], string> = {
  firm: "pill-success",
  soft: "pill-info",
  speculative: "pill-warning",
};

function BalanceRow({ r }: { r: RewardBalanceRow }) {
  return (
    <div className="border-b border-border py-3 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          {r.cardId ? (
            <Link href={`/cards/${r.cardId}`} className="font-medium text-fg hover:text-accent">
              {r.label}
            </Link>
          ) : (
            <span className="font-medium text-fg">{r.label}</span>
          )}
          <div className="readout mt-0.5 text-[11px] text-fg-muted">
            {nfmt(r.units)} {r.unitName} × ₹{r.unitValueInr.toFixed(2)}
          </div>
        </div>
        <div className="text-right">
          <div className={`readout text-lg ${r.confidence === "speculative" ? "text-warning" : "text-fg"}`}>
            {inr(r.inrValue)}
          </div>
          <div className="mt-0.5 flex justify-end gap-1">
            <span className="pill-neutral">{LIQUIDITY_LABEL[r.liquidity]}</span>
            <span className={CONFIDENCE_PILL[r.confidence]}>{r.confidence}</span>
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-fg-muted">{r.redeemVia}</p>
      {r.caveat && <p className="mt-1 text-[11px] text-warning/80">{r.caveat}</p>}
    </div>
  );
}

export default function RewardsPage() {
  const [state, setState] = useState<AppState | null>(null);
  const dataVersion = useDataVersion();

  useEffect(() => {
    setState(loadState());
  }, [dataVersion]);

  const ledger = useMemo(() => (state ? buildRewardLedger(state) : null), [state]);
  const cash = useMemo(() => (state ? idleCash(state) : []), [state]);

  if (!state || !ledger) return <div className="text-fg-muted">Loading…</div>;

  const banked = ledger.rows.filter((r) => r.confidence !== "speculative");
  const speculative = ledger.rows.filter((r) => r.confidence === "speculative");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Reward wallet</h1>
        <p className="page-sub">Every point balance in one place, valued at the redemption you&apos;d actually use.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Readout label="Bankable" value={inr(ledger.bankableInr)} tone="green" sub="Published conversion rates" />
        <Readout label="Idle cash" value={inr(ledger.idleCashInr)} tone="cyan" sub="Gift-card & wallet float" />
        <Readout label="Unproven" value={inr(ledger.speculativeInr)} tone="gold" sub="No published rate" />
        <Readout label="Currencies" value={ledger.rows.length} sub="With a live balance" />
      </div>

      {ledger.speculativeInr > ledger.bankableInr * 0.5 && (
        <Callout tone="warning" title="Most of the headline is unproven">
          {inr(ledger.speculativeInr)} of this wallet sits in app currencies with no published conversion
          rate. It&apos;s excluded from the bankable figure on purpose — counting it would flatter your net
          worth by an amount nobody has ever paid you.
        </Callout>
      )}

      <HudPanel title="Bankable balances">
        {banked.length === 0 ? (
          <p className="text-sm text-fg-muted">No balances with a published rate.</p>
        ) : (
          banked.map((r) => <BalanceRow key={r.key} r={r} />)
        )}
      </HudPanel>

      {cash.length > 0 && (
        <HudPanel title="Idle rupees">
          {cash.map((c) => (
            <div key={c.label} className="flex items-baseline justify-between border-b border-border py-2.5 last:border-0">
              <div>
                <div className="font-medium text-fg">{c.label}</div>
                <div className="text-[11px] text-fg-muted">{c.note}</div>
              </div>
              <div className="readout text-lg text-accent">{inr(c.inr)}</div>
            </div>
          ))}
        </HudPanel>
      )}

      {speculative.length > 0 && (
        <HudPanel title="Unproven — excluded from the total">
          {speculative.map((r) => (
            <BalanceRow key={r.key} r={r} />
          ))}
        </HudPanel>
      )}
    </div>
  );
}
