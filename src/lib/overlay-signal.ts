/**
 * A module-scoped open/close signal for a single global overlay.
 *
 * The storefront has two overlays that any part of the chrome must be able to
 * open — the search overlay (REDESIGN.md §5.6) and the site drawer (§5.4) —
 * and their triggers are scattered: the header, the mobile bottom bar, and a
 * global keyboard shortcut. None is a descendant of the others, and the
 * layout that mounts them is a server component, so it cannot pass a callback
 * down. A module-level external store is the smallest thing that works.
 *
 * `useSyncExternalStore` is the read side (see `src/hooks/`), so React never
 * sees a synchronous setState inside an effect.
 *
 * Each signal remembers the element that opened it, because Part 17 requires
 * that `Esc` return focus to the trigger.
 */
export type OverlaySignal = {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => boolean;
  /** The overlay is always closed on the server. */
  getServerSnapshot: () => boolean;
  open: (trigger?: HTMLElement | null) => void;
  close: () => void;
  toggle: (trigger?: HTMLElement | null) => void;
};

export function createOverlaySignal(): OverlaySignal {
  let open = false;
  let opener: HTMLElement | null = null;
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  return {
    subscribe(onChange) {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    getSnapshot: () => open,
    getServerSnapshot: () => false,
    open(trigger) {
      opener =
        trigger ??
        (typeof document !== "undefined" &&
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null);
      if (open) return;
      open = true;
      emit();
    },
    close() {
      if (!open) return;
      open = false;
      emit();
      // Focus returns after the close has rendered — the trigger may live in
      // a subtree that is only un-inerted once the overlay unmounts.
      const target = opener;
      opener = null;
      if (target && document.contains(target)) {
        requestAnimationFrame(() => target.focus());
      }
    },
    toggle(trigger) {
      if (open) this.close();
      else this.open(trigger);
    },
  };
}
