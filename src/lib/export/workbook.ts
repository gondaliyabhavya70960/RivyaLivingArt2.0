/**
 * XLSX serialization for Studio exports (server-only: uses `exceljs` and
 * `Buffer`. Only ever imported from a route handler or a server action).
 *
 * CSV is the interchange format; XLSX is the one the owner actually opens.
 * Both come from the same rows, so the two downloads can never disagree.
 *
 * `exceljs` is already a dependency — it parses the Bulk Import upload
 * (`src/lib/import/parse.ts`). Using it to WRITE as well is why removing
 * Google Sheets costs no new package.
 */
import ExcelJS from "exceljs";

/**
 * A worksheet from a header and rows.
 *
 * Values are written as strings, so a cell reading `=1+1` is stored as an
 * XLSX string cell rather than a formula — the spreadsheet-injection guard
 * that `csvCell` applies textually is structural here, and needs no prefix.
 *
 * The header row is frozen and bold because this file is read by a person
 * scrolling a few thousand rows, and a header that scrolls away turns column
 * S into a guess.
 */
export async function toXlsxBuffer(
  header: readonly string[],
  rows: readonly (readonly string[])[],
  sheetName: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Rivya Living Art Studio";
  workbook.created = new Date();

  // Excel refuses a sheet name over 31 chars or containing []*/\?: — a caller
  // passing one would throw deep inside the library with an opaque message.
  const safeName = sheetName
    .replace(/[[\]*/\\?:]/g, " ")
    .slice(0, 31)
    .trim();
  const sheet = workbook.addWorksheet(safeName || "Export");

  sheet.addRow(Array.from(header));
  for (const row of rows) sheet.addRow(Array.from(row));

  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.columns = header.map((key) => ({
    // Wide enough for the key itself, capped so one long description column
    // does not push every other column off the screen.
    width: Math.min(Math.max(key.length + 4, 12), 40),
  }));

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
