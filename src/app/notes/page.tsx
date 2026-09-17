"use client";

import { useEffect, useMemo, useState } from "react";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Icon } from "@/components/Icons";
import { toast } from "@/components/Toast";
import { loadNotes, upsertNote, deleteNote as removeNote } from "@/lib/storage";
import { useDataVersion } from "@/lib/useLiveData";
import { newId } from "@/lib/utils";
import {
  NOTE_CATEGORIES,
  categoryStyle,
  derivedTitle,
  emptyNote,
  matchesQuery,
  noteText,
  relativeTime,
  sanitizeNoteHtml,
  sortNotes,
  type Note,
  type NoteCategory,
} from "@/lib/notes";

/** Autosave delay — long enough not to write on every keystroke, short enough to feel safe. */
const AUTOSAVE_MS = 700;

function CategoryChips({
  value,
  onChange,
  size = "md",
}: {
  value: NoteCategory;
  onChange: (c: NoteCategory) => void;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {NOTE_CATEGORIES.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onChange(c.id)}
          className={`inline-flex items-center gap-1.5 rounded-full border transition-colors ${
            size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
          } ${value === c.id ? c.chipActive : `${c.chip} hover:bg-bg-chrome`}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${value === c.id ? "bg-white/80" : c.dot}`} />
          {c.label}
        </button>
      ))}
    </div>
  );
}

function NoteCard({
  note,
  onOpen,
  onTogglePin,
  onDelete,
}: {
  note: Note;
  onOpen: () => void;
  onTogglePin: () => void;
  onDelete: () => void;
}) {
  const style = categoryStyle(note.category);
  const preview = noteText(note.body);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`group relative flex h-56 cursor-pointer flex-col overflow-hidden rounded-xl border pl-4 pr-3 py-3 text-left transition-all hover:shadow-md ${style.card}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${style.accent}`} />

      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{derivedTitle(note)}</h3>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            title={note.pinned ? "Unpin" : "Pin to top"}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin();
            }}
            className={`rounded p-1 hover:bg-bg-chrome ${note.pinned ? "text-accent" : "text-fg-muted hover:text-fg"}`}
          >
            <Icon.Pin size={14} />
          </button>
          <button
            type="button"
            title="Delete note"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded p-1 text-fg-muted hover:bg-bg-chrome hover:text-danger"
          >
            <Icon.Trash size={14} />
          </button>
        </div>
        {note.pinned && (
          <span className="shrink-0 text-[10px] uppercase tracking-wide text-fg-muted group-hover:hidden">
            Pinned
          </span>
        )}
      </div>

      <div className="mt-2 min-h-0 flex-1 overflow-hidden">
        {preview ? (
          <div
            className="note-rich note-rich-compact line-clamp-6 text-sm text-fg-muted"
            dangerouslySetInnerHTML={{ __html: sanitizeNoteHtml(note.body) }}
          />
        ) : (
          <p className="text-sm italic text-fg-muted">Empty note</p>
        )}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${style.chip}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
          {style.label}
        </span>
        <span className="text-[11px] text-fg-muted">{relativeTime(note.updatedAt)}</span>
      </div>
    </div>
  );
}

