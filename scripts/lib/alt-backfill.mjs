/**
 * Alt-backfill's pure core — validation and matching, no database, so the
 * test can pin both without a connection.
 *
 * The rules are the codebase's own, from `scripts/alt-audit.mjs` and the
 * Studio's bulk-alt dialog: an alt describes the SUBJECT (never the medium),
 * carries no filename, and stays inside the dialog's own 300-char ceiling —
 * with a note (not a failure) once it runs long enough to be a caption.
 */

/** Copy that announces the medium — a screen reader has already said "image". */
const REDUNDANT =
  /^\s*(an?\s+)?(image|photo|photograph|picture|graphic|illustration|icon|screenshot)\s+(of|showing|depicting)\b/i;
/** A filename that escaped into the copy. */
const FILENAME = /\.(jpe?g|png|webp|avif|gif|svg|mp4|webm)\b/i;

/** Hard ceiling — the Studio's own bulk-alt dialog enforces it. */
export const ALT_MAX = 300;
/** Past ~125–140 chars a description is a caption, not alt text. */
export const ALT_NOTE = 140;

/**
 * One entry's validity. Returns null when clean, a "NOTE: …" when usable
 * but long, and "FAIL: …" when it must not be written.
 */
export function checkAlt(alt) {
  if (typeof alt !== "string" || alt.trim() === "") {
    return "FAIL: empty alt";
  }
  const value = alt.trim();
  if (value.length > ALT_MAX) return `FAIL: ${value.length} chars (max ${ALT_MAX})`;
  if (REDUNDANT.test(value)) {
    return "FAIL: announces the medium — describe the subject instead";
  }
  if (FILENAME.test(value)) return "FAIL: contains a filename";
  if (value.length > ALT_NOTE) return "NOTE: long enough to read as a caption";
  return null;
}

/** The basename of a pathname or URL, without the query string. */
function basename(path) {
  const clean = String(path).split("?")[0];
  return clean.slice(clean.lastIndexOf("/") + 1);
}

/**
 * Match one batch entry to a Media row.
 *
 * Precedence: exact `pathname` → `url` ending with the match string →
 * identical basenames. A basename that matches more than one row is
 * AMBIGUOUS and skipped — writing alt to the wrong picture is worse than
 * leaving it empty, so ambiguity is reported, never guessed.
 *
 * @returns {{row: object} | {ambiguous: string[]} | null}
 */
export function matchMediaRow(rows, match) {
  const exact = rows.find((row) => row.pathname === match);
  if (exact) return { row: exact };

  const byUrl = rows.filter((row) => row.url.endsWith(match));
  if (byUrl.length === 1) return { row: byUrl[0] };
  if (byUrl.length > 1) return { ambiguous: byUrl.map((row) => row.pathname) };

  const wanted = basename(match);
  const byName = rows.filter((row) => basename(row.pathname) === wanted);
  if (byName.length === 1) return { row: byName[0] };
  if (byName.length > 1) return { ambiguous: byName.map((row) => row.pathname) };

  return null;
}