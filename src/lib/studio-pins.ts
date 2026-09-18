/**
 * The Studio sidebar's pinned row — S13's "pin/favorites row".
 *
 * ## Why this is browser storage and not a column
 *
 * A pin is one person's shortcut on one machine. It is not content, nothing
 * renders it to a visitor, and no other surface reads it back. Giving it a
 * table would mean a production migration on push (CLAUDE.md: every migration
 * here is one) to store a preference that is wrong the moment two people share
 * an ADMIN login — which is how a two-person studio actually works.
 *
 * That makes it exactly the case the repo reserves `localStorage` for: a
 * per-viewer convenience whose loss costs nothing. Every read and write is
 * wrapped, because a private window, cleared site data or a blocked-storage
 * policy makes the accessor THROW rather than return empty.
 *
 * ## Why a module-level store rather than component state
 *
 * Two copies of the nav are mounted at once — the fixed sidebar and the mobile
 * drawer — and a pin toggled in one has to appear in the other. A shared store
 * with `useSyncExternalStore` does that without an effect, which is also what
 * keeps this inside `react-hooks/set-state-in-effect`.
 *
 * The SSR snapshot is a STABLE empty array, so the server renders no pinned
 * row and the client fills it in on hydration. A fresh array each call would
 * make `useSyncExternalStore` loop forever.
 */
const KEY = "rivya.studio.pinned";

/** Stable identity: `useSyncExternalStore` compares snapshots by reference. */
const EMPTY: readonly string[] = Object.freeze([]);

let cache: readonly string[] | null = null;
const listeners = new Set<() => void>();

function read(): readonly string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const hrefs = parsed.filter((v): v is string => typeof v === "string");
    return hrefs.length > 0 ? Object.freeze(hrefs) : EMPTY;
  } catch {
    // Blocked, unavailable, or holding something this version cannot read.
    return EMPTY;
  }
}

export function subscribePins(onChange: () => void): () => void {
  listeners.add(onChange);
  // Another tab's pin lands here. `storage` fires only in OTHER tabs, which is
  // why the local write below also notifies by hand.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== KEY) return;
    cache = null;
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function getPinsSnapshot(): readonly string[] {
  cache ??= read();
  return cache;
}

/** The server, and the first client render, agree on "nothing pinned". */
export function getPinsServerSnapshot(): readonly string[] {
  return EMPTY;
}

/**
 * Add or remove one href. Returns the new list so a caller can act on it
 * without a second read.
 *
 * A write that throws still updates the in-memory list: the pin then works for
 * this session and is simply not remembered, which is a better outcome than a
 * control that appears to do nothing.
 */
export function togglePin(href: string): readonly string[] {
  const current = getPinsSnapshot();
  const next = current.includes(href)
    ? current.filter((entry) => entry !== href)
    : [...current, href];
  cache = next.length > 0 ? Object.freeze(next) : EMPTY;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* Remembered for this session only. */
  }
  for (const listener of listeners) listener();
  return cache;
}

/**
 * The pinned items, in the sidebar's own order rather than the order they were
 * pinned in.
 *
 * Pure, and exported for the test: a row that has been renamed, moved or
 * removed since it was pinned simply drops out, so a stale `localStorage` value
 * can never render a dead link or an empty row. That is the whole reason this
 * filters the nav rather than mapping the stored list.
 */
export function pinnedItemsOf<T extends { href: string }>(
  sections: readonly { items: readonly T[] }[],
  pinned: readonly string[],
): T[] {
  if (pinned.length === 0) return [];
  const wanted = new Set(pinned);
  return sections.flatMap((section) =>
    section.items.filter((item) => wanted.has(item.href)),
  );
}
