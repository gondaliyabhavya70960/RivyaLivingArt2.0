import type { Metadata } from "next";

import { requireStaffPage } from "@/actions/helpers";
import { PageHeader } from "@/components/studio/page-header";
import { SectionsBoard } from "@/components/studio/sections/sections-board";
import { Role } from "@/generated/prisma/enums";
import { PAGE_SECTION_LABELS } from "@/lib/page-sections";
import { countPendingSections } from "@/lib/page-sections-server";
import { buildSectionRows } from "@/lib/page-sections-studio";

export const metadata: Metadata = { title: "Process Steps" };

const PAGE_KEY = "process-steps" as const;

/**
 * Process Steps — the ten cards inside `/process`'s own "stages" band,
 * arranged one level below Page Sections.
 *
 * This is the same `SectionsBoard` `/studio/sections` renders, filtered to
 * one page key and given its own route (roadmap decision 1): every field
 * here already exists as a copy key and an image slot, and draft/publish
 * come free from the board it shares — a second implementation would only
 * be a second place for the two to drift apart. (Arrangements are not
 * revisioned: `publishSections` writes no `ContentRevision`, so the history
 * button on the copy composer covers this surface's words and pictures,
 * not its order. Giving it one is a Server Action change, recorded on the
 * roadmap as a decision.)
 * A `describeArrangementProblem` guard refuses to hide all ten (a process
 * page cannot lose every stage); the board surfaces that refusal same as it
 * does the dark-band rules.
 */
export default async function StudioProcessStepsPage() {
  const session = await requireStaffPage();

  const [rows, pending] = await Promise.all([
    buildSectionRows(PAGE_KEY),
    countPendingSections(PAGE_KEY),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Storefront"
        title="Process Steps"
        description="The ten cards in the Process page's own timeline — reorder them, hide one, or restore the shipped order. Words and pictures are edited on Site Copy and Site Images."
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
