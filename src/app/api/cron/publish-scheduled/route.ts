import { timingSafeEqual } from "node:crypto";

import { requireStaff, revalidatePublic } from "@/actions/helpers";
import { db } from "@/lib/db";

/**
 * Warm the cache for landing pages whose scheduled moment has just passed.
 *
 * **This job is an optimisation, not the mechanism.** Whether a page is live
 * is decided by `isLive()` at read time: a page with `publishAt` at 06:00 is
 * live from 06:00 in every query on this site, whether or not this route ever
 * runs. What the job buys is the difference between "live at 06:00" and
 * "visible by 06:05", because /p/[slug] is cached with a 300s ISR window and
 * the sitemap with an hour's.
 *
 * So it never writes. Flipping DRAFT → PUBLISHED on a timer would put the
 * schedule in two places — the row and the job — and make the page's fate
 * depend on the job having fired, which is the one thing you cannot check on
 * the morning of a campaign.
 *
 * Authorization matches /api/cron/mirror-images: the Vercel cron's bearer
 * token, or a logged-in staff session so the owner can force a refresh.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** How far back to look for a boundary we may not have warmed yet. */
const LOOKBACK_MS = 26 * 60 * 60 * 1000;

/** Constant-time string compare (re-audit R-005). */
function timingSafeEqualStr(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export async function GET(request: Request): Promise<Response> {
  const cronSecret = process.env.CRON_SECRET;
  let authorized =
    Boolean(cronSecret) &&
    timingSafeEqualStr(
      request.headers.get("authorization") ?? "",
      `Bearer ${cronSecret}`,
    );

  if (!authorized) {
    try {
      await requireStaff();
      authorized = true;
    } catch {
      // fall through — no valid staff session either
    }
  }
  if (!authorized) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const since = new Date(now.getTime() - LOOKBACK_MS);

  const crossed = await db.customPage.findMany({
    where: {
      status: "PUBLISHED",
      publishAt: { gte: since, lte: now },
    },
    select: { slug: true, publishAt: true },
  });

  for (const page of crossed) revalidatePublic("customPage", page.slug);

  return Response.json({
    checked: now.toISOString(),
    warmed: crossed.map((p) => p.slug),
  });
}
