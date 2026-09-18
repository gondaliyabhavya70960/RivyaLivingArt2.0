"use client";

import { useEffect, useState } from "react";

/**
 * §2.10 · the 429's mono countdown. The only content on that page, because the
 * one thing a throttled visitor must not be handed is a button that makes
 * another request.
 *
 * Three decisions in eleven lines of logic:
 *
 * **It counts DOWN from a server-supplied number, and never asks for a new
 * one.** A countdown that polls to find out whether it may stop counting is
 * the request the page exists to prevent.
 *
 * **It is a live region, politely.** `aria-live="polite"` with
 * `aria-atomic` on the wrapper, so a screen-reader user hears the remaining
 * time — but the announced value is the MINUTE, not the second. A per-second
 * live region reads a new number aloud sixty times a minute and makes the page
 * unusable for the person it was added for; the visible timer still ticks
 * every second, and only what is announced is coarse. (The same split as the
 * scroll hairline's throttled `aria-valuenow`.)
 *
 * **It renders the full duration during SSR and on the first paint.** No
 * `suppressHydrationWarning`, no null: the server and the first client render
 * agree because both use `seconds` unchanged, and the ticking starts in the
 * effect. A visitor with JS disabled sees the starting figure, which is still
 * true and still useful.
 */
export function RetryCountdown({
  seconds,
  label,
  readyLabel,
}: {
  seconds: number;
  label: string;
  readyLabel: string;
}) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (seconds <= 0) return;
    // A DEADLINE, not a decrement. Two reasons, and the first is the one that
    // shows up in use: `setInterval` is not a clock — a backgrounded tab
    // throttles it to once a minute and a sleeping laptop stops it entirely,
    // so counting down by one per tick drifts long and can report "4 minutes
    // left" after twenty have passed. Reading the wall clock each tick means
    // the timer is correct the moment the tab is looked at again.
    //
    // The second: the rule this repo lints for. `setLeft(seconds)` at the top
    // of an effect body is a synchronous setState in an effect
    // (`react-hooks/set-state-in-effect`), and the honest fix is not to
    // silence it but to stop needing it — `useState(seconds)` already seeds
    // the first render, and every update after that comes from the interval
    // CALLBACK, which is exactly the "subscribe to an external system" shape
    // the rule is asking for. The external system here is the clock.
    const deadline = Date.now() + seconds * 1000;
    const id = window.setInterval(() => {
      setLeft(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [seconds]);

  const mm = Math.floor(left / 60);
  const ss = left % 60;
  const display = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-3">
      <p className="u-micro">{label}</p>
      {/* The visible timer ticks every second and is hidden from assistive
          tech; the sr-only line beside it is what is actually announced, and
          it only changes once a minute. */}
      <p
        aria-hidden
        className="u-num font-mono text-49 leading-none text-champagne"
      >
        {display}
      </p>
      <p aria-live="polite" aria-atomic className="sr-only">
        {left <= 0
          ? readyLabel
          : `${label} ${mm} ${mm === 1 ? "minute" : "minutes"}`}
      </p>
      {left <= 0 ? (
        <p className="font-body text-body text-mineral">{readyLabel}</p>
      ) : null}
    </div>
  );
}
