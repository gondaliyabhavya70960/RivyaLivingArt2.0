export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/["'’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * Returns `base` or `base-2`, `base-3`, … until `exists` is false.
 * Callers pass an existence check scoped to their entity (and excluding
 * the row being edited).
 */
export async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base) || "item";
  let candidate = root;
  for (let i = 2; await exists(candidate); i++) {
    candidate = `${root}-${i}`;
  }
  return candidate;
}

/** True for a Prisma unique-constraint violation (P2002). */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * `uniqueSlug` probes then creates without a lock, so two concurrent creates
 * of the same title (a bulk import racing a manual save, or two scraped rows
 * with identical competitor slugs across instances) can mint the same
 * candidate — the loser then throws an opaque P2002 (ENG-809). This runs the
 * create and, on that race, retries with a short random discriminator so the
 * save succeeds transparently instead of failing. `baseSlug` is the already-
 * deduped candidate; `create` receives the slug to actually persist.
 */
export async function createWithUniqueSlug<T>(
  baseSlug: string,
  create: (slug: string) => Promise<T>,
  attempts = 3,
): Promise<T> {
  let slug = baseSlug;
  for (let i = 0; ; i++) {
    try {
      return await create(slug);
    } catch (error) {
      if (i >= attempts || !isUniqueConstraintError(error)) throw error;
      const { randomBytes } = await import("node:crypto");
      slug = `${baseSlug}-${randomBytes(2).toString("hex")}`;
    }
  }
}
