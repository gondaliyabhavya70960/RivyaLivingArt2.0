"use client";

import { useEffect } from "react";

/**
 * Warns the visitor before they close/reload the tab while a form has unsaved
 * changes. beforeunload only — no in-app navigation interception.
 */
export function useUnsavedChangesGuard(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}
