import type { Metadata } from "next";

import { requireStaffPage } from "@/actions/helpers";
import { PageHeader } from "@/components/studio/page-header";
import { SectionsBoard } from "@/components/studio/sections/sections-board";
import { Role } from "@/generated/prisma/enums";
import { PAGE_SECTION_LABELS } from "@/lib/page-sections";
import { countPendingSections } from "@/lib/page-sections-server";
import { buildSectionRows } from "@/lib/page-sections-studio";

export const metadata: Metadata = { title: "Materials" };

const PAGE_KEY = "materials" as const;

/**
 * Materials — the four material cards Process and About both show.
 *
 * One arrangement, two pages: §11.4 already treats Process as the canonical
 * description of what a piece is made of, and this screen is that same claim
 * applied to order and visibility. Reordering or hiding a material here moves
 * or hides it on Process's own materials band AND About's — there is no
 * separate "About materials" screen to keep in step with this one.
 */
export default async function StudioMaterialsPage() {
  const session = await requireStaffPage();

  const [rows, pending] = await Promise.all([
    buildSectionRows(PAGE_KEY),
    countPendingSections(PAGE_KEY),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Storefront"
        title="Materials"
        description="The four material cards shared by Process and About — reorder one, hide one, or restore the shipped order. Words and pictures are edited on Site Copy and Site Images."
      />
      <SectionsBoard
        pageKey={PAGE_KEY}
        pages={[{ key: PAGE_KEY, title: PAGE_SECTION_LABELS[PAGE_KEY].title }]}
        previewPath={PAGE_SECTION_LABELS[PAGE_KEY].path}
        sections={rows}
        pending={pending}
        canReset={session.user.role === Role.ADMIN}
      />
    </div>
  );
}
