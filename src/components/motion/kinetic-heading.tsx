import { Fragment, type CSSProperties } from "react";

type KineticTag = "h1" | "h2" | "h3" | "p" | "span";

export interface KineticHeadingProps {
  /** The heading text. Split on whitespace; each word rises on its own. */
  text: string;
  /** Element to render. Defaults to `h2`. */
  as?: KineticTag;
  className?: string;
  /**
   * Index the first word counts from, so a caller can continue a stagger a
   * sibling already began (an eyebrow that has spent `--i: 0`).
   */
  startIndex?: number;
}

/**
 * F5 — the kinetic heading. A word-split rise with an 8° x-axis tilt,
 * staggered 50ms per word on `--ease-luxury` over `--dur-reveal`.
 *
 * ## It is a SERVER component, and that is the whole design
 *
 * The plan specified this as a GSAP `SplitText` consumer. `SplitText` is
 * ~3.6 KB gzipped and `scripts/motion-budget.mjs` leaves roughly 600 bytes
 * under its 49 KB ceiling, so the recorded blocker was weight. The
 * resolution is not a lighter plugin but no plugin: a word-split rise is
 * opacity and transform on a fixed set of elements, which is a CSS keyframe
 * (`.sf-word-rise` in `globals.css`). There is no runtime to import, no
 * `"use client"` boundary, no hydration, and nothing for the budget to
 * weigh — that gate counts only chunks that CONTAIN a motion library.
 *
 * ## Why there is no scroll trigger
 *
 * The plan's row says "trigger 85%", and its only named mount (the 404
 * headline, plan §2.10) is the first element of a `min-h-svh` section — it
 * is past 85% of the viewport before a single observer callback could run,
 * so a scroll trigger there fires immediately or never. Animating on paint
 * is what that surface actually wants, and it is the option with no
 * hydration flash: an above-the-fold effect armed from an effect body
 * renders visible, then hides, then rises. `Reveal` carries that constraint
 * in its own header and is explicitly for below-the-fold sections.
 *
 * A below-the-fold consumer would need an `IntersectionObserver` and a
 * client boundary. That is not built, because an unused code path is what
 * owner decision D18 was actually about. CSS `animation-timeline: view()`
 * is not the escape hatch: `redesign-audit.mjs` fails any scroll-linked
 * timeline as a Part 14 breach.
 *
 * ## Reduced motion and RTL
 *
 * The keyframe lives inside `globals.css`'s Motion block, which is entirely
 * behind `prefers-reduced-motion: no-preference` — so under `reduce` the
 * words are plain inline-block spans with no animation AND no stagger
 * delay, rather than text held invisible by a delay the global collapse
 * does not zero. The words keep real space text nodes between them, so the
 * accessible name is the original string and bidi reordering works as it
 * does for any other text node; `translateY`/`rotateX` are axis-neutral, so
 * there is nothing to mirror.
 */
export function KineticHeading({
  text,
  as: Tag = "h2",
  className,
  startIndex = 0,
}: KineticHeadingProps) {
  const words = text.trim().split(/\s+/);

  return (
    <Tag className={className}>
      {words.map((word, index) => (
        <Fragment key={`${index}-${word}`}>
          {index > 0 ? " " : null}
          <span
            className="sf-word-rise"
            style={{ "--i": index + startIndex } as CSSProperties}
          >
            {word}
          </span>
        </Fragment>
      ))}
    </Tag>
  );
}
