"use client";

import { useEffect, useId, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { Pause, Play } from "lucide-react";

/**
 * Shared "motion paused" state for the site's auto-playing decorative motion
 * (AmbientVideo loops, VelocityMarquee) — the in-page pause mechanism
 * WCAG 2.2.2 (Level A) requires on top of the prefers-reduced-motion
 * collapse. Persisted in localStorage under `motion-paused`; a window
 * CustomEvent fans every change out so all instances (and the corner
 * toggle) stay in sync. Pausing one pauses all.
 */

const STORAGE_KEY = "motion-paused";
const CHANGE_EVENT = "motion-paused-change";

/** In-memory fallback so the toggle still works when storage is blocked. */
let memoryPaused = false;

function readPaused(): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) return stored === "1";
  } catch {
    // Storage blocked (private mode / policy) — fall through.
  }
  return memoryPaused;
}

function subscribePaused(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  // Cross-tab sync rides the storage event.
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setMotionPaused(paused: boolean): void {
  memoryPaused = paused;
  try {
    window.localStorage.setItem(STORAGE_KEY, paused ? "1" : "0");
  } catch {
    // The CustomEvent still syncs every instance for this page view.
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
}

/** True while the visitor has paused decorative motion. SSR: false. */
export function useMotionPaused(): boolean {
  return useSyncExternalStore(subscribePaused, readPaused, () => false);
}

/* ————— corner toggle (one per page, shared by every instance) ————— */

// Motion components register on mount; only the first-registered instance
// renders the toggle, so a page with several loops shows ONE control.
const owners: string[] = [];
const ownerListeners = new Set<() => void>();

function subscribeOwners(onChange: () => void) {
  ownerListeners.add(onChange);
  return () => {
    ownerListeners.delete(onChange);
  };
}

function emitOwners() {
  for (const listener of ownerListeners) listener();
}

/**
 * Persistent pause/play control for decorative auto-motion. Rendered by each
 * AmbientVideo / VelocityMarquee instance, but deduped to a single fixed
 * bottom-start chip per page (the WhatsApp FAB owns bottom-end). Portalled to
 * <body>: the media it governs sits inside `aria-hidden` decorative wrappers,
 * where an inline control would be invisible to assistive tech.
 *
 * Register: the card-overlay dark-glass chip — 36px visual, ::after extends
 * the hit area to 44px; low-opacity at rest, full ink on hover/focus, always
 * operable. Fixed porcelain/void literals — it floats over dark media.
 */
export function MotionPauseToggle() {
  const t = useTranslations("Common");
  const paused = useMotionPaused();
  const id = useId();

  useEffect(() => {
    owners.push(id);
    emitOwners();
    return () => {
      const at = owners.indexOf(id);
      if (at !== -1) owners.splice(at, 1);
      emitOwners();
    };
  }, [id]);

  // Ownership only materializes in the mount effect (client-side), so a
  // truthy isOwner also guarantees the DOM exists for the portal; SSR and
  // the first client render agree on null.
  const isOwner = useSyncExternalStore(
    subscribeOwners,
    () => owners[0] === id,
    () => false,
  );

  if (!isOwner) return null;

  return createPortal(
    <button
      type="button"
      aria-pressed={paused}
      aria-label={paused ? t("playMotion") : t("pauseMotion")}
      onClick={() => setMotionPaused(!paused)}
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      // bottom-20 below lg clears the global mobile WhatsApp bar (audit §37);
      // from lg the bar is gone and the chip returns to the corner.
      // No backdrop blur (Part 3.5 keeps blur to the header), the Part 3.8
      // duration token instead of a raw 200ms, and the storefront focus ring
      // rather than the shadcn semantic one.
      className="fixed bottom-20 start-5 z-(--z-bar) lg:bottom-5 flex size-9 cursor-pointer items-center justify-center rounded-sm border border-mineral/25 bg-obsidian/80 text-mineral opacity-60 transition-[opacity,border-color,background-color] duration-(--dur-fast) after:absolute after:-inset-1 hover:border-mineral/45 hover:bg-obsidian/90 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian motion-reduce:transition-none"
    >
      {paused ? (
        <Play aria-hidden className="size-4" />
      ) : (
        <Pause aria-hidden className="size-4" />
      )}
    </button>,
    document.body,
  );
}
