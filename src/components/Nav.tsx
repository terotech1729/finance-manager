"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/cards", label: "Cards" },
  { href: "/milestones", label: "Milestones" },
  { href: "/settings", label: "Settings" },
];

export function Nav() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-10 bg-bg-chrome/80 backdrop-blur-sm border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center gap-6">
        <Link href="/" className="text-base font-semibold tracking-tight text-fg flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-accent" />
          Credit Card Manager
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {items.map((it) => {
            const active = path === it.href || (it.href !== "/" && path.startsWith(it.href));
            return (
              <Link
                key={it.href}
                href={it.href}
                className={`px-3 py-1.5 rounded-md transition-colors ${
                  active ? "bg-bg-elevated text-fg" : "text-fg-muted hover:text-fg hover:bg-bg-elevated"
                }`}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
