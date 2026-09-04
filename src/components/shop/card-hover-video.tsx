"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

const HOVER_CAPABLE_QUERY = "(hover: hover) and (pointer: fine)";

function subscribeHoverCapable(onChange: () => void) {
  const mq = window.matchMedia(HOVER_CAPABLE_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/**
 * True only for a fine-pointer, hover-capable visitor (mouse/trackpad) —
 * `useSyncExternalStore`, matching `use-prefers-reduced-motion.ts`'s pattern
 * rather than a `useState` + effect (the repo lints against setting state
 * synchronously in an effect body). Defaults to `false` for SSR and the
 * first paint: a touch visitor should never see this island try to mount.
 */
function useHoverCapablePointer(): boolean {
  return useSyncExternalStore(
    subscribeHoverCapable,
    () => window.matchMedia(HOVER_CAPABLE_QUERY).matches,
    () => false,
  );
}

/**
 * The catalog card's hover-play clip (D21). A silent, looping ambient film
 * that plays while the card is hovered or focused — never on the first
 * (`priority`) row, and only mounted at all for a fine-pointer, hover-capable
 * visitor who has not asked for reduced motion (`preload="none"` already
 * defers the network fetch to the first play, but a touch visitor gets no
 * `<video>` element in the DOM in the first place).
 *
 * **Why the listeners attach to the nearest `.group` ancestor instead of this
 * node.** The card's stretched click target — the title link's
 * `after:absolute after:inset-0` (Part 0: "the whole card is the target") —
 * sits in the DOM after this element and shares its `position: relative`
 * ancestor, so it paints ABOVE this region and is the actual hit-test target
 * a pointer lands on. A `mouseenter`/`mouseleave` pair bound to this node
 * would silently never fire. CSS `:hover`/`:focus-within` still resolve
 * correctly on every ANCESTOR of whatever the pointer actually hits (hover
 * state is ancestry-based, not paint-order-based) — the same reason the
 * card's existing second-image wipe already works through `group-hover:` —
 * so the imperative play/pause listeners reach up to that same ancestor by
 * hand (`element.closest(".group")`) rather than relying on an event that
 * paint order has made unreachable here.
 */
export function CardHoverVideo({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverCapable = useHoverCapablePointer();
  const prefersReducedMotion = usePrefersReducedMotion();
  const mount = hoverCapable && !prefersReducedMotion;

  useEffect(() => {
    if (!mount) return;
    const video = videoRef.current;
    const card = video?.closest<HTMLElement>(".group");
    if (!video || !card) return;

    const play = () => {
      video.play().catch(() => {
        // A muted, looping clip being refused autoplay is rare and not
        // worth surfacing — the card still links out to the PDP either way.
      });
    };
    const pause = () => {
      video.pause();
      video.currentTime = 0;
    };

    card.addEventListener("mouseenter", play);
    card.addEventListener("mouseleave", pause);
    card.addEventListener("focusin", play);
    card.addEventListener("focusout", pause);
    return () => {
      card.removeEventListener("mouseenter", play);
      card.removeEventListener("mouseleave", pause);
      card.removeEventListener("focusin", play);
      card.removeEventListener("focusout", pause);
    };
  }, [mount]);

  if (!mount) return null;

  return (
    <video
      ref={videoRef}
      aria-hidden
      src={src}
      muted
      loop
      playsInline
      preload="none"
      className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-(--dur-base) ease-(--ease-luxury) group-hover:opacity-100 group-focus-within:opacity-100 motion-reduce:transition-none"
    />
  );
}
