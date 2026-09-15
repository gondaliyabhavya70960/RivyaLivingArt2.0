import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * The eyebrow — REDESIGN.md §3.2: "Every eyebrow on the site becomes mono
 * micro, left-aligned, with an optional index number and a 24px champagne
 * hairline to its left."
 *
 * That hairline is the site's smallest recurring gesture, and it is the reason
 * this is a component rather than a class: getting the 24px rule, the optical
 * centring and the champagne-on-both-grounds behaviour right once is worth
 * more than forty near-copies.
 *
 * The hairline is decorative and never announced. The index, when present, is
 * part of the label — "01 · The signature" reads correctly to a screen reader.
 */
export function Eyebrow({
  children,
  index,
  rule = true,
  className,
}: {
  children: ReactNode;
  /** Zero-padded automatically: pass 4, get "04". */
  index?: number;
  /** The 24px champagne hairline. Off for eyebrows inside tight cards. */
  rule?: boolean;
  className?: string;
}) {
  return (
    <p className={cn("u-micro flex items-center gap-3", className)}>
      {rule ? (
        <span aria-hidden className="block h-px w-6 shrink-0 bg-champagne" />
      ) : null}
      {index != null ? (
        <span className="text-champagne-ink in-data-[theme=navy]:text-champagne">
          {String(index).padStart(2, "0")}
        </span>
      ) : null}
      <span>{children}</span>
    </p>
  );
}

/**
 * SectionHeading — REDESIGN.md §4.6.
 *
 * Mono eyebrow → display heading → optional 52ch intro → optional right-aligned
 * text link. Left-aligned in columns 1–7. Used roughly forty times across the
 * site; one component, no variants beyond alignment, because the moment two
 * section headings differ the page stops reading as one document.
 *
 * `centred` exists for exactly one block — the homepage manifesto (§6 02),
 * which the spec names as "the only centred block on the site". Everything
 * else is left-aligned, and the prop is deliberately awkward to reach for.
 *
 * `as` moves the heading level without moving the size: a section inside an
 * article may need `h3` semantics at `h2` scale, and Part 17 requires one `h1`
 * per page with no skipped levels.
 */
export function SectionHeading({
  eyebrow,
  eyebrowIndex,
  title,
  intro,
  action,
  as: Tag = "h2",
  size = "h2",
  centred = false,
  className,
  id,
}: {
  eyebrow?: ReactNode;
  eyebrowIndex?: number;
  title: ReactNode;
  /** Section intros cap at 52ch (§3.2). */
  intro?: ReactNode;
  /** A single text link, right-aligned on desktop and beneath on mobile. */
  action?: ReactNode;
  as?: ElementType;
  size?: "h1" | "h2" | "h3";
  centred?: boolean;
  className?: string;
  id?: string;
}) {
  // Size AND its leading, as one choice. They were separate: `size` picked
  // the scale here and the class list below pinned h2's 1.08 onto all three,
  // so an h1-scale section title read as loosely as an h3 and an h3 as
  // tightly as an h1 — the flat rhythm the v4 leading scale exists to fix.
  const sizeClass =
    size === "h1"
      ? "text-h1 leading-h1"
      : size === "h3"
        ? "text-h3 leading-h3"
        : "text-h2 leading-h2";

  return (
    <div
      className={cn(
        "flex flex-col gap-6 md:flex-row md:items-end md:justify-between",
        centred && "md:flex-col md:items-center",
        className,
      )}
    >
      <div className={cn("flex flex-col gap-4", centred && "items-center")}>
        {eyebrow ? (
          <Eyebrow index={eyebrowIndex} rule={!centred}>
            {eyebrow}
          </Eyebrow>
        ) : null}
        <Tag
          id={id}
          className={cn(
            "font-display text-balance",
            sizeClass,
            centred && "text-center",
          )}
        >
          {title}
        </Tag>
        {intro ? (
          <p
            className={cn(
              "u-lede font-body text-body text-graphite in-data-[theme=navy]:text-mist",
              centred && "text-center",
            )}
          >
            {intro}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 md:pb-2">{action}</div> : null}
    </div>
  );
}
