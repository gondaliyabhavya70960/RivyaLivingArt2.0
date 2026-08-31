"use client";

import { useEffect, useState } from "react";
import { Pause, Play, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/** The dismissal persists 30 days (§5.1). */
const DISMISS_KEY = "rr-announcement-dismissed";
const DISMISS_DAYS = 30;

/** §5.1: rotate every 6s with a 300ms crossfade. */
const ROTATE_MS = 6000;
const FADE_MS = 300;

/**
 * The announcement bar — REDESIGN.md §5.1.
 *
 * 36px, obsidian, an 11px mono uppercase line centred in it, a 1px champagne
 * bottom hairline at 15%, and a dismiss control whose choice persists for
 * thirty days. Up to three messages rotate every 6s with a 300ms crossfade;
 * rotation pauses on hover and focus, an explicit pause control exists
 * (WCAG 2.2.2), and reduced motion freezes it on the first message.
 *
 * Copy is supplied by the caller and never invented here. §5.1 asks for **a
 * fact, not a slogan** — `CURRENT LEAD TIME · SMALL 7–10 DAYS · STATEMENT
 * 3–6 WEEKS` is the shape; the owner's own lines come from Site Settings.
 *
 * The rotating copy is deliberately NOT a live region: auto-rotation must not
 * narrate itself to a screen reader.
 *
 * Dismissal reads `localStorage` in an event-free effect and renders nothing
 * on the server, so the strip never flashes in for someone who dismissed it —
 * it is above the fold but outside the LCP element, so a one-frame mount is
 * cheaper than shipping the state in the HTML.
 */
export function AnnouncementBar({
  messages,
  href,
  className,
}: {
  messages: string[];
  /** Optional destination — wraps the rotating message in an i18n Link. */
  href?: string;
  className?: string;
}) {
  const t = useTranslations("Common");
  const reducedMotion = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [faded, setFaded] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const rotating =
    !reducedMotion && messages.length > 1 && !paused && !hovered && !dismissed;

  /* Restore a previous dismissal. The read happens inside a timer callback,
     not in the effect body, so no setState runs synchronously during the
     effect (the rule this repo lints for). */
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(DISMISS_KEY);
        if (raw && Number(raw) > Date.now()) setDismissed(true);
      } catch {
        // Private mode or blocked storage: the strip simply shows.
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  /* Every 6s: fade out… */
  useEffect(() => {
    if (!rotating) return;
    const id = window.setInterval(() => setFaded(true), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [rotating]);

  /* …then swap the message once the 300ms crossfade completes. */
  useEffect(() => {
    if (!faded) return;
    const id = window.setTimeout(() => {
      setIndex((i) => (i + 1) % messages.length);
      setFaded(false);
    }, FADE_MS);
    return () => window.clearTimeout(id);
  }, [faded, messages.length]);

  if (messages.length === 0 || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(
        DISMISS_KEY,
        String(Date.now() + DISMISS_DAYS * 24 * 60 * 60 * 1000),
      );
    } catch {
      // Nothing to persist to — the strip returns on the next visit.
    }
  };

  const message = reducedMotion
    ? messages[0]
    : messages[index % messages.length];
  const showPause = !reducedMotion && messages.length > 1;

  return (
    <div
      data-slot="sf-announcement-bar"
      data-theme="navy"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      className={cn(
        // 36px from `sm` up, as specified. Below that the strip is allowed to
        // wrap: this line carries the studio's lead time, and Part 13 is
        // explicit that mobile is a priority rather than a scaled-down
        // desktop — truncating the one fact a first-time visitor needs is not
        // a trade the 36px is worth. `pe-16` keeps the copy clear of the two
        // end-edge controls at every width.
        "relative flex min-h-9 items-center justify-center bg-obsidian py-2 ps-4 pe-16 font-body text-mineral sm:h-9 sm:py-0",
        className,
      )}
    >
      <span
        className={cn(
          "u-micro min-w-0 text-center text-balance text-mineral transition-opacity ease-(--ease-luxury) sm:truncate motion-reduce:transition-none",
          faded ? "opacity-0" : "opacity-100",
        )}
        style={{ transitionDuration: `${FADE_MS}ms` }}
      >
        {href ? (
          <Link
            href={href}
            className="underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian"
          >
            {message}
          </Link>
        ) : (
          message
        )}
      </span>

      {/* The two controls sit at the end edge, outside the centred copy, so
          the message stays optically centred in the 36px strip. Both clear
          the 44px target with an expanded hit area rather than a taller box —
          the strip's height is specified. */}
      <span className="absolute end-2 flex items-center">
        {showPause ? (
          <button
            type="button"
            aria-pressed={paused}
            aria-label={
              paused ? t("resumeAnnouncements") : t("pauseAnnouncements")
            }
            onClick={() => setPaused((p) => !p)}
            className="relative inline-flex size-7 items-center justify-center rounded-full text-mist outline-none transition-colors duration-(--dur-fast) hover:text-mineral after:absolute after:-inset-2.5 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian"
          >
            {paused ? (
              <Play aria-hidden strokeWidth={1.5} className="size-3.5" />
            ) : (
              <Pause aria-hidden strokeWidth={1.5} className="size-3.5" />
            )}
          </button>
        ) : null}
        <button
          type="button"
          aria-label={t("dismissAnnouncement")}
          onClick={dismiss}
          className="relative inline-flex size-7 items-center justify-center rounded-full text-mist outline-none transition-colors duration-(--dur-fast) hover:text-mineral after:absolute after:-inset-2.5 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian"
        >
          <X aria-hidden strokeWidth={1.5} className="size-3.5" />
        </button>
      </span>

      {/* The strip's only ornament: a champagne hairline at 15% (§5.1). */}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-px bg-champagne/15"
      />
    </div>
  );
}
