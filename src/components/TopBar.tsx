"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icons";
import { sectionLabelFor } from "./navConfig";
import { useSession } from "./AuthGate";
import {
  getLastSyncedAt,
  onSyncStatus,
  refreshFromCloud,
  signOutAndClear,
  type SyncStatus,
} from "@/lib/cloudSync";
import { isSupabaseConfigured } from "@/lib/supabase";

function displayName(email: string | null | undefined, metaName?: unknown): string {
  if (typeof metaName === "string" && metaName.trim()) return metaName.trim();
  const local = (email ?? "").split("@")[0];
  if (!local) return "Account";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function relativeTime(ts: number | null): string {
  if (!ts) return "not yet";
  const secs = Math.round((Date.now() - ts) / 1000);
  if (secs < 45) return "just now";
  if (secs < 3600) return `${Math.round(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.round(secs / 3600)}h ago`;
  return `${Math.round(secs / 86400)}d ago`;
}

const STATUS_LABEL: Record<SyncStatus, string> = {
  idle: "Idle",
  syncing: "Syncing…",
  synced: "Synced",
  error: "Sync failed",
  offline: "Local only",
};

const STATUS_DOT: Record<SyncStatus, string> = {
  idle: "bg-fg-subtle",
  syncing: "bg-info animate-pulse",
  synced: "bg-success",
  error: "bg-danger",
  offline: "bg-fg-subtle",
};

function SyncPill() {
  const [status, setStatus] = useState<SyncStatus>("offline");
  // Re-render on a timer so "2m ago" doesn't go stale while the tab sits open.
  const [, setTick] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const off = onSyncStatus(setStatus);
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => { off(); clearInterval(t); };
  }, []);

  const manualRefresh = useCallback(async () => {
    setBusy(true);
    try {
      await refreshFromCloud({ force: true });
    } finally {
      setBusy(false);
    }
  }, []);

  if (!isSupabaseConfigured) return null;

  const title =
    status === "synced" ? `Last synced ${relativeTime(getLastSyncedAt())}` : STATUS_LABEL[status];

  return (
    <button
      type="button"
      onClick={manualRefresh}
      disabled={busy || status === "syncing"}
      title={`${title} · click to refresh now`}
      className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border text-xs text-fg-muted hover:text-fg hover:bg-bg-chrome transition-colors disabled:opacity-60"
    >
      <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {status === "synced" ? relativeTime(getLastSyncedAt()) : STATUS_LABEL[status]}
    </button>
  );
}

function UserMenu() {
  const { user, cloud } = useSession();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!cloud || !user) {
    return (
      <span className="text-xs text-fg-subtle border border-border rounded-lg px-2.5 py-1.5">
        Local mode
      </span>
    );
  }

  const name = displayName(user.email, user.user_metadata?.full_name);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await signOutAndClear();
      location.reload();
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-bg-chrome transition-colors min-h-[40px]"
      >
        <span className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-accent to-info text-white text-xs font-semibold flex items-center justify-center">
          {initialsOf(name)}
        </span>
        <span className="hidden lg:block text-left min-w-0">
          <span className="block text-xs font-medium leading-tight truncate max-w-[10rem]">{name}</span>
          <span className="block text-[10px] text-fg-subtle leading-tight truncate max-w-[10rem]">{user.email}</span>
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-60 z-50 card-shell shadow-xl overflow-hidden"
        >
          <div className="px-3 py-3 border-b border-border">
            <div className="text-sm font-medium truncate">{name}</div>
            <div className="text-xs text-fg-subtle truncate">{user.email}</div>
          </div>
          <div className="p-1">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-fg-muted hover:text-fg hover:bg-bg-chrome"
              role="menuitem"
            >
              <Icon.Settings size={16} /> Settings & sync
            </Link>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-danger hover:bg-danger/10 disabled:opacity-60"
              role="menuitem"
            >
              <Icon.Close size={16} /> {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Desktop title bar: where you are, sync freshness, and who you're signed in as. */
export function TopBar() {
  const path = usePathname();
  const section = sectionLabelFor(path);

  return (
    <header className="hidden md:flex sticky top-0 z-30 h-14 items-center gap-3 border-b border-border bg-bg-chrome/90 backdrop-blur px-6">
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold truncate">{section}</div>
        <div className="text-[11px] text-fg-subtle leading-tight">Personal Finance Manager</div>
      </div>
      <SyncPill />
      <UserMenu />
    </header>
  );
}

/** Compact account control for the mobile header. */
export function MobileAccount() {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <UserMenu />
    </div>
  );
}
