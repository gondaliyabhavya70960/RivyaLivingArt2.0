/**
 * ScrapeDeck v4 CSV export. Staff-only download of staged scraped products:
 *   GET /api/scraper/export?jobId=<id>          — one job's rows
 *   GET /api/scraper/export?ids=<id,id,…>       — an explicit selection
 *   GET /api/scraper/export?source=<sourceKey>  — one source's rows
 *   GET /api/scraper/export?reviewStatus=<enum> — by review status
 *   GET /api/scraper/export?all=1               — everything (capped)
 */
import type { Prisma } from "@/generated/prisma/client";
import { ReviewStatus, Role } from "@/generated/prisma/enums";
import { requireStaff } from "@/actions/helpers";
import { db } from "@/lib/db";
import { rowToScrapeDeck, toCsv } from "@/lib/scraper/export";

/** Hard row cap — the CSV is a working file, not a database dump. */
const EXPORT_CAP = 5000;

/** yyyymmdd (UTC) for the download filename — module-level date helper. */
const dateStamp = () =>
  new Date().toISOString().slice(0, 10).replaceAll("-", "");

function isReviewStatus(value: string): value is ReviewStatus {
  return value in ReviewStatus;
}

function badRequest(error: string): Response {
  return Response.json({ error }, { status: 400 });
}

export async function GET(request: Request): Promise<Response> {
  // Exporting the full scraped-product intelligence DB is ADMIN-only (SEC-109).
  try {
    await requireStaff([Role.ADMIN]);
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");
  const ids = searchParams.get("ids");
  const source = searchParams.get("source");
  const reviewStatus = searchParams.get("reviewStatus");
  const all = searchParams.get("all");

  let where: Prisma.ScrapedProductWhereInput;
  if (jobId) {
    where = { jobId };
  } else if (ids) {
    const list = ids
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (list.length === 0) return badRequest("ids is empty.");
    where = { id: { in: list } };
  } else if (source) {
    where = { sourceKey: source };
  } else if (reviewStatus) {
    if (!isReviewStatus(reviewStatus)) {
      return badRequest(
        `Unknown reviewStatus — expected one of ${Object.keys(ReviewStatus).join(", ")}.`,
      );
    }
    where = { reviewStatus };
  } else if (all === "1") {
    where = {};
  } else {
    return badRequest("Provide jobId, ids, reviewStatus or all=1.");
  }

  const products = await db.scrapedProduct.findMany({
    where,
    orderBy: [{ sourceKey: "asc" }, { slug: "asc" }],
    take: EXPORT_CAP,
  });

  const csv = toCsv(products.map(rowToScrapeDeck));
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="resinriva-scrape-${dateStamp()}.csv"`,
    },
  });
}
