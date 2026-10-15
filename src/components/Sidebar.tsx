"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icons";
import { MobileAccount } from "./TopBar";
import { NAV_GROUPS as groups, isActive, sectionLabelFor } from "./navConfig";

/** Arc reactor mark — concentric rings with a slow outer sweep, scaled to the rail. */
function ArcMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="shrink-0" aria-hidden="true">
      <circle cx="20" cy="20" r="18.5" fill="none" stroke="#14283E" strokeWidth="1" />
      <g className="origin-center animate-sweep-slow">
        <circle
          cx="20" cy="20" r="18.5"
          fill="none" stroke="#00CFFF" strokeWidth="1"
          strokeDasharray="14 102" strokeLinecap="round" opacity="0.9"
        />
      </g>
      <circle cx="20" cy="20" r="13" fill="none" stroke="#00CFFF" strokeWidth="1" opacity="0.35" />
      {/* Eight segments — the reactor's coil ring */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (i * 45 * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={20 + 9 * Math.cos(a)} y1={20 + 9 * Math.sin(a)}
            x2={20 + 12.5 * Math.cos(a)} y2={20 + 12.5 * Math.sin(a)}
            stroke="#00CFFF" strokeWidth="1.4" opacity="0.6"
          />
        );
      })}
      <circle cx="20" cy="20" r="6.5" fill="#00CFFF" opacity="0.13" />
      <circle cx="20" cy="20" r="4" fill="#00FFF7" className="animate-flicker" style={{ filter: "drop-shadow(0 0 5px #00FFF7)" }} />
    </svg>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 min-w-0">
      <ArcMark />
      <div className="min-w-0">
        <div className="font-mono text-sm font-semibold leading-none tracking-[0.22em] text-accent">JARVIS</div>
        <div className="font-mono text-[9px] uppercase leading-none tracking-[0.14em] text-fg-subtle mt-1.5">
          Personal assistant
        </div>
      </div>
    </Link>
  );
}

function NavLinks({ path, onNavigate, compact }: { path: string; onNavigate?: () => void; compact?: boolean }) {
  return (
    <>
      {groups.map((g) => (
        <div key={g.title} className="mb-4">
          <div className="px-3 mb-1.5 font-mono text-[9px] uppercase tracking-[0.2em] text-fg-subtle">{g.title}</div>
          <div className="space-y-0.5">
            {g.items.map((it) => {
              const active = isActive(path, it.href);
              const I = it.icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={onNavigate}
                  className={`relative flex items-center gap-3 px-3 rounded-sm text-sm transition-all ${
                    compact ? "py-2.5 min-h-[44px]" : "py-2"
                  } ${
                    active
                      ? "bg-accent/12 text-accent font-medium"
                      : "text-fg-muted hover:text-fg hover:bg-accent/[0.06]"
                  }`}
                >
                  {active && <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 bg-accent shadow-[0_0_8px_#00CFFF]" />}
                  <I size={16} className={active ? "text-accent" : ""} />
                  {it.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </>
  );
}

/** Shared chrome — desktop permanent rail + mobile slide-over use the same structure. */
function SidebarChrome({
  path,
  onNavigate,
  footer,
  headerRight,
  className,
}: {
  path: string;
  onNavigate?: () => void;
  footer?: boolean;
  headerRight?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col bg-bg-chrome/95 backdrop-blur border-r border-border ${className ?? ""}`}>
      <div className="px-4 sm:px-5 py-4 border-b border-border flex items-center justify-between gap-2">
        <Brand />
        {headerRight}
      </div>
      <nav className="flex-1 p-3 overflow-y-auto overscroll-contain">
        <NavLinks path={path} onNavigate={onNavigate} compact={!!onNavigate} />
      </nav>
      {footer !== false && (
        <div className="p-4 border-t border-border" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
          <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-fg-subtle">
            Mark III · Online
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 min-h-screen sticky top-0 self-start h-[100dvh]">
      <SidebarChrome path={path} className="h-full w-full" />
    </aside>
  );
}

export function MobileNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  // Close the drawer whenever the route changes.
  useEffect(() => { setOpen(false); }, [path]);
  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Current section label for the top bar (mirrors desktop context).
  const current = sectionLabelFor(path);

  return (
    <>
      <header
        className="md:hidden sticky top-0 z-30 bg-bg-chrome/90 backdrop-blur-sm border-b border-border"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="px-2 h-14 flex items-center gap-1 min-w-0">
          <button
            aria-label="Open navigation"
            aria-expanded={open}
            className="btn-ghost px-2 py-2 shrink-0 min-h-[44px] min-w-[44px]"
            onClick={() => setOpen(true)}
          >
            <Icon.Menu size={22} />
          </button>
          <div className="min-w-0 flex-1">
            <Brand />
          </div>
          <div className="shrink-0 hidden sm:block text-xs text-fg-muted truncate max-w-[30%]">{current}</div>
          <MobileAccount />
        </div>
      </header>

      {/* Left slide-over — same pane as desktop sidebar */}
      {mounted && (
        <div
          className={`md:hidden fixed inset-0 z-40 ${open ? "visible" : "invisible pointer-events-none"}`}
          aria-hidden={!open}
        >
          <div
            className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
              open ? "opacity-100" : "opacity-0"
            }`}
            onClick={() => setOpen(false)}
          />
          <aside
            className={`absolute left-0 top-0 h-full w-[min(16.5rem,86vw)] shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
              open ? "translate-x-0" : "-translate-x-full"
            }`}
            style={{ paddingTop: "env(safe-area-inset-top)" }}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <SidebarChrome
              path={path}
              onNavigate={() => setOpen(false)}
              className="h-full w-full"
              headerRight={
                <button
                  aria-label="Close navigation"
                  className="btn-ghost px-2 py-2 min-h-[44px] min-w-[44px] shrink-0"
                  onClick={() => setOpen(false)}
                >
                  <Icon.Close size={20} />
                </button>
              }
            />
          </aside>
        </div>
      )}
    </>
  );
}
