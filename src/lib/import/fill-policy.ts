/**
 * Whether the sheet → catalog fill may run, and whether it may write.
 *
 * The fill is not new — `prisma/import-tiers.ts` has run on every deploy since
 * it was written. What is new is that the owner governs it. So every default
 * here reproduces the old behaviour exactly: an environment that never opens
 * the settings screen keeps self-populating from the sheet on first boot,
 * which is the entire reason the importer sits in bootstrap.
 *
 * Pure module — no database, no filesystem — because these two decisions are
 * the whole feature and the script they run inside needs a real deploy before
 * it will reach them.
 */

export type FillPolicy = {
  enabled: boolean;
  onDeploy: boolean;
  maxCreates: number | null;
};

/** Missing settings row = a brand-new environment. It fills. */
export const DEFAULT_FILL_POLICY: FillPolicy = {
  enabled: true,
  onDeploy: true,
  maxCreates: null,
};

export type FillTrigger = "DEPLOY" | "MANUAL" | "PREVIEW";

export type FillDecision =
  | { run: true }
  | { run: false; reason: string };

/**
 * May this trigger start a fill at all?
 *
 * A PREVIEW is always allowed: it writes nothing, and refusing to even show
 * the owner what WOULD happen is how a switch becomes a thing people are
 * afraid to touch.
 */
export function decideFillRun(
  trigger: FillTrigger,
  policy: FillPolicy,
): FillDecision {
  if (trigger === "PREVIEW") return { run: true };
  if (!policy.enabled) {
    return { run: false, reason: "Automatic fill is switched off in Settings." };
  }
  if (trigger === "DEPLOY" && !policy.onDeploy) {
    return {
      run: false,
      reason: "Fill on deploy is switched off — run it from the studio instead.",
    };
  }
  return { run: true };
}

/**
 * The blast radius guard, checked after the run knows how many products it
 * would CREATE and before it writes any of them.
 *
 * Creates are the dangerous direction. A mis-sorted sheet, a re-keyed export
 * or a changed id column turns an ordinary sync into thousands of inserts,
 * and the catalog is a storefront. Updates are far safer: `ownerTouched`
 * already holds back anything a human edited.
 */
export function decideFillWrite(
  plannedCreates: number,
  policy: FillPolicy,
): FillDecision {
  if (policy.maxCreates === null) return { run: true };
  if (plannedCreates > policy.maxCreates) {
    return {
      run: false,
      reason: `Would create ${plannedCreates} products, over the limit of ${policy.maxCreates}. Nothing was written — raise the limit in Settings if this is expected.`,
    };
  }
  return { run: true };
}
