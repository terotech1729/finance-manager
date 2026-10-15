"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadState, type AppState } from "@/lib/storage";
import { useDataVersion } from "@/lib/useLiveData";
import { summariseLounges, type LoungeEntitlement } from "@/lib/lounges";
import { ArcGauge, HudPanel } from "@/components/Hud";
import { Callout } from "@/components/Callout";
import { inr } from "@/lib/utils";
import { Icon } from "@/components/Icons";

const PERIOD_LABEL: Record<LoungeEntitlement["period"], string> = {
  year: "per year",
  quarter: "per quarter",
  cycle: "per statement cycle",
};

function EntitlementRow({ e }: { e: LoungeEntitlement }) {
  const gate = e.gate;
  const pct =
    gate && gate.target && gate.target > 0
      ? Math.min(100, Math.round(((gate.current ?? 0) / gate.target) * 100))
      : null;

  return (
    <div className="border-b border-border py-3 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link href={`/cards/${e.cardId}`} className="font-medium text-fg hover:text-accent">
          {e.cardShort}
        </Link>
        <div className="flex items-center gap-2">
          <span className={`pill ${e.scope === "international" ? "pill-warning" : "pill-info"}`}>{e.scope}</span>
          <span className="readout text-sm">
            {e.visits === null ? "Unlimited" : `${e.visits}`}
            <span className="ml-1 text-[11px] text-fg-muted">{PERIOD_LABEL[e.period]}</span>
          </span>
        </div>
      </div>

      {gate && (
        <div className="mt-2">
          <div className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className={gate.met ? "text-success" : "text-warning"}>
              {gate.met ? "Unlocked" : "Locked"} · needs {gate.label}
            </span>
            {pct !== null && (
              <span className="readout text-[11px] text-fg-muted">
                {inr(gate.current ?? 0)} / {inr(gate.target ?? 0)}
              </span>
            )}
          </div>
          {pct !== null && (
            <div className="bar mt-1">
              <div className={`bar-fill ${gate.met ? "bar-fill-success" : "bar-fill-warning"}`} style={{ width: `${pct}%` }} />
            </div>
          )}
          {gate.unlocks && <div className="mt-1 text-[11px] text-fg-subtle">{gate.unlocks}</div>}
        </div>
      )}

      {e.note && <p className="mt-1.5 text-[11px] text-fg-muted">{e.note}</p>}
    </div>
  );
}

export default function LoungesPage() {
  const [state, setState] = useState<AppState | null>(null);
  const dataVersion = useDataVersion();

  useEffect(() => {
    setState(loadState());
  }, [dataVersion]);

  const summary = useMemo(() => (state ? summariseLounges(state) : null), [state]);

  if (!state || !summary) return <div className="text-fg-muted">Loading…</div>;

  const { domestic, international, locked, all } = summary;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Lounge access</h1>
        <p className="page-sub">
          What you can actually use right now — spend gates resolved against live figures, not brochure numbers.
        </p>
      </div>

      <HudPanel title="Available now">
        {/* Each ring shows how much of that scope's entitlement is actually unlocked —
            a real ratio, where the bare visit count has no denominator. */}
        <div className="flex flex-wrap items-start justify-center gap-8 sm:justify-start">
          <ArcGauge
            value={domestic.visits}
            ratio={domestic.totalCount ? domestic.liveCount / domestic.totalCount : 0}
            unlimited={domestic.unlimited}
            tone="cyan"
            label="Domestic"
            caption={`${domestic.liveCount}/${domestic.totalCount} live`}
          />
          <ArcGauge
            value={international.visits}
            ratio={international.totalCount ? international.liveCount / international.totalCount : 0}
            unlimited={international.unlimited}
            tone={international.visits > 0 || international.unlimited ? "gold" : "red"}
            label="International"
            caption={`${international.liveCount}/${international.totalCount} live`}
          />
          <ArcGauge
            value={locked.length}
            ratio={all.length ? locked.length / all.length : 0}
            tone={locked.length ? "red" : "green"}
            label="Gated"
            caption={`of ${all.length} total`}
          />
        </div>

        {international.visits <= 1 && !international.unlimited && (
          <Callout tone="warning" title="International lounge access is thin">
            {international.visits === 0
              ? "No international lounge access at all right now."
              : `Just ${international.visits} international visit a year, all of it on HSBC Live+.`}{" "}
            Amex Platinum Travel carried this before it closed, and nothing replaced it.
          </Callout>
        )}
      </HudPanel>

      <HudPanel title={`Breakdown — ${all.length} entitlements across the portfolio`}>
        {all.length === 0 ? (
          <p className="text-sm text-fg-muted">No lounge entitlements on any active card.</p>
        ) : (
          <div>
            {all.map((e, i) => (
              <EntitlementRow key={`${e.cardId}-${e.scope}-${i}`} e={e} />
            ))}
          </div>
        )}
      </HudPanel>

      <p className="flex items-start gap-2 text-xs text-fg-subtle">
        <Icon.Sparkles size={13} className="mt-0.5 shrink-0" />
        Unlimited entitlements are shown as ∞ rather than folded into the visit count, because summing them
        with a finite allowance would produce a number that means nothing.
      </p>
    </div>
  );
}
