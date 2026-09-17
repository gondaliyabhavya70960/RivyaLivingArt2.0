"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireStaff, runAction, type ActionResult } from "@/actions/helpers";
import {
  Role,
  type CollectionMode,
  type PolicyReviewStatus,
  type ScrapePlatform,
  type ScrapeTier,
} from "@/generated/prisma/enums";
import { logActivity } from "@/lib/activity";
import {
  advanceScrapeJob,
  toSnapshot,
  CUSTOM_ADAPTER_MESSAGE,
  type ScrapeJobSnapshot,
} from "@/lib/scraper/job-runner";
import { db } from "@/lib/db";
import {
  IN_FLIGHT_STATUSES,
  isStaleRunning,
  partitionByInFlight,
} from "@/lib/scraper/run-scope";
import { describeBlockedRun } from "@/lib/scraper/breaker";
import { SCRAPE_TIERS } from "@/lib/scraper/purge";
import {
  AUTOMATABLE_SOURCE_WHERE,
  describeUnauthorizedRun,
} from "@/lib/scraper/policy";
import {
  fingerprint,
  isBlockedMarketplace,
  normalizeBaseUrl,
} from "@/lib/scraper/fingerprint";
import { slugify } from "@/lib/slug";

const STUDIO_PATH = "/studio/scraper";

const MARKETPLACE_MESSAGE =
  "Marketplaces (Amazon, Etsy, Flipkart, Meesho, IndiaMART…) are never scraped — use their official APIs instead.";

/**
 * A RUNNING job whose heartbeat (`ScrapeJob.updatedAt`) is older than this is
 * presumed dead — the serverless invocation advancing it crashed before it
 * could write FAILED. Past this age it no longer counts as "this source is
 * busy" (`run-scope.ts`'s `isStaleRunning`), so a fresh scrape can be queued
 * instead of the source being blocked forever by a job nobody is polling.
 * The old job stays in place and is still resumable by id if it turns out to
 * be alive after all.
 */
const STALE_RUNNING_MS = 10 * 60 * 1000;

const createJobSchema = z
  .object({
    sourceId: z.string().min(1).optional(),
    inputUrl: z.string().trim().min(1).max(2048).optional(),
    tier: z.enum(SCRAPE_TIERS).optional(),
    // SOURCE crawls the whole registered site (or, with no sourceId, the
    // pasted URL as a new one). CATEGORY paginates one listing page; URL
    // fetches one product page via the JSON-LD path regardless of platform —
    // both need a registered source (for its tier/breaker/policy) AND the
    // specific target page, which is neither the same field as a plain
    // pasted URL nor optional once scope says so.
    scope: z.enum(["SOURCE", "CATEGORY", "URL"]).default("SOURCE"),
  })
  .refine(
    (v) =>
      v.scope === "SOURCE"
        ? Boolean(v.sourceId) !== Boolean(v.inputUrl)
        : Boolean(v.sourceId) && Boolean(v.inputUrl),
    {
      message:
        "Pass exactly one of sourceId or inputUrl for a whole-source run, or both for a category/URL scope.",
    },
  );

export type CreateScrapeJobInput = z.input<typeof createJobSchema>;

/** Inner outcome — user-facing failures ride out of runAction as data. */
type CreateJobOutcome =
  | { jobId: string; alreadyRunning: boolean; userError?: never }
  | { jobId?: never; alreadyRunning?: never; userError: string };

/**
 * Queue a scrape job, either from a registered source (auto-fingerprinting
 * UNKNOWN platforms and persisting the result) or from a pasted URL — which
 * is blocklist-checked, fingerprinted and SAVED into the source registry
 * (upsert by slugified host, tier defaults to RESIN_GOODS).
 */
