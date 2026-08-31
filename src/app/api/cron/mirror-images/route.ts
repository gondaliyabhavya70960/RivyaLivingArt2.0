import { requireStaff } from "@/actions/helpers";
import { timingSafeEqual } from "node:crypto";
import { mirrorCatalogImagesBatch } from "@/lib/catalog-mirror";

/**
 * Batched catalog-image mirroring (audit C3), driven by the Vercel cron in
 * vercel.json (daily 02:30 UTC) and re-runnable by staff on demand.
 *
 * Authorization — either caller is enough:
 *  - the Vercel cron: when CRON_SECRET is set (Vercel injects it into cron
 *    requests), the call must carry `Authorization: Bearer <CRON_SECRET>`;
 *  - a logged-in staff session (same DB-revalidated requireStaff guard as
 *    the draft-preview route), so the owner can trigger a batch from the
 *    browser: /api/cron/mirror-images?limit=500.
 *
 * `?limit=` sizes the batch (default 200, capped at 500 — ~500 sequential
 * worst-case fetches is what fits comfortably inside maxDuration). Each run
 * resumes where the last stopped; the JSON response reports the counts,
 * including how many external images remain.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DEFAULT_BATCH = 200;
const MAX_BATCH = 500;

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
    timingSafeEqualStr(request.headers.get("authorization") ?? "", `Bearer ${cronSecret}`);

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

  const raw = Number.parseInt(
    new URL(request.url).searchParams.get("limit") ?? "",
    10,
  );
  const limit = Number.isFinite(raw)
    ? Math.min(Math.max(raw, 1), MAX_BATCH)
    : DEFAULT_BATCH;

  const counts = await mirrorCatalogImagesBatch(limit);
  return Response.json(counts);
}
