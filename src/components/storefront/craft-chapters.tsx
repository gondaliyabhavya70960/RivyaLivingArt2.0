"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import { MeniscusImage } from "@/components/storefront/meniscus-image";
import { SectionHeading } from "@/components/storefront/section-heading";
import { cn } from "@/lib/utils";

export interface CraftChapter {
  title: string;
  copy: string;
  /** `blurDataURL` is the slot's 20px LQIP when one is recorded for the
   *  resolved file; null is the resolver's own "none known". */
  image: { src: string; alt: string; blurDataURL?: string | null };
}

export interface CraftChaptersProps {
  eyebrow: string;
  heading: string;
  /** Id for the section's `aria-labelledby` — Part 17. */
  headingId: string;
  chapters: CraftChapter[];
  /** `See the full process →` — the link out to /process (§11.3 item 4). */
  action?: React.ReactNode;
  className?: string;
}

const numeral = (index: number) => String(index + 1).padStart(2, "0");

/**
 * The craft, as a vertical sticky story — REDESIGN.md §11.3 item 4.
 *
 * Left: one framed photograph that changes as you scroll. Right: the stages,
 * each a numbered beat with room to breathe. Below 1024px the stage unfolds
 * into plain stacked cards (Part 13: no pins on mobile — static frames
 * instead).
 *
 * ## What changed, and why it matters
 *
 * The previous implementation shipped **two complete copies of this block**
 * — a GSAP-scrubbed stage and a static fallback — and let CSS media queries
 * pick one. That is the duplicate §11.3 asks to delete: both copies carried
 * the same `h2` and the same four `h3`s, which is precisely the duplicated
 * heading text Part 17 forbids, and when the scrub failed to arm the page was
 * left with four screens of empty navy. There is now **one** heading, **one**
 * list of stages, and the only thing that exists twice is the photograph
 * itself — image elements carry no text, and both copies resolve to the same
 * URL, so the hidden branch is a browser-cache hit rather than a second
 * download.
 *
 * ## No scrub, no pin, no GSAP
 *
 * The stage is `position: sticky` and the active chapter comes from one
 * IntersectionObserver watching the beats through a narrow band across the
 * middle of the viewport. Nothing is scroll-jacked, nothing is measured every
 * frame, and there is no animation library on this page at all. Under
 * `prefers-reduced-motion` the crossfade collapses to an instant swap — the
 * information still tracks the scroll, because which stage you are reading is
 * content, not decoration.
 *
 * Without JavaScript the stage rests on chapter 01 and the stacked frames
 * below still carry every photograph, so nothing is lost.
 */
export function CraftChapters({
  eyebrow,
  heading,
  headingId,
  chapters,
  action,
  className,
}: CraftChaptersProps) {
  const [active, setActive] = useState(0);
  const beatRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const beats = beatRefs.current.filter(
      (el): el is HTMLLIElement => el !== null,
    );
    if (beats.length === 0) return;

    // A 20%-tall band across the middle of the viewport. The last beat whose
    // box overlaps it is the one being read; the callback is asynchronous, so
    // nothing sets state inside the effect body.
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = beats.indexOf(entry.target as HTMLLIElement);
          if (index >= 0) setActive(index);
        }
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: 0 },
    );
    beats.forEach((beat) => io.observe(beat));
    return () => io.disconnect();
  }, [chapters.length]);

  if (chapters.length === 0) return null;

  return (
    <section
      data-slot="sf-craft-chapters"
      data-theme="navy"
      aria-labelledby={headingId}
      className={cn("section-standard bg-obsidian text-mineral", className)}
    >
      <div className="u-shell flex flex-col gap-16">
        <SectionHeading
          id={headingId}
          eyebrow={eyebrow}
          title={heading}
          action={action}
        />

        <div className="lg:grid lg:grid-cols-12 lg:gap-16">
          {/* ————— the stage: one frame, four photographs, ≥1024px ————— */}
          <div className="hidden lg:col-span-6 lg:block lg:self-start lg:sticky lg:top-28">
            <div className="relative aspect-[4/3] overflow-hidden rounded-image bg-deep-ocean">
              {/* The stage is the ONLY copy of the photograph above 1024px —
                  the stacked card below is `lg:hidden` — so the LQIP has to
                  be spread here too, or the desktop reading is the one left
                  without a ground under the picture. */}
              {chapters.map((chapter, index) => (
                <Image
                  key={chapter.image.src}
                  src={chapter.image.src}
                  alt={index === active ? chapter.image.alt : ""}
                  fill
                  sizes="(min-width:1024px) 45vw, 90vw"
                  aria-hidden={index === active ? undefined : true}
                  {...(chapter.image.blurDataURL
                    ? {
                        placeholder: "blur" as const,
                        blurDataURL: chapter.image.blurDataURL,
                      }
                    : {})}
                  className={cn(
                    "object-cover transition-opacity duration-(--dur-slow) ease-(--ease-luxury) motion-reduce:transition-none",
                    index === active ? "opacity-100" : "opacity-0",
                  )}
                />
              ))}
              {/* The level: a champagne hairline that fills with the stage —
                  the cure line's gesture at the scale of one frame. Width,
                  not transform, so it starts at the inline edge under RTL
                  without a second rule. */}
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 block h-px bg-hairline-dk"
              >
                <span
                  className="block h-full bg-champagne transition-[width] duration-(--dur-base) ease-(--ease-luxury) motion-reduce:transition-none"
                  style={{
                    width: `${((active + 1) / chapters.length) * 100}%`,
                  }}
                />
              </span>
            </div>
            <p className="u-micro mt-4 text-mist">
              {numeral(active)} / {numeral(chapters.length - 1)}
            </p>
          </div>

          {/* ————— the beats ————— */}
          <ol className="flex flex-col gap-16 lg:col-span-5 lg:col-start-8 lg:gap-0">
            {chapters.map((chapter, index) => (
              <li
                key={chapter.title}
                ref={(el) => {
                  beatRefs.current[index] = el;
                }}
                className="flex flex-col gap-5 lg:min-h-[68svh] lg:justify-center"
              >
                {/* Static frame per beat below 1024px — Part 13 disables
                    pinned sequences on mobile. */}
                <MeniscusImage
                  src={chapter.image.src}
                  blurDataURL={chapter.image.blurDataURL}
                  alt={chapter.image.alt}
                  width={1000}
                  height={1250}
                  sizes="90vw"
                  className="aspect-[4/3] rounded-image lg:hidden"
                  imageClassName="object-cover"
                />
                {/* Mono numeral only — §3.1 caps champagne at two elements
                    per viewport, and the stage's level line plus the section
                    eyebrow already spend both. */}
                <p className="u-micro">{numeral(index)}</p>
                <h3 className="font-display text-h3 leading-h3 text-mineral">
                  {chapter.title}
                </h3>
                <p className="u-prose font-body text-body leading-relaxed text-mist">
                  {chapter.copy}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
