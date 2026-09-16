import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  PRODUCT_SIZE_TIERS,
  SIZE_TIER_NAME,
  type ProductSizeTier,
} from "@/lib/product-size-tier";
import { suggestCatalogSizeTier } from "@/lib/catalog-size-tier";

/**
 * The write side of `catalog-size-tier.ts`: file the untiered backlog by
 * rule, in two steps that can be shown to a person between them.
 *
 * WHICH rows, exactly:
 *
 * - `sizeTier` is null — a tier already set, by anyone, is never changed.
 * - `ownerTouched` is false — a row a person has edited in the Studio is a
 *   row a person is curating; its tier is theirs to set (the "No tier yet"
 *   filter and bulk **Set product tier** exist for exactly that), and a
 *   rule that overrode that judgement on the next deploy would be the
 *   importer overwriting an owner edit, which `merge-policy.ts` forbids for
 *   content and this module forbids for the tier.
 * - `isDemo` is false — the Content Lab fixtures carry their own tiers.
 *
 * Two callers: `prisma/suggest-size-tiers.ts` on every production and local
 * deploy (so rows the CSV fill creates are filed in the same deploy that
 * created them), and the Studio's **Suggest tiers** action, which shows the
 * plan first. Both take a PrismaClient rather than importing `db`, so the
 * bootstrap script — which constructs its own client — and the db test can
 * drive them.
 */

export const SIZE_TIER_SUGGEST_ACTION = "size-tier-suggest";

export type SizeTierBackfillPlan = {
  /** Untiered, un-edited, non-demo rows read. */
  scanned: number;
  /** Product ids to file, per tier. */
  ids: Record<ProductSizeTier, string[]>;
  /** Up to `SAMPLE_TAKE` titles per tier, for the person looking at the plan. */
  samples: Record<ProductSizeTier, string[]>;
  /** Rows left untiered, by the reason. */
  skipped: { supplies: number; unsure: number };
};

export type SizeTierBackfillSummary = {
  total: number;
  byTier: Record<ProductSizeTier, number>;
};

const SAMPLE_TAKE = 6;
const PAGE = 1000;
const WRITE_CHUNK = 500;

const emptyByTier = <T>(make: () => T): Record<ProductSizeTier, T> =>
  Object.fromEntries(
    PRODUCT_SIZE_TIERS.map((tier) => [tier, make()]),
  ) as Record<ProductSizeTier, T>;

/**
 * Read the backlog and decide every row, writing nothing. `where` narrows
 * the scan (the db test scopes it to its own rows); the callers that file
 * the real catalogue pass nothing.
 */
export async function planSizeTierBackfill(
  db: PrismaClient,
  where: Prisma.ProductWhereInput = {},
): Promise<SizeTierBackfillPlan> {
  const plan: SizeTierBackfillPlan = {
    scanned: 0,
    ids: emptyByTier(() => []),
    samples: emptyByTier(() => []),
    skipped: { supplies: 0, unsure: 0 },
  };
  let cursor: string | undefined;
  for (;;) {
    const rows = await db.product.findMany({
      where: { ...where, sizeTier: null, ownerTouched: false, isDemo: false },
      select: {
        id: true,
        title: true,
        description: true,
        dimensions: true,
        category: { select: { slug: true, name: true } },
      },
      orderBy: { id: "asc" },
      take: PAGE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;
    for (const row of rows) {
      plan.scanned += 1;
      const suggestion = suggestCatalogSizeTier({
        title: row.title,
        description: row.description,
        dimensions: row.dimensions,
        categorySlug: row.category?.slug ?? null,
        categoryName: row.category?.name ?? null,
      });
      if (suggestion.tier) {
        plan.ids[suggestion.tier].push(row.id);
        if (plan.samples[suggestion.tier].length < SAMPLE_TAKE)
          plan.samples[suggestion.tier].push(row.title);
      } else if (
        suggestion.reason === "supply-category" ||
        suggestion.reason === "supply-title"
      ) {
        plan.skipped.supplies += 1;
      } else {
        plan.skipped.unsure += 1;
      }
    }
    if (rows.length < PAGE) break;
    cursor = rows[rows.length - 1]!.id;
  }
  return plan;
}

/** The counts a person reads before saying yes. */
export function summarizeSizeTierPlan(
  plan: SizeTierBackfillPlan,
): SizeTierBackfillSummary {
  const byTier = emptyByTier(() => 0);
  let total = 0;
  for (const tier of PRODUCT_SIZE_TIERS) {
    byTier[tier] = plan.ids[tier].length;
    total += byTier[tier];
  }
  return { total, byTier };
}

/** "41 Collectible Furniture & Spatial Art · 226 Memory & Celebration Art · …" */
export function describeSizeTierCounts(
  byTier: Record<ProductSizeTier, number>,
): string {
  return PRODUCT_SIZE_TIERS.filter((tier) => byTier[tier] > 0)
    .map((tier) => `${byTier[tier]} ${SIZE_TIER_NAME[tier]}`)
    .join(" · ");
}

/**
 * File the plan. Each write re-checks `sizeTier IS NULL`, so a row the
 * owner tiered between the plan and the apply keeps the owner's tier, and
 * the count returned is what actually changed. One ActivityLog row records
 * the run — the audit trail for a write no person made row by row.
 */
export async function applySizeTierBackfill(
  db: PrismaClient,
  plan: SizeTierBackfillPlan,
  options: { actorId?: string | null; source: string },
): Promise<{ total: number; updated: Record<ProductSizeTier, number> }> {
  const updated = emptyByTier(() => 0);
  let total = 0;
  for (const tier of PRODUCT_SIZE_TIERS) {
    const ids = plan.ids[tier];
    for (let start = 0; start < ids.length; start += WRITE_CHUNK) {
      const { count } = await db.product.updateMany({
        where: {
          id: { in: ids.slice(start, start + WRITE_CHUNK) },
          sizeTier: null,
        },
        data: { sizeTier: tier },
      });
      updated[tier] += count;
      total += count;
    }
  }
  if (total > 0) {
    try {
      await db.activityLog.create({
        data: {
          userId: options.actorId ?? null,
          action: SIZE_TIER_SUGGEST_ACTION,
          entity: "Product",
          entityId: null,
          meta: {
            source: options.source,
            total,
            updated,
            scanned: plan.scanned,
            skipped: plan.skipped,
          },
        },
      });
    } catch (error) {
      // Logging must never break the write it describes (activity.ts's rule).
      console.error("size-tier-suggest: ActivityLog write failed:", error);
    }
  }
  return { total, updated };
}
