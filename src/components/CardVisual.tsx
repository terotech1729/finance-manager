import Link from "next/link";
import { getCardStyle } from "@/lib/card-styling";
import type { Card } from "@/lib/types";

type Props = {
  card: Card;
  href?: string;
  size?: "sm" | "md" | "lg";
};

/* ---------- Network Logos (real-looking SVGs) ---------- */

function VisaLogo({ light }: { light: boolean }) {
  const c = light ? "#fff" : "#1a1f71";
  return (
    <svg viewBox="0 0 100 32" width="60" height="20" xmlns="http://www.w3.org/2000/svg">
      <text x="50" y="24" textAnchor="middle" fill={c} fontFamily="Arial Black, sans-serif" fontSize="22" fontStyle="italic" fontWeight="900" letterSpacing="-0.5">VISA</text>
    </svg>
  );
}

function MastercardLogo() {
  return (
    <svg viewBox="0 0 60 36" width="48" height="30" xmlns="http://www.w3.org/2000/svg">
      <circle cx="22" cy="18" r="14" fill="#eb001b" />
      <circle cx="38" cy="18" r="14" fill="#f79e1b" />
      <path d="M30,8 a14,14 0 0 1 0,20 a14,14 0 0 1 0,-20" fill="#ff5f00" />
    </svg>
  );
}

function AmexLogo({ light }: { light: boolean }) {
  // Brand-standard: blue box with white wordmark — readable on any card colour.
  return (
    <svg viewBox="0 0 80 36" width="60" height="28" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="80" height="36" rx="4" fill="#006fcf" />
      <text x="40" y="16" textAnchor="middle" fill="#ffffff" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="8" letterSpacing="0.5">AMERICAN</text>
      <text x="40" y="26" textAnchor="middle" fill="#ffffff" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="8" letterSpacing="0.5">EXPRESS</text>
    </svg>
  );
}

function RuPayLogo({ light }: { light: boolean }) {
  return (
    <svg viewBox="0 0 80 32" width="56" height="22" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="22" fill={light ? "#fff" : "#097A4F"} fontFamily="Arial, sans-serif" fontWeight="900" fontSize="20" letterSpacing="-0.5">Ru</text>
      <text x="22" y="22" fill={light ? "#FF8C00" : "#FF8C00"} fontFamily="Arial, sans-serif" fontWeight="900" fontSize="20" letterSpacing="-0.5">Pay</text>
      <path d="M64,12 L72,12 L68,18 L72,24 L64,24 Z" fill={light ? "#fff" : "#097A4F"} />
    </svg>
  );
}

function SingleNetworkLogo({ network, light }: { network: string; light: boolean }) {
  if (network === "amex") return <AmexLogo light={light} />;
  if (network === "visa") return <VisaLogo light={light} />;
  if (network === "mastercard") return <MastercardLogo />;
  if (network === "rupay") return <RuPayLogo light={light} />;
  return null;
}

function networkPretty(n: string): string {
  return n === "amex" ? "American Express" : n === "visa" ? "Visa" : n === "mastercard" ? "Mastercard" : n === "rupay" ? "RuPay" : n;
}

function NetworkLogo({ network, secondary, light }: { network: string; secondary?: string; light: boolean }) {
  // Legacy "dual" fallback → Visa + RuPay
  if (network === "dual") {
    return (
      <div className="flex items-center gap-1.5" title="Dual-network: Visa + RuPay">
        <VisaLogo light={light} />
        <span className={`text-[8px] opacity-60 ${light ? "text-white" : "text-black"}`}>+</span>
        <RuPayLogo light={light} />
      </div>
    );
  }
  if (secondary) {
    return (
      <div className="flex items-center gap-1.5" title={`Dual-network: ${networkPretty(network)} + ${networkPretty(secondary)}`}>
        <SingleNetworkLogo network={network} light={light} />
        <span className={`text-[8px] opacity-60 ${light ? "text-white" : "text-black"}`}>+</span>
        <SingleNetworkLogo network={secondary} light={light} />
      </div>
    );
  }
  return <SingleNetworkLogo network={network} light={light} />;
}

/* ---------- Card Chip (gold EMV chip) ---------- */

function Chip() {
  return (
    <svg viewBox="0 0 48 36" width="42" height="32" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="chipGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#d4a017" />
          <stop offset="100%" stopColor="#92400e" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="48" height="36" rx="6" fill="url(#chipGrad)" stroke="#92400e" strokeWidth="0.5" />
      <line x1="0" y1="10" x2="20" y2="10" stroke="#92400e" strokeWidth="0.4" />
      <line x1="28" y1="10" x2="48" y2="10" stroke="#92400e" strokeWidth="0.4" />
      <line x1="0" y1="18" x2="48" y2="18" stroke="#92400e" strokeWidth="0.4" />
      <line x1="0" y1="26" x2="20" y2="26" stroke="#92400e" strokeWidth="0.4" />
      <line x1="28" y1="26" x2="48" y2="26" stroke="#92400e" strokeWidth="0.4" />
      <rect x="20" y="10" width="8" height="16" fill="none" stroke="#92400e" strokeWidth="0.5" />
      <line x1="24" y1="0" x2="24" y2="10" stroke="#92400e" strokeWidth="0.4" />
      <line x1="24" y1="26" x2="24" y2="36" stroke="#92400e" strokeWidth="0.4" />
    </svg>
  );
}

