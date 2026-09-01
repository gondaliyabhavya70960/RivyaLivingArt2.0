"use client";

import { useEffect, useRef } from "react";
import Image, { getImageProps, type ImageProps } from "next/image";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { getLqipBlur } from "@/lib/lqip";
import { cn } from "@/lib/utils";

/**
 * The meniscus reveal — REDESIGN.md §2.7, the site's second signature device.
 *
 * No image on this site fades in. Images are revealed by a horizontal edge
 * rising from the bottom of the frame, with a brighter 1px leading line and a
 * slight vertical squash settling out (scaleY(1.015) → 1). It reads as liquid
 * filling a mould. One curve, one duration, used for every image reveal —
 * this component replaces every generic fade-up in the codebase.
 *
 * **Why a mask and not a clip.** The obvious implementation clips the frame to
 * `inset(0 0 100% 0)` and animates the inset away. It does not work: a fully
 * clipped element is treated as not visible, so native lazy-loading never
 * fetches the image and IntersectionObserver on that same element never
 * reports an intersection — the frame stays shut and the photograph never
 * arrives. An animated `mask-size` is paint-time only: layout, hit-testing and
 * visibility are untouched, the image loads exactly as it would unmasked, and
 * the revealed edge is transparent rather than a colour the component would
 * otherwise have to be told. The observer watches the OUTER wrapper, which is
 * never masked, for the same reason.
 *
 * Three further rules the spec's reference implementation leaves to the build:
 *
 * 1. **Never the LCP.** Part 14 forbids animating or delaying the LCP element,
 *    so a `priority` image mounts plain. `reveal={false}` opts any other frame
 *    out for the same reason.
 * 2. **Never hidden without JS.** SSR and the first client render emit plain,
 *    fully visible markup (the contract `Reveal` already keeps). The closed
 *    state is written by an effect, so a visitor with no JS sees every
 *    photograph.
 * 3. **Never a flash.** A frame already inside the viewport when the effect
 *    runs is left alone — masking it after paint would wipe an image the
 *    visitor is already looking at. Above the fold there is nothing to reveal.
 *
 * Reduced motion skips the mechanism entirely: no mask, no transition, no
 * observer. The frame simply is.
 */
export type MeniscusImageProps = ImageProps & {
  /** Applied to the wrapper. Put the aspect ratio here. */
  className?: string;
  /** Applied to the <img> itself — object-fit, object-position, scale. */
  imageClassName?: string;
  /** Opt out of the reveal (already-visible frames, print, tiny thumbnails). */
  reveal?: boolean;
  /**
   * A different file below 768px.
   *
   * Ten slots crop to 16:9 and two to 21:9; on a 390px phone those keep a
   * sliver of the frame's height and routinely lose the subject. When set, the
   * mobile file is offered through a `<source>` and the browser picks — one
   * request either way, chosen before the fetch.
   */
  mobileSrc?: string;
  /**
   * object-position for the crop, 0–1 on each axis.
   *
   * A 4:5 slot filled with a 16:9 photograph crops the centre, which for a
   * maker portrait is a torso. Omitted means centred, which is what CSS does
   * anyway — so passing nothing changes nothing.
   */
  focal?: { x: number; y: number };
};

/** A solid mask whose height is animated from 0% to 100%, anchored bottom. */
const MASK_IMAGE = "linear-gradient(#000, #000)";

