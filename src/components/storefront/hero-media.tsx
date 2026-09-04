"use client";

import { useState } from "react";
import Image, { getImageProps } from "next/image";

import { useIsTouch } from "@/hooks/use-is-touch";
import { MotionPauseToggle, useMotionPaused } from "@/hooks/use-motion-paused";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { isOptimizableImageSrc } from "@/lib/image-src";
import type { SiteImageRef } from "@/lib/site-images";
import { cn } from "@/lib/utils";

/**
 * Home-hero media layer (DESIGN.md B2 §1, E6 "wire Content from the Studio").
 * The priority poster photograph ALWAYS renders — it is the LCP candidate and
 * the only thing SSR/no-JS/reduced-motion/touch/unset-URL visitors ever see.
 * When the studio's Site Settings carry a heroVideoUrl AND the visitor is on
 * a motion-safe fine-pointer device, an ambient loop mounts client-side over
 * the poster and fades in once it can actually play (B4: decorative, muted,
 * aria-hidden — background texture, not content; the touch gate keeps the
 * loop's bytes off phones, matching B4's "static first frame on mobile").
 *
 * WCAG 2.2.2 Pause/Stop/Hide: while the loop is eligible, the site's shared
 * MotionPauseToggle (one deduped corner chip, translated labels, persisted
 * across pages/tabs) is registered; pausing unmounts the video and holds the
 * poster. usePrefersReducedMotion defaults to true during SSR, so the
 * <video> never ships in server HTML.
 *
 * The poster is accepted two ways — both existing call sites (home, process)
 * pass a plain `posterSrc` string from `getSiteImages()` and stay unchanged;
 * a caller that already resolved the full slot (`getSiteImageRefs()`) can
 * pass `poster` instead to get its mobile crop and focal point for free, the
 * same technique `meniscus-image.tsx`/`slot-image.tsx` use — a `<picture>`
 * choosing the file BEFORE the fetch, and `objectPosition` for the focal
 * point. Exactly one of the two is required.
 *
 * `drift` (Part 14 / roadmap Phase 1b `sf-hero-drift`) puts the slow 6s
 * scale-to-1.04 on a WRAPPER around the poster `<Image>`, never on the
 * `<img>` itself — the poster stays the LCP element and Part 14 forbids
 * animating or delaying it. `data-video-playing` on that same wrapper turns
 * the drift off once the ambient loop takes over, so the two motions never
 * compete for the same frame.
 */
type HeroMediaPosterProps =
  | { posterSrc: string; poster?: undefined }
  | { poster: SiteImageRef; posterSrc?: undefined };

export type HeroMediaProps = HeroMediaPosterProps & {
  videoUrl?: string;
  /** Part 14 ambient scale drift on the poster wrapper. Defaults to off — an
   *  existing call site opts in explicitly rather than gaining motion. */
  drift?: boolean;
  /** Decorative by default (matches both existing call sites), since the
   *  poster always sits behind a text band that carries the same content. */
  posterAlt?: string;
};

export function HeroMedia({
  videoUrl,
  drift = false,
  posterAlt = "",
  ...posterProps
}: HeroMediaProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const isTouch = useIsTouch();
  const motionPaused = useMotionPaused();
  const [canPlay, setCanPlay] = useState(false);

  /* Only the pipeline's own masters have a WebM twin (public/media/v3/<id>.mp4
     is written alongside <id>.webm). An owner replacement is a single uploaded
     file, so nothing is offered for it. */
  const webmUrl =
    videoUrl && /^\/media\/v3\/.+\.mp4$/.test(videoUrl)
      ? videoUrl.replace(/\.mp4$/, ".webm")
      : undefined;

  // Eligible = would play if not paused; the toggle must stay mounted while
  // paused, or the visitor could never resume.
  const eligible = Boolean(videoUrl) && !prefersReducedMotion && !isTouch;
  const playing = eligible && !motionPaused;

  const posterUrl = posterProps.poster
    ? posterProps.poster.url
    : posterProps.posterSrc;
  const mobileUrl = posterProps.poster?.mobileUrl ?? null;
  const focalX = posterProps.poster?.focalX ?? 0.5;
  const focalY = posterProps.poster?.focalY ?? 0.5;
  // Centred is CSS's own default, so an untouched slot emits no inline style.
  const focalMoved = focalX !== 0.5 || focalY !== 0.5;
  const posterStyle = focalMoved
    ? { objectPosition: `${focalX * 100}% ${focalY * 100}%` }
    : undefined;

  const posterImage = (
    <Image
      src={posterUrl}
      alt={posterAlt}
      fill
      priority
      fetchPriority="high"
      quality={80}
      sizes="100vw"
      className="object-cover"
      style={posterStyle}
      unoptimized={
        posterProps.poster ? !isOptimizableImageSrc(posterUrl) : undefined
      }
      // The slot's 20px LQIP (batch D): next/image paints it behind the
      // poster until the real bytes land — a placeholder, not a fade, so
      // §2.7's no-fade rule holds and the LCP element is unchanged. A ref
      // without one (an owner upload predating the capture) renders as
      // before.
      {...(posterProps.poster?.blurDataUrl
        ? { placeholder: "blur" as const, blurDataURL: posterProps.poster.blurDataUrl }
        : {})}
    />
  );

  const mobile = mobileUrl
    ? getImageProps({
        src: mobileUrl,
        alt: posterAlt,
        fill: true,
        quality: 80,
        sizes: "100vw",
        unoptimized: !isOptimizableImageSrc(mobileUrl),
      }).props
    : null;

  return (
    <>
      <div
        data-slot="sf-hero"
        data-video-playing={playing ? "true" : "false"}
        className={cn("absolute inset-0", drift && "sf-hero-drift")}
      >
        {mobile?.srcSet ? (
          <picture className="block h-full w-full">
            <source
              media="(max-width: 767px)"
              srcSet={mobile.srcSet}
              sizes={mobile.sizes}
            />
            {posterImage}
          </picture>
        ) : (
          posterImage
        )}
      </div>
      {playing ? (
        <video
          /* No `src` — the sources below are offered in order, and a browser
             that understands VP9 never downloads the H.264 twin. §15.3 asks
             for both; before this the repo shipped no WebM at all and had no
             code path that could have served one.

             `webmUrl` is derived, not configured: the bundled default has a
             .webm sibling written by the same encode, while an owner's own
             upload is MP4-only, and offering a WebM that 404s would cost a
             wasted request before the fallback. So it is only offered for a
             path that came out of that pipeline. */
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          disablePictureInPicture
          aria-hidden
          tabIndex={-1}
          onCanPlay={() => setCanPlay(true)}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-(--dur-base) ease-(--ease-luxury) motion-reduce:transition-none",
            canPlay ? "opacity-100" : "opacity-0",
          )}
        >
          {webmUrl ? <source src={webmUrl} type="video/webm" /> : null}
          <source src={videoUrl} type="video/mp4" />
        </video>
      ) : null}
      {eligible ? <MotionPauseToggle /> : null}
    </>
  );
}
