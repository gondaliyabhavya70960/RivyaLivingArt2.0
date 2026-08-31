"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(hover: none), (pointer: coarse)";

function subscribe(onChange: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** True on touch-primary devices — used to disable magnetic/hover effects. */
export function useIsTouch(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
