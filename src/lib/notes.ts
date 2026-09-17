/**
 * Notes: free-form rich-text cards, colour-coded by category.
 *
 * Bodies are stored as HTML because the editor is a contenteditable surface, which means
 * everything that comes back out has to be sanitised before it is rendered again — see
 * sanitizeNoteHtml. Nothing here touches AppState: notes have no rollover or recompute
 * behaviour and shouldn't be dragged through that machinery.
 */

export type NoteCategory =
  | "finance"
  | "work"
  | "travel"
  | "personal"
  | "ideas"
  | "health"
  | "shopping"
  | "other";

export type Note = {
  id: string;
  title: string;
  /** Sanitised HTML. Never render this without running it through sanitizeNoteHtml. */
  body: string;
  category: NoteCategory;
  pinned: boolean;
  /** ISO timestamps. */
  createdAt: string;
  updatedAt: string;
};

export type CategoryStyle = {
  id: NoteCategory;
  label: string;
  /** Tailwind classes for the card surface. */
  card: string;
  /** The colour bar down the side of a card. */
  accent: string;
  /** Chip shown on the card and in the filter row. */
  chip: string;
  /** Filter chip when selected. */
  chipActive: string;
  dot: string;
};

export const NOTE_CATEGORIES: readonly CategoryStyle[] = [
  {
    id: "finance",
    label: "Finance",
    card: "border-blue-500/30 bg-blue-500/[0.06] hover:border-blue-500/60",
    accent: "bg-blue-500",
    chip: "border-blue-500/40 text-blue-600 dark:text-blue-300",
    chipActive: "bg-blue-500 text-white border-blue-500",
    dot: "bg-blue-500",
  },
  {
    id: "work",
    label: "Work",
    card: "border-violet-500/30 bg-violet-500/[0.06] hover:border-violet-500/60",
    accent: "bg-violet-500",
    chip: "border-violet-500/40 text-violet-600 dark:text-violet-300",
    chipActive: "bg-violet-500 text-white border-violet-500",
    dot: "bg-violet-500",
  },
  {
    id: "travel",
    label: "Travel",
    card: "border-emerald-500/30 bg-emerald-500/[0.06] hover:border-emerald-500/60",
    accent: "bg-emerald-500",
    chip: "border-emerald-500/40 text-emerald-600 dark:text-emerald-300",
    chipActive: "bg-emerald-500 text-white border-emerald-500",
    dot: "bg-emerald-500",
  },
  {
    id: "personal",
    label: "Personal",
    card: "border-rose-500/30 bg-rose-500/[0.06] hover:border-rose-500/60",
    accent: "bg-rose-500",
    chip: "border-rose-500/40 text-rose-600 dark:text-rose-300",
    chipActive: "bg-rose-500 text-white border-rose-500",
    dot: "bg-rose-500",
  },
  {
    id: "ideas",
    label: "Ideas",
    card: "border-amber-500/30 bg-amber-500/[0.06] hover:border-amber-500/60",
    accent: "bg-amber-500",
    chip: "border-amber-500/40 text-amber-600 dark:text-amber-300",
    chipActive: "bg-amber-500 text-white border-amber-500",
    dot: "bg-amber-500",
  },
  {
    id: "health",
    label: "Health",
    card: "border-teal-500/30 bg-teal-500/[0.06] hover:border-teal-500/60",
    accent: "bg-teal-500",
    chip: "border-teal-500/40 text-teal-600 dark:text-teal-300",
    chipActive: "bg-teal-500 text-white border-teal-500",
    dot: "bg-teal-500",
  },
  {
    id: "shopping",
    label: "Shopping",
    card: "border-fuchsia-500/30 bg-fuchsia-500/[0.06] hover:border-fuchsia-500/60",
    accent: "bg-fuchsia-500",
    chip: "border-fuchsia-500/40 text-fuchsia-600 dark:text-fuchsia-300",
    chipActive: "bg-fuchsia-500 text-white border-fuchsia-500",
    dot: "bg-fuchsia-500",
  },
  {
    id: "other",
    label: "Other",
    card: "border-slate-500/30 bg-slate-500/[0.06] hover:border-slate-500/60",
    accent: "bg-slate-400",
    chip: "border-slate-500/40 text-slate-600 dark:text-slate-300",
    chipActive: "bg-slate-500 text-white border-slate-500",
    dot: "bg-slate-400",
  },
];

