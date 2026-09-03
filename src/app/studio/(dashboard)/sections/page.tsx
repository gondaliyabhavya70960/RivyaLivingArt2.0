import type { Metadata } from "next";

import { requireStaffPage } from "@/actions/helpers";
import { PageHeader } from "@/components/studio/page-header";
import { SectionsBoard } from "@/components/studio/sections/sections-board";
import { Role } from "@/generated/prisma/enums";
import {
  PAGE_SECTION_LABELS,
  SECTION_PAGES,
  isSectionPageKey,
  type SectionPageKey,
} from "@/lib/page-sections";
import { countPendingSections } from "@/lib/page-sections-server";
import { buildSectionRows } from "@/lib/page-sections-studio";

export const metadata: Metadata = { title: "Page Sections" };

/**
 * Page Sections — the order a page reads in, and which parts of it show.
 *
 * The last of the three things a page is made of. Words became editable in
 * Phase A and pictures in Phase B; both were addressable all along. Structure
 * was not: the order was the order of the JSX, so moving the Journal rail
 * above the Print studio meant a deploy.
 *
 * What this screen does NOT offer is as deliberate as what it does. There is
 * no "add a section" and no "add a fifth material": the layouts are drawn
 * around specific counts, and a page that can grow arbitrary blocks stops
 * being the page it was designed as. Sections move, hide and come back.
 */
export default async function SectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requireStaffPage();
  const params = await searchParams;

  const pageKey: SectionPageKey =
    params.page && isSectionPageKey(params.page)
      ? params.page
      : SECTION_PAGES[0];

  const [rows, pending] = await Promise.all([
    buildSectionRows(pageKey),
    countPendingSections(pageKey),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Storefront"
        title="Page Sections"
        description="The order a page reads in, and which parts of it show. Words and pictures are edited on Site Copy and Site Images."
      />
      <SectionsBoard
        pageKey={pageKey}
        pages={SECTION_PAGES.map((key) => ({
          key,
          title: PAGE_SECTION_LABELS[key].title,
        }))}
        previewPath={PAGE_SECTION_LABELS[pageKey].path}
        sections={rows}
        pending={pending}
        canReset={session.user.role === Role.ADMIN}
      />
    </div>
  );
}
