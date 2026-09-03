"use client";

import { useState } from "react";
import Image from "next/image";
import { Play } from "lucide-react";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { isOptimizableImageSrc } from "@/lib/image-src";
import { cn } from "@/lib/utils";

/**
 * The video half of `TestimonialCard`'s `video` variant.
 *
 * Never autoplays on mount — Part 14 forbids it, and a wall of testimonial
 * cards is exactly the kind of grid where an ambient loop per card would be
 * the "technology demo" motion the spec rejects. The poster renders first;
 * a click swaps it for the film, following `product/gallery.tsx`'s own
 * click-to-play film: once STARTED, playback autoplays and starts muted
 * only when motion is welcome, otherwise the visitor presses the native
 * play control themselves — the reduced-motion visitor never gets an
 * autoplaying element of any kind, not even one they just clicked toward.
 */
export function TestimonialVideoFrame({
  videoUrl,
  posterUrl,
  watchLabel,
  className,
}: {
  videoUrl: string;
  posterUrl: string | null;
  /** "Watch the film" — the play chip's accessible name. */
  watchLabel: string;
  className?: string;
}) {
  const [started, setStarted] = useState(false);
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div
      className={cn(
        "relative aspect-video w-full overflow-hidden rounded-image bg-sand",
        className,
      )}
    >
      {started ? (
        <video
          src={videoUrl}
          poster={posterUrl ?? undefined}
          controls
          playsInline
          autoPlay={!prefersReducedMotion}
          muted={!prefersReducedMotion}
          className="h-full w-full object-cover"
        />
      ) : (
        <button
          type="button"
          onClick={() => setStarted(true)}
          className="group absolute inset-0 flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3"
        >
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt=""
              fill
              sizes="(min-width:768px) 33vw, 90vw"
              unoptimized={!isOptimizableImageSrc(posterUrl)}
              className="object-cover"
            />
          ) : (
            <span aria-hidden className="absolute inset-0 bg-deep-ocean" />
          )}
          <span
            aria-hidden
            className="relative flex size-14 items-center justify-center rounded-full bg-mineral/90 text-obsidian transition-transform duration-(--dur-fast) ease-(--ease-settle) group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          >
            <Play
              className="ms-0.5 size-5"
              strokeWidth={1.5}
              fill="currentColor"
            />
          </span>
          <span className="sr-only">{watchLabel}</span>
        </button>
      )}
    </div>
  );
}
