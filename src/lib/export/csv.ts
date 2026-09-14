/**
 * Generic CSV serialization for Studio exports.
 *
 * `src/lib/scraper/export.ts` has carried a CSV writer since the ScrapeDeck
 * download shipped, but its `toCsv` hardcodes `SCRAPEDECK_COLUMNS` as the
 * header — which is correct for that one caller and useless for any other.
 * Rather than copy the quoting rules into a second file (the repo's convention
 * is one implementation, not three that drift), the escaping lives here and
 * `scraper/export.ts` delegates to it.
 *
 * Pure and dependency-free, so a test can reach it without a database or a
 * workbook library.
 */

/**
 * RFC-4180 quoting, plus a formula-injection guard.
 *
 * A cell beginning `=`, `+`, `-`, `@`, tab or CR is interpreted as a formula by
 * Excel, Numbers and Sheets alike. Scraped titles genuinely start with `-`
 * ("- Handmade river table"), so this is not a hypothetical: prefixing an
 * apostrophe makes the cell render as the text it is. The apostrophe is
 * consumed by the spreadsheet, so the reader sees the original string.
 */
export function csvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(guarded)
    ? `"${guarded.replaceAll('"', '""')}"`
    : guarded;
}

/**
 * Full CSV document: the given header, then the rows, CRLF throughout.
 *
 * CRLF rather than LF because Excel on Windows still treats a lone LF as one
 * long line, and this file exists to be opened in Excel.
 */
export function toCsvDocument(
  header: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  const lines = [Array.from(header), ...rows.map((row) => Array.from(row))];
  return lines.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
