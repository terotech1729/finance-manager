"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { VISA_TIER_GUIDES, type VisaPerk, type VisaTier } from "@/lib/visaBenefits";
import { getCardById } from "@/lib/cards";
import { CardVisual } from "@/components/CardVisual";
import { Icon } from "@/components/Icons";

const TIER_META: Record<VisaTier, { glow: string; chip: string }> = {
  infinite: { glow: "border-violet-500/40", chip: "bg-violet-500/15 text-violet-200 border-violet-400/30" },
  signature: { glow: "border-sky-500/40", chip: "bg-sky-500/15 text-sky-200 border-sky-400/30" },
  platinum: { glow: "border-slate-400/30", chip: "bg-slate-500/15 text-slate-200 border-slate-400/30" },
};

function perkIcon(id: string) {
  if (/meet|lounge|concierge/.test(id)) return Icon.Lounge;
  if (/avis|travel|emergency|agoda/.test(id)) return Icon.Plane;
  if (/itc|hotel|ihg|mmt-hotel|dining|dine|reserve|tattva/.test(id)) return Icon.Trophy;
  if (/times|gift|offers|sephora|ajio|district|play/.test(id)) return Icon.Sparkles;
  if (/protect|shield/.test(id)) return Icon.Shield;
  return Icon.Card;
}

function PerkTile({ perk, open, onToggle }: { perk: VisaPerk; open: boolean; onToggle: () => void }) {
  const I = perkIcon(perk.id);
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`text-left rounded-xl border transition-all p-4 h-full min-h-[128px] flex flex-col ${
        open
          ? "border-accent bg-accent/10 shadow-lg shadow-accent/10 scale-[1.01]"
          : "border-border bg-bg-elevated hover:border-border-strong hover:bg-bg-chrome"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          open ? "bg-accent/25 text-accent" : "bg-bg-chrome text-fg-muted"
        }`}>
          <I size={20} />
        </div>
        {perk.valueHint && (
          <span className="text-[10px] uppercase tracking-wide text-success font-semibold shrink-0 text-right leading-tight max-w-[40%]">
            {perk.valueHint}
          </span>
        )}
      </div>
      <div className="mt-3 font-semibold text-sm leading-snug">{perk.title}</div>
      <div className="mt-1 text-xs text-fg-muted leading-relaxed flex-1">{perk.blurb}</div>
      <div className={`mt-3 text-[11px] font-medium flex items-center gap-1 ${open ? "text-accent" : "text-fg-subtle"}`}>
        {open ? "Open below" : "Tap for claim"}
        <Icon.ArrowRight size={12} />
      </div>
    </button>
  );
}

