export function inr(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

export function inrExact(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export function nfmt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("en-IN");
}

export function pct(n: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, (n / total) * 100);
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function todayISO(): string {
  return new Date().toISOString();
}

/** Today's date as YYYY-MM-DD in the user's LOCAL timezone (not UTC). */
export function todayLocal(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

/** Convert a YYYY-MM-DD (local) date to an ISO timestamp anchored at local noon. */
export function localDateToISO(dateStr: string): string {
  if (!dateStr) return new Date().toISOString();
  return new Date(`${dateStr}T12:00:00`).toISOString();
}

export function thisMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** YYYY-MM-DD from a local Date (no UTC shift). */
export function toLocalISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Credit-card statement cycle: day after previous statement → statement day inclusive.
 * Scapia Federal statementDay=24 → 25th … 24th next month (user billing cycle).
 */
export function statementCycleRange(
  statementDay: number,
  on: Date | string = new Date()
): { start: string; end: string; key: string } {
  const ref =
    typeof on === "string"
      ? new Date(/^\d{4}-\d{2}-\d{2}/.test(on) ? `${on.slice(0, 10)}T12:00:00` : on)
      : on;
  const y = ref.getFullYear();
  const m = ref.getMonth();
  const d = ref.getDate();
  const day = Math.min(Math.max(1, Math.floor(statementDay) || 1), 28);
  let start: Date;
  let end: Date;
  if (d <= day) {
    // Still in the cycle that closes on this month's statement day.
    start = new Date(y, m - 1, day + 1);
    end = new Date(y, m, day);
  } else {
    // Past statement day — new cycle opened the next calendar day.
    start = new Date(y, m, day + 1);
    end = new Date(y, m + 1, day);
  }
  const startIso = toLocalISODate(start);
  const endIso = toLocalISODate(end);
  return { start: startIso, end: endIso, key: `${startIso}_${endIso}` };
}

export function daysBetween(aISO: string, bISO: string): number {
  const a = new Date(aISO).getTime();
  const b = new Date(bISO).getTime();
  return Math.floor((b - a) / (1000 * 60 * 60 * 24));
}
