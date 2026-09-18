/**
 * Manually built trip itineraries.
 *
 * This is a planning surface, not a generator: you type the flight you actually found,
 * the hotel you actually booked, and what it cost. Everything here exists to make that
 * typing fast — sensible defaults per item kind, running totals, and reordering — and to
 * keep the result somewhere durable rather than in a notes app.
 */
import { toDateOnly } from "@/lib/utils";

export type TripItemKind =
  | "flight"
  | "train"
  | "bus"
  | "cab"
  | "ferry"
  | "stay"
  | "activity"
  | "food"
  | "note";

export type TripAttachment = {
  id: string;
  kind: "link" | "photo";
  /** Absolute URL for links; a downscaled data URL for photos. */
  url: string;
  label?: string;
};

export type CostBasis = "person" | "total";

export type TripItem = {
  id: string;
  kind: TripItemKind;
  title: string;
  from?: string;
  to?: string;
  /** "HH:MM", local. */
  startTime?: string;
  endTime?: string;
  /** Red-eyes and sleeper buses land the next morning. */
  endsNextDay?: boolean;
  costInr?: number;
  costBasis: CostBasis;
  bookingRef?: string;
  notes?: string;
  attachments: TripAttachment[];
  booked: boolean;
};

export type TripDay = {
  id: string;
  /** ISO date, derived from the trip start but editable by inserting/removing days. */
  date: string;
  label?: string;
  items: TripItem[];
};

export type Trip = {
  id: string;
  name: string;
  destination: string;
  /** Place id when picked from the typeahead — unlocks the suggestion palette. */
  destinationPlaceId?: string;
  startDate: string;
  travellers: number;
  notes?: string;
  days: TripDay[];
  createdAt: string;
  updatedAt: string;
};

export const ITEM_KINDS: { id: TripItemKind; label: string; icon: string; defaultTitle: string }[] = [
  { id: "flight", label: "Flight", icon: "✈", defaultTitle: "" },
  { id: "train", label: "Train", icon: "🚆", defaultTitle: "" },
  { id: "bus", label: "Bus", icon: "🚌", defaultTitle: "" },
  { id: "cab", label: "Cab", icon: "🚕", defaultTitle: "" },
  { id: "ferry", label: "Ferry", icon: "⛴", defaultTitle: "" },
  { id: "stay", label: "Stay", icon: "🏨", defaultTitle: "" },
  { id: "activity", label: "Activity", icon: "📍", defaultTitle: "" },
  { id: "food", label: "Food", icon: "🍽", defaultTitle: "" },
  { id: "note", label: "Note", icon: "📝", defaultTitle: "" },
];

/** Transport items get from/to fields; the rest don't need them. */
export const TRANSPORT_KINDS = new Set<TripItemKind>(["flight", "train", "bus", "cab", "ferry"]);

export function itemKindMeta(kind: TripItemKind) {
  return ITEM_KINDS.find((k) => k.id === kind) ?? ITEM_KINDS[ITEM_KINDS.length - 1];
}

/**
 * Dates on a trip are plain YYYY-MM-DD. Both helpers normalise first so a stray
 * timestamp — or a trip saved before that was enforced — renders a real date instead of
 * "NaN-NaN-NaN".
 */
