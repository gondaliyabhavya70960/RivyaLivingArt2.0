"use client";

import { useState } from "react";

import { ContactMapMark } from "@/components/icons/brand-marks";
import { cn } from "@/lib/utils";

/**
 * The click-to-activate studio map — REDESIGN.md §11.7.
 *
 * Two rules decide everything here:
 *
 * 1. **Nothing is requested from Google until the visitor asks.** A map embed
 *    is a third-party frame that sets cookies and reports a page view the
 *    moment it mounts; on a page whose only job is to start a conversation,
 *    that is a cost paid by everyone to serve the few who want directions. So
 *    the frame mounts on a click, and the resting state is type on sand.
 * 2. **Nothing is fabricated.** The embed is built from the studio address the
 *    owner has actually entered. With no address there is nothing truthful to
 *    point a map at, so this component renders nothing at all and the page's
 *    "open in Google Maps" link carries the whole job.
 *
 * The address is rendered as real text by the page beside this panel, never
 * only inside the frame — an image of an address cannot be copied, read aloud
 * or pasted into a WhatsApp reply.
 */
export function StudioMap({
  address,
  activateLabel,
  noteLabel,
  frameTitle,
  className,
}: {
  /** `getSiteSettings().address` — empty until the owner fills it in. */
  address: string;
  /** Translated button label, e.g. "Show the map". */
  activateLabel: string;
  /** Translated mono note explaining what the click loads. */
  noteLabel: string;
  /** Translated `<iframe title>` — required for a keyboard-reachable frame. */
  frameTitle: string;
  className?: string;
}) {
  const [active, setActive] = useState(false);

  if (!address.trim()) return null;

  const src = `https://www.google.com/maps?q=${encodeURIComponent(
    address,
  )}&output=embed`;

  return (
    <div
      data-slot="sf-studio-map"
      className={cn(
        "relative aspect-[4/3] overflow-hidden rounded-image border border-hairline bg-sand sm:aspect-[16/9]",
        className,
      )}
    >
      {active ? (
        <iframe
          title={frameTitle}
          src={src}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <button
          type="button"
          onClick={() => setActive(true)}
          className="group/map absolute inset-0 flex flex-col items-center justify-center gap-3 text-center outline-none transition-colors duration-(--dur-fast) ease-(--ease-luxury) hover:bg-elev-2 motion-reduce:transition-none"
        >
          {/* §4.5's map vector, behind the label rather than beside it. It is
              a suggestion of a map and not a plan of anywhere (see its own
              header) — which is why it can sit at this size without breaking
              rule 2 above. The real address is text, beside this panel. */}
          <ContactMapMark className="absolute inset-0 h-full w-full opacity-70 transition-opacity duration-(--dur-base) ease-(--ease-settle) group-hover/map:opacity-100 motion-reduce:transition-none" />
          <span className="relative font-body text-16 font-medium text-ink">
            {activateLabel}
          </span>
          <span className="u-micro relative max-w-[28ch]">{noteLabel}</span>
        </button>
      )}
    </div>
  );
}
