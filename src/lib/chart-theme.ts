/**
 * THE CHART VOCABULARY — one copy, for every chart in the Studio.
 *
 * There is exactly one chart today (`studio/dashboard/inquiries-chart.tsx`)
 * and it was already correct on the dark ground. This module exists because
 * the SECOND one is the problem: a chart is the one surface where a developer
 * reaches for a colour rather than a token — recharts takes `stroke` and
 * `fill` as plain strings, so `stroke="#3b82f6"` type-checks, renders, and is
 * invisible to `redesign-audit.mjs` (which reads the DOM, where an inline SVG
 * attribute is not a class it can judge) and to the repo's "no raw hex in
 * components" rule (which is prose). CLAUDE.md records the same failure with
 * the scrape-tier labels, where the FIFTH hand-written copy is what shipped
 * three tiers invisible.
 *
 * So: every colour a chart uses is named here, every name resolves to a token
 * from `tokens.css`, and `chart-theme.test.ts` pins both halves — the values
 * are all `var(--…)` references, and the chart component declares none of its
 * own.
 *
 * ## WHY THESE TOKENS AND NOT OTHERS (D30's ground)
 *
 * - `--sapphire-ink`, never raw `--sapphire`. On the Studio's obsidian panel
 *   raw sapphire is 2.2:1; `--sapphire-ink` is the lifted companion that
 *   exists for exactly this (CLAUDE.md, the palette note). A series line is
 *   information, so it has to be readable, not merely present.
 * - `--border` for the grid and the tooltip cursor, which is the same
 *   hairline every panel edge in the Studio uses. A gridline heavier than the
 *   panel it sits in reads as a table.
 * - `--graphite` for the axes: secondary text, because that is what an axis
 *   label is.
 * - `--surface` for the ring around an active point — the point has to be
 *   legible ON the panel, so it is cut out of the panel's own ground rather
 *   than outlined in a colour.
 *
 * ## WHAT IS DELIBERATELY NOT HERE
 *
 * **A categorical palette.** Nothing in this Studio plots more than one
 * series, and a five-colour scale invented ahead of its first use is five
 * colours nobody has checked against the obsidian ground or against each
 * other for colour-blind separation. When a second series exists, it gets a
 * second entry here — chosen against the real chart, and against §16's rule
 * that state is never carried by colour alone.
 */

/** Every ink a chart may use, as token references. */
export const CHART_INK = {
  /** The single data series — line, fill gradient and active point. */
  series: "var(--sapphire-ink)",
  /** Gridlines and the tooltip's hover cursor. */
  grid: "var(--border)",
  /** Axis ticks. */
  axis: "var(--graphite)",
  /** The panel ground an active point is cut out of. */
  surface: "var(--surface)",
} as const;

/** Axis tick type — 12px, the Studio's dense size, in the secondary ink. */
export const CHART_AXIS_TICK = {
  fontSize: 12,
  fill: CHART_INK.axis,
} as const;

/**
 * The area gradient: the series colour at 24% under the line, fading to
 * nothing at the baseline. 24% is the highest opacity that still lets a
 * gridline read through it on `--elev-1`.
 */
export const CHART_AREA_GRADIENT = [
  { offset: "0%", opacity: 0.24 },
  { offset: "100%", opacity: 0 },
] as const;