export default function NetworkPerksPage() {
  const defaultTier = useMemo(
    () => VISA_TIER_GUIDES.find((g) => g.heldCardIds.length > 0)?.tier ?? "infinite",
    []
  );
  const [tier, setTier] = useState<VisaTier>(defaultTier);
  const [openPerk, setOpenPerk] = useState<string | null>(null);

  const guide = VISA_TIER_GUIDES.find((g) => g.tier === tier)!;
  const held = guide.heldCardIds.map((id) => getCardById(id)).filter(Boolean);
  const activePerk = guide.perks.find((p) => p.id === openPerk) ?? null;
  const ActiveIcon = activePerk ? perkIcon(activePerk.id) : Icon.Sparkles;

  return (
    <div className="space-y-6">
      <div className={`relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${guide.accent} p-5 sm:p-6`}>
        <div className="absolute -right-10 -top-12 w-48 h-48 rounded-full bg-white/[0.04] blur-3xl pointer-events-none" />
        <div className="absolute right-6 bottom-0 opacity-[0.07] pointer-events-none select-none hidden sm:block">
          <div className="text-[88px] font-black italic tracking-tighter leading-none text-white">VISA</div>
        </div>
        <div className="relative max-w-xl">
          <div className="text-[10px] uppercase tracking-[0.22em] text-fg-muted font-semibold">Plastic tier · not bank cashback</div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1.5">Network perks</h1>
          <p className="text-sm text-fg-muted mt-1.5 leading-relaxed">
            Pick a Visa tier. See the cards you hold. Tap a perk to claim it.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {VISA_TIER_GUIDES.map((g) => {
              const active = g.tier === tier;
              return (
                <button
                  key={g.tier}
                  type="button"
                  onClick={() => { setTier(g.tier); setOpenPerk(null); }}
                  className={`px-3.5 py-2 rounded-full text-sm font-medium border transition-all ${
                    active
                      ? "bg-white text-bg border-white shadow-md"
                      : "bg-black/25 text-fg-muted border-white/10 hover:text-fg hover:border-white/25 backdrop-blur-sm"
                  }`}
                >
                  {g.label.replace("Visa ", "")}
                  <span className={`ml-1.5 text-[10px] tabular-nums ${active ? "text-bg/70" : "text-fg-subtle"}`}>
                    {g.heldCardIds.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="label">{guide.label} · your cards</div>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${TIER_META[tier].chip}`}>
            {held.length} held
          </span>
        </div>

        {held.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-fg-muted text-sm">
            No cards in this tier.
          </div>
        ) : (
          <div className={`grid gap-4 ${held.length === 1 ? "max-w-sm" : "sm:grid-cols-2 max-w-3xl"}`}>
            {held.map((c, i) => (
              <Link
                key={c!.id}
                href={`/cards/${c!.id}`}
                className="block group"
                style={{ transform: held.length > 1 && i === 1 ? undefined : undefined }}
              >
                <div className={`rounded-2xl border ${TIER_META[tier].glow} p-1 bg-bg-chrome/40`}>
                  <CardVisual card={c!} size="md" />
                </div>
                <div className="mt-2.5 flex items-center justify-between text-sm px-1">
                  <span className="font-medium group-hover:text-accent transition-colors">{c!.short}</span>
                  <span className="text-xs text-fg-muted">Open card →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="label mb-3">Claimable perks</div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {guide.perks.map((p) => (
            <PerkTile
              key={p.id}
              perk={p}
              open={openPerk === p.id}
              onToggle={() => setOpenPerk((cur) => (cur === p.id ? null : p.id))}
            />
          ))}
        </div>
      </section>

      {activePerk && (
        <section className={`rounded-2xl border ${TIER_META[tier].glow} bg-bg-elevated p-4 sm:p-5 space-y-4 toast-in`}>
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-accent/20 text-accent flex items-center justify-center shrink-0">
              <ActiveIcon size={22} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-lg leading-tight">{activePerk.title}</div>
              <p className="text-sm text-fg-muted mt-1 leading-relaxed">{activePerk.summary}</p>
            </div>
            <button type="button" className="btn-ghost px-2 py-1 shrink-0" onClick={() => setOpenPerk(null)} aria-label="Close">
              <Icon.Close size={18} />
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="rounded-xl bg-bg-chrome border border-border p-3.5">
              <div className="label">How to claim</div>
              <p className="text-sm text-fg-muted mt-1.5 leading-relaxed">{activePerk.howToClaim}</p>
            </div>
            {activePerk.eligibility ? (
              <div className="rounded-xl bg-bg-chrome border border-border p-3.5">
                <div className="label">Eligibility</div>
                <p className="text-sm text-fg-muted mt-1.5 leading-relaxed">{activePerk.eligibility}</p>
              </div>
            ) : (
              <div className="rounded-xl bg-bg-chrome border border-border p-3.5 flex items-center">
                <p className="text-sm text-fg-muted">Usually available to any held card in this Visa tier.</p>
              </div>
            )}
          </div>

          {activePerk.recommendHint && (
            <div className="text-xs rounded-lg border border-accent/30 bg-accent/10 px-3 py-2.5 text-fg-muted leading-relaxed">
              <span className="text-accent font-medium">Routing tip — </span>
              {activePerk.recommendHint}
            </div>
          )}

          {activePerk.link && (
            <a href={activePerk.link} target="_blank" rel="noopener noreferrer" className="btn-primary inline-flex">
              {/visa\.co\.in\/en_in\/visa-offers-and-perks/.test(activePerk.link)
                ? "Open Visa offer → Redeem Now"
                : "Open claim page"}{" "}
              <Icon.ArrowRight size={16} />
            </a>
          )}
        </section>
      )}

      <p className="text-xs text-fg-subtle leading-relaxed pb-2">
        Direct links match HSBC Live+ “Know more” Visa offers. Most redeem online via Redeem Now on that page — confirm T&Cs before booking. Issuer lounges stay on each card page.
      </p>
    </div>
  );
}
