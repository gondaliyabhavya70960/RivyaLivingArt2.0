"use client";

import Image from "next/image";
import { useId, useState, type KeyboardEvent } from "react";

import { MeniscusImage } from "@/components/storefront/meniscus-image";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

export type AccordionGalleryItem = {
  key: string;
  src: string;
  /** The strip photograph's 20px LQIP when the resolved slot records one —
   *  null is the resolver's own "none known", forwarded as it stands. */
  blurDataURL?: string | null;
  alt: string;
  title: string;
  copy: string;
  /** A closer second photograph, crossfaded in while the strip is active —
   *  the hover-macro the process and about material grids used to render as
   *  a separate always-on-hover overlay. Optional: not every gallery has one. */
  macroSrc?: string;
};

/**
 * The accordion gallery — the process and about materials use it (§11.3,
 * §11.4). Four (or ten) flex strips share a row; the active one grows to
 * three parts against one for the rest, its copy fading in over the
 * photograph as the width opens up to hold it.
 *
 * "Active" has three equally valid sources — `:hover`, `:focus-within`, and a
 * click, which is what makes the state stick for a touch visitor who has no
 * hover at all. The trigger buttons are a roving-tabindex group: one tab stop
 * for the whole gallery, arrow keys (mirrored under RTL) move it and the
 * active strip together, `Home`/`End` jump to the first/last.
 *
 * Two fallbacks, on two different axes:
 * - **Reduced motion** never animates the width or the copy's opacity — every
 *   strip sits at an equal width with its words already showing. Detected
 *   client-side (`usePrefersReducedMotion` defaults to the safe state during
 *   SSR and the first paint), so a visitor with no JS gets this same reading,
 *   never a gallery stuck mid-collapse.
 * - **Below `md`** the row becomes a column of full-width cards — the same
 *   markup, no JS branch needed, because the flex-grow and opacity rules
 *   above only apply at `md:` and up.
 *
 * Every panel's copy stays in the DOM and in the accessibility tree at every
 * width and every motion preference — only its opacity changes. A screen
 * reader reads all four (or ten) cards in order regardless of which one a
 * mouse visitor currently sees widened.
 */
export function AccordionGallery({
  items,
  labels,
  className,
}: {
  items: readonly AccordionGalleryItem[];
  labels: { expand: string; collapse: string };
  className?: string;
}) {
  const groupId = useId();
  const prefersReducedMotion = usePrefersReducedMotion();
  // No default active strip: starting on item1 meant a mouse hovering item2
  // grew and revealed item2 as a SECOND active strip alongside the one still
  // "active" from load, rather than in place of it — flex-grow having no
  // notion of mutual exclusion. Starting with none active keeps every
  // trigger's tabIndex roving to whichever one, if any, is truly active.
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // Part 16 — a gallery with nothing to show must not render at all.
  if (items.length === 0) return null;

  function moveFocus(index: number) {
    const item = items[index];
    if (!item) return;
    setActiveKey(item.key);
    document.getElementById(triggerId(groupId, item.key))?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const rtl = document.documentElement.dir === "rtl";
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const backward = rtl ? "ArrowRight" : "ArrowLeft";

    if (event.key === forward || event.key === "ArrowDown") {
      event.preventDefault();
      moveFocus((index + 1) % items.length);
    } else if (event.key === backward || event.key === "ArrowUp") {
      event.preventDefault();
      moveFocus((index - 1 + items.length) % items.length);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveFocus(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveFocus(items.length - 1);
    }
  }

  return (
    <ul
      className={cn(
        "flex flex-col gap-3 md:h-[34rem] md:flex-row md:gap-2",
        className,
      )}
    >
      {items.map((item, index) => {
        const active = item.key === activeKey;
        // Under reduced motion every strip already reads as "expanded" — no
        // width ever changes, so there is nothing collapsed for a screen
        // reader to be told about.
        const expanded = prefersReducedMotion || active;
        const trigger = triggerId(groupId, item.key);
        const panel = panelId(groupId, item.key);

        return (
          <li
            key={item.key}
            data-active={active ? "" : undefined}
            className={cn(
              "group/strip relative min-w-0 overflow-hidden rounded-image bg-obsidian",
              "aspect-[4/5] md:aspect-auto md:h-full md:flex-1",
              !prefersReducedMotion &&
                "md:transition-[flex-grow] md:duration-(--dur-slow) md:ease-(--ease-luxury) md:hover:grow-[3] md:focus-within:grow-[3] md:data-[active]:grow-[3]",
            )}
          >
            <MeniscusImage
              src={item.src}
              blurDataURL={item.blurDataURL}
              alt={item.alt}
              fill
              sizes="(min-width:768px) 40vw, 100vw"
              className="absolute inset-0"
              imageClassName="object-cover"
            />
            {item.macroSrc ? (
              <Image
                src={item.macroSrc}
                alt=""
                fill
                sizes="(min-width:768px) 40vw, 100vw"
                className={cn(
                  "absolute inset-0 object-cover transition-opacity duration-(--dur-base) ease-(--ease-luxury)",
                  // Reduced motion shows every macro at rest, same as every
                  // copy panel below. Otherwise it is the SAME three
                  // triggers that widen the strip — hover, focus-within or a
                  // click — so the photograph and the width open together;
                  // un-prefixed (not `md:`-only) so a tap on a stacked
                  // mobile card reveals its macro too, rather than a
                  // permanently-visible macro hiding the base photograph
                  // every other card on the page still shows.
                  prefersReducedMotion
                    ? "opacity-100"
                    : "opacity-0 group-hover/strip:opacity-100 group-focus-within/strip:opacity-100 group-data-[active]/strip:opacity-100",
                )}
              />
            ) : null}
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-obsidian/90 via-obsidian/40 to-transparent"
            />

            {/* Trigger and panel share ONE bottom-anchored flex column so
                the title and the copy stack in normal flow — two
                independently bottom-pinned layers here used to sit on top
                of each other the moment a title wrapped to a second line. */}
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2 p-5 md:p-6">
              <button
                type="button"
                data-theme="navy"
                id={trigger}
                aria-expanded={expanded}
                aria-controls={panel}
                tabIndex={(activeKey === null ? index === 0 : active) ? 0 : -1}
                onClick={() => setActiveKey(item.key)}
                onFocus={() => setActiveKey(item.key)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className="flex flex-col items-start text-start outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3"
              >
                <span className="u-micro text-mist">
                  {String(index + 1).padStart(2, "0")}
                  <span className="sr-only">
                    {" "}
                    — {expanded ? labels.collapse : labels.expand}
                  </span>
                </span>
                <span className="mt-2 font-display text-h3 leading-h3 text-mineral">
                  {item.title}
                </span>
              </button>

              <div id={panel} role="region" aria-labelledby={trigger}>
                <p
                  data-theme="navy"
                  className={cn(
                    "font-body text-14 leading-relaxed text-mist opacity-100 transition-opacity duration-(--dur-base) ease-(--ease-luxury)",
                    // Below md every panel is already visible — the stacked
                    // card IS the reveal. At md+ only the widened strip
                    // shows its words, and "widened" is the same three
                    // triggers the strip itself grows on.
                    !prefersReducedMotion &&
                      "md:opacity-0 md:group-hover/strip:opacity-100 md:group-focus-within/strip:opacity-100 md:group-data-[active]/strip:opacity-100",
                  )}
                >
                  {item.copy}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function triggerId(groupId: string, key: string): string {
  return `${groupId}-trigger-${key}`;
}

function panelId(groupId: string, key: string): string {
  return `${groupId}-panel-${key}`;
}
