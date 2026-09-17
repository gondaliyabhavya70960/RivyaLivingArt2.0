import { Instrument_Serif, Inter, JetBrains_Mono } from "next/font/google";

/**
 * Brand fonts (Latin) — the v3 "Liquid Luxury" trio, Master Redesign
 * Specification Part 3.2 / decisions log #3:
 *
 *   Display  Instrument Serif  hero, section headings, pull-quotes
 *   Body     Inter             navigation, product info, buttons, forms
 *   Numeric  JetBrains Mono    every price, count, date, dimension, cure
 *                              time, timer, spec value and eyebrow label
 *
 * The third face is the point of the pairing: with prices, lead times and
 * project numbers moved out of the body face they finally read as *data*.
 * Every numeric element pairs the face with `font-variant-numeric:
 * tabular-nums` (the `.u-num` utility in globals.css).
 *
 * Display and body preload — the full-svh heroes set the site's largest
 * headline in Instrument Serif and the lead paragraph in Inter above the
 * fold, so a late download is a guaranteed visible swap on the signature
 * screen. The mono face stays lazy: its first use (the hero fact row aside,
 * which is small enough to swap invisibly) is metadata, never the LCP.
 *
 * Per-script Noto SANS faces live in fonts-scripts.ts (imported only by the
 * [locale] layout).
 */
export const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  // *-face suffix: the bare `--font-display` name is reserved for the
  // composed stack in globals.css, so the two can never self-reference.
  variable: "--font-display-face",
  display: "swap",
  preload: true,
});

/**
 * The display face's ITALIC, as its own instance — F4.
 *
 * Instrument Serif ships one (next's own font table lists both styles for
 * the family), but `next/font` only falls back to a family's single
 * available style when there IS exactly one: with two it hard-defaults to
 * `normal`. The declaration above passes no `style`, so every `italic` class
 * on a display element — there is one today, the featured rail's end link —
 * has been painting a SYNTHESISED oblique of the upright face, not the
 * drawn italic. Nothing looked broken, which is why it survived.
 *
 * `preload: false` and a separate variable rather than `style: ["normal",
 * "italic"]` on the one above: next/font preloads every style a declaration
 * carries, and Part 3's accent is "once per headline, max" — a face that
 * rare must not join the two that hold the LCP.
 */
export const instrumentSerifItalic = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  variable: "--font-display-italic-face",
  display: "swap",
  preload: false,
});

export const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body-face",
  display: "swap",
  preload: true,
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-face",
  display: "swap",
  preload: false,
});
