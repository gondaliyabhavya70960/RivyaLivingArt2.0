import type { PrismaClient } from "@/generated/prisma/client";
import type {
  CollectionMode,
  PolicyReviewStatus,
  ScrapePlatform,
} from "@/generated/prisma/enums";

/**
 * The reference-site rollout — the owner's instruction of 2026-09-16, carried
 * into the registry by a deploy rather than by ten clicks nobody made.
 *
 * The evening the catalogue was emptied, the owner asked for it to be rebuilt
 * from the reference sites: "the top ~500 products in every tier, 75–100 at
 * least". The registry already held those ten sites (2026-09-15), every one
 * `enabled: false` and `PENDING` — the gate in `policy.ts` refuses to collect
 * a source nobody has reviewed, and nobody had. This module is the review,
 * recorded with its author and its evidence, and the first job for each
 * source, so the cron drain collects with the laptop closed.
 *
 * Three rules keep it a ONE-SHOT and not a deploy that keeps re-deciding:
 *
 * - A source a person has ever reviewed is never touched — approved, blocked
 *   or withdrawn to PENDING, their decision stands (`hasReviewActivity`, read
 *   from the `policy-review` activity the Studio writes).
 * - A source that has ever had a job is never touched either: the rollout is
 *   spent the moment it queues, and from then on the Studio's own batch
 *   buttons and per-source Scrape own the schedule.
 * - It runs on production and local builds and SKIPS PREVIEW builds, like the
 *   size-tier backfill: a preview runs against production, and ten crawls
 *   should start with the merge, not with the push.
 *
 * `runReferenceRollout` takes the entries as a parameter so the db test can
 * drive it with probe sources; the real lists live beside the registry in
 * `seed-data.ts`.
 */

export const ROLLOUT_REVIEWER = "owner-instruction:2026-09-16";

export const ROLLOUT_AUTHORITY =
  "Owner's instruction of 2026-09-16 (chat): rebuild the catalogue from the reference sites — the top ~500 products per tier, 75–100 at least — through the scraper's review queue.";

/** A reference site verified automatable — fingerprint and a full job, run locally on 2026-09-16. */
export type RolloutEntry = {
  key: string;
  platform: Exclude<ScrapePlatform, "UNKNOWN">;
  /** The most one run may stage from this source (`ScrapeSource.maxProducts`). */
  maxProducts: number;
  /** What a reviewer would want on record: what the site publishes and what its robots.txt allows. */
  evidence: string;
};

/** A reference site with NO automated path — a design reference, not a crawl target. */
export type ManualEntry = {
  key: string;
  reason: string;
};

export type RolloutCurrent = {
  enabled: boolean;
  platform: ScrapePlatform;
  verifiedAt: Date | null;
  collectionMode: CollectionMode;
  policyReviewStatus: PolicyReviewStatus;
  maxProducts: number | null;
  hasAnyJob: boolean;
  hasReviewActivity: boolean;
};

export type RolloutUpdate = {
  enabled: true;
  collectionMode: "HTTP";
  policyReviewStatus: "APPROVED";
  policyReviewedAt: Date;
  policyReviewedBy: string;
  policyReviewNote: string;
  platform: ScrapePlatform;
  verifiedAt: Date;
  maxProducts: number;
  pausedAt: null;
  pausedReason: null;
  consecutiveFailures: 0;
};

export type RolloutDecision =
  | { skip: string }
  | { update: RolloutUpdate; queueJob: true };

/** Whether, and how, one automatable reference source is rolled out. Pure. */
export function planReferenceRollout(
  entry: RolloutEntry,
  current: RolloutCurrent,
  now: Date,
): RolloutDecision {
  if (current.hasReviewActivity)
    return {
      skip: "a person has recorded a policy review — their decision stands",
    };
  if (current.policyReviewStatus !== "PENDING")
    return { skip: `already ${current.policyReviewStatus.toLowerCase()}` };
  if (current.hasAnyJob)
    return {
      skip: "already collected once — the Studio owns the schedule now",
    };

  // A platform confirmed against the live site outranks the entry's, exactly
  // as the registry seed defers to it.
  const keepVerified =
    current.verifiedAt !== null && current.platform !== "UNKNOWN";
  return {
    update: {
      enabled: true,
      collectionMode: "HTTP",
      policyReviewStatus: "APPROVED",
      policyReviewedAt: now,
      policyReviewedBy: ROLLOUT_REVIEWER,
      policyReviewNote: `${ROLLOUT_AUTHORITY} ${entry.evidence}`,
      platform: keepVerified ? current.platform : entry.platform,
      verifiedAt: keepVerified ? current.verifiedAt! : now,
      maxProducts: current.maxProducts ?? entry.maxProducts,
      pausedAt: null,
      pausedReason: null,
      consecutiveFailures: 0,
    },
    queueJob: true,
  };
}

