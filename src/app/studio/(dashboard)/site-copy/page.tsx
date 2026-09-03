import type { Metadata } from "next";

import { requireStaffPage } from "@/actions/helpers";
import { PageHeader } from "@/components/studio/page-header";
import { PublishBar } from "@/components/studio/publish/publish-bar";
import { RevisionHistory } from "@/components/studio/publish/revision-history";
import {
  SiteCopyBoard,
  type CopyRow,
  type CopySectionRows,
} from "@/components/studio/site-copy/site-copy-board";
import { Role } from "@/generated/prisma/enums";
import { defaultLocale, locales, localeLabels } from "@/i18n/config";
import {
  copyGroupsInUse,
  EDITABLE_COPY_SLOTS,
  type CopyGroup,
  type MessageTree,
} from "@/lib/site-copy";
import {
  countCopyOverrides,
  countPendingForSurface,
  readCopyOverridesForStudio,
} from "@/lib/site-copy-server";

export const metadata: Metadata = { title: "Site Copy" };

/** Resolve a dotted key against a message catalogue. */
function lookup(tree: MessageTree, key: string): string {
  let node: string | MessageTree | undefined = tree;
  for (const segment of key.split(".")) {
    if (typeof node !== "object" || node === null) return "";
    node = node[segment];
  }
  return typeof node === "string" ? node : "";
}

/**
 * Site Copy — every word the storefront places itself, slot by slot.
 *
 * The twin of Site Images. Before this screen, changing a headline meant
 * editing `messages/en.json` and shipping a deploy; every one of those strings
 * already had a stable address, so what was missing was not a way to store the
 * words but a way for the owner to reach them.
 *
 * **One surface and one language at a time, deliberately.** There are 1,115
 * slots across nine locales. Sending them all to the browser would be a
 * multi-megabyte payload and an unusable screen; and editing English and Hindi
 * side by side is how half-translated pages happen. The surface and language
 * live in the URL so a particular screen can be linked and reloaded.
 *
 * Reads rows directly rather than through `getSiteCopy()`: that resolver is
 * cached for 24h for the storefront's benefit, and an editing screen must show
 * the row that was just written.
 */
export default async function SiteCopyPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string; locale?: string }>;
}) {
  const session = await requireStaffPage();
  const params = await searchParams;

  const groups = copyGroupsInUse();
  const group: CopyGroup =
    groups.find((g) => g === params.group) ?? groups[0] ?? "Homepage";
  const locale = (locales as readonly string[]).includes(params.locale ?? "")
    ? (params.locale as string)
    : defaultLocale;

  const [overrides, counts, catalogue] = await Promise.all([
    readCopyOverridesForStudio(locale),
    countCopyOverrides(),
    import(`../../../../../messages/${locale}.json`).then(
      (m) => m.default as MessageTree,
    ),
  ]);

  // Group → section → rows, preserving the catalogue's own order so the board
  // reads down the page the way the page does.
  const bySection = new Map<string, CopyRow[]>();
  for (const slot of EDITABLE_COPY_SLOTS) {
    if (slot.group !== group) continue;
    const fallback = lookup(catalogue, slot.key);
    // A slot with nothing behind it in this locale would render an empty
    // field with no way to tell "not translated" from "deliberately blank".
    if (!fallback) continue;
    const row = overrides[slot.key];
    // The staged wording when there is one, otherwise the published one. The
    // board marks the difference so an owner can always tell what a visitor is
    // reading from what they have written but not yet released.
    const published = row?.value.trim();
    const staged = row?.draftValue?.trim();
    const override = staged || published;
    const rows = bySection.get(slot.section) ?? [];
    rows.push({
      key: slot.key,
      label: slot.label,
      where: slot.where,
      kind: slot.kind,
      tier: slot.tier,
      max: slot.max,
      note: slot.note,
      vars: slot.vars ? [...slot.vars] : undefined,
      tags: slot.tags ? [...slot.tags] : undefined,
      fallback,
      current: override || fallback,
      overridden: Boolean(override),
      unpublished: Boolean(staged && staged !== published),
    });
    bySection.set(slot.section, rows);
  }

  const sections: CopySectionRows[] = [...bySection].map(([section, rows]) => ({
    section,
    rows,
  }));

  // Counted across every language, not just the one on screen: an owner who
  // staged a Hindi edit and switched to English must still see it waiting.
  const pending = await countPendingForSurface(group);

  return (
    <div>
      <PageHeader
        eyebrow="Storefront"
        title="Site Copy"
        description="Every word the storefront places itself — headlines, paragraphs, buttons, image descriptions. Product, category, journal and FAQ words are edited on their own screens."
        // In the header rather than the publish bar: that bar hides itself
        // when nothing is staged, which is exactly when history is wanted —
        // you published something wrong, so there is no draft and no bar.
        actions={<RevisionHistory surface={group} />}
      />
      <SiteCopyBoard
        group={group}
        groups={groups}
        locale={locale}
        locales={locales.map((code) => ({
          code,
          label: localeLabels[code],
          changed: counts[code] ?? 0,
        }))}
        sections={sections}
        canResetGroup={session.user.role === Role.ADMIN}
      />
      <PublishBar
        surface={group}
        pending={pending}
        previewPath={SURFACE_PREVIEW_PATH[group] ?? "/"}
      />
    </div>
  );
}

/** Where to send someone previewing a surface. */
const SURFACE_PREVIEW_PATH: Record<string, string> = {
  Homepage: "/",
  About: "/about",
  Process: "/process",
  Workshops: "/workshops",
  Commission: "/custom-order",
  "Large format": "/large-resin-art",
  Contact: "/contact",
  Portfolio: "/portfolio",
  Journal: "/blog",
  FAQ: "/faq",
  Shop: "/shop",
  Legal: "/privacy",
};
