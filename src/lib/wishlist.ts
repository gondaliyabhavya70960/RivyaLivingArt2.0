"use client";

import { useSyncExternalStore } from "react";

/**
 * Tiny client-side wishlist store — an ordered product-slug array persisted
 * under one localStorage key. No accounts: the list lives on the device.
 * Newest saves go first; the list is capped so the wishlist page's server
 * action (take ≤ 48) can always render everything that is stored.
 *
 * Subscribe pattern (useSyncExternalStore-shaped) so the header count, card
 * hearts and the wishlist panel all re-render from one source, including
 * cross-tab via the `storage` event.
 */

const STORAGE_KEY = "rr.wishlist";
const MAX_ITEMS = 48;

const EMPTY: readonly string[] = [];

// Snapshot cache — useSyncExternalStore requires a referentially stable
// snapshot between changes.
let cache: readonly string[] | null = null;
const listeners = new Set<() => void>();

function sanitize(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return EMPTY;
  const slugs = value.filter(
    (slug): slug is string =>
      typeof slug === "string" && slug.length > 0 && slug.length <= 160,
  );
  const unique = [...new Set(slugs)].slice(0, MAX_ITEMS);
  return unique.length > 0 ? unique : EMPTY;
}

function readStorage(): readonly string[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return sanitize(JSON.parse(raw));
  } catch {
    // Corrupt JSON / storage unavailable — treat as empty, never throw.
    return EMPTY;
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

function write(next: readonly string[]): void {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode / quota — the in-memory list still works for the session.
  }
  emit();
}

/** Another tab changed the list — drop the cache and re-read lazily. */
function onStorage(event: StorageEvent): void {
  if (event.key !== null && event.key !== STORAGE_KEY) return;
  cache = null;
  emit();
}

/** Current saved slugs (stable reference until the list changes). */
export function getWishlistSnapshot(): readonly string[] {
  if (cache === null) cache = readStorage();
  return cache;
}

/** SSR snapshot — the server never knows the device's list. */
export function getWishlistServerSnapshot(): readonly string[] {
  return EMPTY;
}

export function subscribeWishlist(listener: () => void): () => void {
  if (listeners.size === 0 && typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function isWishlisted(slug: string): boolean {
  return getWishlistSnapshot().includes(slug);
}

/** Toggle a slug; returns the new saved state. Newest saves lead the list. */
export function toggleWishlist(slug: string): boolean {
  const current = getWishlistSnapshot();
  if (current.includes(slug)) {
    const next = current.filter((s) => s !== slug);
    write(next.length > 0 ? next : EMPTY);
    return false;
  }
  write([slug, ...current].slice(0, MAX_ITEMS));
  return true;
}

/** Reactive saved-slug list for client components (hearts, count, panel). */
export function useWishlist(): readonly string[] {
  return useSyncExternalStore(
    subscribeWishlist,
    getWishlistSnapshot,
    getWishlistServerSnapshot,
  );
}
