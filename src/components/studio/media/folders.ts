/**
 * Fixed folder taxonomy for the studio media library. Plain module (no
 * "use client" / "use server") so the RSC page, the client grid and the
 * upload action can all share the same list.
 */
export const MEDIA_FOLDERS = [
  "products",
  "blog",
  "portfolio",
  "site",
  "refs",
  "other",
] as const;

export type MediaFolder = (typeof MEDIA_FOLDERS)[number];
