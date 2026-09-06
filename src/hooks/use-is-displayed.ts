"use client";

import { useCallback, useSyncExternalStore, type RefObject } from "react";

/**
 * Whether the element a ref points at currently has layout — no ancestor is
 * `display: none`. `offsetParent` is `null` exactly then (and under
 * `position: fixed`, which no caller uses).
 *
 * Why this exists: an `<iframe loading="lazy">` inside a hidden aside is NOT
 * deferred in Chromium. Chrome treats a hidden frame as a communication
 * channel — the tracking-pixel shape — and loads it eagerly on purpose, so
 * the "a hidden aside never fetches the page" that a container-query layout
 * seemed to give for free was measured to be false: at 1280 with the sidebar
 * open, and at 390, the editor had fetched the whole product page into a
 * frame nobody could see. The frame therefore mounts only while this hook
 * says its column is shown.
 *
 * `useSyncExternalStore` rather than an effect that sets state: the repo lints
 * against `setState` in an effect body, and this is exactly the external
 * subscription the hook exists for. A `ResizeObserver` on the element fires
 * when it gains or loses layout size, which is the display toggle; the window
 * resize listener covers the viewport crossing the container's threshold.
 */
export function useIsDisplayed(ref: RefObject<HTMLElement | null>): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const el = ref.current;
      if (!el || typeof ResizeObserver === "undefined") return () => {};
      const observer = new ResizeObserver(() => onChange());
      observer.observe(el);
      window.addEventListener("resize", onChange);
      return () => {
        observer.disconnect();
        window.removeEventListener("resize", onChange);
      };
    },
    [ref],
  );
  const getSnapshot = useCallback(
    () => (ref.current ? ref.current.offsetParent !== null : false),
    [ref],
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
