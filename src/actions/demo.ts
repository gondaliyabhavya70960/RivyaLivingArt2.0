"use server";

import { revalidateTag } from "next/cache";

import {
  requireStaff,
  revalidatePublic,
  runAction,
  type ActionResult,
} from "@/actions/helpers";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import {
  demoCounts,
  removeDemo,
  seedDemo,
  type DemoCounts,
} from "@/lib/demo/apply";
import {
  DEMO_ENTITY_LABELS,
  describeSelectionProblem,
  removeDemoSelection,
  type DemoEntity,
  type DemoRemovalReport,
  type DemoSelection,
} from "@/lib/demo/selective";
import { findMediaUsageDetails } from "@/lib/media-usages";
import { describeDemoHost } from "@/lib/demo/guard";
import { SITE_SETTINGS_TAG } from "@/lib/site-settings";
import { Role, type Prisma } from "@/generated/prisma/client";

const REMOVE_CONFIRMATION = "REMOVE DEMO DATA";

export type DemoContentStatus = {
  demoContentPublic: boolean;
  host: string;
  allowed: boolean;
  production: boolean;
};

/**
 * Current public-visibility switch plus the host guard's read of this
 * database — used by the Settings screen's standalone toggle, which has no
 * server-rendered parent of its own to read the row for it.
 */
export async function getDemoContentStatus(): Promise<
  ActionResult<DemoContentStatus>
> {
  await requireStaff([Role.ADMIN]);
  return runAction(async () => {
    const settings = await db.siteSettings.findUnique({
      where: { id: "main" },
      select: { demoContentPublic: true },
    });
    const { host, allowed, production } = describeDemoHost(
      process.env.DATABASE_URL,
    );
    return {
      demoContentPublic: settings?.demoContentPublic ?? false,
      host,
      allowed,
      production,
    };
  });
}

/**
 * Load every Content Lab fixture into the database (ADMIN only).
 *
 * Refuses on a database that looks like production, exactly like the CLI —
 * a Server Action is a public POST endpoint that anyone with a staff cookie
 * can trigger, so the same host guard has to run here too, not only at the
 * command line.
 */
export async function seedDemoData(): Promise<ActionResult<DemoCounts>> {
  const session = await requireStaff([Role.ADMIN]);
  const { production, host } = describeDemoHost(process.env.DATABASE_URL);
  if (production) {
    return {
      ok: false,
      error: `Refused: ${host} looks like the production database. Content Lab fixtures can only be seeded from the command line with an explicit override.`,
    };
  }
  return runAction(async () => {
    const counts = await seedDemo(db);
    await logActivity({
      userId: session.user.id,
      action: "seed",
      entity: "demo",
      meta: { counts: counts as unknown as Record<string, unknown> },
    });
    revalidatePublic("product");
    revalidatePublic("category");
    revalidatePublic("blogPost");
    revalidatePublic("portfolio");
    revalidatePublic("faq");
    revalidatePublic("testimonial");
    revalidatePublic("customPage");
    return counts;
  });
}

/**
 * Delete every demo row (ADMIN only). Requires the operator to type the
 * confirmation phrase verbatim — the same typed-confirm pattern as every
 * other irreversible bulk action in the Studio (`PromptDialog`), because
 * this removes 400+ rows across eleven tables in one call.
 */
export async function removeDemoData(
  confirmation: string,
): Promise<ActionResult<DemoCounts>> {
  const session = await requireStaff([Role.ADMIN]);
  if (confirmation !== REMOVE_CONFIRMATION) {
    return { ok: false, error: `Type "${REMOVE_CONFIRMATION}" to confirm.` };
  }
  return runAction(async () => {
    const counts = await removeDemo(db);
    await logActivity({
      userId: session.user.id,
      action: "remove",
      entity: "demo",
      meta: { remaining: counts as unknown as Record<string, unknown> },
    });
    revalidatePublic("product");
    revalidatePublic("category");
    revalidatePublic("blogPost");
    revalidatePublic("portfolio");
    revalidatePublic("faq");
    revalidatePublic("testimonial");
    revalidatePublic("customPage");
    return counts;
  });
}

