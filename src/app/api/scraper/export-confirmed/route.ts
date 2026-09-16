/**
 * Confirmed-list export (B7) — the gated final list as CSV or XLSX:
 *   GET /api/scraper/export-confirmed?format=csv   (default)
 *   GET /api/scraper/export-confirmed?format=xlsx
 *
 * Reads CONFIRMED shortlist entries and nothing else — the list a human
 * confirmed, never a scrape's raw output. Both formats come from the same
 * assembled rows (`confirmedRows`) and the same cell serializer
 * (`confirmedRowToCells`), so the two downloads cannot disagree.
 *
 * ADMIN-only, matching the ScrapeDeck export (SEC-109).
 */
import { Role } from "@/generated/prisma/enums";
import { requireStaff } from "@/actions/helpers";
import {
  CONFIRMED_COLUMNS,
  confirmedRowToCells,
  confirmedRowsToCsv,
} from "@/lib/scraper/confirmed-export";
import { confirmedRows } from "@/lib/scraper/shortlist-query";
import { toXlsxBuffer } from "@/lib/export/workbook";

/** yyyymmdd (UTC) for the download filename. */
const dateStamp = () =>
  new Date().toISOString().slice(0, 10).replaceAll("-", "");

export async function GET(request: Request): Promise<Response> {
  try {
    await requireStaff([Role.ADMIN]);
  } catch {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "csv";
  if (format !== "csv" && format !== "xlsx") {
    return Response.json(
      { error: "Unknown format — expected csv or xlsx." },
      { status: 400 },
    );
  }

  const rows = await confirmedRows();
  const filename = `rivya-confirmed-products-${dateStamp()}`;

  if (format === "xlsx") {
    const buffer = await toXlsxBuffer(
      CONFIRMED_COLUMNS,
      rows.map(confirmedRowToCells),
      "Confirmed products",
    );
    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition": `attachment; filename="${filename}.xlsx"`,
      },
    });
  }

  return new Response(confirmedRowsToCsv(rows), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}
