"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { preloaderGate } from "@/lib/preloader-signal";
import { cn } from "@/lib/utils";

// Type-only view of the GSAP module — ships no code (H12).
type GsapModule = typeof import("@/lib/gsap");
type SplitTextInstance = InstanceType<GsapModule["SplitText"]>;
type ScrollTriggerInstance = InstanceType<GsapModule["ScrollTrigger"]>;
type Tween = ReturnType<GsapModule["gsap"]["fromTo"]>;

type KineticTag = "h1" | "h2" | "h3" | "h4" | "div" | "p";
type SplitMode = "chars" | "words" | "lines";

export interface KineticHeadingProps {
  /** Element to render. Defaults to h2. */
  as?: KineticTag;
  /**
   * Seconds the reveal runs. Defaults to 1.1 (the v7 value); 2.0 call sites
   * go through SplitTextHeading, which caps it inside A5's 400–800ms window.
   */
  duration?: number;
  /**
   * Heading content. Only plain string children are split and animated;
   * inline nodes render statically.
   */
  children: ReactNode;
  className?: string;
  /** SplitText granularity. Defaults to words. */
  split?: SplitMode;
  /** Seconds between each fragment. Defaults to 0.045. */
  stagger?: number;
  /** Seconds before the reveal starts. */
  delay?: number;
  /** Play the reveal a single time. Defaults to true. */
  once?: boolean;
  /**
   * Reveal when scrolled into view (start "top 82%"). When false the
   * reveal plays on mount. Defaults to true.
   */
  scrollTrigger?: boolean;
}

/**
 * GSAP SplitText reveal for display headings. Waits for `document.fonts`
 * so serif (Playfair) metrics are final before splitting, masks lines when
 * `split="lines"`, and re-splits on resize. Under reduced motion (or with
 * non-string children) it renders the plain element with no splitting.
 *
 * GSAP is dynamically imported inside the effect *after* the reduced-motion
 * / splittable guards pass (H12, mirroring SmoothScrollProvider's PERF-301
 * pattern), so the ~47KB gz runtime never rides first-load JS — SSR and the
 * initial client render always emit the plain element.
 */