/**
 * The owner's public-visibility switch (ADMIN only — the same gate as
 * Settings). Turning this on in production is the only way demo fixtures
 * ever reach a visitor there, and it is always a deliberate act on this
 * screen — `showDemoContent()` (`src/lib/demo-content.ts`) never defaults it
 * on.
 */
export async function setDemoContentPublic(
  value: boolean,
): Promise<ActionResult> {
  const session = await requireStaff([Role.ADMIN]);
  return runAction(async () => {
    await db.siteSettings.upsert({
      where: { id: "main" },
      create: { id: "main", demoContentPublic: value },
      update: { demoContentPublic: value },
    });
    await logActivity({
      userId: session.user.id,
      action: "update",
      entity: "SiteSettings",
      entityId: "main",
      meta: { demoContentPublic: value },
    });
    // Settings are read through a tagged, cached loader — bust the tag so
    // the switch reaches every public page immediately rather than after
    // the cache's TTL.
    revalidateTag(SITE_SETTINGS_TAG, "max");
    // Every reader that gates on the demo clause needs to re-render: a demo
    // product/post/case/testimonial/faq/lander that was hidden a moment ago
    // may now be visible, and vice versa.
    revalidatePublic("product");
    revalidatePublic("category");
    revalidatePublic("blogPost");
    revalidatePublic("portfolio");
    revalidatePublic("faq");
    revalidatePublic("testimonial");
    revalidatePublic("customPage");
    return undefined;
  });
}

/* ————————————————————————————————————————————————————————————————————————
   Demo Data Manager — the scoped half of Content Lab.

   `removeDemoData` above is all-or-nothing. These two add the thing the owner
   asked for: see what demo data exists per content type, tick what should go,
   and be told exactly what happened — including what was PROTECTED rather
   than deleted. The rules live in `@/lib/demo/selective`; this file is the
   authorisation boundary and the activity record.
   ———————————————————————————————————————————————————————————————————————— */

export type DemoInventoryRow = { id: string; label: string; meta: string };

export type DemoInventoryEntity = {
  entity: DemoEntity;
  label: string;
  count: number;
  rows: DemoInventoryRow[];
  /** True when `count` exceeds what the screen was given to tick. */
  truncated: boolean;
};

/** How many rows per content type the manager lists for individual ticking. */
const INVENTORY_PAGE = 100;

/**
 * Every demo row, per content type, with a human label for each.
 *
 * Capped at 100 rows per type and `truncated` says so — a seeded database
 * holds 4,000+ demo products, and shipping all of them into a checkbox list
 * would make the screen that manages the data heavier than the data. Clearing
 * a whole type does not need the list, which is the path that scale wants.
 */
export async function getDemoInventory(): Promise<
  ActionResult<DemoInventoryEntity[]>
