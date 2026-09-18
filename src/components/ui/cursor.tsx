"use client";

import { useEffect, useRef, useState } from "react";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

/**
 * §6.1 · the custom cursor — an 8px champagne dot that tracks the pointer
 * exactly, and a 36px hairline ring that trails it.
 *
 * BUILT ON OWNER INSTRUCTION. The v3 build prompt's decision 9 defers this
 * ("§6.1 cursor and §6.5 preloader → a second PR"); the owner's own brief for
 * this session asks for it by name. The instruction wins, and the deferral's
 * conditions were written out in full where it was deferred, so they are the
 * spec this is built to rather than something re-invented:
 *
 *   "desktop and fine-pointer only, storefront only, never in Studio, never
 *    on touch, hidden over `input`, `textarea`, `[contenteditable]` and the
 *    Tiptap surface so the native caret survives, moved by rAF and transform —
 *    never React state per pointer move — and on an all-dark ground the ring
 *    uses a champagne hairline rather than `mix-blend-mode: difference`, which
 *    goes near-white on obsidian. Any failure falls back to the native cursor
 *    with no console noise."
 *
 * Every clause above is implemented below, and each is load-bearing:
 *
 * **`mix-blend-mode: difference` is NOT used**, though three of the four
 * briefs propose it. It is the standard trick because it guarantees contrast
 * on an unknown ground — but this ground is known, and it is obsidian.
 * Differencing against #080a0e yields ~#f7f5f1: a near-white blob, on every
 * page, which is the opposite of the "hairline, not a blob" the brief asks
 * for. A champagne ring at a known contrast is both correct and cheaper.
 *
 * **Nothing is React state per pointer move.** The dot and ring are written
 * straight to `style.transform` inside one rAF. A `setState` on `pointermove`
 * is 120 renders a second of the whole subtree, and the repo lints against the
 * adjacent mistake (`react-hooks/set-state-in-effect`) for the same reason.
 * The only state here is `mounted` — one transition, at startup.
 *
 * **It is `aria-hidden` and `pointer-events: none`.** It conveys nothing and
 * must never intercept the click it is drawing on top of.
 *
 * **The native cursor is hidden only while this one is live**, scoped to a
 * `data-cursor-live` attribute this component sets on `<html>` and removes on
 * unmount. If the component never mounts — touch, coarse pointer, reduced
 * motion, the Studio — the attribute is never set and the native cursor is
 * simply the cursor. There is no failure mode where both are hidden.
 *
 * **Text-entry surfaces keep the native caret.** `input`, `textarea`,
 * `select`, `[contenteditable]` and the Tiptap editor (`.ProseMirror`) hide
 * the custom cursor and restore the system one. An I-beam is information —
 * it tells you where the character will land — and a decorative ring is not a
 * substitute for it.
 */

/** Ring lerp per frame. Low enough to trail visibly, high enough not to lag. */
const RING_LERP = 0.18;
/** Selector for everything that must keep the native caret or pointer. */
const NATIVE_CURSOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable]",
  "[contenteditable='true']",
  ".ProseMirror",
].join(",");
/** Selector for anything the ring should open up over. */
const INTERACTIVE = [
  "a[href]",
  "button",
  "[role='button']",
  "[role='link']",
  "summary",
  "label",
].join(",");

export function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  // SSR renders nothing: `matchMedia` does not exist on the server, and a
  // cursor that hydrates in from markup would flash a ring at 0,0 before the
  // first pointer event arrives.
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // A coarse pointer has no cursor to replace, and `hover: none` catches the
    // touch laptop whose pointer is fine only while a mouse is attached.
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const apply = () => setEnabled(fine.matches && !reduced);
    apply();
    fine.addEventListener("change", apply);
    return () => fine.removeEventListener("change", apply);
  }, [reduced]);

  useEffect(() => {
    if (!enabled) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    const root = document.documentElement;
    root.setAttribute("data-cursor-live", "");

    // Start both off-screen rather than at 0,0, so the first frame after mount
    // does not paint a ring in the top-left corner of the hero.
    let px = -100;
    let py = -100;
    let rx = px;
    let ry = py;
    let frame = 0;
    let seen = false;

    const onMove = (event: PointerEvent) => {
      px = event.clientX;
      py = event.clientY;
      if (!seen) {
        // Snap the ring on the very first sighting; lerping it in from
        // off-screen would fly a ring across the page on page load.
        rx = px;
        ry = py;
        seen = true;
        dot.style.opacity = "1";
        ring.style.opacity = "1";
      }

      const target = event.target as Element | null;
      // `closest` rather than a tag check: the pointer is usually over a
      // `<span>` inside the button, not the button.
      const overNative = Boolean(target?.closest?.(NATIVE_CURSOR));
      const overInteractive =
        !overNative && Boolean(target?.closest?.(INTERACTIVE));
      root.toggleAttribute("data-cursor-native", overNative);
      ring.toggleAttribute("data-open", overInteractive);
      dot.toggleAttribute("data-hidden", overNative);
    };

    const tick = () => {
      rx += (px - rx) * RING_LERP;
      ry += (py - ry) * RING_LERP;
      dot.style.transform = `translate3d(${px}px, ${py}px, 0) translate(-50%, -50%)`;
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0) translate(-50%, -50%)`;
      frame = window.requestAnimationFrame(tick);
    };

    // The pointer leaving the document (the tab strip, another window) has to
    // take the cursor with it, or a ring sits frozen mid-page until it returns.
    const onLeave = () => {
      dot.style.opacity = "0";
      ring.style.opacity = "0";
    };
    const onEnter = () => {
      if (seen) {
        dot.style.opacity = "1";
        ring.style.opacity = "1";
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    document.addEventListener("pointerenter", onEnter);
    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("pointerenter", onEnter);
      root.removeAttribute("data-cursor-live");
      root.removeAttribute("data-cursor-native");
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <div
        ref={dotRef}
        aria-hidden
        data-slot="cursor-dot"
        className="pointer-events-none fixed top-0 left-0 z-(--z-skip) size-2 rounded-full bg-champagne opacity-0 transition-opacity duration-(--dur-fast) data-[hidden]:opacity-0"
      />
      <div
        ref={ringRef}
        aria-hidden
        data-slot="cursor-ring"
        // A 1px champagne hairline — §6.1's "ring", and the brand's own
        // vocabulary (Part 3.1 gives champagne to hairlines). `data-open`
        // widens it over anything clickable, which is the only state this
        // cursor has: the four in §6.1's table (`link`/`drag`/`media` labels)
        // are text inside a ring, and a mono word that follows the pointer
        // across nine locales is a translation surface with no copy key. One
        // honest state beats four half-built ones.
        className="pointer-events-none fixed top-0 left-0 z-(--z-skip) size-9 rounded-full border border-champagne opacity-0 transition-[opacity,width,height,border-color] duration-(--dur-fast) ease-(--ease-settle) data-[open]:size-14 data-[open]:border-champagne/60"
      />
    </>
  );
}
