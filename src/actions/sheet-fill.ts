"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  requireStaff,
  revalidatePublic,
  runAction,
  type ActionResult,
} from "@/actions/helpers";
import { SHEET_CONFLICT_STATUS } from "@/lib/sheet-status";
import { logActivity, snapshotBefore } from "@/lib/activity";
import { db } from "@/lib/db";
import {
  DEFAULT_FILL_POLICY,
  decideFillRun,
  type FillPolicy,
} from "@/lib/import/fill-policy";
import { runTierFill, type TierFillResult } from "@/lib/import/tier-fill";

const SHEET_IMPORT_PATH = "/studio/sheet-import";
const CONFLICTS_PATH = "/studio/sheet-import/conflicts";

/**
 * The owner's current fill policy — the same settings row
 * `prisma/import-tiers.ts` reads at deploy time, loaded here so the studio's
 * Preview and Run now buttons honour the identical switches rather than a
 * second copy of the defaults.
 */
async function loadPolicy(): Promise<FillPolicy> {
  const settings = await db.siteSettings.findUnique({
    where: { id: "main" },
    select: {
      catalogFillEnabled: true,
      catalogFillOnDeploy: true,
      catalogFillMaxCreates: true,
    },
  });
  return settings
    ? {
        enabled: settings.catalogFillEnabled,
        onDeploy: settings.catalogFillOnDeploy,
        maxCreates: settings.catalogFillMaxCreates,
      }
    : DEFAULT_FILL_POLICY;
}

/**
 * Dry-run the four-tier fill: every read and decision a real run makes,
 * nothing written. Always allowed regardless of the master switch — refusing
 * to even show what a fill WOULD do is how a switch becomes a thing nobody
 * dares touch (`decideFillRun`'s own contract for the PREVIEW trigger).
 */
export async function previewSheetFill(): Promise<
  ActionResult<TierFillResult>
> {
  return runAction(async () => {
    await requireStaff();
    const policy = await loadPolicy();
    return runTierFill({ trigger: "PREVIEW", dryRun: true, policy, db });
  });
}

/**
 * Run the fill now, from the studio, rather than waiting for the next
 * deploy. Blocked only by the master switch (`catalogFillEnabled`) — MANUAL
 * bypasses "fill on deploy" the same way pressing this button implies: the
 * operator is asking for it right now, not waiting on the next release.
 */
export async function runSheetFillNow(): Promise<ActionResult<TierFillResult>> {
  return runAction(async () => {
    const session = await requireStaff();
    const policy = await loadPolicy();
    const gate = decideFillRun("MANUAL", policy);
    if (!gate.run) throw new Error(gate.reason);

    const result = await runTierFill({ trigger: "MANUAL", policy, db });
    if (result.aborted) throw new Error(result.aborted.reason);

    await logActivity({
      userId: session.user.id,
      action: "sheet-fill-manual",
      entity: "Product",
      meta: {
        totals: result.totals,
        conflictsWritten: result.conflictsWritten,
        dropped: result.dropped.length,
      },
    });
    revalidatePath(SHEET_IMPORT_PATH);
    revalidatePath("/studio/products");
    revalidatePublic("product");
    return result;
  });
}

// ————————————————————— Conflicts —————————————————————

const CONFLICT_CHOICES = ["keep-mine", "take-sheet", "skip"] as const;
type ConflictChoice = (typeof CONFLICT_CHOICES)[number];

const resolveSchema = z.object({
  id: z.string().min(1),
  choice: z.enum(CONFLICT_CHOICES),
});

/** Coerce a ImportConflict's serialized `importedValue` back to the Product
 *  column's real type — the run that wrote it stored every field as a
 *  string (a conflict row has no per-field schema of its own). */
function coerceConflictValue(field: string, raw: string | null): unknown {
  if (raw === null) return null;
  if (field === "priceMin" || field === "priceMax") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (field === "inStock") return raw === "true";
  return raw;
}

/**
 * Resolve one field-level sheet/studio conflict.
 *
 *   keep mine   — the database keeps what it has; nothing is written.
 *   take sheet  — the sheet's value overwrites that ONE field, and
 *                 studioEditedAt is bumped so the next fill sees this as a
 *                 fresh studio decision, not a stale one it already knows.
 *   skip        — same as keep mine (nothing written), recorded separately
 *                 so the activity log shows a deliberate "not now" rather
 *                 than an explicit "keep my version".
 *
 * Every choice logs activity with a before-snapshot of the touched field,
 * and only an OPEN conflict may be resolved — the row is the record of a
 * decision, not a button that can be pressed twice.
 */
export async function resolveImportConflict(
  id: string,
  choice: ConflictChoice,
): Promise<ActionResult<void>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = resolveSchema.parse({ id, choice });

    const conflict = await db.importConflict.findUnique({
      where: { id: parsed.id },
    });
    if (!conflict) throw new Error("That conflict no longer exists.");
    if (conflict.status !== SHEET_CONFLICT_STATUS.OPEN) {
      throw new Error("This conflict was already resolved.");
    }

    const product = await db.product.findUnique({
      where: { id: conflict.productId },
    });
    if (!product) throw new Error("That product no longer exists.");

    const field = conflict.field as keyof typeof product;
    const before = snapshotBefore(product, [field]);

    if (parsed.choice === "take-sheet") {
      const value = coerceConflictValue(conflict.field, conflict.importedValue);
      await db.product.update({
        where: { id: conflict.productId },
        data: { [conflict.field]: value, studioEditedAt: new Date() },
      });
    }

    await logActivity({
      userId: session.user.id,
      action: `sheet-conflict-${parsed.choice}`,
      entity: "Product",
      entityId: conflict.productId,
      meta: { field: conflict.field, before },
    });

    await db.importConflict.update({
      where: { id: parsed.id },
      data: {
        status: SHEET_CONFLICT_STATUS.RESOLVED,
        resolvedAt: new Date(),
        resolvedById: session.user.id,
      },
    });

    revalidatePath(CONFLICTS_PATH);
    if (parsed.choice === "take-sheet") revalidatePublic("product");
    return undefined;
  });
}

const bulkResolveSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one conflict."),
  choice: z.enum(["keep-mine", "skip"]),
});

/**
 * Bulk-resolve OPEN conflicts as "keep mine" or "skip" — the two choices
 * that write nothing to the product, so applying them to many rows at once
 * carries none of "take sheet"'s per-row risk. "Take sheet" stays a
 * one-at-a-time decision, made with the field's two values in view.
 */
export async function bulkResolveImportConflicts(
  ids: string[],
  choice: "keep-mine" | "skip",
): Promise<ActionResult<{ resolved: number }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = bulkResolveSchema.parse({ ids, choice });

    const res = await db.importConflict.updateMany({
      where: { id: { in: parsed.ids }, status: SHEET_CONFLICT_STATUS.OPEN },
      data: {
        status: SHEET_CONFLICT_STATUS.RESOLVED,
        resolvedAt: new Date(),
        resolvedById: session.user.id,
      },
    });

    await logActivity({
      userId: session.user.id,
      action: `sheet-conflict-${parsed.choice}`,
      entity: "Product",
      meta: { count: res.count, bulk: true },
    });
    revalidatePath(CONFLICTS_PATH);
    return { resolved: res.count };
  });
}
