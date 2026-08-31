"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";

// Type-only view of the GSAP module — ships no code (H12).
type GsapModule = typeof import("@/lib/gsap");
type ScrollTriggerInstance = InstanceType<GsapModule["ScrollTrigger"]>;

/** The ffmpeg-extracted sequence (DESIGN.md E4.1): hero-pour.mp4 → 121 webp
 *  frames at 1440×810, ~2.6MB total, lazy-loaded only when the section
 *  approaches the viewport. */
const FRAME_COUNT = 121;
const FRAME_WIDTH = 1440;
const FRAME_HEIGHT = 810;
const frameSrc = (index: number) =>
  `/sequences/pour-cure/frame_${String(index).padStart(3, "0")}.webp`;
/** Final cured frame — doubles as the static-fallback artwork. */
const LAST_FRAME_SRC = frameSrc(FRAME_COUNT - 1);

/** Media gate for the animated stage: fine pointer AND no reduced-motion
 *  preference. The static composition carries the exact complement, so the
 *  page's geometry is decided by CSS at first paint — never by a JS branch
 *  flip that would grow the page post-hydration and break scroll
 *  restoration (reload-below-the-fold, back-nav). */
/* Full literals on purpose — Tailwind's scanner cannot extract classes
   assembled from template strings. ≥lg + ≥600px height keeps the pinned
   h-svh stage off viewports that cannot hold it (WCAG 1.4.10: a 400%-zoom
   desktop is ~320px wide with a fine pointer and must get the static
   branch). Keep both lines byte-parallel — exact complements. */
const STAGE_VISIBLE =
  "hidden motion-safe:pointer-fine:lg:[@media(min-height:37.5rem)]:block";
const STATIC_VISIBLE =
  "block motion-safe:pointer-fine:lg:[@media(min-height:37.5rem)]:hidden";

export interface ShowcaseStage {
  title: string;
  copy: string;
}

export interface PourCureShowcaseProps {
  eyebrow: string;
  heading: string;
  /** The four narrative beats — pour → gild → cure → polish (§6 04). */
  stages: [ShowcaseStage, ShowcaseStage, ShowcaseStage, ShowcaseStage];
  /** Alt text for the static cured-frame fallback image. */
  staticAlt: string;
  /** Id the page's section uses for aria-labelledby. Both compositions carry
   *  a heading, so only ONE of them may claim the id — the visible one is
   *  decided by CSS, so the id goes on both and the duplicate is inert
   *  (display:none subtrees are out of the accessibility tree). */
  headingId?: string;
  className?: string;
}

/**
 * B2 §3 — the Apple-style pinned pour→cure showcase, the site's one signature
 * scroll moment (DESIGN.md B4 "Pinned showcase", E6 Phase 5). A 300svh
 * wrapper with a `sticky top-0 h-svh` stage — deliberately NOT
 * `ScrollTrigger.pin()`, so no pin-spacer exists to fight Lenis (the
 * PinnedStory pattern). One scrubbed tween (scrub 0.5) drives a canvas
 * drawing the 121-frame sequence; three copy blocks crossfade in thirds of
 * the same progress.
 *
 * Fallback law (B4): BOTH compositions are server-rendered and CSS media
 * queries pick one — the animated stage on motion-safe fine-pointer devices,
 * the static cured-frame composition on touch, reduced motion, and (via the
 * <noscript> override) no-JS. Geometry is therefore SSR-stable: hydration
 * never grows the page, so scroll restoration lands where the user was. The
 * effect only WIRES the visible stage (it bails when the CSS gate hides it).
 * Frames lazy-load when the section is within ~1.5 viewports (coarse stride
 * pass first, then fill), and the canvas draws the nearest loaded frame while
 * gaps remain — fast scrollers never see an empty stage.
 */
