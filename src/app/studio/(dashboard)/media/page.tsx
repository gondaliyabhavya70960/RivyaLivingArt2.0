import type { Metadata } from "next";

import {
  MediaGrid,
  type MediaItem,
} from "@/components/studio/media/media-grid";
import { PageHeader } from "@/components/studio/page-header";
import {
  folderCounts,
  parseFilters,
  queryMedia,
  totalCount,
  typeCounts,
} from "./query";

export const metadata: Metadata = { title: "Media Library" };

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const filters = parseFilters(params);

  const [result, folders, types, total] = await Promise.all([
    queryMedia(filters),
    folderCounts(),
    typeCounts(),
    totalCount(),
  ]);

  const items: MediaItem[] = result.rows.map((media) => ({
    id: media.id,
    url: media.url,
    pathname: media.pathname,
    type: media.type,
    folder: media.folder,
    bytes: media.bytes,
    width: media.width,
    height: media.height,
    alt: media.alt,
    caption: media.caption,
    tags: media.tags,
    favourite: media.favourite,
    duration: media.duration,
    posterUrl: media.posterUrl,
    originalName: media.originalName,
    provenance: media.provenance,
    checksum: media.checksum,
    dominantHex: media.dominantHex,
    createdAt: media.createdAt.toISOString(),
    isDemo: media.isDemo,
    usedIn: result.usageDetails.get(media.url) ?? [],
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
      <MediaGrid
        items={items}
        folderCounts={folders}
        typeCounts={types}
        total={total}
        filters={filters}
        nextCursor={result.nextCursor}
        scan={result.scan}
      />
    </>
  );
}
