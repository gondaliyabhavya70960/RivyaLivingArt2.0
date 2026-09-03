import type { Metadata } from "next";

import { requireStaffPage } from "@/actions/helpers";
import { PageHeader } from "@/components/studio/page-header";
import { SiteImageBoard } from "@/components/studio/site-images/site-image-board";
import { Role } from "@/generated/prisma/enums";
import { blobStorageConfigured } from "@/lib/site-images-import";
import { buildSiteImageGroupRows } from "@/lib/site-images-studio";

export const metadata: Metadata = { title: "Site Images" };

/**
 * Site Images — the storefront's editorial photography, slot by slot.
 *
 * Before this screen every hero, macro and process frame was a hardcoded path
 * in the code: changing one meant a deploy. Each is now a named slot with the
 * bundled file as its default, so the owner can replace any of them here and
 * reset back if a choice doesn't work.
 *
 * Reads the rows directly rather than through `getSiteImages()`: the resolver
 * is cached for 24h for the storefront's benefit, and the editing screen must
 * show the row that was just written, not a cached copy of it.
 *
 * Alt text is edited here too, in English, even though it lives in the copy
 * layer. It has to be: an owner who swaps a material macro will not think to
 * open Site Copy and fix the sentence describing it, and the site would then
 * confidently describe the picture it used to have. The other eight languages
 * stay on Site Copy — and fall back to English until they are written.
 */
export default async function SiteImagesPage() {
  const session = await requireStaffPage();

  const groups = await buildSiteImageGroupRows();

  const pendingImport = groups
    .flatMap((g) => g.slots)
    .filter((s) => !s.overridden).length;

  return (
    <div>
      <PageHeader
        eyebrow="Storefront"
        title="Site Images"
        description="Every photograph the storefront places itself — heroes, material macros, process steps, the menu tiles. Product, portfolio and blog pictures are managed on their own screens."
      />
      <SiteImageBoard
        groups={groups}
        canImport={session.user.role === Role.ADMIN}
        blobReady={blobStorageConfigured()}
        pendingImport={pendingImport}
      />
    </div>
  );
}