export function MeniscusImage({
  className,
  imageClassName,
  reveal = true,
  mobileSrc,
  focal,
  ...props
}: MeniscusImageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLSpanElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();
  // Priority images carry the LCP — they are never revealed.
  const animated = reveal && !props.priority;

  useEffect(() => {
    if (!animated || prefersReducedMotion) return;
    const wrapper = wrapperRef.current;
    const frame = frameRef.current;
    const line = lineRef.current;
    if (!wrapper || !frame) return;

    // Already on screen: nothing to reveal, and masking it now would be a
    // visible wipe. Leave the frame plain.
    const rect = wrapper.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) return;

    const setMask = (size: string) => {
      frame.style.maskSize = size;
      // Safari below 15.4 only understands the prefixed longhands.
      frame.style.setProperty("-webkit-mask-size", size);
    };

    frame.style.maskImage = MASK_IMAGE;
    frame.style.setProperty("-webkit-mask-image", MASK_IMAGE);
    frame.style.maskRepeat = "no-repeat";
    frame.style.setProperty("-webkit-mask-repeat", "no-repeat");
    frame.style.maskPosition = "bottom";
    frame.style.setProperty("-webkit-mask-position", "bottom");
    frame.style.transformOrigin = "bottom";
    frame.style.transition =
      "mask-size var(--dur-reveal) var(--ease-luxury), -webkit-mask-size var(--dur-reveal) var(--ease-luxury), transform var(--dur-reveal) var(--ease-luxury)";
    setMask("100% 0%");
    frame.style.transform = "scaleY(1.015)";

    if (line) {
      line.style.transition =
        "bottom var(--dur-reveal) var(--ease-luxury), opacity var(--dur-reveal) linear";
      line.style.bottom = "0%";
      line.style.opacity = "0.8";
    }

    const open = () => {
      setMask("100% 100%");
      frame.style.transform = "scaleY(1)";
      if (line) {
        line.style.bottom = "100%";
        line.style.opacity = "0";
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        // `isIntersecting` alone loses a race. An element that enters and
        // leaves the viewport between two frames — a flick down a long grid,
        // or a programmatic scroll — is only ever reported as NOT
        // intersecting, so its reveal never runs and the champagne sweep line
        // stays painted at 0.8 across the top of the image, permanently.
        // Having scrolled past it counts as having revealed it.
        if (entry.isIntersecting || entry.boundingClientRect.bottom < 0) {
          open();
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    io.observe(wrapper);

    return () => {
      io.disconnect();
      // Unmounting mid-reveal must not leave a masked frame behind if the node
      // is reused (route transitions reuse the tree).
      frame.style.maskImage = "";
      frame.style.removeProperty("-webkit-mask-image");
      frame.style.transform = "";
      frame.style.transition = "";
      // The line was left out of this reset, so a node torn down mid-reveal
      // kept its inline `opacity: 0.8` and stayed visible.
      if (line) {
        line.style.transition = "";
        line.style.bottom = "";
        line.style.opacity = "";
      }
    };
  }, [animated, prefersReducedMotion]);

  /**
   * The mobile crop, as a `<source>`.
   *
   * `<picture>` chooses BEFORE the fetch, so only the matching file is ever
   * downloaded — the reason this is not two `<Image>`s with `hidden`/`block`,
   * which would fetch both on most browsers. `getImageProps` runs the same
   * optimizer pipeline as `<Image>`, so the mobile file gets its own srcSet
   * rather than a single unresponsive URL.
   */
  const srcString = typeof props.src === "string" ? props.src : undefined;
  const desktopBlur = props.blurDataURL ?? getLqipBlur(srcString);
  const mobileBlur = mobileSrc
    ? (props.blurDataURL ?? getLqipBlur(mobileSrc))
    : undefined;

  const imageProps = {
    ...props,
    ...(desktopBlur && !props.placeholder
      ? { placeholder: "blur" as const, blurDataURL: desktopBlur }
      : {}),
  };

  const mobile = mobileSrc
    ? getImageProps({
        ...imageProps,
        src: mobileSrc,
        ...(mobileBlur && !props.placeholder
          ? { placeholder: "blur" as const, blurDataURL: mobileBlur }
          : {}),
      }).props
    : null;

  /* `alt` is required by ImageProps, so it always arrives in the spread — the
     rule just cannot see through it. */
  const image = (
    // eslint-disable-next-line jsx-a11y/alt-text
    <Image
      {...imageProps}
      className={cn("h-full w-full", imageClassName)}
      style={
        // Only written when a focal point was actually chosen, so an untouched
        // slot emits no inline style at all and whatever object-position
        // `imageClassName` sets still wins.
        focal
          ? {
              ...props.style,
              objectPosition: `${focal.x * 100}% ${focal.y * 100}%`,
            }
          : props.style
      }
    />
  );

  return (
    <div ref={wrapperRef} className={cn("relative overflow-hidden", className)}>
      <div ref={frameRef} className="h-full w-full">
        {/* Only wrapped when there is actually a second source to choose from.
            `<picture>` is display:inline, so wrapping unconditionally would
            put an inline, shrink-to-fit box between the `h-full w-full` frame
            and the image it sizes — every frame on the site would collapse. */}
        {mobile?.srcSet ? (
          <picture className="block h-full w-full">
            <source
              media="(max-width: 767px)"
              srcSet={mobile.srcSet}
              sizes={mobile.sizes}
            />
            {image}
          </picture>
        ) : (
          image
        )}
      </div>
      {/* The leading line: a champagne hairline riding the top of the rising
          edge, fading out as the frame fills. Decorative — never announced,
          and invisible until the effect arms it. */}
      {animated ? (
        <span
          ref={lineRef}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-full h-px bg-champagne opacity-0"
        />
      ) : null}
    </div>
  );
}
