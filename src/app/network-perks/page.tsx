"use client";

import Link from "next/link";
import { VISA_TIER_GUIDES } from "@/lib/visaBenefits";
import { getCardById } from "@/lib/cards";
import { Callout } from "@/components/Callout";
import { Icon } from "@/components/Icons";

export default function NetworkPerksPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Icon.Sparkles /> Network perks
        </h1>
        <p className="page-sub">
          Benefits that come with the <b>Visa plastic tier</b> (Infinite / Signature / Platinum) — separate from bank cashback.
          You hold <b>2× Visa Infinite</b> (HSBC Live+, BOB Eterna) and <b>1× Signature</b> (Scapia).
        </p>
      </div>

      <Callout tone="warning" title="Issuer + Visa both matter">
        Network perks can require separate activation, spend thresholds, or offer windows. Always confirm on the linked portal before travel.
        Bank lounges (Scapia DreamFolks, Live+ lounges, BOB ₹40k/qtr) are <b>issuer</b> benefits — listed on each card page, not duplicated here.
      </Callout>

      {VISA_TIER_GUIDES.map((guide) => {
        const held = guide.heldCardIds.map((id) => getCardById(id)).filter(Boolean);
        return (
          <section key={guide.tier} className="card-shell overflow-hidden">
            <div className="card-header">
              <div>
                <div className="font-semibold text-lg">{guide.label}</div>
                <div className="text-sm text-fg-muted mt-0.5">{guide.short}</div>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-end">
                {held.length === 0 ? (
                  <span className="pill-neutral">None held</span>
                ) : (
                  held.map((c) => (
                    <Link key={c!.id} href={`/cards/${c!.id}`} className="pill-info hover:underline">
                      {c!.short}
                    </Link>
                  ))
                )}
              </div>
            </div>
            <div className="divide-y divide-border">
              {guide.perks.map((p) => (
                <div key={p.id} className="card-body space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="font-medium">{p.title}</div>
                    {p.valueHint && <span className="text-xs text-success shrink-0">{p.valueHint}</span>}
                  </div>
                  <p className="text-sm text-fg-muted leading-relaxed">{p.summary}</p>
                  <div className="text-sm">
                    <span className="label">How to claim</span>
                    <div className="mt-0.5 text-fg-muted leading-relaxed">{p.howToClaim}</div>
                  </div>
                  {p.eligibility && (
                    <div className="text-sm">
                      <span className="label">Eligibility</span>
                      <div className="mt-0.5 text-fg-muted leading-relaxed">{p.eligibility}</div>
                    </div>
                  )}
                  {p.recommendHint && (
                    <div className="text-xs rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-fg-muted">
                      <span className="text-accent font-medium">Routing note — </span>
                      {p.recommendHint}
                    </div>
                  )}
                  {p.link && (
                    <a
                      href={p.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                    >
                      Open claim / offer page <Icon.ArrowRight size={14} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <Callout tone="info" title="Want Mastercard / Amex network guides too?">
        Same pattern can cover Mastercard World / World Elite and Amex Membership Rewards partner perks. Tell me when you want those added.
      </Callout>
    </div>
  );
}
