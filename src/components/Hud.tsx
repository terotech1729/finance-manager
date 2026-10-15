"use client";

/**
 * JARVIS HUD primitives.
 *
 * The guiding rule from the Iron Man HUD design language: a ring is an instrument, not
 * an ornament. Every `ArcGauge` here encodes a real ratio (visits used, spend against a
 * gate), and anything that isn't radial data gets a bar or a plain readout instead.
 */
import Link from "next/link";
import type { ReactNode } from "react";

/** Degrees of sweep for a gauge — a 270° arc reads as a dial, 360° as a progress ring. */
const SWEEP = 270;
const START = 135; // bottom-left, so the gap sits at the bottom

export type ArcTone = "cyan" | "gold" | "green" | "red";

const TONE_STROKE: Record<ArcTone, string> = {
  cyan: "#00CFFF",
  gold: "#FFB454",
  green: "#00E6A8",
  red: "#FF3C3C",
};

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number) {
  // A full circle can't be expressed as a single arc — nudge it just under 360.
  const sweep = Math.min(sweepDeg, 359.99);
  const a = polar(cx, cy, r, startDeg);
  const b = polar(cx, cy, r, startDeg + sweep);
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${sweep > 180 ? 1 : 0} 1 ${b.x} ${b.y}`;
}

export function ArcGauge({
  value,
  ratio,
  label,
  caption,
  tone = "cyan",
  size = 132,
  unlimited = false,
}: {
  /** The headline figure, rendered in the middle. Can be any number or ∞. */
  value: number;
  /**
   * What the ring encodes, 0–1 — deliberately separate from `value`, because a bare
   * count has no denominator and a ring drawn from `value / value` would always read
   * full and mean nothing.
   */
  ratio: number;
  label: ReactNode;
  caption?: string;
  tone?: ArcTone;
  size?: number;
  /** Renders ∞ instead of the count. */
  unlimited?: boolean;
}) {
  const r = size / 2 - 10;
  const c = size / 2;
  const stroke = TONE_STROKE[tone];
  // Clamp hard: NaN from an upstream divide-by-zero would silently break the arc path.
  const pct = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="block -rotate-0">
          {/* Track */}
          <path d={arcPath(c, c, r, START, SWEEP)} fill="none" stroke="#12283E" strokeWidth={6} strokeLinecap="round" />
          {/* Value */}
          {pct > 0 && (
            <path
              d={arcPath(c, c, r, START, SWEEP * pct)}
              fill="none"
              stroke={stroke}
              strokeWidth={6}
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 5px ${stroke}aa)` }}
            />
          )}
          {/* Tick ring — purely positional reference, kept faint */}
          {Array.from({ length: 12 }).map((_, i) => {
            const deg = START + (SWEEP / 11) * i;
            const p1 = polar(c, c, r - 10, deg);
            const p2 = polar(c, c, r - 13, deg);
            return <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="#1E3C5A" strokeWidth={1} />;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="font-mono text-2xl font-semibold tabular-nums leading-none" style={{ color: stroke }}>
            {unlimited ? "∞" : value}
          </div>
          {caption && <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-fg-subtle">{caption}</div>}
        </div>
      </div>
      <div className="mt-2 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-fg-muted">{label}</div>
    </div>
  );
}

/** A framed HUD panel with corner brackets and an optional right-hand action. */
export function HudPanel({
  title,
  action,
  children,
  className = "",
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`hud-brackets card-shell ${className}`}>
      {title && (
        <header className="card-header">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent">{title}</h2>
          {action}
        </header>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}

/** Label / value pair in HUD type. `href` turns the whole tile into a link. */
export function Readout({
  label,
  value,
  sub,
  tone,
  href,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: ArcTone;
  href?: string;
}) {
  const color = tone ? TONE_STROKE[tone] : undefined;
  const body = (
    <>
      <div className="label">{label}</div>
      <div className="readout-lg mt-1" style={color ? { color } : undefined}>
        {value}
      </div>
      {sub && <div className="mt-1 text-[11px] text-fg-muted">{sub}</div>}
    </>
  );
  return href ? (
    <Link href={href} className="stat-tile block">
      {body}
    </Link>
  ) : (
    <div className="stat-tile">{body}</div>
  );
}
