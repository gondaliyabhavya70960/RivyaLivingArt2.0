import type { Metadata } from "next";

import { requireStaffPage } from "@/actions/helpers";
import { PageHeader } from "@/components/studio/page-header";
import {
  SiteImageBoard,
  type SiteImageGroupRows,
} from "@/components/studio/site-images/site-image-board";
import { Role } from "@/generated/prisma/enums";
import { db } from "@/lib/db";
import { defaultLocale } from "@/i18n/config";
import { siteImageMinWidth, siteImageSlotsByGroup } from "@/lib/site-images";
import { blobStorageConfigured } from "@/lib/site-images-import";
import { readStagedImage } from "@/lib/site-images-server";
import type { MessageTree } from "@/lib/site-copy";
import { readCopyOverridesForStudio } from "@/lib/site-copy-server";

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

  const [rows, altOverrides, catalogue] = await Promise.all([
    db.siteImage.findMany({
      select: {
        key: true,
        url: true,
        mobileUrl: true,
        focalX: true,
        focalY: true,
        // Every write from this screen STAGES (actions/site-images.ts:80-86,
        // 130-141, 178-183) — the published columns are untouched until the
        // surface is published. Selecting only those columns meant the board
        // re-rendered the OLD value after a successful save: a focal point
        // snapped back to centre, and swapping an already-overridden slot
        // still showed the previous picture. The editing screen has to show
        // the row it just wrote.
        draft: true,
      },
    }),
    readCopyOverridesForStudio(defaultLocale),
    import("../../../../../messages/en.json").then(
      (m) => m.default as MessageTree,
    ),
  ]);

  const overrides = new Map(rows.map((row) => [row.key, row]));

  /** Resolve a dotted key against the English catalogue. */
  const lookup = (key: string): string => {
    let node: string | MessageTree | undefined = catalogue;
    for (const segment of key.split(".")) {
      if (typeof node !== "object" || node === null) return "";
      node = node[segment];
    }
    return typeof node === "string" ? node : "";
  };

  const groups: SiteImageGroupRows[] = siteImageSlotsByGroup().map(
    ({ group, slots }) => ({
      group,
      slots: slots.map((slot) => {
        const row = overrides.get(slot.key);
        const staged = readStagedImage(row?.draft);
        // Staged wins for DISPLAY; `overridden` still tracks whether a
        // published override exists, because that is what Reset acts on.
        const override = (staged?.url ?? row?.url)?.trim();
        const altDefault = slot.altKey ? lookup(slot.altKey) : "";
        const altOverride = slot.altKey
          ? (altOverrides[slot.altKey]?.draftValue?.trim() ??
            altOverrides[slot.altKey]?.value.trim())
          : undefined;
        return {
          ...slot,
          current: override || slot.fallback,
          overridden: Boolean(override),
          mobileUrl:
            (staged && "mobileUrl" in staged
              ? staged.mobileUrl
              : row?.mobileUrl
            )?.trim() || null,
          focalX: staged?.focalX ?? row?.focalX ?? 0.5,
          focalY: staged?.focalY ?? row?.focalY ?? 0.5,
          unpublished: staged !== null,
          minWidth: siteImageMinWidth(slot.ratio),
          alt: slot.altKey ? altOverride || altDefault : null,
          altOverridden: Boolean(altOverride),
        };
      }),
    }),
  );

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
