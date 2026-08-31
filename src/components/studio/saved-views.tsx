"use client";

import { useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bookmark, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type SavedView = { name: string; qs: string };

/**
 * Saved filter views (C2 scope-out, now in scope). Per-device convenience:
 * the current filter querystring saved under a name, re-applied with one
 * click. localStorage by design — views are a personal working set, not
 * shared content — and read as an EXTERNAL STORE (useSyncExternalStore), so
 * there is no mount effect mirroring storage into state and other tabs stay
 * in sync via the `storage` event. Every access is guarded: blocked storage
 * simply means no saved views.
 */
const EMPTY: SavedView[] = [];
const listeners = new Set<() => void>();
/** Snapshot cache per key — useSyncExternalStore requires a STABLE reference
 *  between reads, so the parsed array is reused until the raw string changes. */
const snapshots = new Map<string, { raw: string | null; views: SavedView[] }>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function isSavedView(value: unknown): value is SavedView {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as SavedView).name === "string" &&
    typeof (value as SavedView).qs === "string"
  );
}

function readViews(storageKey: string): SavedView[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(storageKey);
  } catch {
    return EMPTY;
  }
  const cached = snapshots.get(storageKey);
  if (cached && cached.raw === raw) return cached.views;

  let views = EMPTY;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      const valid = parsed.filter(isSavedView);
      if (valid.length > 0) views = valid;
    }
  } catch {
    // Corrupt entry — behave as if nothing was saved.
  }
  snapshots.set(storageKey, { raw, views });
  return views;
}

export function SavedViews({ storageKey }: { storageKey: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const views = useSyncExternalStore(
    subscribe,
    () => readViews(storageKey),
    () => EMPTY,
  );

  const persist = (next: SavedView[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Storage write blocked — nothing to re-read, so nothing changes.
    }
    for (const listener of listeners) listener();
  };

  const currentQs = searchParams.toString();

  const save = () => {
    const name = window.prompt("Name this view:")?.trim();
    if (!name) return;
    persist(
      [
        ...views.filter((view) => view.name !== name),
        { name, qs: currentQs },
      ].slice(-8),
    );
  };

  if (views.length === 0 && !currentQs) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      {views.map((view) => {
        const active = view.qs === currentQs;
        return (
          <span
            key={view.name}
            className={`inline-flex items-center overflow-hidden rounded-full border text-small ${
              active
                ? "border-sapphire-ink bg-sapphire-ink/10 font-medium text-sapphire-ink"
                : "border-border text-graphite"
            }`}
          >
            <button
              type="button"
              onClick={() =>
                router.push(view.qs ? `${pathname}?${view.qs}` : pathname)
              }
              className="min-h-9 px-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
            >
              {view.name}
            </button>
            <button
              type="button"
              aria-label={`Delete view ${view.name}`}
              onClick={() => persist(views.filter((v) => v.name !== view.name))}
              className="min-h-9 pe-3 ps-1 outline-none hover:text-alert focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset"
            >
              <X className="size-3.5" />
            </button>
          </span>
        );
      })}
      {currentQs && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-9"
          onClick={save}
        >
          <Bookmark strokeWidth={1.5} /> Save view
        </Button>
      )}
    </div>
  );
}
