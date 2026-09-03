"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Play, Rotate3d } from "lucide-react";

import { ModelViewer } from "@/components/product/model-viewer";
import { Lightbox } from "@/components/storefront/lightbox";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { isOptimizableImageSrc } from "@/lib/image-src";
import { cn } from "@/lib/utils";

export type GalleryImage = {
  id: string;
  /** Renderable src only ("/uploads/…" or "http…") — filtered server-side. */
  url: string;
  alt: string;
};

interface ProductGalleryProps {
  /** CSS view-transition-name pairing this stage with the shop card. */
  morphName?: string;
  title: string;
  images: GalleryImage[];
  videoUrl: string | null;
  model3dUrl: string | null;
}

type Slide =
  | { kind: "image"; index: number }
  | { kind: "video" }
  | { kind: "model" };

function initialSlide(
  images: GalleryImage[],
  videoUrl: string | null,
  model3dUrl: string | null,
): Slide | null {
  if (images.length > 0) return { kind: "image", index: 0 };
  if (videoUrl) return { kind: "video" };
  if (model3dUrl) return { kind: "model" };
  return null;
}

/** §9.1's counter is mono and zero-padded: `03 / 07`. */
function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/* Part 16: 2px sapphire ring at 3px offset. */
const FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3 focus-visible:ring-offset-mineral";

/**
 * ProductGallery — REDESIGN.md §9.1.
 *
 * The 60% of the PDP split. A 4:5 stage with hover pan-zoom, a **vertical**
 * thumbnail rail carrying a champagne border on the active frame, the video
 * and 3D chips where the owner supplied them, and a full-screen lightbox at
 * 96% obsidian with a mono `03 / 07` counter.
 *
 * Three things are load-bearing rather than decorative:
 *
 * - **The first image is the LCP.** It is `priority`, it is never revealed,
 *   and no transform is applied to it on mount (Part 14). The pan-zoom is a
 *   pointer-driven transform written straight to the DOM — no React state on
 *   the hot path, and it is switched off entirely under reduced motion.
 * - **One rail, two directions.** The thumbnails are a single list that flows
 *   horizontally under the stage on mobile and vertically beside it from
 *   `lg`, ordered with `order-*` so the DOM order stays stage-then-rail and
 *   a screen reader meets the picture before its index.
 * - **Focus comes home.** The lightbox is state-controlled with no Radix
 *   trigger to restore to, so `onCloseAutoFocus` puts focus back on the stage
 *   button by hand (Part 17: "Esc closes every layer and focus returns to the
 *   trigger").
 */