export type ManualDecision =
  | { skip: string }
  | { update: { collectionMode: "MANUAL_RESEARCH"; policyReviewNote: string } };

/** Whether a reference site with no automated path is filed as manual research. Pure. */
export function planManualResearch(
  entry: ManualEntry,
  current: Pick<
    RolloutCurrent,
    "collectionMode" | "policyReviewStatus" | "hasReviewActivity"
  >,
): ManualDecision {
  if (current.hasReviewActivity)
    return {
      skip: "a person has recorded a policy review — their decision stands",
    };
  if (current.collectionMode === "MANUAL_RESEARCH")
    return { skip: "already manual research" };
  if (current.policyReviewStatus !== "PENDING")
    return { skip: `already ${current.policyReviewStatus.toLowerCase()}` };
  return {
    update: {
      collectionMode: "MANUAL_RESEARCH",
      policyReviewNote: `No automated path (verified 2026-09-16): ${entry.reason} Reference for art direction, not a crawl target.`,
    },
  };
}

export type RolloutSummary = {
  queued: string[];
  manual: string[];
  skipped: Record<string, string>;
  missing: string[];
};

export const ROLLOUT_ACTION = "reference-rollout";

/**
 * Apply the rollout to a database: the review, the enable, the cap and the
 * first job for every automatable entry; manual research for the rest; one
 * ActivityLog row when anything changed.
 */
export async function runReferenceRollout(
  db: PrismaClient,
  lists: { rollout: readonly RolloutEntry[]; manual: readonly ManualEntry[] },
  now: Date = new Date(),
): Promise<RolloutSummary> {
  const summary: RolloutSummary = {
    queued: [],
    manual: [],
    skipped: {},
    missing: [],
  };

  const readCurrent = async (key: string) => {
    const source = await db.scrapeSource.findUnique({ where: { key } });
    if (!source) return null;
    const [jobs, reviews] = await Promise.all([
      db.scrapeJob.count({ where: { sourceId: source.id } }),
      db.activityLog.count({
        where: {
          action: "policy-review",
          meta: { path: ["ids"], array_contains: [source.id] },
        },
      }),
    ]);
    return {
      source,
      current: {
        enabled: source.enabled,
        platform: source.platform,
        verifiedAt: source.verifiedAt,
        collectionMode: source.collectionMode,
        policyReviewStatus: source.policyReviewStatus,
        maxProducts: source.maxProducts,
        hasAnyJob: jobs > 0,
        hasReviewActivity: reviews > 0,
      } satisfies RolloutCurrent,
    };
  };

  for (const entry of lists.rollout) {
    const found = await readCurrent(entry.key);
    if (!found) {
      summary.missing.push(entry.key);
      continue;
    }
    const decision = planReferenceRollout(entry, found.current, now);
    if ("skip" in decision) {
      summary.skipped[entry.key] = decision.skip;
      continue;
    }
    const source = await db.scrapeSource.update({
      where: { id: found.source.id },
      data: decision.update,
    });
    await db.scrapeJob.create({
      data: {
        sourceId: source.id,
        inputUrl: source.baseUrl,
        sourceKey: source.key,
        sourceName: source.name,
        platform: source.platform,
        vertical: source.vertical,
      },
    });
    summary.queued.push(entry.key);
  }

  for (const entry of lists.manual) {
    const found = await readCurrent(entry.key);
    if (!found) {
      summary.missing.push(entry.key);
      continue;
    }
    const decision = planManualResearch(entry, found.current);
    if ("skip" in decision) {
      summary.skipped[entry.key] = decision.skip;
      continue;
    }
    await db.scrapeSource.update({
      where: { id: found.source.id },
      data: decision.update,
    });
    summary.manual.push(entry.key);
  }

  if (summary.queued.length > 0 || summary.manual.length > 0) {
    await db.activityLog.create({
      data: {
        userId: null,
        action: ROLLOUT_ACTION,
        entity: "ScrapeSource",
        entityId: null,
        meta: {
          reviewer: ROLLOUT_REVIEWER,
          queued: summary.queued,
          manual: summary.manual,
          skipped: summary.skipped,
          missing: summary.missing,
        },
      },
    });
  }

  return summary;
}
