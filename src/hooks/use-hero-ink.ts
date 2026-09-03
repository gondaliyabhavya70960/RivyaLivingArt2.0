"use client";

import { useEffect, useSyncExternalStore } from "react";

import { usePathname } from "@/i18n/navigation";

type Listener = () => void;

/**
 * Module-level store: there is exactly one sticky header on the page, so one
 * shared boolean (rather than per-hook-instance state) is enough, and it
 * means every `useHeroInk` call (there is only ever one, in `site-header.tsx`)
 * reads the same value without a context provider.
 */
let overDark = false;
const listeners = new Set<Listener>();

function setOverDark(next: boolean) {
  if (next === overDark) return;
  overDark = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return overDark;
}

/**
 * True while the header's own band — the top 80px of the viewport — is
 * currently over a dark hero: `main [data-theme="navy"]` (any dark band) or
 * `main [data-slot="sf-hero"]` (a hero wrapper that isn't itself dark-themed
 * — `hero-media.tsx` carries the attribute on its poster wrapper, so a light
 * hero still registers). While true the header should render its
 * transparent-over-hero, light-ink treatment.
 *
 * Replaces the static per-route allowlist (`transparentRoutes.includes
 * (pathname)`) with an observer: a hero on a route the allowlist never knew
 * about (a `/p/*` seasonal lander, a future page) gets the right header
 * without a code change, because the observer watches what is actually
 * rendered rather than a list of paths.
 *
 * `seed` — the OLD allowlist check — is the value used for SSR and the
 * first client render, before any observer has had a chance to run
 * (`useSyncExternalStore`'s `getServerSnapshot`); it keeps the header from
 * flashing the wrong ink on first paint on routes the allowlist already got
 * right. The observer is re-armed on every pathname change (a client-side
 * navigation swaps the DOM under `main` without remounting this hook) and on
 * resize (the 80px band's `rootMargin` is computed from `window.innerHeight`
 * and goes stale otherwise).
 */
export function useHeroInk(seed: boolean): boolean {
  const pathname = usePathname();

  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    const intersecting = new Set<Element>();

    const arm = () => {
      observer?.disconnect();
      intersecting.clear();

      const targets = document.querySelectorAll<HTMLElement>(
        'main [data-theme="navy"], main [data-slot="sf-hero"]',
      );
      if (targets.length === 0) {
        setOverDark(false);
        return;
      }

      // Shrink the observed area to the header's own 80px band: a negative
      // bottom margin excludes everything below it, so an element only
      // counts as "intersecting" while some part of it is within that band.
      const excludeBelow = Math.max(0, window.innerHeight - 80);

      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) intersecting.add(entry.target);
            else intersecting.delete(entry.target);
          }
          setOverDark(intersecting.size > 0);
        },
        { rootMargin: `0px 0px -${excludeBelow}px 0px`, threshold: 0 },
      );

      for (const el of targets) observer.observe(el);
    };

    arm();
    window.addEventListener("resize", arm);

    return () => {
      window.removeEventListener("resize", arm);
      observer?.disconnect();
    };
  }, [pathname]);

  return useSyncExternalStore(subscribe, getSnapshot, () => seed);
}