export async function createScrapeJob(
  input: CreateScrapeJobInput,
): Promise<ActionResult<{ jobId: string; alreadyRunning: boolean }>> {
  const result = await runAction<CreateJobOutcome>(async () => {
    const session = await requireStaff();
    const parsed = createJobSchema.parse(input);

    let source: {
      id: string;
      key: string;
      name: string;
      baseUrl: string;
      vertical: string;
      // Breaker state travels with the row — both branches below assign a
      // full ScrapeSource, so reading it here costs nothing extra.
      pausedAt: Date | null;
      pausedReason: string | null;
      // Governance state travels the same way, and is checked below before a
      // single request is sent.
      collectionMode: CollectionMode;
      policyReviewStatus: PolicyReviewStatus;
      policyReviewNote: string | null;
    };
    let platform: ScrapePlatform;

    if (parsed.sourceId) {
      const found = await db.scrapeSource.findUnique({
        where: { id: parsed.sourceId },
      });
      if (!found) {
        return {
          userError: "Source not found — refresh the registry and try again.",
        };
      }
      platform = found.platform;
      if (platform === "UNKNOWN") {
        // Live-detect and persist so the registry heals itself.
        platform = await fingerprint(found.baseUrl);
        await db.scrapeSource.update({
          where: { id: found.id },
          data: {
            platform,
            ...(platform !== "UNKNOWN" ? { verifiedAt: new Date() } : {}),
          },
        });
        if (platform === "UNKNOWN")
          return { userError: CUSTOM_ADAPTER_MESSAGE };
      }
      source = found;

      // CATEGORY/URL: the schema already guarantees inputUrl is present
      // here. It must resolve to the SAME host as the registered source —
      // otherwise a scoped run would let a trusted source's tier, breaker
      // and politeness settings crawl an unrelated site by pasting its URL
      // into a field meant for one of that source's own pages.
      if (parsed.scope !== "SOURCE") {
        let scopedUrl: URL;
        try {
          scopedUrl = new URL(parsed.inputUrl ?? "");
        } catch {
          return { userError: "That doesn't look like a valid page URL." };
        }
        let sourceHost: string;
        try {
          sourceHost = new URL(source.baseUrl).hostname;
        } catch {
          sourceHost = "";
        }
        if (
          scopedUrl.hostname.replace(/^www\./, "") !==
          sourceHost.replace(/^www\./, "")
        ) {
          return {
            userError: `That page isn't on ${sourceHost || source.name} — paste a URL from this source.`,
          };
        }
      }
    } else {
      let baseUrl: string;
      try {
        baseUrl = normalizeBaseUrl(parsed.inputUrl ?? "");
      } catch {
        return { userError: "That doesn't look like a valid website URL." };
      }
      if (isBlockedMarketplace(baseUrl))
        return { userError: MARKETPLACE_MESSAGE };

      platform = await fingerprint(baseUrl);
      if (platform === "UNKNOWN") return { userError: CUSTOM_ADAPTER_MESSAGE };

      const host = new URL(baseUrl).hostname.replace(/^www\./, "");
      const key = slugify(host) || "source";
      source = await db.scrapeSource.upsert({
        where: { key },
        create: {
          key,
          name: host,
          baseUrl,
          tier: parsed.tier ?? "RESIN_GOODS",
          platform,
          verifiedAt: new Date(),
        },
        update: { baseUrl, platform, verifiedAt: new Date() },
      });
    }

    // One run per source at a time. Two jobs against the same site double its
    // request rate for no extra coverage — they crawl the same pages — and the
    // second one's rows land on top of the first's mid-flight. A double click
    // on Scrape was enough to cause it, because nothing here looked.
    //
    // QUEUED counts as in-flight: it has not started, so starting another is
    // the same mistake a moment earlier.
    const inFlight = await db.scrapeJob.findFirst({
      where: { sourceId: source.id, status: { in: [...IN_FLIGHT_STATUSES] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, updatedAt: true },
    });
    // Returning the job that is ALREADY running, rather than an error, is what
    // makes this action idempotent: pressing Scrape twice leaves one job and
    // lands the operator on it. An error here would be technically correct and
    // practically useless — they would still have to go and find it.
    //
    // Unless it's stale: a RUNNING job whose heartbeat predates
    // STALE_RUNNING_MS is presumed dead (the invocation advancing it crashed
    // before writing FAILED), and no longer blocks a fresh job for this
    // source. It stays in the database, still resumable by id if it turns
    // out to be alive after all.
    if (
      inFlight &&
      !isStaleRunning(inFlight, new Date(Date.now() - STALE_RUNNING_MS))
    ) {
      return { jobId: inFlight.id, alreadyRunning: true };
    }

    // The governance gate, checked BEFORE the breaker because it answers the
    // more fundamental question. A breaker pause is about the site (it is
    // down; resume when it is fixed); this is about us (nobody has established
    // that we may crawl it at all), and no amount of waiting clears it.
    //
    // A source reached by pasting a URL was created moments ago by the branch
    // above, so it arrives here PENDING by default and is refused — which is
    // the intended shape: pasting a URL is a decision to crawl a site, and the
    // gate exists so that decision is recorded rather than implied.
    const unauthorized = describeUnauthorizedRun(source.name, source);
    if (unauthorized) {
      return {
        userError: parsed.sourceId
          ? unauthorized
          : `${unauthorized} ${source.name} has been added to the registry, so the review is waiting for you there.`,
      };
    }

    // The circuit breaker. A source paused after repeated failures does not
    // get new jobs until an operator has looked at it — continuing to send
    // requests to a site that is down or blocking us is useless and is how a
    // soft block becomes a hard one.
    const blocked = describeBlockedRun(source.name, {
      pausedAt: source.pausedAt,
      pausedReason: source.pausedReason,
    });
    if (blocked) return { userError: blocked };

    // SOURCE crawls source.baseUrl; CATEGORY/URL crawl the specific page the
    // operator pasted, already verified above to be on this source's host.
    const targetUrl =
      parsed.scope === "SOURCE" ? source.baseUrl : (parsed.inputUrl as string);

    const job = await db.scrapeJob.create({
      data: {
        sourceId: source.id,
        inputUrl: targetUrl,
        sourceKey: source.key,
        sourceName: source.name,
        platform,
        vertical: source.vertical,
        scope: parsed.scope,
        // status QUEUED / cursorPage 0 via schema defaults.
      },
      select: { id: true },
    });

    await logActivity({
      userId: session.user.id,
      action: "create",
      entity: "ScrapeJob",
      entityId: job.id,
      meta: { sourceKey: source.key, platform, scope: parsed.scope },
    });
    revalidatePath(STUDIO_PATH);
    return { jobId: job.id, alreadyRunning: false };
  });

  if (!result.ok) return result;
  const outcome = result.data;
  if (!outcome || outcome.userError !== undefined) {
    return {
      ok: false,
      error: outcome?.userError ?? "Something went wrong. Please try again.",
    };
  }
  return {
    ok: true,
    data: { jobId: outcome.jobId, alreadyRunning: outcome.alreadyRunning },
  };
}

/**
 * Advance a job by up to PAGES_PER_INVOCATION pages (serverless budget).
 * The client runner calls this in a loop until the snapshot reports
 * DONE or FAILED. Terminal jobs are returned untouched, so polling and
 * "Resume" are idempotent.
 */
export async function continueScrapeJob(
  jobId: string,
): Promise<ActionResult<ScrapeJobSnapshot>> {
  return runAction(async () => {
    const session = await requireStaff();
    const id = z.string().min(1).parse(jobId);
    return advanceScrapeJob(id, session.user.id);
  });
}

/**
 * Fan-out order. The owner's size tiers come first, largest work first,
 * because that is the order the business cares about; the retired provenance
 * tiers follow, so a source still filed under one is queued last rather than
 * skipped.
 */
const TIER_RANK: Record<ScrapeTier, number> = {
  LARGE_FORMAT: 0,
  MEDIUM_FORMAT: 1,
  SMALL_FORMAT: 2,
  OWNER: 3,
  RESIN_GOODS: 4,
  SUPPLIES: 5,
  PRINT3D: 6,
};

/**
 * Queue jobs for every enabled, platform-detected source in a tier (or all
 * tiers, in TIER_RANK order — the size tiers first, largest work first, then
 * the retired provenance tiers — then by name). The client runs the returned
 * ids sequentially.
 */
export async function createTierJobs(
  tier: ScrapeTier | "ALL",
): Promise<ActionResult<{ jobIds: string[]; skipped: string[] }>> {
  return runAction(async () => {
    const session = await requireStaff();
    const parsed = z.enum([...SCRAPE_TIERS, "ALL"]).parse(tier);

    const sources = await db.scrapeSource.findMany({
      where: {
        enabled: true,
        platform: { not: "UNKNOWN" },
        // The same gate as the single-source path, enforced in the QUERY.
        // The fan-out is exactly where a forgotten check would queue a
        // hundred jobs at once, so the rule is a clause rather than a filter
        // anyone can leave out.
        ...AUTOMATABLE_SOURCE_WHERE,
        ...(parsed === "ALL" ? {} : { tier: parsed }),
      },
      orderBy: { name: "asc" },
    });
    sources.sort(
      (a, b) =>
        TIER_RANK[a.tier] - TIER_RANK[b.tier] || a.name.localeCompare(b.name),
    );

    if (sources.length === 0) return { jobIds: [], skipped: [] };

    // The same one-run-per-source rule as createScrapeJob, including the
    // same stale-reclaim: a RUNNING job whose heartbeat predates
    // STALE_RUNNING_MS no longer blocks a fresh batch job for its source.
    // Without the base guard, the batch is the faster way to cause exactly
    // the duplicate it prevents: press a tier button twice and every source
    // gets a second crawl.
    const busy = await db.scrapeJob.findMany({
      where: {
        sourceId: { in: sources.map((s) => s.id) },
        status: { in: [...IN_FLIGHT_STATUSES] },
      },
      select: { sourceId: true, status: true, updatedAt: true },
    });
    const { queueable, skipped } = partitionByInFlight(sources, busy, {
      staleBefore: new Date(Date.now() - STALE_RUNNING_MS),
    });

    if (queueable.length === 0) return { jobIds: [], skipped };

    const jobs = await db.$transaction(
      queueable.map((source) =>
        db.scrapeJob.create({
          data: {
            sourceId: source.id,
            inputUrl: source.baseUrl,
            sourceKey: source.key,
            sourceName: source.name,
            platform: source.platform,
            vertical: source.vertical,
          },
          select: { id: true },
        }),
      ),
    );

    await logActivity({
      userId: session.user.id,
      action: "batch-create",
      entity: "ScrapeJob",
      meta: { tier: parsed, count: jobs.length, skipped: skipped.length },
    });
    revalidatePath(STUDIO_PATH);
    return { jobIds: jobs.map((j) => j.id), skipped };
  });
}

/** Snapshot fetch for polling — read-only, no side effects. */
export async function getScrapeJobs(
  ids: string[],
): Promise<ActionResult<ScrapeJobSnapshot[]>> {
  return runAction(async () => {
    await requireStaff();
    const parsed = z.array(z.string().min(1)).parse(ids);
    if (parsed.length === 0) return [];
    const jobs = await db.scrapeJob.findMany({
      where: { id: { in: parsed } },
    });
    return jobs.map(toSnapshot);
  });
}

/** Bulk delete jobs — their staging rows cascade with them. */
export async function deleteScrapeJobs(ids: string[]): Promise<ActionResult> {
  return runAction(async () => {
    // Deleting scrape jobs (and their staged competitor rows) is ADMIN-only (SEC-109).
    const session = await requireStaff([Role.ADMIN]);
    const parsed = z.array(z.string().min(1)).min(1).parse(ids);

    await db.scrapeJob.deleteMany({ where: { id: { in: parsed } } });

    await logActivity({
      userId: session.user.id,
      action: parsed.length > 1 ? "bulk-delete" : "delete",
      entity: "ScrapeJob",
      meta: { count: parsed.length, ids: parsed },
    });
    revalidatePath(STUDIO_PATH);
    return undefined;
  });
}
