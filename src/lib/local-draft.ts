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
