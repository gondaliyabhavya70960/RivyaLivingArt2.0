/**
 * A bounded "before" picture of a row for the activity log.
 *
 * `ActivityLog.meta` recorded who changed what and when, but never what it
 * looked like before — so an accidental edit had nothing to compare against.
 * This copies only the fields the caller names, drops object values (Json
 * bodies would swamp the row), and truncates strings until the serialised
 * result fits under `maxBytes`, marking the cut so a reader knows it is
 * partial. Pure, so the Studio actions and the tests share it.
 */
export type Snapshot<T extends object> = Partial<T> & { truncated?: true };

export function snapshotBefore<T extends object>(
  row: T,
  fields: readonly (keyof T)[],
  maxBytes = 8_192,
): Snapshot<T> {
  const out: Record<string, unknown> = {};
  let truncated = false;
  for (const key of fields) {
    const value = row[key];
    if (value === undefined) continue;
    if (value !== null && typeof value === "object" && !(value instanceof Date)) {
      truncated = true;
      continue;
    }
    out[key as string] = value instanceof Date ? value.toISOString() : value;
  }

  const size = () => Buffer.byteLength(JSON.stringify(out), "utf8");
  // Trim the longest string first until it fits; a row with only short
  // scalars never enters the loop.
  while (size() > maxBytes) {
    const longest = Object.entries(out)
      .filter((e): e is [string, string] => typeof e[1] === "string")
      .sort((a, b) => b[1].length - a[1].length)[0];
    if (!longest || longest[1].length <= 16) break;
    out[longest[0]] = longest[1].slice(0, Math.floor(longest[1].length / 2));
    truncated = true;
  }

  return (truncated ? { ...out, truncated: true } : out) as Snapshot<T>;
}
