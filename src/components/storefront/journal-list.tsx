"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { Link } from "@/i18n/navigation";
import { isOptimizableImageSrc } from "@/lib/image-src";

export type JournalRow = {
  id: string;
  slug: string;
  title: string;
  /** Already localized and formatted on the server — this is a client file. */
  dateLabel: string | null;
  category: string | null;
  cover: string | null;
};

/**
 * The journal as an editorial LIST — spec §3.1 S8, plan §2.1.
 *
 * It was a featured-post-plus-two grid: one large cover, two stubs beside it.
 * The spec asks for rows instead — "each row = date (mono) · category · title
 * (40px serif). Hover → cover thumbnail follows cursor" — because a list of
 * five titles reads as a journal with things in it, where a grid of three
 * reads as a page that ran out of posts.
 *
 * ── Three things the mockup specifies that are NOT copied verbatim ──────────
 *
 * TITLE SIZE. The mockup sets `clamp(24px, 2.8vw, 42px)` and the spec says
 * 40px; `--text-h3` is `clamp(24px, …, 36px)`. The floor matches exactly and
 * the ceiling is 6px short, and it stays short: CLAUDE.md is explicit that
 * colours, spacing and type come from REDESIGN.md Part 3 and are never
 * invented, so a 42px display step would have to be ratified into the scale
 * before anything could use it. `text-h2` (34 → 64px) is the next real step up
 * and is a headline size — at 64px a row title would outweigh the section's
 * own heading.
 *
 * CATEGORY COLOUR. The mockup paints every row's category champagne. Five rows
 * would be five champagne elements, and `redesign-audit.mjs` fails a viewport
 * with more than two — the eyebrow above already spends one. Champagne moves
 * to the hover state, where it costs nothing at rest and still marks the row
 * the cursor is on.
 *
 * THE HOVER SLIDE is kept (`translate-x-4`, the mockup's 16px). REDESIGN.md's
 * "no scale or lift on hover" is stated of BUTTONS, in the buttons section, and
 * this is an editorial row — the same reason the portfolio cards may rise.
 */
export function JournalList({ rows }: { rows: JournalRow[] }) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<string | null>(null);

  /**
   * The cursor preview, and the reasons it is built this way.
   *
   * The position is written straight to `style.transform` inside a
   * `requestAnimationFrame`, never through React state: a `setState` per
   * `pointermove` would re-render the whole list sixty times a second to move
   * one absolutely-positioned box. (It is also the rule this repo lints for —
   * no synchronous `setState` in an effect body.)
   *
   * Guards match `featured-rail.tsx`: nothing attaches under
   * `prefers-reduced-motion` or on a coarse pointer. On a touch device there
   * is no cursor for a preview to follow, and the whole thing would be dead
   * weight behind a listener that can never usefully fire.
   *
   * `position: fixed` with `pointer-events: none` keeps it out of the document
   * flow, so it cannot widen the page — `redesign-audit.mjs` fails any route
   * whose `scrollWidth` exceeds its `clientWidth`, and a 230px box tracking the
   * cursor near the right edge is exactly the shape that would trip it.
   */
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    let frame = 0;
    const onMove = (event: PointerEvent) => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const node = previewRef.current;
        if (!node) return;
        node.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%) rotate(-3deg)`;
      });
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const activeRow = rows.find((row) => row.id === active) ?? null;

  return (
    <>
      <div className="flex flex-col">
        {rows.map((row, index) => (
          <Link
            key={row.id}
            href={`/blog/${row.slug}`}
            onPointerEnter={() => setActive(row.id)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(null)}
            className={[
              "group grid items-baseline gap-x-6 gap-y-1 border-t border-hairline-dk py-8 outline-none",
              "grid-cols-1 md:grid-cols-[7rem_1fr_auto]",
              "focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-4",
              index === rows.length - 1 ? "border-b" : "",
            ].join(" ")}
          >
            <span className="u-micro text-graphite">{row.dateLabel}</span>
            <h3 className="font-display text-h3 leading-h3 text-ink transition-[transform,color] duration-(--dur-base) ease-(--ease-settle) group-hover:translate-x-4 group-hover:text-champagne-ink group-focus-visible:text-champagne-ink motion-reduce:transition-none">
              {row.title}
            </h3>
            {row.category ? (
              <span className="u-micro text-graphite">{row.category}</span>
            ) : (
              <span />
            )}
          </Link>
        ))}
      </div>

      {/* One preview node for the whole list, re-pointed as rows take turns —
          not one per row, which would put five hidden images on the page. */}
      <div
        ref={previewRef}
        aria-hidden
        className="pointer-events-none fixed top-0 left-0 z-40 hidden w-[230px] overflow-hidden rounded-image opacity-0 transition-opacity duration-(--dur-fast) ease-(--ease-settle) md:block motion-reduce:hidden"
        style={activeRow?.cover ? { opacity: 1 } : undefined}
      >
        {activeRow?.cover ? (
          <div className="relative aspect-[4/5] w-full bg-sand">
            <Image
              src={activeRow.cover}
              alt=""
              fill
              sizes="230px"
              unoptimized={!isOptimizableImageSrc(activeRow.cover)}
              className="object-cover"
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
