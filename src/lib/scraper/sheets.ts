/**
 * Optional Google Sheet sync (server-only). Talks to the Sheets REST API
 * directly with a service-account JWT — no googleapis dependency. Entirely
 * optional: the CSV export covers the full workflow when this is not
 * configured.
 *
 * Merge model: one tab per tier, header row = SCRAPEDECK_COLUMNS, rows keyed
 * by `${sourceKey}|${externalId}` (columns A and C).
 */
import "server-only";

import { createSign } from "node:crypto";

import type { ScrapeTier } from "@/generated/prisma/enums";
import { SCRAPEDECK_COLUMNS } from "@/lib/scraper/export";
import {
  PRODUCT_SHEET_COLUMNS,
  PRODUCT_SHEET_TAB,
} from "@/lib/scraper/product-sheet";
import { planRowDeletions } from "@/lib/scraper/sheet-delete-plan";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";

/** Sheet tab per tier — mirrors the registry's ScrapeTier enum. */
export const TAB_BY_TIER: Record<ScrapeTier, string> = {
  OWNER: "Tier1_Owner",
  RESIN_GOODS: "Tier2_ResinGoods",
  SUPPLIES: "Tier3_Supplies",
  PRINT3D: "Tier4_3DPrint",
};

/**
 * Service-account JSON from either env form:
 *  - GOOGLE_SERVICE_ACCOUNT_JSON — the raw JSON, or
 *  - GOOGLE_SERVICE_ACCOUNT_KEY_B64 — base64 of that JSON (easier to paste
 *    into GitHub/Vercel secret UIs without newline mangling).
 */
function readServiceAccountJson(): string | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (raw && raw.trim()) return raw;
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_B64;
  if (b64 && b64.trim()) {
    try {
      return Buffer.from(b64.trim(), "base64").toString("utf8");
    } catch {
      return null;
    }
  }
  return null;
}

/** The owner's chosen sheet, when they've set one in Settings → Sheets. */
export type SheetIdSettings = { sheetId?: string | null } | null | undefined;

/**
 * Designated sheet id: `settings.sheetId` first (the owner's own choice,
 * `/studio/settings`), then SCRAPE_SHEET_ID or SHEET_ID from the deploy
 * environment. `settings` is optional and defaults to none, so every
 * existing call site that has not been threaded a settings row yet keeps
 * today's env-only behaviour exactly.
 */
export function readSheetId(settings?: SheetIdSettings): string | undefined {
  return (
    settings?.sheetId?.trim() ||
    process.env.SCRAPE_SHEET_ID?.trim() ||
    process.env.SHEET_ID?.trim() ||
    undefined
  );
}

/** Sheet sync is on only when both a service account and a sheet id resolve. */
export function isSheetSyncConfigured(settings?: SheetIdSettings): boolean {
  return Boolean(readServiceAccountJson() && readSheetId(settings));
}

/**
 * A tab's numeric sheet id from `SiteSettings.sheetTabIds` (Json: tab name →
 * numeric id, recorded from `/studio/settings`), or undefined when unset or
 * shaped wrong — never throws on a malformed Json value, since a settings
 * row nobody has touched holds the schema default `{}`.
 */
function tabIdFromSettings(
  sheetTabIds: unknown,
  tab: string,
): number | undefined {
  if (!sheetTabIds || typeof sheetTabIds !== "object") return undefined;
  const value = (sheetTabIds as Record<string, unknown>)[tab];
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

/** Module-level clock helper — epoch seconds for JWT iat/exp. */
const nowSeconds = () => Math.floor(Date.now() / 1000);

const b64url = (value: string) => Buffer.from(value).toString("base64url");

/**
 * Service-account OAuth: self-signed RS256 JWT exchanged for a short-lived
 * access token. Uses node:crypto directly, so it needs the Node runtime.
 */
export async function getAccessToken(): Promise<string> {
  const raw = readServiceAccountJson();
  if (!raw)
    throw new Error(
      "Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_KEY_B64",
    );

  const account = JSON.parse(raw) as {
    client_email?: string;
    private_key?: string;
  };
  if (!account.client_email || !account.private_key) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON must contain client_email and private_key",
    );
  }
  // Env UIs often store the key with literal \n escapes — normalize.
  const privateKey = account.private_key.replace(/\\n/g, "\n");

  const iat = nowSeconds();
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: account.client_email,
      scope: SHEETS_SCOPE,
      aud: TOKEN_URL,
      iat,
      exp: iat + 3600,
    }),
  );
  const unsigned = `${header}.${claims}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const signature = signer.sign(privateKey).toString("base64url");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status})`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Google token exchange returned no access_token");
  }
  return data.access_token;
}

