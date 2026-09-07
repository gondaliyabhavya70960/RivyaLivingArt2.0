/**
 * Pure serialisation for the studio forms' local autosave (10 remnants: "no
 * autosave"). `useLocalDraft` (the client hook that actually touches
 * `localStorage`) is a thin wrapper around this module — everything that can
 * go wrong with a stored draft (missing, corrupt, from a different shape of
 * form) is handled here, where it is testable without a DOM.
 *
 * A draft NEVER reaches the database — it is a local safety net for a tab
 * closed mid-edit, cleared the moment a save succeeds.
 */
export type LocalDraftRecord<T> = {
  /** `Date.now()` at the moment of the write. */
  savedAt: number;
  values: T;
};

/**
 * `localStorage["studio:draft:<entity>:<id|new>"]` — one draft per entity
 * PER ROW, so editing product A never clobbers an abandoned draft on
 * product B, and the create form's draft (`id` absent) is its own slot.
 */
export function draftStorageKey(
  entity: string,
  id: string | undefined,
): string {
  return `studio:draft:${entity}:${id ?? "new"}`;
}

/** `values` → the JSON string written to storage. */
export function serializeDraft<T>(
  values: T,
  savedAt: number = Date.now(),
): string {
  return JSON.stringify({ savedAt, values } satisfies LocalDraftRecord<T>);
}

/**
 * The raw stored string (or `null`, or garbage) → a valid record, or `null`.
 * A malformed value — a draft from before a form's fields changed shape, a
 * half-written string, `localStorage` returning something unexpected — is
 * treated exactly like no draft at all rather than thrown at the caller.
 */
export function parseDraft<T>(raw: string | null): LocalDraftRecord<T> | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  if (typeof record.savedAt !== "number" || !("values" in record)) {
    return null;
  }
  return { savedAt: record.savedAt, values: record.values as T };
}

/**
 * Are two draft value objects the same edit? Order-insensitive for object
 * keys and blind to keys holding `undefined` — a draft round-trips through
 * JSON, which drops those, so a form's `{ note: undefined }` and a restored
 * `{}` are one value, not two. Arrays keep their order: a reordered list IS
 * an edit. Used to keep a value-shaped form from writing a draft that says
 * nothing (equal to what it opened with).
 */
export function sameDraftValues(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => sameDraftValues(item, b[index]));
  }
  if (
    typeof a !== "object" ||
    typeof b !== "object" ||
    a === null ||
    b === null
  ) {
    return false;
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keysOf = (o: Record<string, unknown>) =>
    Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort();
  const leftKeys = keysOf(left);
  const rightKeys = keysOf(right);
  if (leftKeys.length !== rightKeys.length) return false;
  return leftKeys.every(
    (k, i) => k === rightKeys[i] && sameDraftValues(left[k], right[k]),
  );
}

/**
 * A stored draft folded onto the shape the form has NOW. Keys the form no
 * longer has are dropped; keys it has gained, or whose stored value is
 * missing or of a different kind (a string where the form holds an array, a
 * boolean where it holds a string), keep the baseline's value. So a draft
 * written before a field was added or renamed restores what it can and
 * never hands a controlled input `undefined` — which would turn it
 * uncontrolled and throw on the next submit's `.trim()`. A baseline that
 * holds `null` or `undefined` itself says nothing about the field's kind, so
 * the stored value is taken as it is; a stored `null` against a non-null
 * baseline keeps the baseline (no Studio form uses `null` for "empty" — they
 * use `""` — so nothing is lost by it). Anything but an object in storage
 * is the baseline unchanged.
 */
export function coerceDraftValues<T extends Record<string, unknown>>(
  baseline: T,
  stored: unknown,
): T {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) {
    return baseline;
  }
  const source = stored as Record<string, unknown>;
  const out: Record<string, unknown> = { ...baseline };
  for (const key of Object.keys(baseline)) {
    const have = baseline[key];
    const got = source[key];
    if (got === undefined) continue;
    if (have === undefined || have === null) {
      out[key] = got;
      continue;
    }
    if (got === null) continue;
    if (Array.isArray(have) !== Array.isArray(got)) continue;
    if (typeof have !== typeof got) continue;
    out[key] = got;
  }
  return out as T;
}
