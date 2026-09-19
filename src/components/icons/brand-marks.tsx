import type { SVGProps } from "react";

import { cn } from "@/lib/utils";

/* ————————————————————————————————————————————————————————————————
   BRAND MARKS — the few vectors that are too big to be icons.

   `registry.tsx` is the 24px grid: marks that sit beside a word. `empty-art.tsx`
   is the 96px grid: one mark per empty Studio list. This file is neither — it
   holds the handful of §4.5 vectors that are a PANEL rather than a glyph, and
   it is separate so the registry's style contract (one viewBox, one stroke
   width, pinned by test) stays literally true of the registry.

   ## DUOTONE HERE IS TWO OPACITIES OF ONE INK, NOT TWO COLOURS

   §4.5 asks for duotone, and `registry.tsx`'s header offers "champagne at
   18%" as the brand set's second tone. This file does not take that offer,
   for a reason that only shows up at this size: CLAUDE.md's palette rule says
   champagne is "never a fill" and caps it at two instances per viewport, and
   an 18% champagne wash across a 4:3 panel is the largest fill on the page.
   The second tone is therefore `currentColor` at 14% — which also keeps the
   whole mark inheriting the ink of wherever it is dropped, the one property
   that makes these usable on all three elevation steps.

   ## §4.5's REMAINING ROWS, AND WHY THEY ARE NOT DRAWN (2026-09-19)

   `docs/reference-design/implementation-plan.md §4.5` lists seven things. Four are built —
   the Studio empty-state set (ten marks in `empty-art.tsx`, where the plan
   asked for three), the trust set (in `registry.tsx`, cut to the three rows
   the PDP's copy actually has), this map, and the craft registry itself.
   Three are DECLINED rather than pending, and the reason is the same one in
   each case: a decorative vector with no surface is a file nobody deletes.

   · **`meniscus-line.svg` ×3 weights.** A section divider. This project
     already has one — `rule` / `rule-dk` in `globals.css`, used on every
     page — and `docs/redesign-contract.md §11` names "a second answer to the
     same question" as the failure to avoid. The meniscus IS in the design, as
     `MeniscusImage`'s reveal mask (§2.7); that is where the shape belongs,
     and it is built.

   · **`flow-contours.svg`.** An ambient background layer. `HeroMedia` and the
     system pages already carry one, `/redesign/texture-resin-flow.jpg`, which
     is a photograph of real resin. An SVG imitating it would be a generated
     stand-in for a picture the owner already has — and §12.5's provenance
     filter exists precisely so those two are never confused.

   · **The six duotone marks (F1).** F1 is a row in a brief that names a
     count and no subjects. Six marks chosen here would be six guesses; when a
     surface needs one, it gets one, in the file whose grid it belongs to.

   None of this is a backlog. If a future surface needs any of them, draw the
   one it needs — do not draw the set.
   ———————————————————————————————————————————————————————————————— */

type MarkProps = Omit<SVGProps<SVGSVGElement>, "children">;

/**
 * §4.5's contact map — the resting state of the click-to-activate embed on
 * `/contact`.
 *
 * It is DELIBERATELY NOT A MAP OF ANYWHERE. It is roads, a river and a pin:
 * enough to read as "a map is behind this", and nothing a visitor could
 * mistake for directions. A plausible-looking street plan of a place that is
 * not the studio would be the one thing on this page worse than no map —
 * `studio-map.tsx`'s own header records that nothing here is fabricated, and
 * the real address is rendered as text beside this panel.
 */
export function ContactMapMark({ className, ...props }: MarkProps) {
  return (
    <svg
      viewBox="0 0 160 120"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable={false}
      className={cn("text-graphite", className)}
      {...props}
    >
      {/* The second tone: blocks of land, one ink at 14%. */}
      <g fill="currentColor" fillOpacity={0.14} stroke="none">
        <path d="M0 0h58v34H0z" />
        <path d="M74 0h86v26H74z" />
        <path d="M0 50h44v70H0z" />
        <path d="M96 42h64v44H96z" />
        <path d="M60 96h30v24H60z" />
      </g>
      {/* Roads. */}
      <path d="M66 0v120M0 42h160" strokeOpacity={0.5} />
      <path d="M0 88h160M104 0v120" strokeOpacity={0.3} />
      {/* The river, because this studio pours them. */}
      <path
        d="M-2 66c18 8 26-6 44-4s22 16 40 14 28-14 46-10 22 10 34 6"
        strokeOpacity={0.55}
      />
      {/* The pin, on the one crossing that is not a grid line. */}
      <path d="M86 62a8 8 0 1 0-16 0c0 6 8 14 8 14s8-8 8-14Z" />
      <circle cx="78" cy="62" r="2.6" />
    </svg>
  );
}
