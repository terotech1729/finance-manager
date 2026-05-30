"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./Icons";

const items = [
  { href: "/", label: "Home", icon: Icon.Dashboard },
  { href: "/recommend", label: "Recommend", icon: Icon.Zap },
  { href: "/transactions", label: "Transactions", icon: Icon.Transaction },
  { href: "/investments", label: "Investments", icon: Icon.Trophy },
  { href: "/cards", label: "Cards", icon: Icon.Card },
  { href: "/milestones", label: "Milestones", icon: Icon.Sparkles },
  { href: "/settings", label: "Settings", icon: Icon.Settings },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="hidden md:flex md:flex-col w-60 shrink-0 border-r border-border bg-bg-chrome min-h-screen sticky top-0">
      <div className="px-5 py-4 border-b border-border">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-info flex items-center justify-center text-white font-bold text-sm">
            ₹
          </div>
          <div>
            <div className="text-sm font-semibold leading-none">Personal Finance</div>
            <div className="text-sm font-semibold leading-none mt-0.5">Manager</div>
          </div>
        </Link>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {items.map((it) => {
          const active = path === it.href || (it.href !== "/" && path.startsWith(it.href));
          const I = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? "bg-bg-elevated text-fg font-medium"
                  : "text-fg-muted hover:text-fg hover:bg-bg-elevated"
              }`}
            >
              <I size={16} />
              {it.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="text-xs text-fg-muted">v1.5 · Started 30 May 2026</div>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const path = usePathname();
  return (
    <header className="md:hidden sticky top-0 z-10 bg-bg-chrome/90 backdrop-blur-sm border-b border-border">
      <div className="px-4 h-12 flex items-center gap-3 overflow-x-auto">
        {items.map((it) => {
          const active = path === it.href || (it.href !== "/" && path.startsWith(it.href));
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`px-2 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                active ? "bg-bg-elevated text-fg font-medium" : "text-fg-muted"
              }`}
            >
              {it.label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