export default function NotesPage() {
  const version = useDataVersion();
  const [notes, setNotes] = useState<Note[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Note | null>(null);
  const [filter, setFilter] = useState<NoteCategory | "all">("all");
  const [query, setQuery] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setNotes(loadNotes());
  }, [version]);

  // Autosave the open note. Debounced so typing doesn't hit localStorage per keystroke.
  useEffect(() => {
    if (!draft || !dirty) return;
    const t = setTimeout(() => {
      const all = upsertNote(draft);
      setNotes(all);
      // upsertNote re-stamps updatedAt, so pull it back into the draft — otherwise the
      // header keeps showing the time of the previous save.
      const saved = all.find((n) => n.id === draft.id);
      if (saved) setDraft((d) => (d && d.id === saved.id ? { ...d, updatedAt: saved.updatedAt } : d));
      setDirty(false);
    }, AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [draft, dirty]);

  // Don't leave an unsaved edit behind when the editor closes.
  const closeEditor = () => {
    if (draft && dirty) setNotes(upsertNote(draft));
    setDirty(false);
    setOpenId(null);
    setDraft(null);
  };

  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeEditor();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // closeEditor closes over the current draft, which is exactly what we want on Escape.
  });

  const createNote = () => {
    const seed = emptyNote(filter === "all" ? "finance" : filter);
    const note: Note = { ...seed, id: newId() };
    setNotes(upsertNote(note));
    setDraft(note);
    setOpenId(note.id);
  };

  const openNote = (n: Note) => {
    setDraft(n);
    setOpenId(n.id);
    setDirty(false);
  };

  const togglePin = (n: Note) => {
    setNotes(upsertNote({ ...n, pinned: !n.pinned }));
  };

  const deleteNote = (n: Note) => {
    if (!window.confirm(`Delete "${derivedTitle(n)}"? This can't be undone.`)) return;
    setNotes(removeNote(n.id));
    if (openId === n.id) {
      setOpenId(null);
      setDraft(null);
      setDirty(false);
    }
    toast("Note deleted", "success");
  };

  const visible = useMemo(() => {
    const byCat = filter === "all" ? notes : notes.filter((n) => n.category === filter);
    return sortNotes(byCat.filter((n) => matchesQuery(n, query)));
  }, [notes, filter, query]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of notes) m.set(n.category, (m.get(n.category) ?? 0) + 1);
    return m;
  }, [notes]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Notes</h1>
          <p className="page-sub">
            One card per note, colour-coded by category. Formatting, search and pinning included; everything
            saves as you type.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={createNote}>
          <Icon.Plus size={16} />
          New note
        </button>
      </div>

      <div className="card-shell p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              filter === "all"
                ? "border-fg bg-fg text-bg font-semibold"
                : "border-border text-fg-muted hover:bg-bg-chrome"
            }`}
          >
            All {notes.length > 0 && <span className="opacity-60">· {notes.length}</span>}
          </button>
          {NOTE_CATEGORIES.map((c) => {
            const n = counts.get(c.id) ?? 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setFilter(c.id)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                  filter === c.id ? c.chipActive : `${c.chip} hover:bg-bg-chrome`
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${filter === c.id ? "bg-white/80" : c.dot}`} />
                {c.label}
                {n > 0 && <span className="opacity-60">· {n}</span>}
              </button>
            );
          })}
        </div>
        <input
          className="input"
          placeholder="Search notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {visible.length === 0 ? (
        <div className="card-shell p-10 text-center">
          <p className="text-sm text-fg-muted">
            {notes.length === 0
              ? "No notes yet. Create one and it'll show up here as a card."
              : "Nothing matches that filter."}
          </p>
          {notes.length === 0 && (
            <button type="button" className="btn-secondary mt-4" onClick={createNote}>
              <Icon.Plus size={16} />
              Write your first note
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              onOpen={() => openNote(n)}
              onTogglePin={() => togglePin(n)}
              onDelete={() => deleteNote(n)}
            />
          ))}
          <button
            type="button"
            onClick={createNote}
            className="flex h-56 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border text-fg-muted transition-colors hover:border-accent hover:text-fg"
          >
            <Icon.Plus size={22} />
            <span className="text-sm">New note</span>
          </button>
        </div>
      )}

      {draft && openId && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/60 p-3 sm:p-6"
          onClick={closeEditor}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-border bg-bg-elevated shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${categoryStyle(draft.category).dot}`} />
                <span className="text-xs text-fg-muted">
                  {dirty ? "Saving…" : `Edited ${relativeTime(draft.updatedAt)}`}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title={draft.pinned ? "Unpin" : "Pin to top"}
                  onClick={() => {
                    setDraft({ ...draft, pinned: !draft.pinned });
                    setDirty(true);
                  }}
                  className={`rounded p-1.5 hover:bg-bg-chrome ${
                    draft.pinned ? "text-accent" : "text-fg-muted hover:text-fg"
                  }`}
                >
                  <Icon.Pin size={16} />
                </button>
                <button
                  type="button"
                  title="Delete note"
                  onClick={() => deleteNote(draft)}
                  className="rounded p-1.5 text-fg-muted hover:bg-bg-chrome hover:text-danger"
                >
                  <Icon.Trash size={16} />
                </button>
                <button
                  type="button"
                  title="Close"
                  onClick={closeEditor}
                  className="rounded p-1.5 text-fg-muted hover:bg-bg-chrome hover:text-fg"
                >
                  <Icon.Close size={16} />
                </button>
              </div>
            </div>

            <div className="space-y-3 p-4">
              <input
                className="w-full bg-transparent text-lg font-semibold text-fg outline-none placeholder:text-fg-muted"
                placeholder="Note title"
                value={draft.title}
                onChange={(e) => {
                  setDraft({ ...draft, title: e.target.value });
                  setDirty(true);
                }}
              />
              <CategoryChips
                size="sm"
                value={draft.category}
                onChange={(c) => {
                  setDraft({ ...draft, category: c });
                  setDirty(true);
                }}
              />
              <RichTextEditor
                docKey={draft.id}
                value={draft.body}
                placeholder="Start typing. Use the toolbar for headings, lists and links."
                onChange={(html) => {
                  setDraft((d) => (d ? { ...d, body: html } : d));
                  setDirty(true);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
