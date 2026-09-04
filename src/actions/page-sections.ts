"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";

import { requireStaff, runAction, type ActionResult } from "@/actions/helpers";
import { logActivity } from "@/lib/activity";
import { db } from "@/lib/db";
import {
  PAGE_SECTIONS,
  applyReorder,
  describeArrangementProblem,
  isSectionPageKey,
  sectionDef,
  type SectionPageKey,
} from "@/lib/page-sections";
import {
  PAGE_SECTIONS_TAG,
  readSectionsForStudio,
} from "@/lib/page-sections-server";

/**
 * Section arrangement — the write half of /studio/sections.
 *
 * Every write is STAGED, like copy and images: an owner rearranging a page
 * previews the whole new order before a visitor sees any of it.
 *
 * The band-rhythm rules are checked HERE, on the resolved arrangement, and
 * they refuse rather than warn. `scripts/redesign-audit.mjs` enforces the same
 * rules in CI — but CI does not run when the owner presses Publish, so a page
 * with four dark bands would ship and only fail on somebody's next PR.
 */

const STUDIO_PATH = "/studio/sections";

const pageSchema = z.string().refine(isSectionPageKey, "Unknown page");

function revalidate() {
  revalidateTag(PAGE_SECTIONS_TAG, "max");
  revalidatePath(STUDIO_PATH);
}

/** Ensure every section of a page has a row, so order is writable. */
async function ensureRows(pageKey: SectionPageKey, userId: string) {
  const existing = await db.pageSection.findMany({
    where: { pageKey },
    select: { key: true },
  });
  const have = new Set(existing.map((r) => r.key));
  const missing = PAGE_SECTIONS[pageKey]
    .map((def, index) => ({ def, index }))
    .filter(({ def }) => !have.has(def.key));
  if (missing.length === 0) return;
  await db.pageSection.createMany({
    // `visible` is seeded from the REGISTRY, not left to the column default.
    // The resolver reads `row?.visible ?? def.defaultVisible ?? true`, so a
    // section that ships OFF (the homepage's furniture and rooms concept
    // bands, the large-format pieces band) is off only while it HAS NO ROW.
    // This function creates rows for every section of a page the moment the
    // owner touches any one of them — so without this, dragging one section
    // or leaving a note silently switched those bands on, live, with no
    // Publish and nothing in the UI saying so.
    data: missing.map(({ def, index }) => ({
      pageKey,
      key: def.key,
      order: index,
      visible: def.defaultVisible ?? true,
      updatedById: userId,
    })),
  });
}

/**
 * Check an arrangement before writing it.
 *
 * Takes the arrangement as it WOULD BE, not as it is, so the refusal happens
 * before the row is written rather than after.
 */
function checkArrangement(
  pageKey: SectionPageKey,
  arrangement: { key: string; visible: boolean }[],
): string | null {
  const ordered = arrangement
    .map((entry) => {
      const def = sectionDef(pageKey, entry.key);
      return def ? { ...def, visible: entry.visible } : null;
    })
    .filter((v): v is NonNullable<typeof v> => v !== null);
  return describeArrangementProblem(ordered);
}

/** Stage a new order for one page. */
export async function reorderSections(input: {
  pageKey: string;
  keys: string[];
}): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN", "EDITOR"]);
    const pageKey = pageSchema.parse(input.pageKey);
    await ensureRows(pageKey, session.user.id);

    const current = await readSectionsForStudio(pageKey);

    // A pinned section keeps its index whatever the client sent. The board
    // runs the same helper before it calls, so what it previews is what the
    // action writes.
    const next = applyReorder(current, input.keys);

    const problem = describeArrangementProblem(next);
    if (problem) throw new Error(problem);

    await db.$transaction(
      next.map((section, index) =>
        db.pageSection.update({
          where: { pageKey_key: { pageKey, key: section.key } },
          data: { draftOrder: index, updatedById: session.user.id },
        }),
      ),
    );

    await logActivity({
      userId: session.user.id,
      action: "reorder",
      entity: "PageSection",
      entityId: pageKey,
    });
    revalidate();
    return undefined;
  });
}

