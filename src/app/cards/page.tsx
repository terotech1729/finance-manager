"use client";
import Link from "next/link";
import { CARDS, netCreditLimit } from "@/lib/cards";
import { DEBIT_CARDS } from "@/lib/debitCards";
import { CardVisual } from "@/components/CardVisual";
import { Icon } from "@/components/Icons";
import { inr, inrExact } from "@/lib/utils";

export default function CardsPage() {
  const active = CARDS.filter((c) => c.status === "active");
  const applied = CARDS.filter((c) => c.status === "applied");
  const limited = active.filter((c) => c.creditLimit > 0);
  const noLimit = active.filter((c) => c.creditLimit === 0);
  const net = netCreditLimit();
  const debit = DEBIT_CARDS.filter((c) => c.status === "active");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title">All Cards</h1>
        <p className="text-fg-muted mt-1">
          {active.length} credit active · {applied.length} pending · {debit.length} debit
        </p>
      </div>

      <section className="card-shell p-5 bg-gradient-to-br from-warning/10 via-bg-elevated to-bg-elevated border-warning/30">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="label">Net credit limit</div>
            <div className="text-3xl font-bold mt-1">{inr(net)}</div>
            <div className="text-xs text-fg-muted mt-1">
              Sum of {limited.length} preset limits (debit excluded)
              {noLimit.length > 0 ? ` · ${noLimit.map((c) => c.short).join(", ")}: no fixed limit` : ""}
            </div>
          </div>
          <div className="text-sm text-fg-muted tabular-nums">{inrExact(net)}</div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Icon.Card size={18} /> Credit — active ({active.length})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {active.map((c) => (
            <div key={c.id} className="space-y-2">
              <CardVisual card={c} href={`/cards/${c.id}`} size="md" />
              <div className="flex items-center justify-between text-xs text-fg-muted px-1">
                <span>{c.creditLimit === 0 ? "No fixed limit" : `${inr(c.creditLimit)} limit`}</span>
                <span>{c.bestRatePct}% top rate</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {applied.length > 0 && (
        <section>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Icon.Sparkles size={18} /> Credit — pending issuance ({applied.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {applied.map((c) => (
              <div key={c.id} className="space-y-2">
                <CardVisual card={c} href={`/cards/${c.id}`} size="md" />
                <div className="text-xs text-fg-muted px-1">{c.notes}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Icon.Card size={18} /> Debit ({debit.length})
          </h2>
          <Link href="/debit" className="text-sm text-accent hover:underline">
            GyFTR & debit benefits →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {debit.map((c) => (
            <div key={c.id} className="space-y-2">
              <CardVisual card={c} href="/debit" size="md" />
              <div className="flex items-center justify-between text-xs text-fg-muted px-1">
                <span>{c.annualFee === 0 ? "LTF" : `~${inr(c.annualFee)}/yr fee`}</span>
                <span>GyFTR + cashback pts</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