function ContactlessIcon({ light }: { light: boolean }) {
  const c = light ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)";
  return (
    <svg width="20" height="22" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 6 Q7 11 3 16" stroke={c} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M7 4 Q13 11 7 18" stroke={c} strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M11 2 Q19 11 11 20" stroke={c} strokeWidth="1.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/* ---------- Sizes ---------- */

const SIZES = {
  sm: { height: "h-32", padding: "p-3", title: "text-sm", text: "text-[10px]", chipScale: 0.7 },
  md: { height: "h-44", padding: "p-4", title: "text-base", text: "text-[11px]", chipScale: 1 },
  lg: { height: "h-56", padding: "p-6", title: "text-2xl", text: "text-xs", chipScale: 1.2 },
};

export function CardVisual({ card, href, size = "md" }: Props) {
  const style = getCardStyle(card.id);
  const dim = SIZES[size];
  const isLight = style.fgClass.includes("text-white") || style.fgClass.includes("text-blue-50") ||
                  style.fgClass.includes("text-amber-50") || style.fgClass.includes("text-amber-100") ||
                  style.fgClass.includes("text-slate-50") || style.fgClass.includes("text-orange-300") ||
                  style.fgClass.includes("text-amber-100");

  const content = (
    <div
      className={`relative w-full ${dim.height} overflow-hidden rounded-2xl ${style.bgClass} ${style.fgClass} shadow-2xl group transition-all hover:-translate-y-1 hover:shadow-2xl ${style.patternClass ?? ""}`}
      style={{
        aspectRatio: "1.586 / 1",
        boxShadow: "0 10px 30px -10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.15)",
      }}
    >
      {/* Glossy overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/30 pointer-events-none" />
      {/* Specular highlight (top-left to bottom-right shimmer) */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.25) 0%, transparent 25%, transparent 75%, rgba(255,255,255,0.1) 100%)",
        }}
      />
      {/* Subtle holographic stripe (optional) */}
      <div className="absolute inset-y-0 right-0 w-12 opacity-20 mix-blend-overlay pointer-events-none"
           style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)" }} />

      <div className={`relative h-full flex flex-col justify-between ${dim.padding}`}>
        {/* Top row: brand label + network logo */}
        <div className="flex items-start justify-between">
          <div className="space-y-0.5">
            {style.topLabel && (
              <div className={`${dim.text} font-bold tracking-[0.15em] uppercase opacity-95`} style={{ textShadow: isLight ? "0 1px 2px rgba(0,0,0,0.3)" : "none" }}>
                {style.topLabel}
              </div>
            )}
            <div className={`${dim.text} opacity-70 font-medium tracking-wider`}>
              {style.issuerLabel}
            </div>
          </div>
          <NetworkLogo network={style.network} secondary={style.secondaryNetwork} light={isLight} />
        </div>

        {/* Middle: chip + contactless */}
        <div className="flex items-center gap-3">
          <div style={{ transform: `scale(${dim.chipScale})`, transformOrigin: "left center" }}>
            <Chip />
          </div>
          <ContactlessIcon light={isLight} />
        </div>

        {/* Bottom: card name + dummy number */}
        <div>
          {size !== "sm" && (
            <div className={`${dim.text} font-mono tracking-[0.25em] opacity-60 mb-1`}>
              •••• •••• •••• ••••
            </div>
          )}
          <div className={`${dim.title} font-bold leading-tight tracking-tight`} style={{ textShadow: isLight ? "0 1px 2px rgba(0,0,0,0.3)" : "none" }}>
            {style.bottomLabel ?? style.topLabel ?? card.short}
          </div>
        </div>
      </div>

      {/* Hover tooltip for dual-network cards */}
      {(style.network === "dual" || style.secondaryNetwork) && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <div className="text-[9px] bg-black/70 text-white px-2 py-0.5 rounded backdrop-blur-sm whitespace-nowrap">
            {style.network === "dual"
              ? "Dual-network: Visa + RuPay"
              : `Dual-network: ${networkPretty(style.network)} + ${networkPretty(style.secondaryNetwork as string)}`}
          </div>
        </div>
      )}

      {/* Status badge */}
      {card.status !== "active" && (
        <div className="absolute top-3 right-3 z-10">
          <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-500/30 text-amber-50 border border-amber-300/50 backdrop-blur-sm uppercase tracking-wider">
            {card.status === "applied" ? "Pending" : "Future"}
          </span>
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus:outline-none focus:ring-2 focus:ring-accent rounded-2xl">
        {content}
      </Link>
    );
  }
  return content;
}
