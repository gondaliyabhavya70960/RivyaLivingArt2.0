"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * The cure line — REDESIGN.md §2.6, the site's signature element and the one
 * place boldness is spent.
 *
 * A 1px vertical hairline in the left gutter that fills as the page scrolls,
 * notched with short ticks at each section boundary, each labelled in mono
 * (`01 · THE POUR`). It is a resin level rising in a mould, a scroll-progress
 * indicator and a section nav at once. Everything else stays quiet around it.
 *
 * - **≥1024px:** fixed in the 56px cure gutter reserved outside the shell.
 * - **<1024px:** collapses to a 2px top progress bar with the active label.
 * - **Reduced motion:** a static ruler. The fill still tracks the page (it is
 *   information, not decoration) but nothing eases between frames.
 *
 * Two implementation notes:
 *
 * **The fill is written to the DOM, not to React state.** It updates every
 * scroll frame; re-rendering a list of ticks sixty times a second to move one
 * transform is the kind of thing the Part 14 motion budget exists to prevent.
 * Only `active` — which changes a handful of times per page — is state.
 *
 * **Ticks are positioned by measured offset, not by even division.** A 200px
 * CTA strip and a 100svh hero must not get the same slice of the rail or the
 * line stops meaning anything. Positions are remeasured whenever the document
 * resizes (images settling, a panel collapsing).
 */
export type CureMark = {
  /** The id of the section element this tick points at. */
  id: string;
  /** Mono label, e.g. "THE POUR". Rendered uppercase by `u-micro`. */
  label: string;
  /**
   * True when the section behind this tick is a dark band. The rail is fixed
   * chrome floating over whatever section happens to be there, so it cannot
   * inherit a `data-theme` scope — the page has to tell it. Without this the
   * mono labels resolve graphite over obsidian and simply vanish.
   */
  dark?: boolean;
};