export function addDaysIso(iso: string, days: number): string {
  const base = toDateOnly(iso) || toDateOnly(new Date());
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dayHeading(iso: string): string {
  const base = toDateOnly(iso);
  if (!base) return "Date not set";
  const d = new Date(`${base}T00:00:00`);
  if (!Number.isFinite(d.getTime())) return "Date not set";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/**
 * Repair a trip loaded from storage. Earlier builds wrote `startDate` as a full ISO
 * timestamp, which broke the date picker and every derived day date.
 */
export function normaliseTrip(trip: Trip): Trip {
  const startDate = toDateOnly(trip.startDate) || toDateOnly(new Date());
  const fixed: Trip = {
    ...trip,
    startDate,
    travellers: Math.max(1, Math.round(trip.travellers || 1)),
    days: (trip.days ?? []).map((d) => ({
      ...d,
      items: (d.items ?? []).map((i) => ({ ...i, attachments: i.attachments ?? [] })),
    })),
  };
  if (fixed.days.length === 0) {
    fixed.days = [{ id: `${trip.id}-d0`, date: startDate, items: [] }];
  }
  return resequenceDays(fixed);
}

/** What this item costs the whole party. */
export function itemPartyCost(item: TripItem, travellers: number): number {
  const c = item.costInr ?? 0;
  return item.costBasis === "person" ? c * Math.max(1, travellers) : c;
}

export function dayTotal(day: TripDay, travellers: number): number {
  return day.items.reduce((s, i) => s + itemPartyCost(i, travellers), 0);
}

export function tripTotal(trip: Trip): number {
  return trip.days.reduce((s, d) => s + dayTotal(d, trip.travellers), 0);
}

/** Totals grouped by kind, for the summary strip. */
export function totalsByKind(trip: Trip): { kind: TripItemKind; label: string; icon: string; inr: number }[] {
  const acc = new Map<TripItemKind, number>();
  for (const d of trip.days) {
    for (const i of d.items) {
      acc.set(i.kind, (acc.get(i.kind) ?? 0) + itemPartyCost(i, trip.travellers));
    }
  }
  return [...acc.entries()]
    .filter(([, inr]) => inr > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([kind, inr]) => ({ kind, label: itemKindMeta(kind).label, icon: itemKindMeta(kind).icon, inr }));
}

export function bookedProgress(trip: Trip): { booked: number; total: number } {
  let booked = 0;
  let total = 0;
  for (const d of trip.days) {
    for (const i of d.items) {
      // A plain note isn't something you book.
      if (i.kind === "note") continue;
      total++;
      if (i.booked) booked++;
    }
  }
  return { booked, total };
}

/** Chronological within a day; untimed items sink to the bottom in insertion order. */
export function sortDayItems(items: TripItem[]): TripItem[] {
  return [...items].sort((a, b) => {
    const at = a.startTime || "";
    const bt = b.startTime || "";
    if (at && bt) return at.localeCompare(bt);
    if (at) return -1;
    if (bt) return 1;
    return 0;
  });
}

export function emptyItem(kind: TripItemKind): Omit<TripItem, "id"> {
  return {
    kind,
    title: itemKindMeta(kind).defaultTitle,
    costBasis: kind === "stay" ? "total" : "person",
    attachments: [],
    booked: false,
  };
}

export function emptyTrip(id: string, startDate: string): Trip {
  const now = new Date().toISOString();
  return {
    id,
    name: "New trip",
    destination: "",
    startDate,
    travellers: 2,
    days: [{ id: `${id}-d0`, date: startDate, items: [] }],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Re-date every day from the trip start. Days are always consecutive, so inserting or
 * removing one shifts the rest rather than leaving a gap.
 */
export function resequenceDays(trip: Trip): Trip {
  return {
    ...trip,
    days: trip.days.map((d, i) => ({ ...d, date: addDaysIso(trip.startDate, i) })),
  };
}

/** Plain-text itinerary for pasting into WhatsApp or email. */
export function tripToText(trip: Trip): string {
  const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  const lines: string[] = [];
  lines.push(trip.name || "Trip");
  if (trip.destination) lines.push(trip.destination);
  lines.push(`${trip.days.length} day${trip.days.length === 1 ? "" : "s"} · ${trip.travellers} traveller${trip.travellers === 1 ? "" : "s"} · from ${dayHeading(trip.startDate)}`);
  lines.push("");

  for (const [i, day] of trip.days.entries()) {
    lines.push(`Day ${i + 1} — ${dayHeading(day.date)}${day.label ? ` · ${day.label}` : ""}`);
    if (day.items.length === 0) {
      lines.push("  (nothing planned)");
    }
    for (const item of sortDayItems(day.items)) {
      const meta = itemKindMeta(item.kind);
      const when = item.startTime
        ? `${item.startTime}${item.endTime ? `–${item.endTime}${item.endsNextDay ? "+1" : ""}` : ""}  `
        : "";
      const route = item.from || item.to ? ` (${item.from ?? "?"} → ${item.to ?? "?"})` : "";
      const cost = item.costInr
        ? ` — ${money(item.costInr)}${item.costBasis === "person" ? "/person" : ""}`
        : "";
      lines.push(`  ${when}${meta.icon} ${item.title || meta.label}${route}${cost}${item.booked ? " ✓" : ""}`);
      if (item.bookingRef) lines.push(`      Ref: ${item.bookingRef}`);
      if (item.notes) lines.push(`      ${item.notes}`);
      for (const a of item.attachments) {
        if (a.kind === "link") lines.push(`      ${a.label ? `${a.label}: ` : ""}${a.url}`);
      }
    }
    const dt = dayTotal(day, trip.travellers);
    if (dt > 0) lines.push(`  Day total: ${money(dt)}`);
    lines.push("");
  }

  const total = tripTotal(trip);
  lines.push(`TOTAL: ${money(total)} for ${trip.travellers} — ${money(total / Math.max(1, trip.travellers))} each`);
  return lines.join("\n");
}

/**
 * Photos ride along in the same JSON blob that syncs to the cloud, so they are
 * aggressively downscaled before being stored. Full-size phone photos would blow past
 * the localStorage quota after two or three attachments.
 */
export const PHOTO_MAX_EDGE = 1000;
export const PHOTO_QUALITY = 0.7;
/** Warn once attachments on one trip get heavy. */
export const ATTACHMENT_WARN_BYTES = 2_500_000;

export async function fileToDownscaledDataUrl(file: File): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error("Could not read that file"));
    fr.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("That file isn't a readable image"));
    el.src = dataUrl;
  });

  const scale = Math.min(1, PHOTO_MAX_EDGE / Math.max(img.width, img.height));
  if (scale === 1 && dataUrl.length < 400_000) return dataUrl;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", PHOTO_QUALITY);
}

/** Rough byte weight of everything attached to a trip. */
export function attachmentBytes(trip: Trip): number {
  let n = 0;
  for (const d of trip.days) for (const i of d.items) for (const a of i.attachments) n += a.url.length;
  return n;
}

export function normaliseUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v)) return `https://${v}`;
  return null;
}
