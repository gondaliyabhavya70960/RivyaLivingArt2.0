/**
 * Bulk Import — file/sheet parsing (server-only: uses Buffer, network
 * fetch and the Node build of @tiptap/html). Only ever imported from
 * server actions — never from client components.
 */

import ExcelJS from "exceljs";
import Papa from "papaparse";
import { marked } from "marked";
import { generateJSON } from "@tiptap/html/server";
import StarterKit from "@tiptap/starter-kit";

/**
 * User-facing import failure. previewImport/runImport surface the message
 * verbatim instead of letting runAction blur it into a generic error.
 */
export class ImportError extends Error {}

const SHEET_ERROR =
  'Could not read the sheet. Make sure it is shared as "Anyone with the link can view" (or published to the web) and try again.';

/**
 * Lowercase/trim headers and stringify cells so every downstream consumer
 * sees the same shape regardless of CSV vs XLSX origin.
 */
function normalizeRow(raw: Record<string, unknown>): Record<string, string> {
  const row: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw)) {
    const header = key.trim().toLowerCase();
    // sheet_to_json names unlabelled columns "__EMPTY", "__EMPTY_1", …
    if (!header || header.startsWith("__empty")) continue;
    row[header] = String(value ?? "").trim();
  }
  return row;
}

const hasAnyValue = (row: Record<string, string>) =>
  Object.values(row).some((value) => value !== "");

export function parseCsv(text: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header: string) => header.trim().toLowerCase(),
  });
  return result.data.map(normalizeRow).filter(hasAnyValue);
}

export async function parseXlsx(
  buffer: Buffer,
): Promise<Record<string, string>[]> {
  // exceljs replaced SheetJS (Part 0 audit S-09): the registry build of xlsx
  // carries unfixed prototype-pollution/ReDoS advisories. cell.text mirrors
  // the old raw:false behavior — the formatted string the user sees.
  const workbook = new ExcelJS.Workbook();
  try {
    // exceljs ships stale Buffer typings (pre-Node-22) — runtime accepts
    // a Node Buffer fine; the cast only reconciles the declaration gap.
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new ImportError(
      "Could not read that file — it does not look like a valid .xlsx workbook.",
    );
  }
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const headers: string[] = [];
  sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = String(cell.text ?? "").trim();
  });
  const rows: Record<string, unknown>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    // Pre-fill every labelled header with "" (the old defval behavior), so
    // a row with trailing empty cells still carries every column key.
    const rec: Record<string, unknown> = {};
    for (const h of headers) if (h) rec[h] = "";
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      // Unlabelled columns keep the "__EMPTY" convention normalizeRow drops.
      rec[headers[col] || `__EMPTY_${col}`] = cell.text;
    });
    rows.push(rec);
  });
  return rows.map(normalizeRow).filter(hasAnyValue);
}

/**
 * Fetch a Google Sheet as CSV via the public export endpoint. Works for
 * any docs.google.com/spreadsheets URL (edit links, share links, links
 * with a #gid fragment). Private sheets answer with an HTML login page,
 * which we translate into a friendly sharing hint.
 */
export async function fetchGoogleSheetCsv(url: string): Promise<string> {
  const idMatch = url.match(/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/);
  if (!idMatch) {
    throw new ImportError(
      "That does not look like a Google Sheets link — paste the full URL from your browser.",
    );
  }
  const gid = url.match(/[#?&]gid=(\d+)/)?.[1] ?? "0";
  const exportUrl = `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`;

  let response: Response;
  try {
    response = await fetch(exportUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new ImportError(SHEET_ERROR);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || contentType.includes("text/html")) {
    throw new ImportError(SHEET_ERROR);
  }
  const text = await response.text();
  // Login/consent pages occasionally slip through with a 200 — sniff HTML.
  if (text.trimStart().startsWith("<")) throw new ImportError(SHEET_ERROR);
  return text;
}

/**
 * Markdown → Tiptap document JSON (the shape BlogPost.content and
 * Page.content store), via marked → generateJSON with the same StarterKit
 * the studio rich-text editor uses.
 */
export async function markdownToTiptap(
  markdown: string,
): Promise<Record<string, unknown>> {
  const html = await marked.parse(markdown ?? "");
  return generateJSON(html, [StarterKit]) as Record<string, unknown>;
}
