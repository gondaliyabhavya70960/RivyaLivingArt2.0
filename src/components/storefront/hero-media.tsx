"use client";

import { useState } from "react";
import Image from "next/image";

import { useIsTouch } from "@/hooks/use-is-touch";
import { MotionPauseToggle, useMotionPaused } from "@/hooks/use-motion-paused";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
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
 */
export function HeroMedia({
  videoUrl,
  posterSrc,
}: {
  videoUrl?: string;
  posterSrc: string;
}) {
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

  return (
    <>
      <Image
        src={posterSrc}
        alt=""
        fill
        priority
        fetchPriority="high"
        quality={80}
        sizes="100vw"
        className="object-cover"
      />
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