const CATEGORY_BY_ID = new Map(NOTE_CATEGORIES.map((c) => [c.id, c]));

export function categoryStyle(id: NoteCategory | string): CategoryStyle {
  return CATEGORY_BY_ID.get(id as NoteCategory) ?? CATEGORY_BY_ID.get("other")!;
}

// ————————————————————————— sanitising —————————————————————————

/** Tags the editor can produce. Anything else is unwrapped or dropped. */
const ALLOWED_TAGS = new Set([
  "P",
  "BR",
  "DIV",
  "SPAN",
  "H1",
  "H2",
  "H3",
  "UL",
  "OL",
  "LI",
  "STRONG",
  "B",
  "EM",
  "I",
  "U",
  "S",
  "STRIKE",
  "DEL",
  "BLOCKQUOTE",
  "CODE",
  "PRE",
  "A",
  "HR",
]);

/** Dropped outright, contents and all. */
const VOID_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "FORM", "INPUT"]);

function safeHref(raw: string): string | null {
  const v = raw.trim();
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
  // Bare domains typed into the link prompt are the common case.
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v)) return `https://${v}`;
  return null;
}

/**
 * Strip anything the editor shouldn't have produced. contenteditable happily accepts
 * pasted markup from anywhere, so this runs on the way in (before save) rather than
 * trusting the surface.
 */
export function sanitizeNoteHtml(html: string): string {
  if (typeof window === "undefined" || !html) return "";
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");

  const walk = (node: Element) => {
    for (const child of [...node.children]) {
      if (VOID_TAGS.has(child.tagName)) {
        child.remove();
        continue;
      }
      walk(child);
      if (!ALLOWED_TAGS.has(child.tagName)) {
        // Keep the text, lose the tag.
        child.replaceWith(...child.childNodes);
        continue;
      }
      for (const attr of [...child.attributes]) {
        const keep =
          child.tagName === "A" && attr.name.toLowerCase() === "href" && safeHref(attr.value) !== null;
        if (!keep) child.removeAttribute(attr.name);
      }
      if (child.tagName === "A") {
        const href = safeHref(child.getAttribute("href") ?? "");
        if (!href) {
          child.replaceWith(...child.childNodes);
          continue;
        }
        child.setAttribute("href", href);
        child.setAttribute("target", "_blank");
        child.setAttribute("rel", "noopener noreferrer");
      }
    }
  };

  walk(doc.body);
  return doc.body.innerHTML;
}

/**
 * Plain text for card previews and search. Block boundaries become spaces first —
 * textContent alone would run a heading straight into the list under it and turn
 * "Trip / Book cab" into "TripBook cab", which then fails a search for "trip book".
 */
export function noteText(html: string): string {
  if (!html) return "";
  const spaced = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|h[1-6]|li|ul|ol|blockquote|pre|hr)>/gi, " ");
  if (typeof window === "undefined") return spaced.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  const doc = new DOMParser().parseFromString(`<body>${spaced}</body>`, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** First line of the body, used to name a note the user never titled. */
export function derivedTitle(note: Pick<Note, "title" | "body">): string {
  if (note.title.trim()) return note.title.trim();
  const text = noteText(note.body);
  if (!text) return "Untitled note";
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

export function emptyNote(category: NoteCategory = "finance"): Omit<Note, "id"> {
  const now = new Date().toISOString();
  return { title: "", body: "", category, pinned: false, createdAt: now, updatedAt: now };
}

/** Pinned first, then most recently edited. */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort(
    (a, b) =>
      Number(b.pinned) - Number(a.pinned) || (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0)
  );
}

export function matchesQuery(note: Note, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${note.title} ${noteText(note.body)}`.toLowerCase().includes(q);
}

/** "Edited 5 min ago" / "Edited 12 Sep". */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}
