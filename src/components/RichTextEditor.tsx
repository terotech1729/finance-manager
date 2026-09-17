"use client";

import { useCallback, useEffect, useRef } from "react";
import { sanitizeNoteHtml } from "@/lib/notes";

type Props = {
  /** Initial HTML. The surface is uncontrolled after mount so the caret doesn't jump. */
  value: string;
  onChange: (html: string) => void;
  /** Changing this reloads the surface — pass the note id when switching notes. */
  docKey: string;
  placeholder?: string;
};

type ToolButton =
  | { kind: "cmd"; id: string; label: string; title: string; arg?: string; bold?: boolean }
  | { kind: "block"; id: string; label: string; title: string; tag: string }
  | { kind: "link"; label: string; title: string }
  | { kind: "sep" };

const TOOLBAR: ToolButton[] = [
  { kind: "block", id: "h1", label: "H1", title: "Heading", tag: "H1" },
  { kind: "block", id: "h2", label: "H2", title: "Subheading", tag: "H2" },
  { kind: "block", id: "p", label: "Body", title: "Body text", tag: "P" },
  { kind: "sep" },
  { kind: "cmd", id: "bold", label: "B", title: "Bold (Ctrl/Cmd+B)", bold: true },
  { kind: "cmd", id: "italic", label: "I", title: "Italic (Ctrl/Cmd+I)" },
  { kind: "cmd", id: "underline", label: "U", title: "Underline (Ctrl/Cmd+U)" },
  { kind: "cmd", id: "strikeThrough", label: "S", title: "Strikethrough" },
  { kind: "sep" },
  { kind: "cmd", id: "insertUnorderedList", label: "• List", title: "Bullet list" },
  { kind: "cmd", id: "insertOrderedList", label: "1. List", title: "Numbered list" },
  { kind: "block", id: "quote", label: "❝", title: "Quote", tag: "BLOCKQUOTE" },
  { kind: "block", id: "code", label: "</>", title: "Code block", tag: "PRE" },
  { kind: "sep" },
  { kind: "link", label: "Link", title: "Add link" },
  { kind: "cmd", id: "removeFormat", label: "Clear", title: "Clear formatting" },
];

export function RichTextEditor({ value, onChange, docKey, placeholder }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const loadedKey = useRef<string | null>(null);

  // Only write into the DOM when the document actually changes. Re-setting innerHTML on
  // every keystroke would collapse the selection to the start of the node.
  useEffect(() => {
    if (!ref.current || loadedKey.current === docKey) return;
    ref.current.innerHTML = value || "";
    loadedKey.current = docKey;
  }, [docKey, value]);

  const emit = useCallback(() => {
    if (!ref.current) return;
    onChange(sanitizeNoteHtml(ref.current.innerHTML));
  }, [onChange]);

  const exec = (command: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  };

  /** execCommand toggles formatBlock, so re-applying the current block returns it to a paragraph. */
  const toggleBlock = (tag: string) => {
    ref.current?.focus();
    const current = document.queryCommandValue("formatBlock")?.toUpperCase();
    document.execCommand("formatBlock", false, current === tag ? "P" : tag);
    emit();
  };

  const addLink = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      window.alert("Select the text you want to turn into a link first.");
      return;
    }
    const url = window.prompt("Link to:");
    if (!url) return;
    exec("createLink", url);
  };

  return (
    <div className="rounded-xl border border-border bg-bg-elevated overflow-hidden">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-bg-chrome px-2 py-1.5">
        {TOOLBAR.map((b, i) =>
          b.kind === "sep" ? (
            <span key={i} className="mx-1 h-5 w-px bg-border" />
          ) : (
            <button
              key={i}
              type="button"
              title={b.kind === "link" ? b.title : b.title}
              // Keep the selection alive — focus would otherwise leave the editor on press.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                if (b.kind === "cmd") exec(b.id, b.arg);
                else if (b.kind === "block") toggleBlock(b.tag);
                else addLink();
              }}
              className={`min-w-[30px] rounded px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-bg-elevated hover:text-fg ${
                b.kind === "cmd" && b.bold ? "font-bold" : ""
              } ${b.kind === "cmd" && b.id === "italic" ? "italic" : ""} ${
                b.kind === "cmd" && b.id === "underline" ? "underline" : ""
              } ${b.kind === "cmd" && b.id === "strikeThrough" ? "line-through" : ""}`}
            >
              {b.label}
            </button>
          )
        )}
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder ?? "Start typing…"}
        onInput={emit}
        onBlur={emit}
        // Paste as plain text: pasted markup is the main way junk gets into the body.
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
          emit();
        }}
        className="note-editor min-h-[320px] max-h-[55vh] overflow-auto px-4 py-3 text-sm text-fg outline-none"
      />
    </div>
  );
}
