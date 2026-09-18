import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

/* ————————————————————————————————————————————————————————————————
   EMPTY-STATE LINE ART — §6.17, one per Studio list surface.

   A 96px mark, drawn at 1px on a 96 grid rather than scaled up from the 24px
   registry: a 1.5px stroke enlarged four times is a 6px stroke, and reads as a
   cartoon. These are a different weight on purpose.

   ## THE SELF-DRAW IS 600ms, AND IT DOES NOT RUN FOR EVERYONE

   `stroke-dashoffset` from the full path length to zero, `--dur-slow` over
   `--ease-luxury`, ONCE, on mount. Under reduced motion it renders complete
   and does not animate at all — not a 0.01ms version of the same thing. A
   drawing animation is exactly the vestibular-neutral-but-attention-grabbing
   effect that media query is for, and a 0.01ms draw is still a flicker.

   The keyframe and the guard are in `globals.css` (`sf-draw`), not here, so
   the reduced-motion branch is a CSS media query rather than a hook: this
   component has no state, no effect and no `"use client"`, which means an
   empty state can render inside a server component like the rest of the
   Studio's screens.

   `pathLength="1"` on every path is what makes one keyframe work for all of
   them. SVG normalises the path's length to 1, so `stroke-dasharray: 1` and
   an offset from 1 to 0 draws any path completely, whatever its real length —
   without it each mark would need its own measured dash value, and a path
   edited later would silently stop drawing all the way.

   ## STRUCTURE, NOT DECORATION

   §6.17: mark · short heading · one useful sentence · ONE next action. These
   are the mark. They are deliberately small and deliberately line-only — an
   oversized illustration on an empty table is the product apologising for
   having no data, when what the person needs is the button.
   ———————————————————————————————————————————————————————————————— */

type ArtProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  /** Rendered size in px. 96 is §6.17's; smaller reads as an icon, not art. */
  size?: number;
};

function Art({
  size = 96,
  className,
  children,
  ...props
}: ArtProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 96 96"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      className={cn("sf-draw text-mist", className)}
      {...props}
    >
      {children}
    </svg>
  );
}

/** Products — an empty shelf. */
export const EmptyProductsArt = (p: ArtProps) => (
  <Art {...p}>
    <path pathLength="1" d="M12 30h72M12 54h72M12 78h72" />
    <path pathLength="1" d="M20 30V18h16v12" />
    <path pathLength="1" d="M52 54V42h20v12" />
    <path pathLength="1" d="M12 18v66M84 18v66" />
  </Art>
);

/** Inquiries — an empty tray. */
export const EmptyInquiriesArt = (p: ArtProps) => (
  <Art {...p}>
    <path
      pathLength="1"
      d="M14 46 26 22h44l12 24v28a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4Z"
    />
    <path pathLength="1" d="M14 46h20l4 10h20l4-10h20" />
  </Art>
);

/** Media — an empty frame with the corner of a picture that is not there. */
export const EmptyMediaArt = (p: ArtProps) => (
  <Art {...p}>
    <rect pathLength="1" x="14" y="20" width="68" height="56" rx="3" />
    <circle pathLength="1" cx="34" cy="38" r="6" />
    <path pathLength="1" d="m18 66 18-16a5 5 0 0 1 7 0l24 22" />
  </Art>
);

/** Journal — an unwritten page. */
export const EmptyJournalArt = (p: ArtProps) => (
  <Art {...p}>
    <path
      pathLength="1"
      d="M22 14h34l18 18v50a4 4 0 0 1-4 4H22a4 4 0 0 1-4-4V18a4 4 0 0 1 4-4Z"
    />
    <path pathLength="1" d="M56 14v18h18" />
    <path pathLength="1" d="M30 50h32M30 62h20" />
  </Art>
);

/** Portfolio — an empty wall. */
export const EmptyPortfolioArt = (p: ArtProps) => (
  <Art {...p}>
    <rect pathLength="1" x="14" y="18" width="30" height="24" rx="2" />
    <rect pathLength="1" x="52" y="18" width="30" height="40" rx="2" />
    <rect pathLength="1" x="14" y="52" width="30" height="26" rx="2" />
    <path pathLength="1" d="M52 68h30" />
  </Art>
);

/** Testimonials — an open quote with nothing after it. */
export const EmptyTestimonialsArt = (p: ArtProps) => (
  <Art {...p}>
    <path
      pathLength="1"
      d="M28 54c-6 0-10-4-10-10s4-10 10-10 10 4 10 10c0 10-6 18-16 22"
    />
    <path
      pathLength="1"
      d="M66 54c-6 0-10-4-10-10s4-10 10-10 10 4 10 10c0 10-6 18-16 22"
    />
  </Art>
);

/** FAQs — a question with no answer yet. */
export const EmptyFaqsArt = (p: ArtProps) => (
  <Art {...p}>
    <path
      pathLength="1"
      d="M18 26a6 6 0 0 1 6-6h48a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H40L24 74V60a6 6 0 0 1-6-6Z"
    />
    <path pathLength="1" d="M42 34a6 6 0 1 1 8 5.6V44" />
    <path pathLength="1" d="M48 51h.01" />
  </Art>
);

/** Subscribers — an empty list. */
export const EmptySubscribersArt = (p: ArtProps) => (
  <Art {...p}>
    <path pathLength="1" d="M16 30h64v40a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4Z" />
    <path pathLength="1" d="m16 32 32 22 32-22" />
  </Art>
);

/** Scraper runs — an empty net. */
export const EmptyScraperArt = (p: ArtProps) => (
  <Art {...p}>
    <circle pathLength="1" cx="42" cy="42" r="24" />
    <path pathLength="1" d="M18 42h48M42 18v48" />
    <path pathLength="1" d="m60 60 20 20" />
  </Art>
);

/** Search — nothing matched. */
export const EmptySearchArt = (p: ArtProps) => (
  <Art {...p}>
    <circle pathLength="1" cx="42" cy="42" r="24" />
    <path pathLength="1" d="m60 60 20 20" />
    <path pathLength="1" d="m34 34 16 16M50 34 34 50" />
  </Art>
);
