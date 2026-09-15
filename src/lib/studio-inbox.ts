import { db } from "@/lib/db";

import { IMPORT_CONFLICT_STATUS } from "@/lib/import-status";
/**
 * The studio topbar's notification list (§12.2's bell, previously a bare
 * link + a two-number count). `getStudioInbox()` gathers everything in the
 * Studio that is currently WAITING ON A HUMAN or just happened, from five
 * sources; `shapeInbox` turns those raw rows into one ordered, capped list —
 * kept pure and exported on its own so the ordering/labelling rules are
 * testable without a database.
 */
export type InboxItem = {
  /** Stable within one inbox render — `"<kind>:<id>"`. */
  id: string;
  kind: "pending" | "scrape-job" | "import-run" | "activity";
  /** The line shown in the popover. */
  label: string;
  /** Optional second line — a count, a source name, a reason. */
  detail?: string;
  href: string;
  /** ISO timestamp, or `null` for a pending count (it has no "when"). */
  at: string | null;
  tone: "default" | "warning" | "success";
};

export type StudioInboxRows = {
  pending: {
    testimonials: number;
    scrapedProducts: number;
    products: number;
    blogPosts: number;
    portfolios: number;
    importConflicts: number;
  };
  scrapeJobs: {
    id: string;
    sourceName: string;
    status: "DONE" | "FAILED";
    totalScraped: number;
    newCount: number;
    error: string | null;
    finishedAt: Date | null;
    createdAt: Date;
  }[];
  importRuns: {
    id: string;
    trigger: string;
    created: number;
    updated: number;
    failed: number;
    abortedReason: string | null;
    startedAt: Date;
  }[];
  activity: {
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    createdAt: Date;
    userName: string | null;
  }[];
};

/** Studio route each pending queue drains into. */
const PENDING_HREF = {
  testimonials: "/studio/testimonials?status=PENDING_REVIEW",
  scrapedProducts: "/studio/scraper/review",
  products: "/studio/products?status=REVIEW",
  blogPosts: "/studio/blog?status=REVIEW",
  portfolios: "/studio/portfolio?status=REVIEW",
  importConflicts: "/studio/catalog-fill/conflicts",
} as const;

const PENDING_LABEL: Record<keyof StudioInboxRows["pending"], string> = {
  testimonials: "testimonial",
  scrapedProducts: "scraped product",
  products: "product",
  blogPosts: "journal post",
  portfolios: "portfolio piece",
  importConflicts: "sheet conflict",
};

const PENDING_VERB: Record<keyof StudioInboxRows["pending"], string> = {
  testimonials: "awaiting review",
  scrapedProducts: "awaiting review",
  products: "awaiting review",
  blogPosts: "awaiting review",
  portfolios: "awaiting review",
  importConflicts: "to resolve",
};

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/**
 * Raw rows → an ordered, capped inbox. Pending queues lead (they are the
 * items an owner can act on right now and have no natural "recency"), then
 * everything else — scrape-job results, import runs, publish activity —
 * interleaves newest first. Capped at 20 so the popover never grows past a
 * screenful; the individual queries already cap what they fetch (last 10/5).
 */