/** Stage showing or hiding one section. */
export async function setSectionVisible(input: {
  pageKey: string;
  key: string;
  visible: boolean;
}): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN", "EDITOR"]);
    const pageKey = pageSchema.parse(input.pageKey);
    const def = sectionDef(pageKey, input.key);
    if (!def) throw new Error("Unknown section");
    if (!def.hideable && !input.visible) {
      throw new Error(
        `${def.label} is part of the page's structure and cannot be hidden.`,
      );
    }
    await ensureRows(pageKey, session.user.id);

    const current = await readSectionsForStudio(pageKey);
    const problem = checkArrangement(
      pageKey,
      current.map((s) => ({
        key: s.key,
        visible: s.key === input.key ? input.visible : s.visible,
      })),
    );
    if (problem) throw new Error(problem);

    await db.pageSection.update({
      where: { pageKey_key: { pageKey, key: input.key } },
      data: { draftVisible: input.visible, updatedById: session.user.id },
    });

    await logActivity({
      userId: session.user.id,
      action: input.visible ? "show" : "hide",
      entity: "PageSection",
      entityId: `${pageKey}:${input.key}`,
    });
    revalidate();
    return undefined;
  });
}

/** A staff note on a section — why it is arranged the way it is. */
export async function setSectionNote(input: {
  pageKey: string;
  key: string;
  note: string;
}): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN", "EDITOR"]);
    const pageKey = pageSchema.parse(input.pageKey);
    if (!sectionDef(pageKey, input.key)) throw new Error("Unknown section");
    await ensureRows(pageKey, session.user.id);

    const note = input.note.trim().slice(0, 300);
    await db.pageSection.update({
      where: { pageKey_key: { pageKey, key: input.key } },
      data: { notes: note || null, updatedById: session.user.id },
    });
    revalidate();
    return undefined;
  });
}

/** Promote a page's staged arrangement. */
export async function publishSections(
  pageKeyInput: string,
): Promise<ActionResult<{ published: number }>> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN", "EDITOR"]);
    const pageKey = pageSchema.parse(pageKeyInput);

    const rows = await db.pageSection.findMany({ where: { pageKey } });
    const staged = rows.filter(
      (r) =>
        (r.draftOrder != null && r.draftOrder !== r.order) ||
        (r.draftVisible != null && r.draftVisible !== r.visible),
    );
    if (staged.length === 0) return { published: 0 };

    await db.$transaction(
      rows.map((r) =>
        db.pageSection.update({
          where: { id: r.id },
          data: {
            order: r.draftOrder ?? r.order,
            visible: r.draftVisible ?? r.visible,
            draftOrder: null,
            draftVisible: null,
          },
        }),
      ),
    );

    await logActivity({
      userId: session.user.id,
      action: "publish",
      entity: "PageSection",
      entityId: pageKey,
      meta: { sections: staged.length },
    });
    revalidate();
    return { published: staged.length };
  });
}

/** Throw away a page's staged arrangement. */
export async function discardSectionDraft(
  pageKeyInput: string,
): Promise<ActionResult<{ discarded: number }>> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN", "EDITOR"]);
    const pageKey = pageSchema.parse(pageKeyInput);
    const { count } = await db.pageSection.updateMany({
      where: { pageKey },
      data: { draftOrder: null, draftVisible: null },
    });
    await logActivity({
      userId: session.user.id,
      action: "discard-draft",
      entity: "PageSection",
      entityId: pageKey,
    });
    revalidate();
    return { discarded: count };
  });
}

/** Put a page back to the arrangement it ships with. */
export async function resetSections(
  pageKeyInput: string,
): Promise<ActionResult> {
  return runAction(async () => {
    const session = await requireStaff(["ADMIN"]);
    const pageKey = pageSchema.parse(pageKeyInput);
    await db.pageSection.deleteMany({ where: { pageKey } });
    await logActivity({
      userId: session.user.id,
      action: "reset",
      entity: "PageSection",
      entityId: pageKey,
    });
    revalidate();
    return undefined;
  });
}
