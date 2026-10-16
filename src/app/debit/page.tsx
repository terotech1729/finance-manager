"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DEBIT_CARDS } from "@/lib/debitCards";
import { loadState, saveState, type AppState } from "@/lib/storage";
import { useDataVersion } from "@/lib/useLiveData";
import { CardVisual } from "@/components/CardVisual";
import { Callout } from "@/components/Callout";
import { Icon } from "@/components/Icons";
import { inr, inrExact } from "@/lib/utils";
import { HDFC_DEBIT_LOUNGE_QUARTER_INR } from "@/lib/lounges";
import { liveRoutes, deadRoutes, sbiUnipayReturnInr, SBI_RP_MILESTONE_INR, SBI_RP_MILESTONE_POINTS, SBI_RP_VALUE_INR } from "@/lib/billRoutes";

export default function DebitPage() {
  const [state, setState] = useState<AppState | null>(null);
  const dataVersion = useDataVersion();
  useEffect(() => { setState(loadState()); }, [dataVersion]);
  if (!state) return <div className="text-fg-muted">Loading…</div>;

  const update = <K extends keyof AppState>(k: K, v: AppState[K]) => {
    const next = { ...state, [k]: v };
    setState(next);
    saveState(next);
  };

  const sbiMilestoneMet = (state.sbiUnipayMonthSpend ?? 0) >= SBI_RP_MILESTONE_INR;
  const debitGateMet = (state.hdfcDebitQuarterSpend ?? 0) >= HDFC_DEBIT_LOUNGE_QUARTER_INR;
  const card = DEBIT_CARDS[0];
  const vouchers = state.gyftrVouchers ?? [];
  const openBal = vouchers.filter((v) => !v.redeemed).reduce((s, v) => s + v.valueInr, 0);
  const bal = Math.max(state.gyftrBalance, openBal);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">Debit & GyFTR</h1>
        <p className="text-fg-muted mt-1">
          Separate from credit cards — HDFC Visa Platinum debit cashback points + GyFTR campaign vouchers.
        </p>
      </div>

      <section className="grid sm:grid-cols-3 gap-4">
        <div className="card-shell p-5 bg-gradient-to-br from-info/10 via-bg-elevated to-bg-elevated border-info/30">
          <div className="label">GyFTR balance (tracked)</div>
          <div className="text-3xl font-bold mt-1">{inr(bal)}</div>
          <div className="text-xs text-fg-muted mt-1">{inrExact(bal)} · claim via GyFTR / email code</div>
        </div>
        <div className="card-shell p-5">
          <div className="label">Debit cashback points</div>
          <div className="text-3xl font-bold mt-1">{nfmt(state.hdfcDebitCashbackPts)}</div>
          <div className="text-xs text-fg-muted mt-1">NetBanking / MobileBanking · ≈ ₹1/pt · min redeem 250</div>
        </div>
        <div className="card-shell p-5">
          <div className="label">Welcome GyFTR ₹750</div>
          <div className="text-lg font-bold mt-1">
            {state.hdfcDebitWelcomeGyftrClaimed ? "Received" : "Not yet"}
          </div>
          <div className="text-xs text-fg-muted mt-1">New-account SmartBuy campaign (5× ≥₹500)</div>
        </div>
      </section>

      <Callout tone="success">
        <div className="font-medium mb-1">Why you got ₹750 on GyFTR</div>
        <p className="text-sm mb-2">
          This is <b>not</b> the ongoing monthly cashback-points pool. It is HDFC SmartBuy&apos;s{" "}
          <b>new savings/debit activation offer</b> (offer id ~25064, live Apr 2025–Apr 2026 cohorts):
        </p>
        <ul className="text-sm list-disc pl-4 space-y-1">
          <li>
            <b>₹750 GyFTR</b> for <b>5 or more</b> debit POS / online / contactless spends of <b>≥₹500 each</b>
            (₹500 voucher if you only hit 3 such txns).
          </li>
          <li>
            Window = <b>account-opening calendar month + the next calendar month</b> only.
            ATM and UPI do <b>not</b> count.
          </li>
          <li>
            Fulfilment is emailed/SMS&apos;d afterward (often ~90 days / by a stated posting date) with a promo code →{" "}
            <a
              className="text-accent underline"
              href="https://www.gyftr.com/rewards/hdfcbank-dc-campaigns/"
              target="_blank"
              rel="noreferrer"
            >
              gyftr.com/rewards/hdfcbank-dc-campaigns
            </a>
            .
          </li>
        </ul>
        <p className="text-sm mt-2 text-fg-muted">
          Separate from Platinum debit&apos;s monthly Swiggy/BMS/grocery cashback points (shared ~₹750/mo account cap in NetBanking).
        </p>
      </Callout>

      <section className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">
        <div className="space-y-2">
          <CardVisual card={card} href="/debit" size="md" />
          <div className="text-xs text-fg-muted px-1">
            {card.annualFee === 0 ? "LTF" : `Fee ~${inr(card.annualFee)}/yr`} · {card.network}
          </div>
        </div>

        <div className="space-y-6">
          <section className="card-shell">
            <div className="card-header font-semibold flex items-center gap-2">
              <Icon.Sparkles size={16} /> Track balances
            </div>
            <div className="card-body grid sm:grid-cols-2 gap-3">
              <div>
                <div className="label mb-1">GyFTR balance (₹)</div>
                <input
                  className="input"
                  type="number"
                  value={state.gyftrBalance}
                  onChange={(e) => update("gyftrBalance", Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <div className="label mb-1">Cashback points (NetBanking)</div>
                <input
                  className="input"
                  type="number"
                  value={state.hdfcDebitCashbackPts}
                  onChange={(e) => update("hdfcDebitCashbackPts", Number(e.target.value) || 0)}
                />
              </div>
              <div>
                <div className="label mb-1">Debit / account issue date</div>
                <input
                  className="input"
                  placeholder="YYYY-MM-DD"
                  value={state.hdfcDebitIssueDate}
                  onChange={(e) => update("hdfcDebitIssueDate", e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm mt-6">
                <input
                  type="checkbox"
                  checked={state.hdfcDebitWelcomeGyftrClaimed}
                  onChange={(e) => update("hdfcDebitWelcomeGyftrClaimed", e.target.checked)}
                />
                Welcome GyFTR ₹500/₹750 already received
              </label>
            </div>
          </section>

          <section className="card-shell">
            <div className="card-header font-semibold">Campaigns & vouchers</div>
            <div className="card-body space-y-4">
              {card.campaigns.map((c) => (
                <div key={c.id} className="border border-border rounded-lg p-3 space-y-1">
                  <div className="font-medium">{c.title}</div>
                  <div className="text-sm text-accent">{c.reward}</div>
                  <div className="text-sm text-fg-muted">{c.how}</div>
                  {c.notes && <div className="text-xs text-fg-subtle">{c.notes}</div>}
                  {c.claimUrl && (
                    <a className="text-sm text-accent underline" href={c.claimUrl} target="_blank" rel="noreferrer">
                      Claim / redeem →
                    </a>
                  )}
                </div>
              ))}

              <div className="pt-2 border-t border-border">
                <div className="label mb-2">Logged GyFTR vouchers</div>
                {vouchers.length === 0 ? (
                  <div className="text-sm text-fg-muted">None logged.</div>
                ) : (
                  <ul className="space-y-2">
                    {vouchers.map((v) => (
                      <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <span>
                          {v.description} · <b>{inr(v.valueInr)}</b>
                          {v.expires ? ` · exp ${v.expires}` : ""}
                        </span>
                        <button
                          className="btn-secondary text-xs"
                          onClick={() => {
                            const next = vouchers.map((x) =>
                              x.id === v.id ? { ...x, redeemed: !x.redeemed } : x
                            );
                            update("gyftrVouchers", next);
                            if (!v.redeemed) update("gyftrBalance", Math.max(0, state.gyftrBalance - v.valueInr));
                          }}
                        >
                          {v.redeemed ? "Mark unredeemed" : "Mark redeemed"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>

          <section className="card-shell">
            <div className="card-header font-semibold">Ongoing monthly cashback (points ≈ ₹1)</div>
            <div className="card-body">
              <ul className="space-y-2 text-sm">
                {card.monthlyCashback.map((r) => (
                  <li key={r.rule} className="flex justify-between gap-3">
                    <span>{r.rule}</span>
                    <span className="text-fg-muted whitespace-nowrap">cap ~{inr(r.capInr)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-fg-muted mt-3">
                Account-level monthly cap is typically ~750 pts across cards on the account. Points appear in NetBanking within ~2 working days; min redemption 250; lapse ~12 months after credit.
              </p>
            </div>
          </section>

          <section className="card-shell">
            <div className="card-header font-semibold">Lounge gate — ₹10,000 this quarter</div>
            <div className="card-body space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-fg-muted">Qualifying spend logged</span>
                <span className="readout text-sm">
                  {inr(state.hdfcDebitQuarterSpend ?? 0)} / {inr(HDFC_DEBIT_LOUNGE_QUARTER_INR)}
                </span>
              </div>
              <div className="bar">
                <div
                  className={`bar-fill ${debitGateMet ? "bar-fill-success" : "bar-fill-warning"}`}
                  style={{
                    width: `${Math.min(100, ((state.hdfcDebitQuarterSpend ?? 0) / HDFC_DEBIT_LOUNGE_QUARTER_INR) * 100)}%`,
                  }}
                />
              </div>
              <label className="block">
                <span className="label">Update qualifying spend this quarter</span>
                <input
                  className="input mt-1"
                  inputMode="numeric"
                  value={state.hdfcDebitQuarterSpend ?? 0}
                  onChange={(e) => update("hdfcDebitQuarterSpend", Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                />
              </label>
              <Callout tone={debitGateMet ? "success" : "warning"}>
                {debitGateMet
                  ? "Gate cleared — HDFC sends a link by SMS/email within 2–3 working days. Claim it: since 10 Jan 2026 the desk needs the 12–18 digit voucher code and swiping the card is refused."
                  : `${inr(HDFC_DEBIT_LOUNGE_QUARTER_INR - (state.hdfcDebitQuarterSpend ?? 0))} more unlocks 2 domestic visits (8/yr). Telecom and utility spend is the cheapest way there — it also earns 1%.`}
              </Callout>
              <p className="text-xs text-fg-muted">
                Credit-card bill payments and MCC 6010/6011/6012/6211/7995 are excluded from this
                gate, so paying a card bill on this debit card builds nothing toward it.
              </p>
            </div>
          </section>

          <section className="card-shell">
            <div className="card-header font-semibold">Paying credit-card bills — what actually pays</div>
            <div className="card-body space-y-3">
              <p className="text-xs text-fg-muted">
                Networks tag card-bill payments as MCC 6012, which nearly every rewards programme
                excludes. The default return is zero; anything above it is a promotion the platform
                funds and can pull without notice. Figures are per ₹1,00,000 paid.
              </p>

              <div className="rounded-md border border-border bg-bg-chrome p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="label">SBI Unipay this month</span>
                  <span className="readout text-sm">
                    {inr(state.sbiUnipayMonthSpend ?? 0)} / {inr(SBI_RP_MILESTONE_INR)}
                  </span>
                </div>
                <div className="bar mt-1.5">
                  <div
                    className={`bar-fill ${sbiMilestoneMet ? "bar-fill-success" : "bar-fill-warning"}`}
                    style={{
                      width: `${Math.min(100, ((state.sbiUnipayMonthSpend ?? 0) / SBI_RP_MILESTONE_INR) * 100)}%`,
                    }}
                  />
                </div>
                <label className="mt-2 block">
                  <span className="label">Paid via Unipay this month</span>
                  <input
                    className="input mt-1"
                    inputMode="numeric"
                    value={state.sbiUnipayMonthSpend ?? 0}
                    onChange={(e) => update("sbiUnipayMonthSpend", Number(e.target.value.replace(/[^0-9]/g, "")) || 0)}
                  />
                </label>
                <div className="mt-2 flex items-baseline justify-between gap-3 text-[11px]">
                  <span className="text-fg-muted">Earned so far</span>
                  <span className="readout text-success">
                    {inr(sbiUnipayReturnInr(state.sbiUnipayMonthSpend ?? 0))}
                  </span>
                </div>
                {!sbiMilestoneMet && (
                  <p className="mt-1.5 text-[11px] text-warning">
                    {inr(SBI_RP_MILESTONE_INR - (state.sbiUnipayMonthSpend ?? 0))} more this month
                    triggers the 1,000-point bonus — worth {inr(SBI_RP_MILESTONE_POINTS * SBI_RP_VALUE_INR)}.
                    The last rupee before ₹1L is the most valuable one you will spend all month.
                  </p>
                )}
              </div>
              {liveRoutes().map((r) => (
                <div key={r.id} className="border-b border-border pb-2 last:border-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-fg">{r.name}</span>
                    <span className="readout shrink-0 text-sm text-success">
                      {r.per1LInr === null ? "varies" : `≈${inr(r.per1LInr)}`}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-fg-muted">{r.rate}</div>
                  <div className="mt-1 text-[11px] text-fg-subtle">{r.verdict}</div>
                </div>
              ))}

              <div className="label pt-1 text-warning">Closed or misleading — don&apos;t re-try</div>
              {deadRoutes().map((r) => (
                <div key={r.id} className="border-b border-border pb-2 last:border-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-fg-muted line-through">{r.name}</span>
                    <span className={`pill ${r.status === "trap" ? "pill-danger" : "pill-neutral"}`}>
                      {r.status}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-fg-subtle">{r.verdict}</div>
                </div>
              ))}
            </div>
          </section>

          <section className="card-shell">
            <div className="card-header font-semibold">Other perks</div>
            <div className="card-body">
              <ul className="list-disc pl-4 text-sm space-y-1">
                {card.perks.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <p className="text-sm text-fg-muted mt-3">{card.notes}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <a
                  className="text-accent underline"
                  href="https://www.hdfc.bank.in/debit-cards/platinum-debit-card"
                  target="_blank"
                  rel="noreferrer"
                >
                  HDFC Platinum debit product page
                </a>
                <a
                  className="text-accent underline"
                  href="https://offers.smartbuy.hdfc.bank.in/offer_details/hdfc-bank-debit-card/25064"
                  target="_blank"
                  rel="noreferrer"
                >
                  SmartBuy GyFTR offer T&Cs
                </a>
                <Link className="text-accent underline" href="/cards">
                  Credit cards →
                </Link>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function nfmt(n: number) {
  return new Intl.NumberFormat("en-IN").format(n);
}
