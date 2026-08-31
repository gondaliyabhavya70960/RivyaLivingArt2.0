"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

import { Button } from "@/components/storefront/button";
import { cn } from "@/lib/utils";

/**
 * StickyMobileCta — REDESIGN.md §9.5.
 *
 * > "Sticky action bar appears once the CTA scrolls out: title (one line) +
 * > price + WhatsApp button."
 *
 * Two details the spec implies rather than states:
 *
 * - **It sits ABOVE the global mobile bottom bar**, not on top of it. Part 5.5
 *   gives that bar the bottom 72px on every page; a second bar at `bottom-0`
 *   would simply be painted over by it.
 * - **It goes inert, not just invisible.** While the order panel or the
 *   footer is on screen the bar slides away AND leaves the tab order, so it
 *   can never cover the real Place Order CTA or the legal links, and a
 *   keyboard user never lands on an offscreen control.
 *
 * This is one of the two places on the storefront allowed a shadow (Part 3.5),
 * and it does not use one: a hairline over an opaque ground reads cleanly
 * enough here, and the site's argument is restraint.
 */
export function StickyMobileCta({
  title,
  priceLabel,
  whatsappHref,
  whatsappLabel,
  newTabLabel,
}: {
  title: string;
  priceLabel: string;
  /** `wa.me` deep link, built server-side with `@/lib/whatsapp`. */
  whatsappHref: string;
  whatsappLabel: string;
  /** Translated `Common.openInNewTab`, appended for screen readers. */
  newTabLabel: string;
}) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    // While the panel's own CTAs, the customize form, or the footer are on
    // screen the bar has nothing to add — §9.5 asks for it only "once the CTA
    // scrolls out", and it must never cover the real Place Order button or
    // the legal links.
    const targets = [
      document.getElementById("pdp-actions"),
      document.getElementById("order-panel"),
      document.querySelector("footer"),
    ].filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;
    const inView = new Map<Element, boolean>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries)
        inView.set(entry.target, entry.isIntersecting);
      setHidden([...inView.values()].some(Boolean));
    });
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      inert={hidden || undefined}
      className={cn(
        "fixed inset-x-0 bottom-18 z-30 border-y border-hairline bg-mineral lg:hidden",
        "transition-transform duration-(--dur-base) ease-(--ease-luxury) motion-reduce:transition-none",
        hidden && "translate-y-[calc(100%+4.5rem)]",
      )}
    >
      <div className="flex items-center justify-between gap-4 px-5 py-2.5">
        <div className="min-w-0">
          <p className="truncate font-body text-14 font-medium text-ink">
            {title}
          </p>
          <p className="u-num truncate text-12 text-graphite">{priceLabel}</p>
        </div>
        <Button variant="whatsapp" size="sm" className="shrink-0" asChild>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            data-wa-source="pdp_sticky_bar"
          >
            <MessageCircle aria-hidden strokeWidth={1.5} className="size-4" />
            {whatsappLabel}
            <span className="sr-only"> {newTabLabel}</span>
          </a>
        </Button>
      </div>
    </div>
  );
}
