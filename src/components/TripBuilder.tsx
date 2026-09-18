"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./Icons";
import { Callout } from "./Callout";
import { PlaceTypeahead } from "./PlaceTypeahead";
import { toast } from "./Toast";
import { loadTrips, upsertTrip, deleteTrip as removeTrip } from "@/lib/storage";
import { useDataVersion } from "@/lib/useLiveData";
import { inr, newId, todayLocal, toDateOnly } from "@/lib/utils";
import type { TravelPlace } from "@/lib/travel/places";
import { guideFor, monthRangeLabel } from "@/lib/travel/itinerary/guides";
import {
  ATTACHMENT_WARN_BYTES,
  ITEM_KINDS,
  TRANSPORT_KINDS,
  addDaysIso,
  attachmentBytes,
  bookedProgress,
  dayHeading,
  dayTotal,
  emptyItem,
  emptyTrip,
  fileToDownscaledDataUrl,
  itemKindMeta,
  itemPartyCost,
  normaliseTrip,
  normaliseUrl,
  resequenceDays,
  sortDayItems,
  totalsByKind,
  tripToText,
  tripTotal,
  type Trip,
  type TripDay,
  type TripItem,
  type TripItemKind,
} from "@/lib/travel/itinerary/trips";

const AUTOSAVE_MS = 600;

/** Quick-add buttons shown on every day — the ones you reach for most, first. */
const QUICK_ADD: TripItemKind[] = ["flight", "stay", "cab", "activity", "train", "food", "note"];

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="label mb-1 block">{label}</span>
      {children}
    </label>
  );
}

function AttachmentStrip({
  item,
  onChange,
}: {
  item: TripItem;
  onChange: (next: TripItem) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const addLink = () => {
    const raw = window.prompt("Paste a link (booking page, map, blog post):");
    if (!raw) return;
    const url = normaliseUrl(raw);
    if (!url) {
      toast("That doesn't look like a URL", "error");
      return;
    }
    const label = window.prompt("Label (optional):") || undefined;
    onChange({
      ...item,
      attachments: [...item.attachments, { id: newId(), kind: "link", url, label }],
    });
  };

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const added = [];
      for (const file of [...files].slice(0, 6)) {
        if (!file.type.startsWith("image/")) continue;
        added.push({ id: newId(), kind: "photo" as const, url: await fileToDownscaledDataUrl(file), label: file.name });
      }
      if (added.length) onChange({ ...item, attachments: [...item.attachments, ...added] });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't attach that image", "error");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const drop = (id: string) =>
    onChange({ ...item, attachments: item.attachments.filter((a) => a.id !== id) });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-ghost !min-h-0 !py-1 !px-2 text-xs" onClick={addLink}>
          🔗 Add link
        </button>
        <button
          type="button"
          className="btn-ghost !min-h-0 !py-1 !px-2 text-xs"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          🖼 {busy ? "Adding…" : "Add photo"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => void addPhotos(e.target.files)}
        />
      </div>

      {item.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.attachments.map((a) =>
            a.kind === "photo" ? (
              <div key={a.id} className="group relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.url}
                  alt={a.label || "Attachment"}
                  className="h-20 w-20 rounded-lg border border-border object-cover"
                />
                <button
                  type="button"
                  onClick={() => drop(a.id)}
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-bg-elevated border border-border p-0.5 text-fg-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger"
                  title="Remove"
                >
                  <Icon.Close size={12} />
                </button>
              </div>
            ) : (
              <span
                key={a.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-chrome px-2 py-1 text-xs"
              >
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                  {a.label || new URL(a.url).hostname}
                </a>
                <button type="button" onClick={() => drop(a.id)} className="text-fg-muted hover:text-danger">
                  <Icon.Close size={11} />
                </button>
              </span>
            )
          )}
        </div>
      )}
    </div>
  );
}