export function KineticHeading({
  as: Tag = "h2",
  children,
  className,
  duration = 1.1,
  split = "words",
  stagger = 0.045,
  delay = 0,
  once = true,
  scrollTrigger: withScrollTrigger = true,
}: KineticHeadingProps) {
  const ref = useRef<HTMLElement | null>(null);
  const reduced = usePrefersReducedMotion();
  const splittable = typeof children === "string";

  useEffect(() => {
    const el = ref.current;
    if (reduced || !splittable || !el) return;

    // The server-rendered heading is readable from first paint — clock how
    // long it has been up before GSAP is ready to split (L-P1).
    const visibleSince = performance.now();

    let cancelled = false;
    // Set once the dynamic import lands, so unmount before (or during) the
    // load tears nothing down — there is nothing to tear down yet.
    let cleanup: (() => void) | undefined;

    void (async () => {
      const { gsap, SplitText } = await import("@/lib/gsap");
      if (cancelled) return;

      let instance: SplitTextInstance | null = null;
      let tween: Tween | null = null;
      let hasPlayed = false;
      let removeResize: (() => void) | null = null;

      const targetsOf = (s: SplitTextInstance): Element[] =>
        split === "chars" ? s.chars : split === "lines" ? s.lines : s.words;

      const killTween = () => {
        if (!tween) return;
        // The instance property isn't in gsap's type augmentations, only the
        // vars — narrow it manually so the trigger dies with the tween.
        (
          tween as unknown as { scrollTrigger?: ScrollTriggerInstance }
        ).scrollTrigger?.kill();
        tween.kill();
        tween = null;
      };

      const animate = (targets: Element[], masked: boolean) => {
        killTween();
        gsap.set(el, { autoAlpha: 1 });
        tween = gsap.fromTo(
          targets,
          { yPercent: 110, opacity: masked ? 1 : 0 },
          {
            yPercent: 0,
            opacity: 1,
            duration,
            ease: "power4.out",
            stagger,
            delay,
            onComplete: () => {
              hasPlayed = true;
            },
            scrollTrigger: withScrollTrigger
              ? {
                  trigger: el,
                  start: "top 82%",
                  toggleActions: once
                    ? "play none none none"
                    : "restart none none reset",
                }
              : undefined,
          },
        );
        return tween;
      };

      const build = () => {
        try {
          // gsap 3.13+: autoSplit reverts and re-splits on resize / late font
          // loads, re-running onSplit with the fresh fragments.
          instance = SplitText.create(el, {
            type: split,
            mask: split === "lines" ? "lines" : undefined,
            autoSplit: true,
            onSplit: (self) => {
              animate(targetsOf(self), split === "lines");
            },
          });
        } catch {
          // Older gsap: split manually and handle resize with a debounced
          // revert + re-split, jumping straight to the end state if the
          // reveal already played.
          instance = new SplitText(el, { type: split });
          animate(targetsOf(instance), false);

          let timer: number | undefined;
          const onResize = () => {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => {
              if (cancelled) return;
              killTween();
              instance?.revert();
              instance = new SplitText(el, { type: split });
              const targets = targetsOf(instance);
              if (once && hasPlayed) {
                gsap.set(targets, { yPercent: 0, opacity: 1 });
              } else {
                animate(targets, false);
              }
            }, 200);
          };
          window.addEventListener("resize", onResize);
          removeResize = () => {
            window.clearTimeout(timer);
            window.removeEventListener("resize", onResize);
          };
        }
      };

      // Registered before the font wait so an unmount mid-wait still
      // reverts the autoAlpha hide above.
      cleanup = () => {
        removeResize?.();
        killTween();
        instance?.revert();
        instance = null;
        gsap.set(el, { clearProps: "visibility,opacity" });
      };

      // Wait for webfonts so the serif metrics (and line breaks) are final, but
      // cap the wait at 400ms so a slow font can never leave the heading (often
      // the LCP element, e.g. the hero h1) hidden indefinitely (UIUX-003).
      const fontsReady = document.fonts?.ready ?? Promise.resolve();
      Promise.race([
        fontsReady,
        new Promise<void>((resolve) => {
          window.setTimeout(resolve, 400);
        }),
      ]).then(async () => {
        if (cancelled) return;

        // L-P1: never yank back a headline the reader is already into. If
        // the heading sits in the viewport and has been readable for over a
        // second by the time the runtime is ready (slow network, long
        // hydration), or the webfonts still aren't final at split time (the
        // 400ms cap fired — split metrics would be wrong), skip the hide +
        // replay entirely: the heading simply stays as painted. Off-screen
        // headings still split — their reveal hasn't been seen yet.
        const rect = el.getBoundingClientRect();
        const inViewport =
          rect.bottom > 0 && rect.top < window.innerHeight;
        if (inViewport && performance.now() - visibleSince > 1000) return;
        if (document.fonts && document.fonts.status !== "loaded") return;

        // First-visit sequencing (S-03): if the Preloader overlay is up,
        // wait for its exit fade to start before hiding + replaying — time
        // under an opaque overlay doesn't count as "readable", so this wait
        // deliberately sits AFTER the settled-heading skip above.
        await preloaderGate();
        if (cancelled) return;

        // Hide only now that the split is committed, so the fragments never
        // flash at their unsplit positions (and a bail above never leaves
        // the heading hidden).
        gsap.set(el, { autoAlpha: 0 });
        build();
      });
    })();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [
    reduced,
    splittable,
    children,
    duration,
    split,
    stagger,
    delay,
    once,
    withScrollTrigger,
  ]);

  return (
    <Tag
      ref={(node: HTMLElement | null) => {
        ref.current = node;
      }}
      className={cn(className)}
    >
      {children}
    </Tag>
  );
}
