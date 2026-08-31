/**
 * The seeded legal pages the public site footer links to. Plain module
 * (no "use client" / "use server") so the RSC list page, the client form
 * and the server actions can all share the same guard.
 */
export const LEGAL_PAGE_SLUGS = ["privacy", "terms"] as const;

export function isLegalPageSlug(slug: string): boolean {
  return (LEGAL_PAGE_SLUGS as readonly string[]).includes(slug);
}