> {
  await requireStaff([Role.ADMIN]);
  return runAction(async () => {
    const where = { isDemo: true } as const;
    const take = INVENTORY_PAGE;
    const [
      counts,
      blogCategories,
      blogPosts,
      media,
      products,
      portfolio,
      testimonials,
      faqs,
      customPages,
      inquiries,
      research,
      scrapeJobs,
      importRuns,
    ] = await Promise.all([
      demoCounts(db),
      db.blogCategory.findMany({ where, take, select: { id: true, name: true, slug: true } }),
      db.blogPost.findMany({ where, take, select: { id: true, title: true, status: true } }),
      db.media.findMany({ where, take, select: { id: true, pathname: true, folder: true } }),
      db.product.findMany({ where, take, select: { id: true, title: true, status: true } }),
      db.portfolio.findMany({ where, take, select: { id: true, title: true, status: true } }),
      db.testimonial.findMany({ where, take, select: { id: true, name: true, status: true } }),
      db.faq.findMany({ where, take, select: { id: true, question: true, status: true } }),
      db.customPage.findMany({ where, take, select: { id: true, title: true, slug: true } }),
      db.inquiry.findMany({ where, take, select: { id: true, customerName: true, status: true } }),
      db.researchRecord.findMany({ where, take, select: { id: true, title: true, source: true } }),
      db.scrapeJob.findMany({ where, take, select: { id: true, sourceKey: true, status: true } }),
      db.importRun.findMany({ where, take, select: { id: true, trigger: true, startedAt: true, rowsRead: true } }),
    ]);

    const entity = (
      key: DemoEntity,
      rows: DemoInventoryRow[],
    ): DemoInventoryEntity => ({
      entity: key,
      label: DEMO_ENTITY_LABELS[key],
      count: counts[key],
      rows,
      truncated: counts[key] > rows.length,
    });

    return [
      entity("BlogCategory", blogCategories.map((r) => ({ id: r.id, label: r.name, meta: r.slug }))),
      entity("BlogPost", blogPosts.map((r) => ({ id: r.id, label: r.title, meta: r.status }))),
      entity("Media", media.map((r) => ({ id: r.id, label: r.pathname, meta: r.folder || "—" }))),
      entity("Product", products.map((r) => ({ id: r.id, label: r.title, meta: r.status }))),
      entity("Portfolio", portfolio.map((r) => ({ id: r.id, label: r.title, meta: r.status }))),
      entity("Testimonial", testimonials.map((r) => ({ id: r.id, label: r.name, meta: r.status }))),
      entity("Faq", faqs.map((r) => ({ id: r.id, label: r.question, meta: r.status }))),
      entity("CustomPage", customPages.map((r) => ({ id: r.id, label: r.title, meta: r.slug }))),
      entity("Inquiry", inquiries.map((r) => ({ id: r.id, label: r.customerName, meta: r.status }))),
      entity("ResearchRecord", research.map((r) => ({ id: r.id, label: r.title, meta: r.source }))),
      entity("ScrapeJob", scrapeJobs.map((r) => ({ id: r.id, label: r.sourceKey, meta: r.status }))),
      entity(
        "ImportRun",
        importRuns.map((r) => ({
          id: r.id,
          label: r.trigger,
          meta: `${r.rowsRead} rows · ${r.startedAt.toISOString().slice(0, 10)}`,
        })),
      ),
    ];
  });
}

/**
 * Delete the selected demo rows (ADMIN only).
 *
 * The typed phrase is required to clear a whole content type and not to
 * remove rows the owner ticked — `describeSelectionProblem` owns that rule so
 * the screen and this action cannot disagree about it. Every id is re-read
 * with `isDemo: true` server-side before anything is deleted; a row that is
 * no longer demo comes back as PROTECTED rather than being quietly skipped.
 */
export async function removeDemoSelectionAction(
  selection: DemoSelection,
  confirmation: string,
): Promise<ActionResult<DemoRemovalReport>> {
  const session = await requireStaff([Role.ADMIN]);
  const problem = describeSelectionProblem(selection, confirmation);
  if (problem) return { ok: false, error: problem };

  return runAction(async () => {
    const report = await removeDemoSelection(
      db,
      selection,
      findMediaUsageDetails,
      demoCounts,
    );
    await logActivity({
      userId: session.user.id,
      action: "remove-selection",
      entity: "demo",
      meta: {
        selected: report.selected,
        deleted: report.deleted,
        protectedRows: report.protectedRows,
        missing: report.missing,
        sharedMediaPreserved: report.sharedMediaPreserved.length,
        byEntity: report.byEntity as unknown as Prisma.InputJsonValue,
      },
    });
    revalidatePublic("product");
    revalidatePublic("category");
    revalidatePublic("blogPost");
    revalidatePublic("portfolio");
    revalidatePublic("faq");
    revalidatePublic("testimonial");
    revalidatePublic("customPage");
    return report;
  });
}