export function ProductGallery({
  morphName,
  title,
  images,
  videoUrl,
  model3dUrl,
}: ProductGalleryProps) {
  const t = useTranslations("Product");
  const tCommon = useTranslations("Common");
  const prefersReducedMotion = usePrefersReducedMotion();
  const [active, setActive] = useState<Slide | null>(() =>
    initialSlide(images, videoUrl, model3dUrl),
  );
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const stageButtonRef = useRef<HTMLButtonElement>(null);
  const zoomRef = useRef<HTMLSpanElement>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const railCount = images.length + (videoUrl ? 1 : 0) + (model3dUrl ? 1 : 0);
  const activeImage =
    active?.kind === "image" ? (images[active.index] ?? null) : null;
  const lightboxImage =
    lightboxIndex !== null ? (images[lightboxIndex] ?? null) : null;

  function stepStage(delta: number) {
    if (images.length < 2) return;
    setActive((current) =>
      current?.kind === "image"
        ? {
            kind: "image",
            index: (current.index + delta + images.length) % images.length,
          }
        : current,
    );
  }

  /* Pan-zoom: written to the node, never to state. */
  function pan(event: React.MouseEvent<HTMLElement>) {
    const node = zoomRef.current;
    if (!node || prefersReducedMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    node.style.transformOrigin = `${x}% ${y}%`;
    node.style.transform = "scale(1.6)";
  }

  function resetPan() {
    const node = zoomRef.current;
    if (!node) return;
    node.style.transform = "";
  }

  const thumbBase = cn(
    "relative size-16 shrink-0 snap-start overflow-hidden rounded-image border transition-colors duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none lg:size-20",
    FOCUS_RING,
  );
  const thumbActive = "border-champagne";
  const thumbIdle = "border-hairline hover:border-ink/30";

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:gap-5">
      {/* ——— thumbnail rail: under the stage on mobile, beside it from lg ——— */}
      {railCount > 1 ? (
        <div
          role="group"
          aria-label={t("gallery.railLabel")}
          className={cn(
            "order-2 flex snap-x gap-3 overflow-x-auto pb-1",
            "lg:order-1 lg:max-h-[34rem] lg:w-20 lg:shrink-0 lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:pb-0",
            "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          )}
        >
          {images.map((image, i) => {
            const isActive = active?.kind === "image" && active.index === i;
            return (
              <button
                key={image.id}
                type="button"
                aria-label={t("gallery.showImage", {
                  index: i + 1,
                  count: images.length,
                })}
                aria-pressed={isActive}
                onClick={() => setActive({ kind: "image", index: i })}
                className={cn(thumbBase, isActive ? thumbActive : thumbIdle)}
              >
                <Image
                  src={image.url}
                  alt=""
                  fill
                  sizes="80px"
                  unoptimized={!isOptimizableImageSrc(image.url)}
                  className="object-cover"
                />
              </button>
            );
          })}

          {videoUrl ? (
            <button
              type="button"
              aria-label={t("gallery.playVideo")}
              aria-pressed={active?.kind === "video"}
              onClick={() => setActive({ kind: "video" })}
              className={cn(
                thumbBase,
                "flex flex-col items-center justify-center gap-1 bg-obsidian text-mineral",
                active?.kind === "video" ? thumbActive : thumbIdle,
              )}
            >
              <Play aria-hidden strokeWidth={1.5} className="size-5" />
              <span className="u-micro text-mist">
                {t("gallery.videoChip")}
              </span>
            </button>
          ) : null}

          {model3dUrl ? (
            <button
              type="button"
              aria-label={t("gallery.view3d")}
              aria-pressed={active?.kind === "model"}
              onClick={() => setActive({ kind: "model" })}
              className={cn(
                thumbBase,
                "flex flex-col items-center justify-center gap-1 bg-deep-ocean text-mineral",
                active?.kind === "model" ? thumbActive : thumbIdle,
              )}
            >
              <Rotate3d aria-hidden strokeWidth={1.5} className="size-5" />
              <span className="u-micro text-mist">
                {t("gallery.threeDChip")}
              </span>
            </button>
          ) : null}
        </div>
      ) : null}

      {/* ——— the stage ——— */}
      <div
        style={morphName ? { viewTransitionName: morphName } : undefined}
        onTouchStart={(event) => {
          const touch = event.touches[0];
          touchStartRef.current = { x: touch.clientX, y: touch.clientY };
        }}
        onTouchEnd={(event) => {
          const start = touchStartRef.current;
          touchStartRef.current = null;
          if (!start) return;
          const touch = event.changedTouches[0];
          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          // Horizontal intent only — a vertical scroll must never page.
          if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy)) return;
          const rtl = document.documentElement.dir === "rtl";
          stepStage(dx < 0 ? (rtl ? -1 : 1) : rtl ? 1 : -1);
        }}
        className="relative order-1 aspect-[4/5] min-w-0 flex-1 overflow-hidden rounded-image bg-sand lg:order-2"
      >
        {activeImage ? (
          <button
            ref={stageButtonRef}
            type="button"
            aria-label={t("gallery.viewFullScreen")}
            onClick={() =>
              setLightboxIndex(active?.kind === "image" ? active.index : 0)
            }
            onMouseMove={pan}
            onMouseLeave={resetPan}
            /* The fill image paints over the button's own outline, so the
               focus indicator is an ::after ring above it. */
            className="absolute inset-0 block h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:after:pointer-events-none focus-visible:after:absolute focus-visible:after:inset-1 focus-visible:after:z-10 focus-visible:after:border-2 focus-visible:after:border-focus"
          >
            <span
              ref={zoomRef}
              className="absolute inset-0 block transition-transform duration-(--dur-slow) ease-(--ease-luxury) motion-reduce:transition-none motion-reduce:transform-none"
            >
              <Image
                key={activeImage.id}
                src={activeImage.url}
                alt={activeImage.alt || title}
                fill
                /* The PDP's first frame carries the LCP: eager, unrevealed,
                   untransformed on mount (Part 14). */
                priority={active?.kind === "image" && active.index === 0}
                sizes="(min-width: 1024px) 52vw, 100vw"
                unoptimized={!isOptimizableImageSrc(activeImage.url)}
                className="object-cover"
              />
            </span>
          </button>
        ) : null}

        {active?.kind === "video" && videoUrl ? (
          <video
            key={videoUrl}
            src={videoUrl}
            // A frame from the piece's own gallery rather than a black flash
            // before the first paint (or at all, if autoplay is refused).
            poster={images[0]?.url}
            controls
            playsInline
            // The selected film starts itself, muted and looping; controls
            // stay for pause/unmute. Reduced motion keeps click-to-play.
            autoPlay={!prefersReducedMotion}
            muted={!prefersReducedMotion}
            loop
            className="h-full w-full object-cover"
          />
        ) : null}

        {active?.kind === "model" && model3dUrl ? (
          <ModelViewer
            src={model3dUrl}
            alt={t("gallery.modelAlt", { title })}
            poster={images[0]?.url}
          />
        ) : null}

        {!active ? (
          <span aria-hidden className="absolute inset-0 block bg-deep-ocean" />
        ) : null}

        {/* Mobile counter — the swipe needs a position, and it is mono. */}
        {activeImage && images.length > 1 ? (
          <p
            aria-hidden
            className="pointer-events-none absolute bottom-3 end-3 bg-obsidian/80 px-2.5 py-1 font-mono text-12 tracking-[0.14em] text-mineral tabular-nums lg:hidden"
          >
            {t("gallery.counter", {
              index: pad((active?.kind === "image" ? active.index : 0) + 1),
              count: pad(images.length),
            })}
          </p>
        ) : null}
      </div>

      {/* ——— lightbox: the shared component, full-viewport chrome kept.
          Mounted whenever there is anything to open (unconditionally on
          `open`) rather than only while open, so Radix's own close animation
          and `onCloseAutoFocus` still run — an open-gated mount would tear
          the whole dialog tree down before either could. ——— */}
      {images.length > 0 ? (
        <Lightbox
          open={lightboxIndex !== null}
          onOpenChange={(open) => {
            if (!open) setLightboxIndex(null);
          }}
          index={lightboxIndex ?? 0}
          count={images.length}
          onIndexChange={(i) => setLightboxIndex(i)}
          // The stage button is the one place a lightbox opens from here —
          // every index FLIPs in from the same origin.
          originFor={() => stageButtonRef.current}
          labels={{
            prev: t("gallery.previousImage"),
            next: t("gallery.nextImage"),
            close: tCommon("close"),
          }}
          dialogTitle={t("gallery.lightboxTitle", {
            title,
            index: (lightboxIndex ?? 0) + 1,
            count: images.length,
          })}
          statusText={
            lightboxImage
              ? t("gallery.lightboxStatus", {
                  index: (lightboxIndex ?? 0) + 1,
                  count: images.length,
                  alt: lightboxImage.alt || title,
                })
              : ""
          }
          /* `left-0` rather than `start-0`: it exists to CANCEL the shared
             DialogContent's own `left-1/2`, and only the same physical
             property can do that in tailwind-merge. The surface is the whole
             viewport, so there is no direction to get wrong. */
          contentClassName="top-0 left-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-none"
        >
          {lightboxImage ? (
            <Image
              src={lightboxImage.url}
              alt={lightboxImage.alt || title}
              fill
              sizes="96vw"
              unoptimized={!isOptimizableImageSrc(lightboxImage.url)}
              className="object-contain"
            />
          ) : null}
        </Lightbox>
      ) : null}
    </div>
  );
}
