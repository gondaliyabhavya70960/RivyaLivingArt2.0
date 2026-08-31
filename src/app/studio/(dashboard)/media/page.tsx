import type { Metadata } from "next";

import {
  MEDIA_FOLDERS,
  type MediaFolder,
} from "@/components/studio/media/folders";
import {
  MediaGrid,
  type MediaItem,
} from "@/components/studio/media/media-grid";
import { PageHeader } from "@/components/studio/page-header";
import { db } from "@/lib/db";
import { findMediaUsageDetails, findUnusedMedia } from "@/lib/media-usages";

export const metadata: Metadata = { title: "Media Library" };

/** Grids beyond this get unwieldy — the client shows a truncation note. */
const CAP = 200;

/**
 * The filters that change behaviour rather than convenience
 * (`docs/studio-cms/03-image-layer.md` §3.4).
 *
 * `missing-alt` is a plain column filter and sweeps the whole library.
 * `unused` cannot be: whether a file is referenced is computed live from a
 * dozen tables, deliberately, because a stored counter behind a DELETE button
 * goes stale the first time somebody adds a table and forgets. So it scans in
 * batches and reports how far it got.
 * `ai-generated` is a plain column filter too, and unlike the other two it is
 * not a problem to fix — it answers "which of these did a model draw", which
 * is a question about origin, not about quality.
 */
const BEHAVIOUR_FILTERS = ["missing-alt", "unused", "ai-generated"] as const;
type BehaviourFilter = (typeof BEHAVIOUR_FILTERS)[number];

function readFilter(value: unknown): BehaviourFilter | null {
  return typeof value === "string" &&
    (BEHAVIOUR_FILTERS as readonly string[]).includes(value)
    ? (value as BehaviourFilter)
    : null;
}

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{
    folder?: string | string[];
    q?: string | string[];
    filter?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const rawFolder =
    typeof params.folder === "string" ? params.folder : undefined;
  const q = (typeof params.q === "string" ? params.q : "").trim().slice(0, 120);
  const folder =
    rawFolder && (MEDIA_FOLDERS as readonly string[]).includes(rawFolder)
      ? (rawFolder as MediaFolder)
      : undefined;
  const filter = readFilter(params.filter);

  const grouped = await db.media.groupBy({
    by: ["folder"],
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const group of grouped) counts[group.folder] = group._count._all;
  const total = grouped.reduce((sum, group) => sum + group._count._all, 0);

  const where = {
    ...(folder ? { folder } : {}),
    ...(q
      ? {
          // Search reaches the name the file arrived with and its description,
          // not only the normalised pathname — an owner looking for "the
          // WhatsApp one from July" has nothing else to type.
          OR: [
            { pathname: { contains: q, mode: "insensitive" as const } },
            { originalName: { contains: q, mode: "insensitive" as const } },
            { alt: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    // Alt text is a property of a picture. Asking a video or a 3D model for
    // one would put every GLB in the library on a to-do list.
    ...(filter === "missing-alt" ? { alt: null, type: "IMAGE" as const } : {}),
    ...(filter === "ai-generated" ? { provenance: "AI" as const } : {}),
  };

  let scan: { scanned: number; exhausted: boolean } | null = null;
  let rows: Awaited<ReturnType<typeof db.media.findMany>>;

  if (filter === "unused") {
    const unused = await findUnusedMedia(where, CAP);
    scan = { scanned: unused.scanned, exhausted: unused.exhausted };
    rows = await db.media.findMany({
      where: { id: { in: unused.ids } },
      orderBy: { createdAt: "desc" },
    });
  } else {
    rows = await db.media.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: CAP,
    });
  }

  // "Used in" lines (audit §32) for exactly the rows on screen — one labeled
  // scan across every gallery/cover/settings reference.
  const usageDetails = await findMediaUsageDetails(rows.map((r) => r.url));

  const visibleTotal = folder ? (counts[folder] ?? 0) : total;

  const items: MediaItem[] = rows.map((media) => ({
    id: media.id,
    url: media.url,
    pathname: media.pathname,
    type: media.type,
    folder: media.folder,
    bytes: media.bytes,
    width: media.width,
    height: media.height,
    alt: media.alt,
    originalName: media.originalName,
    provenance: media.provenance,
    usedIn: usageDetails.get(media.url) ?? [],
  }));

  const driver = process.env.BLOB_READ_WRITE_TOKEN
    ? "Vercel Blob"
    : "local dev storage (public/uploads) — connects to Vercel Blob automatically in production";

  return (
    <>
      <PageHeader
        eyebrow="ASSETS"
        title="Media Library"
        description={`Every image, video and 3D model used across the site. Files are stored on ${driver}.`}
      />
      {/* Search (audit §32) — plain GET form; folder and filter survive via
          the hidden fields. */}
      <form
        action="/studio/media"
        className="mb-4 flex max-w-md items-center gap-2"
      >
        {folder && <input type="hidden" name="folder" value={folder} />}
        {filter && <input type="hidden" name="filter" value={filter} />}
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name or description…"
          aria-label="Search media by name or description"
          className="h-11 w-full rounded-input border border-field bg-transparent px-4 text-small text-foreground outline-none placeholder:text-graphite focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        />
        <button
          type="submit"
          className="inline-flex h-11 shrink-0 items-center rounded-input border border-field px-5 text-small font-medium text-foreground outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:border-sapphire-ink/50 focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
        >
          Search
        </button>
      </form>
      <MediaGrid
        items={items}
        counts={counts}
        total={total}
        activeFolder={folder ?? null}
        activeFilter={filter}
        query={q}
        truncated={filter === null && visibleTotal > CAP}
        visibleTotal={visibleTotal}
        scan={scan}
      />
    </>
  );
}
