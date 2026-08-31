import { createOverlaySignal } from "@/lib/overlay-signal";

/**
 * Open/close signal for the site search overlay (REDESIGN.md §5.6) and for
 * the site drawer (§5.4).
 *
 * Both are mounted once, high in the storefront tree, and both are opened
 * from places that are not their descendants: the header's search action and
 * menu button, the mobile bottom bar's SEARCH and MENU items, and the global
 * `⌘K` / `/` shortcut. See `overlay-signal.ts` for why this is a module store
 * rather than context.
 */
export const searchSignal = createOverlaySignal();
export const menuSignal = createOverlaySignal();

/** Convenience wrappers — the call sites read better without `.open()`. */
export const openSearch = (trigger?: HTMLElement | null) =>
  searchSignal.open(trigger);
export const closeSearch = () => searchSignal.close();
export const toggleSearch = (trigger?: HTMLElement | null) =>
  searchSignal.toggle(trigger);

export const openMenu = (trigger?: HTMLElement | null) =>
  menuSignal.open(trigger);
export const closeMenu = () => menuSignal.close();
