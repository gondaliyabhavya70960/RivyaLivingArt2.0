/**
 * Confirmed-products download — the Sheet push, as a file.
 *
 *   GET /api/studio/export/confirmed            — CSV
 *   GET /api/studio/export/confirmed?format=xlsx — XLSX
 *
 * The query below is deliberately identical to the one `syncConfirmedToSheet`
 * used (`where: { confirmedAt: { not: null } }`, newest first), because this
 * route exists to replace that push exactly — same list, same order, same
 * staff permission. A replacement that quietly returns a different set is not
 * a replacement, and the owner would only find out by comparing row counts.
 *
 * `CONFIRMED_PRODUCTS ≡ { p : p.confirmedAt IS NOT NULL }` still holds, and
 * nothing here can set it. This is a read.
 */
import { requireStaff } from "@/actions/helpers";
import { db } from "@/lib/db";
import { toCsvDocument } from "@/lib/export/csv";
import {
  CONFIRMED_EXPORT_COLUMNS,
  confirmedProductsToRows,
} from "@/lib/export/confirmed";
import { toXlsxBuffer } from "@/lib/export/workbook";

/** yyyy-mm-dd (UTC) for the download filename. */
const dateStamp = () => new Date().toISOString().slice(0, 10);

export async function GET(request: Request): Promise<Response> {
  // Staff, not ADMIN-only: this is the owner's OWN catalogue, and the Sheet
  // push it replaces ran under the same default. `/api/scraper/export` stays
  // ADMIN-only because that one is the competitor-intelligence corpus (SEC-109).
  try {
    await requireStaff();
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const format =
    new URL(request.url).searchParams.get("format") === "xlsx" ? "xlsx" : "csv";

  const products = await db.product.findMany({
    where: { confirmedAt: { not: null } },
    orderBy: { confirmedAt: "desc" },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      showPrice: true,
      priceMin: true,
      priceMax: true,
      inStock: true,
      timeline: true,
      materials: true,
      dimensions: true,
      importSource: true,
      importRef: true,
      tier: true,
      needsRewrite: true,
      confirmedAt: true,
      confirmedById: true,
      createdAt: true,
      updatedAt: true,
      category: { select: { slug: true } },
      images: { orderBy: { order: "asc" }, take: 1, select: { url: true } },
      _count: { select: { images: true } },
    },
  });

  const rows = confirmedProductsToRows(
    products.map((p) => ({
      ...p,
      heroImageUrl: p.images[0]?.url ?? null,
      imageCount: p._count.images,
    })),
  );

  const filename = `rivya-confirmed-products-${dateStamp()}`;

  if (format === "xlsx") {
    const buffer = await toXlsxBuffer(
      CONFIRMED_EXPORT_COLUMNS,
      rows,
      "Confirmed Products",
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
        // A confirmed list changes the moment somebody confirms a product.
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(toCsvDocument(CONFIRMED_EXPORT_COLUMNS, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