export function shapeInbox(rows: StudioInboxRows): InboxItem[] {
  const pendingItems: InboxItem[] = (
    Object.keys(rows.pending) as (keyof StudioInboxRows["pending"])[]
  )
    .filter((key) => rows.pending[key] > 0)
    .map((key) => ({
      id: `pending:${key}`,
      kind: "pending",
      label: plural(rows.pending[key], PENDING_LABEL[key]),
      detail: PENDING_VERB[key],
      href: PENDING_HREF[key],
      at: null,
      tone: "warning",
    }));

  const scrapeItems: InboxItem[] = rows.scrapeJobs.map((job) => ({
    id: `scrape-job:${job.id}`,
    kind: "scrape-job",
    label:
      job.status === "DONE"
        ? `Scrape finished — ${job.sourceName}`
        : `Scrape failed — ${job.sourceName}`,
    detail:
      job.status === "DONE"
        ? `${plural(job.totalScraped, "row")} scraped, ${plural(job.newCount, "new")}`
        : (job.error ?? "No error recorded."),
    href: `/studio/scraper/sources/${job.sourceName}`,
    at: (job.finishedAt ?? job.createdAt).toISOString(),
    tone: job.status === "DONE" ? "success" : "warning",
  }));

  const importItems: InboxItem[] = rows.importRuns.map((run) => ({
    id: `import-run:${run.id}`,
    kind: "import-run",
    label: run.abortedReason
      ? `Import run aborted — ${run.trigger}`
      : `Import run — ${run.trigger}`,
    detail: run.abortedReason
      ? run.abortedReason
      : `${plural(run.created, "created")}, ${plural(run.updated, "updated")}${
          run.failed > 0 ? `, ${plural(run.failed, "failed")}` : ""
        }`,
    href: "/studio/import",
    at: run.startedAt.toISOString(),
    tone: run.abortedReason || run.failed > 0 ? "warning" : "default",
  }));

  const activityItems: InboxItem[] = rows.activity.map((entry) => ({
    id: `activity:${entry.id}`,
    kind: "activity",
    label: `${entry.userName ?? "System"} published ${entry.entity.toLowerCase()}`,
    href: "/studio/activity",
    at: entry.createdAt.toISOString(),
    tone: "default",
  }));

  const timed = [...scrapeItems, ...importItems, ...activityItems].sort(
    (a, b) => (b.at ?? "").localeCompare(a.at ?? ""),
  );

  return [...pendingItems, ...timed].slice(0, 20);
}

/** Gathers the raw rows and shapes them. Server-only — reads the database
 *  directly, so this is called from an RSC or a "use server" action, never
 *  imported into client code. */
export async function getStudioInbox(): Promise<InboxItem[]> {
  const [
    testimonials,
    scrapedProducts,
    products,
    blogPosts,
    portfolios,
    importConflicts,
    scrapeJobs,
    importRuns,
    activity,
  ] = await Promise.all([
    db.testimonial.count({ where: { status: "PENDING_REVIEW" } }),
    db.scrapedProduct.count({ where: { reviewStatus: "PENDING" } }),
    db.product.count({ where: { status: "REVIEW" } }),
    db.blogPost.count({ where: { status: "REVIEW" } }),
    db.portfolio.count({ where: { status: "REVIEW" } }),
    db.importConflict.count({ where: { status: IMPORT_CONFLICT_STATUS.OPEN } }),
    db.scrapeJob.findMany({
      where: { status: { in: ["DONE", "FAILED"] } },
      orderBy: { finishedAt: "desc" },
      take: 10,
      select: {
        id: true,
        sourceName: true,
        status: true,
        totalScraped: true,
        newCount: true,
        error: true,
        finishedAt: true,
        createdAt: true,
      },
    }),
    db.importRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 5,
      select: {
        id: true,
        trigger: true,
        created: true,
        updated: true,
        failed: true,
        abortedReason: true,
        startedAt: true,
      },
    }),
    db.activityLog.findMany({
      where: { action: { contains: "publish" } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
  ]);

  return shapeInbox({
    pending: {
      testimonials,
      scrapedProducts,
      products,
      blogPosts,
      portfolios,
      importConflicts,
    },
    scrapeJobs: scrapeJobs.map((job) => ({
      id: job.id,
      sourceName: job.sourceName,
      status: job.status as "DONE" | "FAILED",
      totalScraped: job.totalScraped,
      newCount: job.newCount,
      error: job.error,
      finishedAt: job.finishedAt,
      createdAt: job.createdAt,
    })),
    importRuns,
    activity: activity.map((entry) => ({
      id: entry.id,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId,
      createdAt: entry.createdAt,
      userName: entry.user?.name ?? null,
    })),
  });
}
