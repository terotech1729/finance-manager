"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "./Icons";

type NavItem = { href: string; label: string; icon: (p: { size?: number; className?: string }) => React.ReactElement };
type NavGroup = { title: string; items: NavItem[] };

const groups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/", label: "Home", icon: Icon.Dashboard },
      { href: "/recommend", label: "Recommend", icon: Icon.Zap },
    ],
  },
  {
    title: "Spending",
    items: [
      { href: "/transactions", label: "Transactions", icon: Icon.Transaction },
      { href: "/bills", label: "Bill Tracker", icon: Icon.Card },
      { href: "/spend", label: "Spend Analyzer", icon: Icon.Dashboard },
    ],
  },
  {
    title: "Investing",
    items: [
      { href: "/investments", label: "Investments", icon: Icon.Trophy },
      { href: "/portfolio", label: "Investment Analyzer", icon: Icon.Dashboard },
    ],
  },
  {
    title: "Reference",
    items: [
      { href: "/cards", label: "Cards", icon: Icon.Card },
      { href: "/milestones", label: "Milestones", icon: Icon.Sparkles },
      { href: "/redemptions", label: "Redemptions", icon: Icon.Plane },
      { href: "/settings", label: "Settings", icon: Icon.Settings },
    ],
  },
];

function isActive(path: string, href: string) {
  return path === href || (href !== "/" && path.startsWith(href));
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 min-w-0">
      <div className="w-9 h-9 shrink-0 rounded-xl bg-gradient-to-br from-accent to-info flex items-center justify-center text-white font-bold shadow-md shadow-accent/30">
        ₹
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold leading-none truncate">Personal Finance</div>
        <div className="text-xs text-fg-muted leading-none mt-1">Manager</div>
      </div>
    </Link>
  );
}

function NavLinks({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
  return (
    <>
      {groups.map((g) => (
        <div key={g.title} className="mb-4">
          <div className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">{g.title}</div>
          <div className="space-y-0.5">
            {g.items.map((it) => {
              const active = isActive(path, it.href);
              const I = it.icon;
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={onNavigate}
                  className={`relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active ? "bg-accent/15 text-fg font-medium" : "text-fg-muted hover:text-fg hover:bg-bg-elevated"
                  }`}
                >
                  {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r bg-accent" />}
                  <I size={17} className={active ? "text-accent" : ""} />
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

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-border bg-bg-chrome/80 backdrop-blur min-h-screen sticky top-0">
      <div className="px-5 py-4 border-b border-border">
        <Brand />
      </div>
      <nav className="flex-1 p-3 overflow-y-auto">
        <NavLinks path={path} />
      </nav>
      <div className="p-4 border-t border-border">
        <div className="text-xs text-fg-subtle">v1.6 · Personal finance manager</div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);

  // Close the drawer whenever the route changes.
  useEffect(() => { setOpen(false); }, [path]);
  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <header
      className="md:hidden sticky top-0 z-30 bg-bg-chrome/90 backdrop-blur-sm border-b border-border"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="px-3 sm:px-4 h-14 flex items-center justify-between gap-2 min-w-0">
        <div className="min-w-0 shrink">
          <Brand />
        </div>
        <button
          aria-label="Menu"
          className="btn-ghost px-2 py-2 shrink-0 min-h-[44px] min-w-[44px]"
          onClick={() => setOpen(true)}
        >
          <Icon.Menu size={22} />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-0 h-full w-72 max-w-[min(85vw,20rem)] bg-bg-chrome border-l border-border shadow-2xl flex flex-col toast-in"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="px-4 py-4 border-b border-border flex items-center justify-between gap-2">
              <Brand />
              <button aria-label="Close" className="btn-ghost px-2 py-2 min-h-[44px] min-w-[44px]" onClick={() => setOpen(false)}><Icon.Close size={20} /></button>
            </div>
            <nav className="flex-1 p-3 overflow-y-auto overscroll-contain">
              <NavLinks path={path} onNavigate={() => setOpen(false)} />
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
