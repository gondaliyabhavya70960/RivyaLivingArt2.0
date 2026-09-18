"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * §6.4 · the route loading bar — trickles to 70% over 800ms on navigation
 * start, completes and fades over 200ms on commit.
 *
 * WHY THIS IS A CLICK LISTENER AND NOT A ROUTER EVENT. The App Router ships
 * no `routeChangeStart`; `useLinkStatus` (Next 16) is the supported pending
 * signal and it must be rendered INSIDE the `<Link>` that is pending, so it
 * cannot drive one bar for the whole document. What is left is the two ends
 * of the navigation, observed directly:
 *
 *   start   a capture-phase click on an anchor that will actually navigate,
 *           plus `popstate` for back/forward
 *   commit  `usePathname()` / `useSearchParams()` changing
 *
 * That split is not a workaround for the missing event — it is what makes
 * §6.4's guard ("never on same-page anchors, hash links, or dropdown state")
 * expressible at all. The filter below is the guard, and it is the only place
 * in this component that decides anything:
 *
 *   · no anchor, or no href                  → not a navigation
 *   · modified click, middle click, `target` → the browser handles it, we do not
 *   · `download`, or a non-http(s) scheme    → mailto:, tel:, wa.me redirects
 *   · a different origin                     → we will not be here to finish
 *   · same path AND same query               → a hash link or a re-click
 *   · `event.defaultPrevented`               → a menu, a dialog, a filter
 *                                              chip: something already claimed
 *                                              this click
 *
 * The last two are the ones §6.4 names. A dropdown trigger is a `<button>` and
 * never reaches the anchor branch at all; an in-page `#section` link shares
 * the path and is rejected; a filter chip that preventDefaults to update state
 * client-side is rejected. MorphLink's own `preventDefault` runs in the BUBBLE
 * phase and ours in CAPTURE, so a view-transition navigation is still seen —
 * which is correct, it is a real navigation.
 *
 * NO GSAP (owner decision 13): the trickle is `requestAnimationFrame` easing a
 * single `scaleX`, and the completion is a CSS transition. §6.4's table row
 * lists `next-view-transitions` as its package; nothing from it is needed here,
 * because this bar reports on the navigation rather than driving it.
 *
 * REDUCED MOTION: §6.4's resting frame is "a bar that appears and disappears
 * with no trickle". Checked in JS as well as CSS — the trickle is a JS loop and
 * the global `@media` collapse in tokens.css cannot reach it.
 *
 * It also sets `data-route-busy` on `<html>`, which is how the scroll hairline
 * yields: the two share `--z-progress` and the same 2px strip, and §6.4 says
 * the route bar wins. Expressing that as one attribute and one CSS rule keeps
 * either component from having to import the other.
 */

/** §6.4: 70% over 800ms, then wait for the commit. */
const TRICKLE_TARGET = 0.7;
const TRICKLE_MS = 800;
/**
 * §6.4 asks for a 200ms fade on commit. This is 180ms — `--dur-fast` — and
 * the 20ms is deliberate: the contract's §8 says "existing tokens only… two
 * curves and four durations exist; a third is a bug", and 200ms is not one of
 * the four. The unmount timer below has to match whatever the CSS actually
 * runs, so both read the token rather than one reading the spec's number and
 * the other reading the token — a 20ms gap that leaves a fully transparent
 * bar in the DOM is not visible, and is exactly the kind of drift that makes
 * a later reader distrust both values.
 */
const FADE_MS = 180;

type Phase = "idle" | "loading" | "done";

/** True when this click will cause a client navigation we should report on. */
function isNavigatingClick(event: MouseEvent): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
    return false;

  const anchor = (event.target as Element | null)?.closest?.("a");
  if (!anchor) return false;
  if (anchor.hasAttribute("download")) return false;
  if (anchor.target && anchor.target !== "_self") return false;

  const href = anchor.getAttribute("href");
  if (!href) return false;

  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.origin !== window.location.origin) return false;
  // A hash link, or a re-click on the page we are already on. Both would
  // start a bar that nothing would ever finish.
  if (
    url.pathname === window.location.pathname &&
    url.search === window.location.search
  ) {
    return false;
  }
  return true;
}

export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const barRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  // The navigation this bar is currently reporting on. `usePathname` fires on
  // mount too, and a bar that completes on its own first render would flash on
  // every cold load.
  const watching = useRef(false);

  // ————— start —————
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!isNavigatingClick(event)) return;
      watching.current = true;
      setPhase("loading");
    };
    // Capture, so a link whose own handler calls preventDefault (MorphLink's
    // view-transition path) is still seen — that IS a navigation.
    document.addEventListener("click", onClick, { capture: true });
    // Back/forward: no click, same bar.
    const onPop = () => {
      watching.current = true;
      setPhase("loading");
    };
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  // ————— commit —————
  useEffect(() => {
    if (!watching.current) return;
    watching.current = false;
    setPhase("done");
    const id = window.setTimeout(() => setPhase("idle"), FADE_MS);
    return () => window.clearTimeout(id);
    // The route key, not the values: this must run when either half moves.
  }, [pathname, searchParams]);

  // ————— the trickle —————
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    if (phase === "idle") {
      bar.style.transform = "scaleX(0)";
      return;
    }
    if (phase === "done") {
      bar.style.transform = "scaleX(1)";
      return;
    }

    // §6.4 resting frame: no trickle. The bar still appears and disappears,
    // so the navigation is still reported — it just does not animate toward a
    // number it is guessing at.
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      bar.style.transform = `scaleX(${TRICKLE_TARGET})`;
      return;
    }

    let frame = 0;
    const started = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / TRICKLE_MS);
      // --ease-luxury, cubic-bezier(.16,1,.3,1), as its ~equivalent closed
      // form: fast out of the gate, long tail. A curve is not a token here —
      // this is a JS easing of a number, not a CSS transition — so it is
      // written as the out-expo the token approximates rather than inventing
      // a third house curve (tokens.css: "two curves, and a third is a bug").
      const eased = 1 - Math.pow(2, -10 * t);
      bar.style.transform = `scaleX(${eased * TRICKLE_TARGET})`;
      if (t < 1) frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [phase]);

  // ————— the hand-off to ScrollProgress —————
  useEffect(() => {
    const root = document.documentElement;
    if (phase === "idle") root.removeAttribute("data-route-busy");
    else root.setAttribute("data-route-busy", "");
    return () => root.removeAttribute("data-route-busy");
  }, [phase]);

  return (
    <div
      data-slot="route-progress"
      data-phase={phase}
      // Never announced. It reports on a navigation the user just asked for
      // and that the page title will confirm; a live progressbar on top of
      // that is a second voice saying the same thing. (ScrollProgress IS
      // announced, because nothing else conveys reading position.)
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-(--z-progress) h-0.5 opacity-0 transition-opacity duration-(--dur-fast) ease-(--ease-settle) data-[phase=done]:opacity-0 data-[phase=loading]:opacity-100 motion-reduce:transition-none"
    >
      <div
        ref={barRef}
        className="h-full origin-left scale-x-0 bg-champagne transition-transform duration-(--dur-fast) ease-(--ease-settle) rtl:origin-right motion-reduce:transition-none"
      />
    </div>
  );
}
