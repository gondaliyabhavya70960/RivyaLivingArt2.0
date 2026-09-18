import type { Metadata } from "next";
import Link from "next/link";

import { requireStaffPage } from "@/actions/helpers";
import { PageHeader } from "@/components/studio/page-header";
import { PublishBar } from "@/components/studio/publish/publish-bar";
import { RevisionHistory } from "@/components/studio/publish/revision-history";
import { SectionsBoard } from "@/components/studio/sections/sections-board";
import {
  SiteCopyBoard,
  type CopyRow,
  type CopySectionRows,
} from "@/components/studio/site-copy/site-copy-board";
import { SurfaceSwitcher } from "@/components/studio/site-copy/surface-switcher";
import { SurfaceTabs } from "@/components/studio/site-copy/surface-tabs";
import { SiteImageBoard } from "@/components/studio/site-images/site-image-board";
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
import {
  PAGE_SECTION_LABELS,
  sublistsForPage,
  type SectionPageKey,
} from "@/lib/page-sections";
import { countPendingSections } from "@/lib/page-sections-server";
import { buildSectionRows, pageKeyForPath } from "@/lib/page-sections-studio";
import { blobStorageConfigured } from "@/lib/site-images-import";
import { buildSiteImageGroupRows } from "@/lib/site-images-studio";
import { isSurfaceTab, type SurfaceTab } from "@/lib/surface-tabs";

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
 * Site Copy — and, since the per-page composer landed, the pictures and the
 * section order of the same page, on the same screen.
 *
 * The roadmap asked for a "unified per-page editor composing words, pictures
 * and order from the registries — UI composition, no data change". It named
 * `/studio/pages/<key>` for it, but that route is already the `Page` model
 * editor (About, the policies) keyed by cuid, and a `<key>` route beside a
 * `[id]` route is a collision. This screen was already scoped to one surface,
 * already carried the surface's publish bar and revision history, and the
 * image and copy registries already share its surface names — so the three
 * boards compose HERE, under one surface picker, as Words · Pictures · Order.
 * The two standalone screens remain for anyone who reaches them from the
 * sidebar; they render the same rows from the same builders.
 *
 * Originally: every word the storefront places itself, slot by slot — the
 * twin of Site Images. Before this screen, changing a headline meant
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
  searchParams: Promise<{
    group?: string;
    locale?: string;
    tab?: string;
    board?: string;
  }>;
}) {
  const session = await requireStaffPage();
  const params = await searchParams;

  const groups = copyGroupsInUse();
  const group: CopyGroup =
    groups.find((g) => g === params.group) ?? groups[0] ?? "Homepage";
  const locale = (locales as readonly string[]).includes(params.locale ?? "")
    ? (params.locale as string)
    : defaultLocale;

  // The section manifest covers seven pages; the join is by public path, so
  // a surface with no matching page simply has no Order tab. Only an EXPLICIT
  // path may join: "Site chrome" and "System" are copy groups with no page of
  // their own, and the preview fallback of "/" would otherwise hand them the
  // Homepage's sections to reorder.
  const explicitPath = SURFACE_PREVIEW_PATH[group];
  const previewPath = explicitPath ?? "/";
  const pageKey = explicitPath ? pageKeyForPath(explicitPath) : null;

  // A URL asking for the Order tab of a surface that has none lands on Words
  // rather than an empty panel.
  const requestedTab = params.tab;
  const tab: SurfaceTab =
    isSurfaceTab(requestedTab) && (requestedTab !== "order" || pageKey !== null)
      ? requestedTab
      : "words";

  /* S9: the Order tab arranges the page's own bands AND any sublist living
     inside it — Process Steps and Materials, which are the same
     `SectionsBoard` filtered to one key and used to be two separate screens.
     `?board=` picks which; anything unrecognised falls back to the page
     itself, so a stale link cannot land on an empty panel.

     The board's own page switcher is not reused: it hardcodes
     `/studio/sections?page=`, which would navigate OUT of this hub. It stays
     hidden here (one entry) and this screen draws its own, in-hub. */
  const orderBoards: SectionPageKey[] = pageKey
    ? [pageKey, ...sublistsForPage(pageKey)]
    : [];
  const board: SectionPageKey | null =
    orderBoards.find((key) => key === params.board) ?? pageKey;

  const [overrides, counts, catalogue, imageGroups, sectionData] =
    await Promise.all([
      readCopyOverridesForStudio(locale),
      countCopyOverrides(),
      import(`../../../../../messages/${locale}.json`).then(
        (m) => m.default as MessageTree,
      ),
      buildSiteImageGroupRows(group),
      board
        ? Promise.all([buildSectionRows(board), countPendingSections(board)])
        : Promise.resolve(null),
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
  // The figure covers copy AND images for the surface — the same unit the
  // publish bar promotes — so the per-tab badges split it: images are counted
  // exactly (they are not per-locale), and the remainder is words.
  const pending = await countPendingForSurface(group);
  const picturesPending = imageGroups
    .flatMap((g) => g.slots)
    .filter((slot) => slot.unpublished).length;
  const wordsPending = Math.max(0, pending - picturesPending);
  const orderPending = sectionData ? sectionData[1] : 0;

  const canReset = session.user.role === Role.ADMIN;
  const hrefFor = (g: CopyGroup) =>
    `/studio/site-copy?group=${encodeURIComponent(g)}&locale=${locale}` +
    (tab !== "words" ? `&tab=${tab}` : "");

  return (
    <div>
      <PageHeader
        eyebrow="Storefront"
        title="Site Copy"
        description="One page at a time: its words, its pictures and the order its sections read in. Pick the page, then the tab. Product, category, journal and FAQ words are edited on their own screens."
        // In the header rather than the publish bar: that bar hides itself
        // when nothing is staged, which is exactly when history is wanted —
        // you published something wrong, so there is no draft and no bar.
        actions={<RevisionHistory surface={group} />}
      />

      {/* The surface applies to all three tabs, so its picker sits above them
          rather than inside the words board where it used to live. */}
      <div className="mb-6">
        <SurfaceSwitcher groups={groups} group={group} hrefFor={hrefFor} />
      </div>

      <SurfaceTabs
        tab={tab}
        counts={{
          words: wordsPending,
          pictures: picturesPending,
          order: orderPending,
        }}
        words={
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
            canResetGroup={canReset}
            hideSurfaceSwitcher
          />
        }
        pictures={
          imageGroups.length === 0 ? (
            <p className="max-w-[70ch] text-small leading-relaxed text-graphite">
              This surface places no editorial photography of its own. Page
              pictures live on the surfaces that render them; catalogue,
              portfolio and journal images are managed on their own screens.
            </p>
          ) : (
            <SiteImageBoard
              groups={imageGroups}
              embedded
              // Importing the bundled files is a whole-site action and lives
              // on the Site Images screen; here the surface's pictures only.
              canImport={false}
              blobReady={blobStorageConfigured()}
              pendingImport={0}
            />
          )
        }
        order={
          board && sectionData ? (
            <div className="space-y-6">
              {/* The in-hub board picker. Only drawn when the page HAS a
                  sublist, so six of the seven surfaces are unchanged. Plain
                  links rather than a client control: the whole panel is
                  server-rendered and the selection is already in the URL. */}
              {orderBoards.length > 1 ? (
                <nav
                  aria-label="Arrangement"
                  className="flex flex-wrap gap-1.5"
                >
                  {orderBoards.map((key) => (
                    <Link
                      key={key}
                      href={`/studio/site-copy?group=${encodeURIComponent(group)}&locale=${locale}&tab=order&board=${key}`}
                      aria-current={key === board ? "page" : undefined}
                      scroll={false}
                      className={
                        key === board
                          ? "rounded-md border border-foreground bg-foreground px-3 py-1.5 text-small text-background"
                          : "rounded-md border border-border px-3 py-1.5 text-small text-graphite transition-colors hover:border-foreground hover:text-foreground"
                      }
                    >
                      {PAGE_SECTION_LABELS[key].title}
                    </Link>
                  ))}
                </nav>
              ) : null}
              <SectionsBoard
                pageKey={board}
                // One entry hides the board's own page switcher — the picker
                // above is this screen's, and the board's would leave the hub.
                pages={[{ key: board, title: PAGE_SECTION_LABELS[board].title }]}
                previewPath={PAGE_SECTION_LABELS[board].path}
                sections={sectionData[0]}
                pending={orderPending}
                canReset={canReset}
              />
            </div>
          ) : null
        }
      />

      <PublishBar surface={group} pending={pending} previewPath={previewPath} />
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
