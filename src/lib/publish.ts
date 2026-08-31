import type { CopySlot } from "@/lib/site-copy";
import { describeCopyProblem } from "@/lib/site-copy";
import type { SiteImageSlot } from "@/lib/site-images";

/**
 * The publish checklist — what stops a surface going live, and what merely
 * warns.
 *
 * Split deliberately. A gate that blocks on everything gets worked around: the
 * owner finds the one field that will not validate, gives up on the review
 * step, and starts publishing past it. So only things a VISITOR would
 * experience as broken block; everything else is advice the owner can take or
 * leave.
 *
 * Pure functions over already-resolved rows, so the unit suite covers the
 * rules themselves rather than a database round-trip.
 */

export type PublishIssue = {
  /** What the owner has to go and fix, in their words. */
  message: string;
  /** Where to fix it — the label they will recognise on the board. */
  where: string;
};

export type PublishReport = {
  blocking: PublishIssue[];
  warnings: PublishIssue[];
  /** How many staged changes are waiting, for the confirm button's label. */
  counts: { copy: number; images: number };
};

export type StagedCopy = {
  slot: CopySlot;
  locale: string;
  /** What is staged. */
  value: string;
};

export type StagedImage = {
  slot: SiteImageSlot;
  /** The staged URL, or the published one when only the crop changed. */
  url: string;
  /** The alt text this slot will have AFTER publishing, resolved. */
  alt: string | null;
};

/**
 * Build the report for one surface.
 *
 * @param altIsEmptyFor a slot whose `altKey` resolves to nothing after publish.
 *   Passed in rather than looked up, so this stays pure.
 */
export function buildPublishReport(
  copy: readonly StagedCopy[],
  images: readonly StagedImage[],
): PublishReport {
  const blocking: PublishIssue[] = [];
  const warnings: PublishIssue[] = [];

  for (const entry of copy) {
    // Re-run the save-time check. A row can have been staged before a slot
    // gained an ICU placeholder, or edited straight in the database.
    const problem = describeCopyProblem(entry.slot, entry.value);
    if (problem) {
      blocking.push({
        message: problem,
        where: `${entry.slot.label} (${entry.locale})`,
      });
      continue;
    }

    // The character budget is design guidance and some languages genuinely
    // need more room, so going over is advice, not a gate.
    if (entry.slot.max && entry.value.length > entry.slot.max) {
      warnings.push({
        message: `${entry.value.length} characters against about ${entry.slot.max} — it may wrap badly on a phone.`,
        where: `${entry.slot.label} (${entry.locale})`,
      });
    }
  }

  for (const entry of images) {
    // A picture that carries meaning and describes itself to nobody is the one
    // image failure a visitor experiences as broken, and the one the a11y
    // audit fails on. Decorative slots have no altKey and are skipped.
    if (entry.slot.altKey && !entry.alt?.trim()) {
      blocking.push({
        message:
          "This picture has no description, so screen readers get nothing. Add one beside the image.",
        where: entry.slot.label,
      });
    }
  }

  return {
    blocking,
    warnings,
    counts: { copy: copy.length, images: images.length },
  };
}

/**
 * One line naming what a publish changed, for the revision history.
 *
 * Names the fields with their registry labels rather than their keys: a
 * history that reads "Hero headline, Hero image, 3 more" is usable, and one
 * that reads "Home.hero.headline" is a diff nobody opens twice.
 */
export function summarisePublish(
  copy: readonly StagedCopy[],
  images: readonly StagedImage[],
): string {
  const names = [
    ...copy.map((c) => c.slot.label),
    ...images.map((i) => i.slot.label),
  ];
  const unique = [...new Set(names)];
  if (unique.length === 0) return "No changes";
  if (unique.length <= 3) return unique.join(", ");
  return `${unique.slice(0, 3).join(", ")}, ${unique.length - 3} more`;
}