/** Thin authorized fetch against the Sheets API; throws on non-2xx. */
async function sheetsApi<T>(
  token: string,
  path: string,
  init?: { method?: "GET" | "POST" | "PUT"; body?: unknown },
): Promise<T> {
  const method = init?.method ?? "GET";
  const res = await fetch(`${SHEETS_BASE}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Sheets API ${method} failed (${res.status}): ${detail.slice(0, 300)}`,
    );
  }
  return (await res.json()) as T;
}

/** 1-based column index → A1 letter(s): 1→A, 26→Z, 27→AA, 45→AS. */
function columnLetter(index: number): string {
  let n = index;
  let letter = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

/**
 * Make sure `tab` exists and carries `header` in row 1. A missing tab is
 * created with the header; an existing tab (e.g. a fresh sheet's default
 * "Sheet1") gets the header only when row 1 is still empty — never
 * overwriting existing data.
 */
async function ensureTab(
  token: string,
  spreadsheetId: string,
  tab: string,
  header: readonly string[],
): Promise<void> {
  const meta = await sheetsApi<{
    sheets?: { properties?: { title?: string } }[];
  }>(token, `${spreadsheetId}?fields=sheets.properties.title`);
  const exists = (meta.sheets ?? []).some((s) => s.properties?.title === tab);

  if (!exists) {
    await sheetsApi(token, `${spreadsheetId}:batchUpdate`, {
      method: "POST",
      body: { requests: [{ addSheet: { properties: { title: tab } } }] },
    });
  } else {
    const first = await sheetsApi<{ values?: string[][] }>(
      token,
      `${spreadsheetId}/values/${encodeURIComponent(`${tab}!A1:A1`)}`,
    );
    const hasHeader = (first.values?.[0]?.[0] ?? "").trim().length > 0;
    if (hasHeader) return;
  }
  await sheetsApi(
    token,
    `${spreadsheetId}/values/${encodeURIComponent(`${tab}!A1`)}?valueInputOption=RAW`,
    { method: "PUT", body: { values: [Array.from<string>(header)] } },
  );
}

/**
 * Upsert pre-serialized rows into any tab: rows whose merge key already exists
 * are rewritten in place (values.batchUpdate), new keys are appended.
 * `keyOf` derives the merge key from a full row (empty string = always append).
 */
export async function upsertRowsToTab(opts: {
  tab: string;
  header: readonly string[];
  rows: string[][];
  keyOf: (row: string[]) => string;
  /** The owner's chosen sheet, when the caller has one to hand — see
   *  `readSheetId`. Omitted keeps the env-only fallback. */
  settings?: SheetIdSettings;
}): Promise<{ updated: number; appended: number }> {
  const spreadsheetId = readSheetId(opts.settings);
  if (!spreadsheetId) throw new Error("Set SCRAPE_SHEET_ID or SHEET_ID");

  const { tab, header, rows, keyOf } = opts;
  const lastCol = columnLetter(header.length);
  const token = await getAccessToken();

  await ensureTab(token, spreadsheetId, tab, header);

  const existing = await sheetsApi<{ values?: string[][] }>(
    token,
    `${spreadsheetId}/values/${encodeURIComponent(`${tab}!A2:${lastCol}`)}`,
  );
  const byKey = new Map<string, number>();
  (existing.values ?? []).forEach((cells, i) => {
    const key = keyOf(cells);
    if (key) byKey.set(key, i + 2);
  });

  const updates: { range: string; values: string[][] }[] = [];
  const appends: string[][] = [];
  for (const row of rows) {
    const key = keyOf(row);
    const rowIndex = key ? byKey.get(key) : undefined;
    if (rowIndex !== undefined) {
      updates.push({
        range: `${tab}!A${rowIndex}:${lastCol}${rowIndex}`,
        values: [row],
      });
    } else {
      appends.push(row);
    }
  }

  if (updates.length > 0) {
    await sheetsApi(token, `${spreadsheetId}/values:batchUpdate`, {
      method: "POST",
      body: { valueInputOption: "RAW", data: updates },
    });
  }
  if (appends.length > 0) {
    await sheetsApi(
      token,
      `${spreadsheetId}/values/${encodeURIComponent(`${tab}!A1`)}:append?valueInputOption=RAW`,
      { method: "POST", body: { values: appends } },
    );
  }
  return { updated: updates.length, appended: appends.length };
}

/**
 * Remove rows from a tab by key.
 *
 * Deleting is not the mirror image of upserting. `upsertRowsToTab` addresses
 * rows by A1 range and can leave a blank; a real delete has to close the gap,
 * which needs `deleteDimension` and therefore the tab's NUMERIC id — the title
 * is not accepted there.
 *
 * Row indexes are deleted in DESCENDING order. Delete row 5 first and every
 * row after it shifts up one, so an ascending pass removes the wrong rows
 * from the second deletion onward. That bug is silent: the call succeeds and
 * the sheet is quietly wrong.
 */
export async function deleteRowsFromTab(opts: {
  tab: string;
  keys: readonly string[];
  keyOf: (row: string[]) => string;
  columns: number;
  /** The owner's chosen sheet + tab-id map, when the caller has them — see
   *  `readSheetId`. Omitted keeps the env-only sheet id and always looks
   *  the tab's numeric id up from the API (the pre-existing behaviour). */
  settings?: SheetIdSettings & { sheetTabIds?: unknown };
}): Promise<{ deleted: number }> {
  const spreadsheetId = readSheetId(opts.settings);
  if (!spreadsheetId) throw new Error("Set SCRAPE_SHEET_ID or SHEET_ID");
  const { tab, keys, keyOf, columns } = opts;
  if (keys.length === 0) return { deleted: 0 };

  const token = await getAccessToken();

  // The owner's recorded tab id skips a metadata round trip entirely — the
  // existing lookup below is the fallback for a tab that hasn't been
  // recorded yet, not the only path.
  const knownId = tabIdFromSettings(opts.settings?.sheetTabIds, tab);
  let sheetId = knownId;
  if (sheetId === undefined) {
    const meta = await sheetsApi<{
      sheets?: { properties?: { title?: string; sheetId?: number } }[];
    }>(token, `${spreadsheetId}?fields=sheets.properties(title,sheetId)`);
    sheetId = (meta.sheets ?? []).find((s) => s.properties?.title === tab)
      ?.properties?.sheetId;
  }
  // No tab means nothing was ever written there — not an error.
  if (sheetId === undefined) return { deleted: 0 };

  const lastCol = columnLetter(columns);
  const existing = await sheetsApi<{ values?: string[][] }>(
    token,
    `${spreadsheetId}/values/${encodeURIComponent(`${tab}!A2:${lastCol}`)}`,
  );

  // Descending order and 0-based ranges are the planner's contract, and
  // sheet-delete-plan.test.ts proves it against a simulated tab — this call
  // site must never re-sort or re-index what it is handed.
  const plan = planRowDeletions({
    rows: existing.values ?? [],
    keyOf,
    keys,
    sheetId,
  });
  if (plan.rowNumbers.length === 0) return { deleted: 0 };

  await sheetsApi(token, `${spreadsheetId}:batchUpdate`, {
    method: "POST",
    body: { requests: plan.requests },
  });
  return { deleted: plan.rowNumbers.length };
}

/**
 * Upsert ScrapeDeck rows into the tier's tab, keyed by
 * `${sourceKey}|${externalId}` (columns A + C). Rows must already be
 * serialized via rowToScrapeDeck.
 */
export async function syncRowsToSheet(
  tier: ScrapeTier,
  rows: string[][],
  settings?: SheetIdSettings,
): Promise<{ updated: number; appended: number }> {
  return upsertRowsToTab({
    tab: TAB_BY_TIER[tier],
    header: SCRAPEDECK_COLUMNS,
    rows,
    keyOf: (row) => (row[0] && row[2] ? `${row[0]}|${row[2]}` : ""),
    settings,
  });
}

/**
 * Upsert bulk-upload "products" rows into the designated sheet's Sheet1 tab,
 * keyed by `slug` (column B). Rows must already be serialized via
 * scrapedRowToProductSheetRow so they re-import through the bulk uploader.
 */
export async function syncProductsToSheet1(
  rows: string[][],
  settings?: SheetIdSettings,
): Promise<{ updated: number; appended: number }> {
  return upsertRowsToTab({
    tab: PRODUCT_SHEET_TAB,
    header: PRODUCT_SHEET_COLUMNS,
    rows,
    keyOf: (row) => row[1] ?? "",
    settings,
  });
}
