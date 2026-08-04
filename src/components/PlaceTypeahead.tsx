"use client";

import { useEffect, useId, useRef, useState } from "react";
import { placeLabel, placeSubLabel, searchPlaces, type TravelPlace } from "@/lib/travel/places";
import type { TravelMode } from "@/lib/travel/types";

type Props = {
  mode: TravelMode;
  label: string;
  placeholder: string;
  value: TravelPlace | null;
  onChange: (place: TravelPlace | null) => void;
  excludeId?: string;
};

export function PlaceTypeahead({ mode, label, placeholder, value, onChange, excludeId }: Props) {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(value ? placeLabel(value) : "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    setQuery(value ? placeLabel(value) : "");
  }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const suggestions = searchPlaces(query, mode, 8).filter((p) => p.id !== excludeId);

  const pick = (place: TravelPlace) => {
    onChange(place);
    setQuery(placeLabel(place));
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapRef}>
      <label className="label mb-1 block">{label}</label>
      <input
        className="input"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={placeholder}
        value={query}
        autoComplete="off"
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onChange={(e) => {
          const q = e.target.value;
          setQuery(q);
          onChange(null);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter")) {
            setOpen(true);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, Math.max(0, suggestions.length - 1)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && open && suggestions[active]) {
            e.preventDefault();
            pick(suggestions[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && suggestions.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 w-full max-h-64 overflow-auto rounded-lg border border-border bg-bg-elevated shadow-lg"
        >
          {suggestions.map((place, i) => (
            <li key={place.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={`w-full text-left px-3 py-2.5 text-sm border-b border-border/60 last:border-0 ${
                  i === active ? "bg-accent/15 text-fg" : "hover:bg-bg-chrome text-fg"
                }`}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(place)}
              >
                <div className="font-medium flex items-center gap-2">
                  <span>{placeLabel(place)}</span>
                  {place.code && (
                    <span className="text-[10px] uppercase tracking-wide text-fg-muted border border-border rounded px-1.5 py-0.5">
                      {place.code}
                    </span>
                  )}
                </div>
                <div className="text-xs text-fg-muted mt-0.5">{placeSubLabel(place)}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
