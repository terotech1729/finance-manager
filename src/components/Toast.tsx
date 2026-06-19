"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icons";

export type ToastTone = "success" | "error" | "info";
type ToastItem = { id: number; message: string; tone: ToastTone };
type Listener = (t: ToastItem) => void;

let listeners: Listener[] = [];
let counter = 0;

/** Fire a transient toast from anywhere (client components only). */
export function toast(message: string, tone: ToastTone = "info") {
  const item = { id: ++counter, message, tone };
  listeners.forEach((l) => l(item));
}

const toneStyles: Record<ToastTone, string> = {
  success: "border-success/50 bg-success-muted text-success",
  error: "border-danger/50 bg-danger-muted text-danger",
  info: "border-info/50 bg-info-muted text-info",
};

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const l: Listener = (t) => {
      setItems((cur) => [...cur, t]);
      setTimeout(() => setItems((cur) => cur.filter((x) => x.id !== t.id)), 3400);
    };
    listeners.push(l);
    return () => { listeners = listeners.filter((x) => x !== l); };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-[calc(100vw-2rem)] pointer-events-none">
      {items.map((t) => (
        <div
          key={t.id}
          className={`toast-in pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-lg border shadow-lg backdrop-blur-sm text-sm font-medium ${toneStyles[t.tone]}`}
        >
          <span className="shrink-0">
            {t.tone === "success" ? <Icon.Sparkles size={16} /> : t.tone === "error" ? <Icon.Close size={16} /> : <Icon.Zap size={16} />}
          </span>
          <span className="text-fg">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
