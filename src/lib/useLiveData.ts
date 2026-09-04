"use client";

import { useEffect, useState } from "react";
import { onStorageChange } from "./storage";

/**
 * Version counter that ticks whenever the stored data changes — a local edit, a
 * cloud pull, or another tab on this device writing to localStorage.
 *
 * Pages key their load effect on it (`useEffect(..., [dataVersion])`) so they
 * re-read after a background sync instead of showing whatever was cached when
 * they mounted. Loads are plain localStorage reads, so re-running is cheap.
 */
export function useDataVersion(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((n) => n + 1);
    const off = onStorageChange(bump);
    const onCrossTab = (e: StorageEvent) => {
      // "ccm.sync.*" is sync bookkeeping, not user data — ignore it.
      if (e.key?.startsWith("ccm.") && !e.key.startsWith("ccm.sync.")) bump();
    };
    window.addEventListener("storage", onCrossTab);
    return () => {
      off();
      window.removeEventListener("storage", onCrossTab);
    };
  }, []);

  return version;
}
