"use client";

import { useEffect, useState } from "react";

import type { DocumentHeading } from "@/lib/document-toc";
import { cn } from "@/lib/utils";

/**
 * The article's floating table of contents — REDESIGN.md §11.9:
 * "a floating table of contents in cols 9–12 with scroll-spy".
 *
 * The list itself is server-rendered from the document's real headings
 * (`withHeadingAnchors`), so the links work with no JavaScript at all and a
 * crawler sees the same outline a reader does. The only thing this client
 * component adds is the spy: which heading the reader is currently inside.
 *
 * Three decisions:
 *
 * 1. **The active heading is the last one above the reading line**, not the
 *    first one intersecting. An IntersectionObserver keyed on "is visible"
 *    flickers between two entries whenever a short section fits on screen
 *    with its neighbour; measuring against a fixed line 30% down the viewport
 *    is monotonic, which is what a progress indicator has to be.
 * 2. **Nothing is set synchronously in the effect body** — the repo enforces
 *    `react-hooks/set-state-in-effect`. The first measurement is taken inside
 *    the rAF the scroll handler already uses, so the initial state comes from
 *    a frame callback like every later one.
 * 3. **Motion-free.** The spy moves a 1px champagne rule between rows via a
 *    colour/opacity change; there is no sliding indicator to collapse under
 *    `prefers-reduced-motion`, and smooth scrolling is left to the browser's
 *    own `:target` behaviour, which the global collapse already governs.
 *
 * Fewer than three headings and the caller does not render this at all — a
 * two-line contents list is furniture, not navigation (§11.9).
 */
export function ArticleToc({
  headings,
  label,
  title,
  className,
}: {
  headings: DocumentHeading[];
  /** Translated landmark name for the nav, e.g. "On this page". */
  label: string;
  /** Translated visible heading, e.g. "Contents". */
  title: string;
  className?: string;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  /* The id list as one dependency value: the effect re-arms if the outline
     ever changes, and nothing is written to a ref during render. */
  const idsKey = headings.map((heading) => heading.id).join("|");

  useEffect(() => {
    const ids = idsKey ? idsKey.split("|") : [];
    let frame = 0;

    const measure = () => {
      frame = 0;
      // The reading line: 30% down the viewport. A heading above it has been
      // read into; the last such heading is where the reader is.
      const line = window.innerHeight * 0.3;
      let current: string | null = null;
      for (const id of ids) {
        const node = document.getElementById(id);
        if (!node) continue;
        if (node.getBoundingClientRect().top <= line) current = id;
        else break;
      }
      setActiveId(current);
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    // First measurement rides the same rAF as every later one, so no state is
    // written synchronously from this effect.
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [idsKey]);

  return (
    <nav
      data-slot="sf-article-toc"
      aria-label={label}
      className={cn("lg:sticky lg:top-28", className)}
    >
      <p className="u-micro border-t border-hairline pt-4">{title}</p>
      <ol className="mt-4 flex flex-col">
        {headings.map((heading) => {
          const active = heading.id === activeId;
          return (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                aria-current={active ? "location" : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 py-1 font-body text-14 leading-snug",
                  "transition-colors duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none",
                  heading.level > 2 && "ps-4",
                  active ? "text-ink" : "text-graphite hover:text-sapphire-ink",
                )}
              >
                {/* The active mark is a rule, not a fill — the same "you are
                    here" gesture the pagination and the category switcher
                    use (Part 3.5). */}
                <span
                  aria-hidden
                  className={cn(
                    "block h-px w-4 shrink-0 transition-colors duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none",
                    active ? "bg-champagne" : "bg-hairline",
                  )}
                />
                <span className="min-w-0">{heading.text}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
