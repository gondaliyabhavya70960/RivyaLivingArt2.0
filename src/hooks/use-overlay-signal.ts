"use client";

import { useSyncExternalStore } from "react";

import type { OverlaySignal } from "@/lib/overlay-signal";

/**
 * Read side of an overlay signal. Kept in a hook so every consumer subscribes
 * the same way and no component reaches for `useEffect` + `setState`, which
 * the repo's lint rules (correctly) reject.
 */
export function useOverlayOpen(signal: OverlaySignal): boolean {
  return useSyncExternalStore(
    signal.subscribe,
    signal.getSnapshot,
    signal.getServerSnapshot,
  );
}