export function PourCureShowcase({
  eyebrow,
  heading,
  stages,
  staticAlt,
  headingId,
  className,
}: PourCureShowcaseProps) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const wrapperRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageBlockRefs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (prefersReducedMotion || !wrapper || !canvas) return;
    // The CSS media gate is the single source of truth for which composition
    // shows — wire nothing while the stage is display:none (coarse pointer).
    if (window.getComputedStyle(wrapper).display === "none") return;

    let cancelled = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      const { gsap, ScrollTrigger } = await import("@/lib/gsap");
      if (cancelled) return;

      const context = canvas.getContext("2d");
      if (!context) return;

      /* —— frame store: load lazily, draw the nearest ready frame —— */
      const frames: (HTMLImageElement | null)[] = Array.from(
        { length: FRAME_COUNT },
        () => null,
      );
      let drawnFrame = -1;

      const nearestLoaded = (target: number): number => {
        for (let offset = 0; offset < FRAME_COUNT; offset += 1) {
          if (frames[target - offset]) return target - offset;
          if (target + offset < FRAME_COUNT && frames[target + offset]) {
            return target + offset;
          }
        }
        return -1;
      };

      /** Cover-fit draw (the canvas is sized to the stage, frames are 16:9). */
      const draw = (target: number, force = false) => {
        const index = nearestLoaded(target);
        if (index < 0 || (index === drawnFrame && !force)) return;
        const image = frames[index];
        if (!image) return;
        drawnFrame = index;
        const { width: cw, height: ch } = canvas;
        const scale = Math.max(cw / FRAME_WIDTH, ch / FRAME_HEIGHT);
        const dw = FRAME_WIDTH * scale;
        const dh = FRAME_HEIGHT * scale;
        context.clearRect(0, 0, cw, ch);
        context.drawImage(image, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
      };

      const state = { frame: 0 };
      const loadFrame = (index: number): Promise<void> => {
        if (cancelled || frames[index]) return Promise.resolve();
        const image = new window.Image();
        image.decoding = "async";
        image.src = frameSrc(index);
        return image
          .decode()
          .then(() => {
            if (cancelled) return;
            frames[index] = image;
            // Redraw if this arrival improves the currently shown frame.
            if (
              Math.abs(index - state.frame) < Math.abs(drawnFrame - state.frame)
            ) {
              draw(Math.round(state.frame));
            }
          })
          .catch(() => {
            /* One missing frame degrades to its neighbor — never fatal. */
          });
      };

      // Coarse stride pass first, AWAITED so it truly gets the bandwidth
      // (over HTTP/2 a same-tick fill pass would multiplex at equal priority
      // and starve the coverage frames), then the fill pass takes the rest.
      // Kicked off by its own one-shot trigger below.
      let loadStarted = false;
      const startLoading = () => {
        if (loadStarted || cancelled) return;
        loadStarted = true;
        const stride: Promise<void>[] = [];
        for (let i = 0; i < FRAME_COUNT; i += 8) stride.push(loadFrame(i));
        void Promise.allSettled(stride).then(() => {
          if (cancelled) return;
          for (let i = 0; i < FRAME_COUNT; i += 1) void loadFrame(i);
        });
      };

      /* —— canvas sizing (DPR-aware, capped at 2) —— */
      const stage = canvas.parentElement as HTMLElement;
      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const { width, height } = stage.getBoundingClientRect();
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        draw(Math.round(state.frame), true);
      };
      resize();
      const resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(stage);

      /* —— copy-block crossfade: thirds of progress, quickTo-smoothed —— */
      const blocks = stageBlockRefs.current.filter(
        (el): el is HTMLLIElement => el !== null,
      );
      // A5 bands: fades smooth at the micro ceiling (0.25s), rises at the
      // entrance floor (0.4s) — no invented timing.
      const blockFades = blocks.map((el) =>
        gsap.quickTo(el, "opacity", { duration: 0.25, ease: "power2.out" }),
      );
      /* §6 04: "the active step is full opacity, the rest at 30%." The
         inactive steps stay readable rather than disappearing — the column is
         a table of contents for the pour, not a slideshow. */
      const RESTING_OPACITY = 0.3;
      const applyCopy = (progress: number) => {
        const band = 1 / blocks.length;
        const active = Math.min(
          blocks.length - 1,
          Math.floor(progress / band),
        );
        blocks.forEach((el, i) => {
          blockFades[i](i === active ? 1 : RESTING_OPACITY);
          if (i === active) el.setAttribute("data-active", "");
          else el.removeAttribute("data-active");
        });
      };

      /* —— the single scrubbed tween driving frame + copy —— */
      const tween = gsap.to(state, {
        frame: FRAME_COUNT - 1,
        ease: "none",
        scrollTrigger: {
          trigger: wrapper,
          start: "top top",
          end: "bottom bottom",
          scrub: 0.5,
          onUpdate: (self) => applyCopy(self.progress),
        },
        onUpdate: () => draw(Math.round(state.frame)),
      });

      // One-shot preload trigger: begin fetching ~1.5 viewports early
      // ("top 250%" = the section top is still 1.5 viewport heights below
      // the fold when loading starts).
      const preloadTrigger = ScrollTrigger.create({
        trigger: wrapper,
        start: "top 250%",
        once: true,
        onEnter: startLoading,
      });
      // Already past that point on mount (deep links, back-nav restores).
      if (preloadTrigger.progress > 0 || preloadTrigger.isActive) {
        startLoading();
      }
      applyCopy(0);

      cleanup = () => {
        resizeObserver.disconnect();
        preloadTrigger.kill();
        (
          tween as unknown as { scrollTrigger?: ScrollTriggerInstance }
        ).scrollTrigger?.kill();
        tween.kill();
        blocks.forEach((el) =>
          gsap.set(el, { clearProps: "opacity,transform" }),
        );
        frames.fill(null);
      };
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [prefersReducedMotion]);

  return (
    <>
      {/* No-JS: the animated stage would be an inert navy band — force the
          static composition whatever the media queries say. */}
      <noscript>
        <style>{`[data-slot="pour-cure-stage"]{display:none !important}[data-slot="pour-cure-static"]{display:block !important}`}</style>
      </noscript>

      {/* ——— static composition (touch / reduced motion / no-JS) ——— */}
      <section
        data-slot="pour-cure-static"
        data-theme="navy"
        aria-labelledby="showcase-heading-static"
        className={cn(STATIC_VISIBLE, "section-standard bg-obsidian", className)}
      >
        <div className="u-shell">
          <p className="u-micro flex items-center gap-3 text-champagne">
            <span aria-hidden className="block h-px w-6 bg-champagne" />
            {eyebrow}
          </p>
          <h2
            id={headingId ?? "showcase-heading-static"}
            className="mt-4 max-w-xl font-display text-h2 leading-[1.08] tracking-display text-mineral"
          >
            {heading}
          </h2>
          <div className="mt-10 grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            <div className="overflow-hidden rounded-image">
              {/* unoptimized on purpose: the raw frame URL matches what the
                  canvas loader fetches, so a fetch here warms the sequence
                  cache instead of pulling a never-reused optimizer variant
                  (the frame is a 21KB webp — the optimizer gains nothing). */}
              <Image
                src={LAST_FRAME_SRC}
                alt={staticAlt}
                unoptimized
                width={FRAME_WIDTH}
                height={FRAME_HEIGHT}
                sizes="(min-width: 1024px) 48vw, 100vw"
                className="h-auto w-full object-cover"
              />
            </div>
            <ol className="flex flex-col gap-8">
              {stages.map((stage, index) => (
                <li key={stage.title} className="border-t border-hairline-dk pt-5">
                  <h3 className="u-micro text-champagne">
                    {String(index + 1).padStart(2, "0")} · {stage.title}
                  </h3>
                  <p className="mt-2 max-w-md font-body text-body leading-relaxed text-mist">
                    {stage.copy}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ——— animated stage (motion-safe fine-pointer desktops) ——— */}
      <section
        ref={wrapperRef}
        data-slot="pour-cure-stage"
        data-theme="navy"
        aria-labelledby="showcase-heading"
        className={cn(
          STAGE_VISIBLE,
          "relative h-[400svh] bg-obsidian",
          className,
        )}
      >
        <div className="sticky top-0 h-svh overflow-hidden">
          {/* Sequence canvas — decorative rendering of the frames; the real
              narrative lives in the copy blocks, so the canvas is labeled once
              as an image and its per-frame changes stay silent. */}
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={staticAlt}
            className="absolute inset-0 size-full"
          />
          {/* Legibility scrim on the copy edge (A2 depth-gradient direction) —
              flipped in RTL locales so it always backs the inline-start copy
              column. /90→/60@60% keeps the 12px gold labels and body copy at
              AA over the brightest mid-pour frames (measured worst ≈ frame 42). */}
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-r from-obsidian/90 via-obsidian/60 via-60% to-transparent rtl:bg-gradient-to-l"
          />
          <div className="u-shell relative flex h-full flex-col justify-center">
            <p className="u-micro flex items-center gap-3 text-champagne">
              <span aria-hidden className="block h-px w-6 bg-champagne" />
              {eyebrow}
            </p>
            <h2
              id={headingId ?? "showcase-heading"}
              className="mt-4 max-w-xl font-display text-h2 leading-[1.08] tracking-display text-mineral"
            >
              {heading}
            </h2>
            {/* The four beats, all present and all readable: the active one at
                full opacity, the rest at 30% (§6 04). Opacity is visual
                sequencing only — every beat stays in the accessibility tree
                and in reading order, which is why the reduced-motion branch
                can be the same list without a scrub. */}
            <ol className="mt-10 flex max-w-md flex-col gap-6">
              {stages.map((stage, index) => (
                <li
                  key={stage.title}
                  ref={(el) => {
                    stageBlockRefs.current[index] = el;
                  }}
                  className="border-t border-hairline-dk pt-4 transition-opacity duration-(--dur-base)"
                  style={index === 0 ? undefined : { opacity: 0.3 }}
                >
                  <h3 className="u-micro text-champagne">
                    {String(index + 1).padStart(2, "0")} · {stage.title}
                  </h3>
                  <p className="mt-2 font-body text-body leading-relaxed text-mineral/90">
                    {stage.copy}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>
    </>
  );
}