export function CureLine({
  marks,
  className,
}: {
  marks: readonly CureMark[];
  className?: string;
}) {
  const [active, setActive] = useState(0);
  const [offsets, setOffsets] = useState<number[]>([]);
  /* Which ground the rail is currently floating over. The rail is fixed
     chrome, so it cannot inherit a `data-theme` scope — it has to read what
     is actually behind it. Seeded from the active mark's own flag so the
     first server-rendered frame is already right. */
  const [overDark, setOverDark] = useState(marks[0]?.dark ?? false);
  const railFill = useRef<HTMLSpanElement>(null);
  const barFill = useRef<HTMLSpanElement>(null);
  const frame = useRef(0);

  useEffect(() => {
    if (marks.length === 0) return;

    const scrollable = () =>
      document.documentElement.scrollHeight - window.innerHeight;

    const measure = () => {
      const max = scrollable();
      setOffsets(
        marks.map((mark, i) => {
          const el = document.getElementById(mark.id);
          if (!el || max <= 0) {
            return marks.length > 1 ? i / (marks.length - 1) : 0;
          }
          const top = el.getBoundingClientRect().top + window.scrollY;
          return Math.min(1, Math.max(0, top / max));
        }),
      );
    };

    const paint = () => {
      const max = scrollable();
      const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      if (railFill.current) {
        railFill.current.style.transform = `scaleY(${p})`;
      }
      if (barFill.current) {
        barFill.current.style.transform = `scaleX(${p})`;
      }
      // The active section is the last one whose top has crossed 40% of the
      // viewport — the same threshold the process page's step scrub uses.
      let current = 0;
      marks.forEach((mark, i) => {
        const el = document.getElementById(mark.id);
        if (el && el.getBoundingClientRect().top <= window.innerHeight * 0.4) {
          current = i;
        }
      });
      setActive(current);

      /* The rail is `pointer-events: none`, so elementFromPoint returns what
         is painted behind it rather than the rail itself. Reading the real
         ground beats trusting the active mark: a dark section's tick becomes
         active while the viewport is still showing the light band above it,
         and the rail would flip a beat early. */
      const behind = document.elementFromPoint(
        document.dir === "rtl"
          ? window.innerWidth - 28
          : 28,
        window.innerHeight / 2,
      );
      const scope = behind?.closest("[data-theme]");
      setOverDark(
        scope
          ? scope.getAttribute("data-theme") === "navy"
          : (marks[current]?.dark ?? false),
      );
    };

    const onScroll = () => {
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        paint();
      });
    };

    // ResizeObserver fires once on observe, which is where the first measure
    // and the first paint happen — never synchronously in the effect body.
    const ro = new ResizeObserver(() => {
      measure();
      onScroll();
    });
    ro.observe(document.body);

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [marks]);

  if (marks.length === 0) return null;

  const activeLabel = marks[active]?.label ?? "";
  const activeIndex = String(active + 1).padStart(2, "0");

  return (
    <>
      {/* ————— ≥1024px: the rail ————— */}
      <nav
        aria-label="Page sections"
        data-slot="cure-line"
        data-theme={overDark ? "navy" : undefined}
        className={cn(
          "group/cure pointer-events-none fixed inset-y-0 start-0 z-(--z-rail) hidden w-cure lg:block",
          className,
        )}
      >
        <span
          aria-hidden
          className="absolute start-7 top-0 h-full w-px bg-hairline in-data-[theme=navy]:bg-hairline-dk"
        />
        <span
          ref={railFill}
          aria-hidden
          style={{ transform: "scaleY(0)" }}
          className="absolute start-7 top-0 h-full w-px origin-top bg-sapphire will-change-transform in-data-[theme=navy]:bg-champagne"
        />
        {/* The tick band is inset from the viewport edges: at 0% and 100% a
            label would sit under the browser chrome or the sticky header,
            where it is unreadable and overlaps the announcement strip. The
            fill line still runs the full height — it is the level, and a
            level that stops short of the rim is not a level. */}
        <ul className="absolute inset-y-32 start-0">
          {marks.map((mark, i) => (
            <li
              key={mark.id}
              className="absolute start-7 -translate-y-1/2"
              style={{ top: `${(offsets[i] ?? 0) * 100}%` }}
            >
              <a
                href={`#${mark.id}`}
                aria-current={i === active ? "true" : undefined}
                className="pointer-events-auto -ms-2 flex items-center gap-2 py-2 ps-2 outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
              >
                <span
                  aria-hidden
                  className={cn(
                    "block h-px transition-all duration-(--dur-fast) ease-(--ease-settle)",
                    i <= active
                      ? "w-3 bg-sapphire in-data-[theme=navy]:bg-champagne"
                      : "w-2 bg-hairline in-data-[theme=navy]:bg-hairline-dk",
                  )}
                />
                {/* The index is always visible on the active tick — it fits
                    the 56px gutter. The full label is longer than the gutter,
                    so it reveals on hover or keyboard focus and carries a
                    ground of its own; painting it permanently would run it
                    straight through the section copy beside it. */}
                <span
                  className={cn(
                    "u-micro whitespace-nowrap transition-opacity duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none",
                    i === active ? "opacity-100" : "opacity-0",
                  )}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "u-micro absolute start-8 whitespace-nowrap bg-mineral/95 px-2 py-1 opacity-0 transition-opacity duration-(--dur-fast) ease-(--ease-settle) group-hover/cure:opacity-100 group-focus-within/cure:opacity-100 motion-reduce:transition-none in-data-[theme=navy]:bg-obsidian/95",
                    i === active && "text-ink in-data-[theme=navy]:text-mineral",
                  )}
                >
                  {String(i + 1).padStart(2, "0")} · {mark.label}
                </span>
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ————— <1024px: a 2px top bar carrying the active label ————— */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-(--z-rail) lg:hidden">
        <span aria-hidden className="block h-0.5 w-full bg-hairline">
          <span
            ref={barFill}
            style={{ transform: "scaleX(0)" }}
            className="block h-full origin-left bg-sapphire will-change-transform"
          />
        </span>
      </div>

      {/* The active section, announced politely, so a screen reader following
          the page hears where it is without the tick list being duplicated. */}
      <p className="sr-only" aria-live="polite">
        {activeIndex} · {activeLabel}
      </p>
    </>
  );
}
