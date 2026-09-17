"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { CatalogProductCard } from "@/components/storefront/catalog-product-card";
import { Link } from "@/i18n/navigation";
import type { ShopProductItem } from "@/lib/shop";

/**
 * FeaturedRail — the homepage's "Featured pieces" as a pinned horizontal
 * gallery (Liquid Luxury v3.1, branch `redesign/liquid-luxury`).
 *
 * Replaces the 1+3 grid with a scroll-driven rail: on fine-pointer desktops
 * the section pins and the track translates horizontally with scroll (GSAP
 * ScrollTrigger, same engine and guards as `SmoothScrollProvider`); on touch
 * devices and under `prefers-reduced-motion` it is a plain overflow-x rail
 * with scroll-snap — identical content, no hijacking.
 *
 * Cards are the house `CatalogProductCard` untouched: the rail changes the
 * room, not the furniture. The outlined index numeral behind each card is
 * the rail's only addition to the card grammar.
 *
 * Enhancement is mounted-only: SSR renders the accessible overflow rail, so
 * the section is fully usable before, during and after hydration, and the
 * pin only ever attaches after the guards pass — never on the server.
 */
export function FeaturedRail({
  items,
  heading,
  endHref,
  endLabel,
}: {
  items: readonly ShopProductItem[];
  /** The section heading block, rendered above the track and pinned with it. */
  heading: ReactNode;
  endHref: string;
  endLabel: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const [enhanced, setEnhanced] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let cancelled = false;
    let tween: { kill: () => void } | null = null;

    void (async () => {
      const { gsap } = await import("@/lib/gsap");
      if (cancelled) return;
      const root = rootRef.current;
      const track = trackRef.current;
      const head = headRef.current;
      if (!root || !track || !head) return;

      // Align the track's first card with the heading's left edge, whatever
      // the shell resolves to at this viewport.
      const pad = Math.max(0, head.getBoundingClientRect().left);
      track.style.paddingInline = `${pad}px`;

      setEnhanced(true);

      const distance = () =>
        Math.max(0, track.scrollWidth - window.innerWidth);

      tween = gsap.to(track, {
        x: () => -distance(),
        ease: "none",
        scrollTrigger: {
          trigger: root,
          start: "top top",
          end: () => "+=" + distance(),
          pin: true,
          scrub: 1,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      });
    })();

    return () => {
      cancelled = true;
      tween?.kill();
    };
  }, []);

  return (
    <div ref={rootRef} className="flex flex-col gap-12">
      <div ref={headRef} className="u-shell">
        {heading}
      </div>
      <div
        className={
          enhanced ? "fr-viewport fr-pinned" : "fr-viewport"
        }
      >
        <div ref={trackRef} className="fr-track">
          {items.map((item, index) => (
            <div key={item.id} className="fr-card">
              <span aria-hidden className="fr-idx">
                {String(index + 1).padStart(2, "0")}
              </span>
              <CatalogProductCard item={item} variant="full" />
            </div>
          ))}
          <div className="fr-end">
            <Link
              href={endHref}
              // `min-h-11` is the 44px tap floor, which this link missed at phone
              // widths (measured 144×28): the rail's end-cap is the one way out
              // of a horizontal scroller, and it sat below the floor on the
              // viewport where the scroller is hardest to use.
              className="inline-flex min-h-11 items-center font-display text-h3 leading-h3 italic text-ink underline decoration-champagne decoration-1 underline-offset-8 outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-champagne-ink motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3"
            >
              {endLabel} →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
