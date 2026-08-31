import { createOverlaySignal } from "@/lib/overlay-signal";

/**
 * Open/close signal for the Studio's ⌘K command palette (REDESIGN.md §12.2).
 *
 * Deliberately a SECOND signal rather than a reuse of `searchSignal`: the
 * storefront overlay and the Studio palette share a keybinding and a visual
 * language, not a component — one searches the public catalogue, the other
 * jumps between staff destinations behind auth, and the two trees never mount
 * together. What they must not share is state, or a Studio page would try to
 * open a storefront overlay that is not in the tree.
 *
 * The signal exists so the topbar's Search button can open the palette without
 * being its ancestor. See `overlay-signal.ts` for why this is a module store.
 */
export const studioPaletteSignal = createOverlaySignal();

export const openStudioPalette = (trigger?: HTMLElement | null) =>
  studioPaletteSignal.open(trigger);