function ItemRow({
  item,
  travellers,
  onChange,
  onDelete,
  onDuplicate,
  onMove,
  dayCount,
  dayIndex,
  onMoveToDay,
}: {
  item: TripItem;
  travellers: number;
  onChange: (next: TripItem) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMove: (dir: -1 | 1) => void;
  dayCount: number;
  dayIndex: number;
  onMoveToDay: (target: number) => void;
}) {
  const [open, setOpen] = useState(!item.title);
  const meta = itemKindMeta(item.kind);
  const isTransport = TRANSPORT_KINDS.has(item.kind);

  return (
    <div className={`rounded-lg border p-3 ${item.booked ? "border-emerald-500/40 bg-emerald-500/[0.04]" : "border-border bg-bg-chrome/40"}`}>
      <div className="flex items-start gap-2">
        <span className="pt-0.5 text-base leading-none">{meta.icon}</span>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="input !py-1 min-w-0 flex-1"
              placeholder={`${meta.label} name — e.g. ${
                item.kind === "flight" ? "6E 5321" : item.kind === "stay" ? "Naini Retreat" : "what you're doing"
              }`}
              value={item.title}
              onChange={(e) => onChange({ ...item, title: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="btn-ghost !min-h-0 !py-1 !px-2 text-xs"
            >
              {open ? "Hide" : "Details"}
            </button>
          </div>

          <div className="grid gap-2 sm:grid-cols-[repeat(4,minmax(0,1fr))]">
            {isTransport && (
              <>
                <input
                  className="input !py-1 text-xs"
                  placeholder="From"
                  value={item.from ?? ""}
                  onChange={(e) => onChange({ ...item, from: e.target.value })}
                />
                <input
                  className="input !py-1 text-xs"
                  placeholder="To"
                  value={item.to ?? ""}
                  onChange={(e) => onChange({ ...item, to: e.target.value })}
                />
              </>
            )}
            <input
              className="input !py-1 text-xs"
              type="time"
              value={item.startTime ?? ""}
              onChange={(e) => onChange({ ...item, startTime: e.target.value })}
            />
            <input
              className="input !py-1 text-xs"
              type="time"
              value={item.endTime ?? ""}
              onChange={(e) => onChange({ ...item, endTime: e.target.value })}
            />
            {!isTransport && (
              <>
                <input
                  className="input !py-1 text-xs"
                  inputMode="numeric"
                  placeholder="Cost ₹"
                  value={item.costInr ?? ""}
                  onChange={(e) =>
                    onChange({ ...item, costInr: Number(e.target.value.replace(/[^0-9.]/g, "")) || undefined })
                  }
                />
                <select
                  className="input !py-1 text-xs"
                  value={item.costBasis}
                  onChange={(e) => onChange({ ...item, costBasis: e.target.value as "person" | "total" })}
                >
                  <option value="person">per person</option>
                  <option value="total">total</option>
                </select>
              </>
            )}
          </div>

          {isTransport && (
            <div className="grid gap-2 sm:grid-cols-[repeat(4,minmax(0,1fr))]">
              <input
                className="input !py-1 text-xs"
                inputMode="numeric"
                placeholder="Cost ₹"
                value={item.costInr ?? ""}
                onChange={(e) =>
                  onChange({ ...item, costInr: Number(e.target.value.replace(/[^0-9.]/g, "")) || undefined })
                }
              />
              <select
                className="input !py-1 text-xs"
                value={item.costBasis}
                onChange={(e) => onChange({ ...item, costBasis: e.target.value as "person" | "total" })}
              >
                <option value="person">per person</option>
                <option value="total">total</option>
              </select>
              <label className="flex items-center gap-2 text-xs text-fg-muted">
                <input
                  type="checkbox"
                  checked={item.endsNextDay ?? false}
                  onChange={(e) => onChange({ ...item, endsNextDay: e.target.checked })}
                  className="rounded border-border"
                />
                Arrives next day
              </label>
              <input
                className="input !py-1 text-xs"
                placeholder="PNR / booking ref"
                value={item.bookingRef ?? ""}
                onChange={(e) => onChange({ ...item, bookingRef: e.target.value })}
              />
            </div>
          )}

          {open && (
            <div className="space-y-2 border-t border-border pt-2">
              {!isTransport && (
                <input
                  className="input !py-1 text-xs"
                  placeholder="Booking ref / confirmation"
                  value={item.bookingRef ?? ""}
                  onChange={(e) => onChange({ ...item, bookingRef: e.target.value })}
                />
              )}
              <textarea
                className="input !py-1 text-xs"
                rows={2}
                placeholder="Notes — what to carry, who to call, why this one"
                value={item.notes ?? ""}
                onChange={(e) => onChange({ ...item, notes: e.target.value })}
              />
              <AttachmentStrip item={item} onChange={onChange} />
            </div>
          )}

          {!open && item.attachments.length > 0 && (
            <div className="text-xs text-fg-muted">
              {item.attachments.filter((a) => a.kind === "photo").length} photo(s) ·{" "}
              {item.attachments.filter((a) => a.kind === "link").length} link(s)
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="text-right text-xs tabular-nums text-fg-muted">
            {item.costInr ? inr(itemPartyCost(item, travellers)) : "—"}
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              title={item.booked ? "Booked" : "Mark booked"}
              onClick={() => onChange({ ...item, booked: !item.booked })}
              className={`rounded p-1 text-xs ${item.booked ? "text-emerald-500" : "text-fg-muted hover:text-fg"}`}
            >
              ✓
            </button>
            <button type="button" title="Move up" onClick={() => onMove(-1)} className="rounded p-1 text-fg-muted hover:text-fg">
              ↑
            </button>
            <button type="button" title="Move down" onClick={() => onMove(1)} className="rounded p-1 text-fg-muted hover:text-fg">
              ↓
            </button>
            <button type="button" title="Duplicate" onClick={onDuplicate} className="rounded p-1 text-fg-muted hover:text-fg">
              <Icon.Plus size={13} />
            </button>
            <button type="button" title="Delete" onClick={onDelete} className="rounded p-1 text-fg-muted hover:text-danger">
              <Icon.Trash size={13} />
            </button>
          </div>
          {dayCount > 1 && (
            <select
              className="input !py-0.5 !px-1 text-[11px] w-auto"
              value={dayIndex}
              onChange={(e) => onMoveToDay(Number(e.target.value))}
              title="Move to another day"
            >
              {Array.from({ length: dayCount }, (_, i) => (
                <option key={i} value={i}>
                  Day {i + 1}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </div>
  );
}

export function TripBuilder() {
  const version = useDataVersion();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Trip | null>(null);
  const [dirty, setDirty] = useState(false);
  const [destPlace, setDestPlace] = useState<TravelPlace | null>(null);
  const [showIdeas, setShowIdeas] = useState(true);
  /** Which day the suggestion palette drops items onto. */
  const [ideaDay, setIdeaDay] = useState(0);

  useEffect(() => {
    const all = loadTrips().map(normaliseTrip);
    setTrips(all);
    setActiveId((cur) => cur ?? all[0]?.id ?? null);
  }, [version]);

  // Load the selected trip into the editable draft.
  useEffect(() => {
    if (!activeId) {
      setDraft(null);
      return;
    }
    const found = loadTrips().find((t) => t.id === activeId) ?? null;
    setDraft(found ? normaliseTrip(found) : null);
    setDirty(false);
  }, [activeId, version]);

  useEffect(() => {
    if (!draft || !dirty) return;
    const t = setTimeout(() => {
      setTrips(upsertTrip(draft));
      setDirty(false);
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [draft, dirty]);

  const update = (fn: (t: Trip) => Trip) => {
    setDraft((d) => (d ? fn(d) : d));
    setDirty(true);
  };

  const createTrip = () => {
    const trip = emptyTrip(newId(), todayLocal());
    setTrips(upsertTrip(trip));
    setActiveId(trip.id);
    setDraft(trip);
    setDirty(false);
  };

  const dropTrip = (t: Trip) => {
    if (!window.confirm(`Delete "${t.name}"? This can't be undone.`)) return;
    const rest = removeTrip(t.id);
    setTrips(rest);
    setActiveId(rest[0]?.id ?? null);
    toast("Trip deleted", "success");
  };

  // ————— day + item mutations —————

  const patchDay = (dayId: string, fn: (d: TripDay) => TripDay) =>
    update((t) => ({ ...t, days: t.days.map((d) => (d.id === dayId ? fn(d) : d)) }));

  const addItem = (dayId: string, kind: TripItemKind, seed?: Partial<TripItem>) =>
    patchDay(dayId, (d) => ({
      ...d,
      items: [...d.items, { ...emptyItem(kind), id: newId(), ...seed }],
    }));

  const patchItem = (dayId: string, item: TripItem) =>
    patchDay(dayId, (d) => ({ ...d, items: d.items.map((i) => (i.id === item.id ? item : i)) }));

  const dropItem = (dayId: string, itemId: string) =>
    patchDay(dayId, (d) => ({ ...d, items: d.items.filter((i) => i.id !== itemId) }));

  const duplicateItem = (dayId: string, item: TripItem) =>
    patchDay(dayId, (d) => {
      const at = d.items.findIndex((i) => i.id === item.id);
      const copy = { ...item, id: newId(), attachments: item.attachments.map((a) => ({ ...a, id: newId() })) };
      const next = [...d.items];
      next.splice(at + 1, 0, copy);
      return { ...d, items: next };
    });

  const moveItem = (dayId: string, itemId: string, dir: -1 | 1) =>
    patchDay(dayId, (d) => {
      const at = d.items.findIndex((i) => i.id === itemId);
      const to = at + dir;
      if (at === -1 || to < 0 || to >= d.items.length) return d;
      const next = [...d.items];
      [next[at], next[to]] = [next[to], next[at]];
      return { ...d, items: next };
    });

  const moveItemToDay = (fromDayId: string, item: TripItem, targetIndex: number) =>
    update((t) => {
      const target = t.days[targetIndex];
      if (!target || target.id === fromDayId) return t;
      return {
        ...t,
        days: t.days.map((d) => {
          if (d.id === fromDayId) return { ...d, items: d.items.filter((i) => i.id !== item.id) };
          if (d.id === target.id) return { ...d, items: [...d.items, item] };
          return d;
        }),
      };
    });

  const addDay = () =>
    update((t) =>
      resequenceDays({
        ...t,
        days: [...t.days, { id: newId(), date: addDaysIso(t.startDate, t.days.length), items: [] }],
      })
    );

  const removeDay = (dayId: string) =>
    update((t) => {
      if (t.days.length <= 1) return t;
      const day = t.days.find((d) => d.id === dayId);
      if (day && day.items.length > 0 && !window.confirm(`Delete this day and its ${day.items.length} item(s)?`))
        return t;
      return resequenceDays({ ...t, days: t.days.filter((d) => d.id !== dayId) });
    });

  const duplicateDay = (dayId: string) =>
    update((t) => {
      const at = t.days.findIndex((d) => d.id === dayId);
      if (at === -1) return t;
      const src = t.days[at];
      const copy: TripDay = {
        id: newId(),
        date: src.date,
        label: src.label,
        items: src.items.map((i) => ({
          ...i,
          id: newId(),
          booked: false,
          attachments: i.attachments.map((a) => ({ ...a, id: newId() })),
        })),
      };
      const days = [...t.days];
      days.splice(at + 1, 0, copy);
      return resequenceDays({ ...t, days });
    });

  const sortDay = (dayId: string) => patchDay(dayId, (d) => ({ ...d, items: sortDayItems(d.items) }));

  /** Drop a curated suggestion onto the chosen day. */
  const addIdea = (kind: TripItemKind, title: string, costInr?: number, notes?: string) => {
    if (!draft) return;
    const day = draft.days[Math.min(ideaDay, draft.days.length - 1)];
    if (!day) return;
    addItem(day.id, kind, { title, costInr, notes, costBasis: "person" });
    toast(`Added "${title}" to Day ${draft.days.indexOf(day) + 1}`, "success");
  };

  const copyText = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(tripToText(draft));
      toast("Itinerary copied as text", "success");
    } catch {
      toast("Couldn't reach the clipboard", "error");
    }
  };

  const guide = useMemo(() => {
    const id = draft?.destinationPlaceId ?? destPlace?.id;
    return id ? guideFor(id) : null;
  }, [draft?.destinationPlaceId, destPlace]);

  const heavy = draft ? attachmentBytes(draft) > ATTACHMENT_WARN_BYTES : false;
  const progress = draft ? bookedProgress(draft) : { booked: 0, total: 0 };
  const kinds = draft ? totalsByKind(draft) : [];
  const total = draft ? tripTotal(draft) : 0;

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-[#1a1206] via-[#0f172a] to-[#0b1220]">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(700px 280px at 15% 0%, rgba(245,158,11,0.26), transparent 55%), radial-gradient(500px 240px at 88% 30%, rgba(168,85,247,0.16), transparent 50%)",
          }}
        />
        <div className="relative p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.18em] text-amber-300/80">Build itinerary</div>
              <h2 className="text-xl sm:text-2xl font-semibold text-white mt-1">Your plan, day by day</h2>
              <p className="text-sm text-slate-300/90 mt-1 max-w-2xl">
                Type in the flights, stays and cabs you actually find. Costs roll up per day and per person,
                and you can attach booking links or screenshots to any line.
              </p>
            </div>
            <button type="button" className="btn-primary" onClick={createTrip}>
              <Icon.Plus size={16} />
              New trip
            </button>
          </div>

          {trips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {trips.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveId(t.id)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    activeId === t.id
                      ? "border-white bg-white text-slate-900 font-semibold"
                      : "border-white/20 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {t.name || "Untitled"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {!draft ? (
        <div className="card-shell p-10 text-center">
          <p className="text-sm text-fg-muted">No trip yet. Start one and build it out day by day.</p>
          <button type="button" className="btn-secondary mt-4" onClick={createTrip}>
            <Icon.Plus size={16} />
            Start a trip
          </button>
        </div>
      ) : (
        <>
          <div className="card-shell p-3 sm:p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Trip name">
                <input
                  className="input"
                  value={draft.name}
                  onChange={(e) => update((t) => ({ ...t, name: e.target.value }))}
                />
              </Field>
              <div>
                <span className="label mb-1 block">Destination</span>
                <PlaceTypeahead
                  mode="any"
                  label=""
                  placeholder="Nainital…"
                  value={destPlace}
                  onChange={(p) => {
                    setDestPlace(p);
                    if (p) update((t) => ({ ...t, destination: p.city, destinationPlaceId: p.id }));
                  }}
                />
              </div>
              <Field label="Start date">
                <input
                  className="input"
                  type="date"
                  value={toDateOnly(draft.startDate)}
                  onChange={(e) => {
                    const day = toDateOnly(e.target.value);
                    if (!day) return;
                    update((t) => resequenceDays({ ...t, startDate: day }));
                  }}
                />
              </Field>
              <Field label="Travellers">
                <input
                  className="input"
                  type="number"
                  min={1}
                  value={draft.travellers}
                  onChange={(e) => update((t) => ({ ...t, travellers: Math.max(1, Number(e.target.value) || 1) }))}
                />
              </Field>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-fg-muted">
                  Total <span className="font-semibold text-fg tabular-nums">{inr(total)}</span>
                </span>
                <span className="text-fg-muted">
                  {inr(total / Math.max(1, draft.travellers))} each
                </span>
                {progress.total > 0 && (
                  <span className="text-fg-muted">
                    {progress.booked}/{progress.total} booked
                  </span>
                )}
                <span className="text-xs text-fg-muted">{dirty ? "Saving…" : "Saved"}</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className="btn-secondary !min-h-0 !py-1.5 text-xs" onClick={copyText}>
                  Copy as text
                </button>
                <button
                  type="button"
                  className="btn-ghost !min-h-0 !py-1.5 text-xs"
                  onClick={() => dropTrip(draft)}
                >
                  <Icon.Trash size={14} />
                  Delete trip
                </button>
              </div>
            </div>

            {kinds.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                {kinds.map((k) => (
                  <span
                    key={k.kind}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border bg-bg-chrome px-2.5 py-1 text-xs"
                  >
                    <span>{k.icon}</span>
                    {k.label}
                    <span className="font-semibold tabular-nums">{inr(k.inr)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>

          {heavy && (
            <Callout tone="info" title="Attachments are getting heavy">
              Photos are downscaled on upload, but they still travel in the same synced blob as the rest of your
              data. If this trip gets much bigger, prefer links over screenshots.
            </Callout>
          )}

          {guide && showIdeas && (
            <div className="card-shell p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-fg text-sm">Ideas for {draft.destination}</div>
                  <p className="text-xs text-fg-muted mt-0.5">{guide.vibe}</p>
                </div>
                <button
                  type="button"
                  className="btn-ghost !min-h-0 !py-1 !px-2 text-xs"
                  onClick={() => setShowIdeas(false)}
                >
                  Hide
                </button>
              </div>
              <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
                <div>
                  <span className="label">Worth</span>
                  <div className="text-fg-muted mt-0.5">
                    {guide.idealNights} nights
                    {draft.days.length - 1 < guide.minNights && (
                      <span className="text-amber-600 dark:text-amber-400">
                        {" "}
                        — you have {draft.days.length - 1}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="label">Best months</span>
                  <div className="text-fg-muted mt-0.5">{monthRangeLabel(guide.bestMonths)}</div>
                </div>
                <div>
                  <span className="label">Getting around</span>
                  <div className="text-fg-muted mt-0.5">{guide.localTransport}</div>
                </div>
              </div>

              <p className="mt-3 text-xs text-fg-muted">
                Click any of these to drop it on the day you choose, then set the time.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <select
                  className="input !py-0.5 !px-1.5 text-[11px] w-auto"
                  value={ideaDay}
                  onChange={(e) => setIdeaDay(Number(e.target.value))}
                  title="Which day these get added to"
                >
                  {draft.days.map((_, i) => (
                    <option key={i} value={i}>
                      → Day {i + 1}
                    </option>
                  ))}
                </select>
                {guide.attractions.map((a) => (
                  <button
                    key={a.name}
                    type="button"
                    onClick={() => addIdea("activity", a.name, a.costInr, a.note)}
                    className="rounded-full border border-border px-2.5 py-1 text-xs text-fg-muted transition-colors hover:border-accent hover:text-fg"
                  >
                    + {a.name}
                    {a.costInr ? <span className="ml-1 opacity-60">{inr(a.costInr)}</span> : null}
                  </button>
                ))}
                {(guide.dayTrips ?? []).map((t) => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => addIdea("cab", `Day trip — ${t.name}`, t.costInr, t.note)}
                    className="rounded-full border border-emerald-500/40 px-2.5 py-1 text-xs text-emerald-600 transition-colors hover:bg-emerald-500/10 dark:text-emerald-300"
                  >
                    + {t.name} <span className="opacity-60">{t.hours}h</span>
                  </button>
                ))}
              </div>

              {guide.tips && guide.tips.length > 0 && (
                <ul className="mt-3 list-disc space-y-0.5 pl-4 text-xs text-fg-muted">
                  {guide.tips.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="space-y-4">
            {draft.days.map((day, dayIdx) => (
              <div key={day.id} className="card-shell p-3 sm:p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-bg-chrome px-2 py-1 text-xs font-semibold text-fg">
                      Day {dayIdx + 1}
                    </span>
                    <span className="text-sm text-fg-muted">{dayHeading(day.date)}</span>
                    <input
                      className="input !py-1 !px-2 text-xs w-44"
                      placeholder="Label — e.g. Arrive & settle"
                      value={day.label ?? ""}
                      onChange={(e) => patchDay(day.id, (d) => ({ ...d, label: e.target.value }))}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    {dayTotal(day, draft.travellers) > 0 && (
                      <span className="text-xs tabular-nums text-fg-muted">
                        {inr(dayTotal(day, draft.travellers))}
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn-ghost !min-h-0 !py-1 !px-2 text-xs"
                      onClick={() => sortDay(day.id)}
                      title="Sort this day by time"
                    >
                      Sort by time
                    </button>
                    <button
                      type="button"
                      className="btn-ghost !min-h-0 !py-1 !px-2 text-xs"
                      onClick={() => duplicateDay(day.id)}
                    >
                      Duplicate
                    </button>
                    {draft.days.length > 1 && (
                      <button
                        type="button"
                        className="btn-ghost !min-h-0 !py-1 !px-2 text-xs hover:text-danger"
                        onClick={() => removeDay(day.id)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {day.items.length > 0 && (
                  <div className="space-y-2">
                    {day.items.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        travellers={draft.travellers}
                        dayCount={draft.days.length}
                        dayIndex={dayIdx}
                        onChange={(next) => patchItem(day.id, next)}
                        onDelete={() => dropItem(day.id, item.id)}
                        onDuplicate={() => duplicateItem(day.id, item)}
                        onMove={(dir) => moveItem(day.id, item.id, dir)}
                        onMoveToDay={(target) => moveItemToDay(day.id, item, target)}
                      />
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {QUICK_ADD.map((k) => {
                    const meta = itemKindMeta(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => addItem(day.id, k)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-fg-muted transition-colors hover:border-accent hover:text-fg"
                      >
                        <span>{meta.icon}</span>+ {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addDay}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-4 text-sm text-fg-muted transition-colors hover:border-accent hover:text-fg"
          >
            <Icon.Plus size={18} />
            Add day {draft.days.length + 1}
          </button>
        </>
      )}
    </div>
  );
}
