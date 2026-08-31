/**
 * `SiteSettings.businessHours` → schema.org `openingHours`.
 *
 * The owner types free text — "Mon–Sat", "10:00–19:00" — because that is what
 * belongs on the About page. schema.org wants `Mo-Sa 10:00-19:00`, and a
 * malformed value there is worse than no value: Google reports it as an error
 * on the whole LocalBusiness node. So this converts only what it is sure of
 * and **drops anything it cannot parse**, rather than guessing.
 *
 * Plain module, no server imports.
 */

/** Day names in the orders an owner actually types them. */
const DAYS: Record<string, string> = {
  mon: "Mo",
  monday: "Mo",
  tue: "Tu",
  tues: "Tu",
  tuesday: "Tu",
  wed: "We",
  weds: "We",
  wednesday: "We",
  thu: "Th",
  thur: "Th",
  thurs: "Th",
  thursday: "Th",
  fri: "Fr",
  friday: "Fr",
  sat: "Sa",
  saturday: "Sa",
  sun: "Su",
  sunday: "Su",
};

/** Every dash an owner might type, including the ones a word processor makes. */
const DASHES = /[-–—‐‑‒―]/g;

function normaliseDay(token: string): string | null {
  return DAYS[token.trim().toLowerCase().replace(/\.$/, "")] ?? null;
}

/** "10:00", "10", "10am", "9.30 AM" → "10:00" / "09:30", or null. */
function normaliseTime(token: string): string | null {
  const raw = token.trim().toLowerCase().replace(/\s+/g, "");
  const match = /^(\d{1,2})(?:[:.](\d{2}))?(am|pm)?$/.exec(raw);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3];

  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === "pm" && hour !== 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
  } else if (hour > 24) {
    return null;
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** "Mon–Sat" → "Mo-Sa"; "Mon, Wed" → "Mo,We"; unparseable → null. */
function normaliseDays(value: string): string | null {
  const cleaned = value.replace(DASHES, "-").trim();
  if (!cleaned) return null;

  const groups = cleaned
    .split(/[,/&]|\band\b/i)
    .map((part) => part.trim())
    .filter(Boolean);
  if (groups.length === 0) return null;

  const out: string[] = [];
  for (const group of groups) {
    const range = group.split("-").map((part) => part.trim());
    if (range.length === 1) {
      const day = normaliseDay(range[0]);
      if (!day) return null;
      out.push(day);
      continue;
    }
    if (range.length !== 2) return null;
    const from = normaliseDay(range[0]);
    const to = normaliseDay(range[1]);
    if (!from || !to) return null;
    out.push(`${from}-${to}`);
  }
  return out.join(",");
}

/**
 * Read a bare opening hour against a closing hour that names its half-day.
 *
 * "9 – 5pm" is nine in the MORNING; "1 – 5pm" is one in the afternoon. The
 * rule everyone applies without thinking about it: when the bare hour is
 * greater than the closing hour's clock face, it belongs to the other half of
 * the day; otherwise it shares the closing time's meridiem.
 *
 * Anything else — both sides bare, both sides marked, a 24-hour opening — is
 * returned untouched for `normaliseTime` to read as it stands.
 */
function resolveOpening(open: string, close: string): string {
  if (/am|pm/i.test(open)) return open;
  const meridiem = /am|pm/i.exec(close)?.[0]?.toLowerCase();
  if (!meridiem) return open;

  const openHour = /^\s*(\d{1,2})/.exec(open);
  const closeHour = /^\s*(\d{1,2})/.exec(close);
  if (!openHour || !closeHour) return open;

  const from = Number(openHour[1]);
  const to = Number(closeHour[1]);
  // A 24-hour opening time was never ambiguous.
  if (from > 12) return open;

  const other = meridiem === "pm" ? "am" : "pm";
  return `${open.trim()}${from > to ? other : meridiem}`;
}

/**
 * Turn the owner's rows into `openingHours` strings.
 *
 * A row that does not parse is skipped silently — the About page still shows
 * the owner's own words, and the structured data simply omits that line. An
 * empty result means the caller should leave `openingHours` off the node
 * entirely rather than emit an empty array.
 */
export function toOpeningHours(
  rows: readonly { days: string; hours: string }[],
): string[] {
  const out: string[] = [];
  for (const row of rows) {
    const days = normaliseDays(row.days ?? "");
    if (!days) continue;

    const parts = (row.hours ?? "")
      .replace(DASHES, "-")
      .split("-")
      .map((part) => part.trim());
    if (parts.length !== 2) continue;

    const closing = normaliseTime(parts[1]);
    const opening = normaliseTime(resolveOpening(parts[0], parts[1]));
    if (!opening || !closing) continue;

    out.push(`${days} ${opening}-${closing}`);
  }
  return out;
}
