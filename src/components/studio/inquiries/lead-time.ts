/**
 * Rivya Living Art's published lead times, and the stage-timer maths built on them.
 *
 * REDESIGN.md §12.4 asks the Kanban card for a "stage timer badge — a circular
 * progress ring using Rivya Living Art's ACTUAL cure times (`Layer 2 · 48 of 72 h`),
 * not an invented 14-day schedule", and decision #5 in the spec's own log
 * settles the numbers: **24–72 h per layer, 7–10 days for small pieces, 3–6
 * weeks for statement pieces.**
 *
 * What the schema does not have is any per-layer or per-cure tracking: an
 * `Inquiry` carries `createdAt`, a `status` and a customer-typed `timeline`
 * string, and nothing else about the bench. So the ring cannot say
 * "Layer 2 · 48 of 72 h" without making it up. What it CAN say truthfully is
 * how long this commission has been in the pipeline, read against the two
 * published bands — which is the same question the spec's badge answers, asked
 * of data that exists.
 *
 * Pure module (no React, no Prisma) so the unit suite can reach it.
 */

/** Small pieces: 7–10 days, per the live site. */
export const SMALL_PIECE_DAYS = 10;
/** Statement pieces: 3–6 weeks, per the live site. */
export const STATEMENT_PIECE_DAYS = 42;

export type LeadTimeBand = "within" | "beyond-small" | "beyond-statement";

export type StageTimer = {
  /** Whole days since the inquiry landed. */
  days: number;
  band: LeadTimeBand;
  /** 0–1, days against the statement-piece ceiling. Clamped. */
  progress: number;
  /** Short mono chip, e.g. "7–10 d band". */
  bandLabel: string;
  /** Full sentence for the accessible name / title. */
  description: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Days in pipeline for one commission, read against the published bands.
 * `now` is injectable so the unit suite is not clock-dependent.
 */
export function stageTimer(
  createdAt: Date,
  now: number = Date.now(),
): StageTimer {
  const days = Math.max(0, Math.floor((now - createdAt.getTime()) / DAY_MS));

  const band: LeadTimeBand =
    days <= SMALL_PIECE_DAYS
      ? "within"
      : days <= STATEMENT_PIECE_DAYS
        ? "beyond-small"
        : "beyond-statement";

  const bandLabel =
    band === "within"
      ? "7–10 d band"
      : band === "beyond-small"
        ? "past 7–10 d"
        : "past 3–6 wk";

  const dayWord = days === 1 ? "day" : "days";
  const description =
    band === "within"
      ? `${days} ${dayWord} in the pipeline — inside the 7–10 day band for a small piece.`
      : band === "beyond-small"
        ? `${days} ${dayWord} in the pipeline — past the 7–10 day small-piece band, inside the 3–6 week statement-piece band.`
        : `${days} ${dayWord} in the pipeline — past the 3–6 week statement-piece band.`;

  return {
    days,
    band,
    progress: Math.min(1, days / STATEMENT_PIECE_DAYS),
    bandLabel,
    description,
  };
}

/**
 * §12.4 asks the card for a `priority`. There is no priority column on
 * `Inquiry`, and inventing one would be exactly the fabrication decision #5
 * rules out — so priority is DERIVED from the same real quantity the ring
 * draws: how far past the published lead time this commission has drifted.
 * The label says what it means, so nobody reads it as a field the owner set.
 */
export function priorityFromBand(band: LeadTimeBand): {
  label: string;
  tone: "flat" | "warning" | "alert";
} {
  if (band === "within") return { label: "On track", tone: "flat" };
  if (band === "beyond-small")
    return { label: "Running long", tone: "warning" };
  return { label: "Overdue", tone: "alert" };
}
