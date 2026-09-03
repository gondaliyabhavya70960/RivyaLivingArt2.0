import "server-only";

import { db } from "@/lib/db";
import { defaultLocale } from "@/i18n/config";
import { siteImageMinWidth, siteImageSlotsByGroup } from "@/lib/site-images";
import { readStagedImage } from "@/lib/site-images-server";
import type { MessageTree } from "@/lib/site-copy";
import { readCopyOverridesForStudio } from "@/lib/site-copy-server";
import type { SiteImageGroupRows } from "@/components/studio/site-images/site-image-board";

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
 * The rows the Site Images board renders, built once for every screen that
 * shows them.
 *
 * This used to live inline in `/studio/site-images/page.tsx`. The per-page
 * composer on `/studio/site-copy` needs the same rows for ONE surface, and two
 * copies of a builder that merges published, staged and alt-text state is how
 * the two screens start disagreeing about what an owner has changed — one
 * showing a focal point the other snapped back to centre. One builder; a
 * filter on top.
 *
 * Reads rows directly rather than through `getSiteImages()`: that resolver is
 * cached 24h for the storefront's benefit, and an editing screen must show the
 * row that was just written. Selects `draft` too — every write from the board
 * STAGES, and without the draft column the board re-rendered the old value
 * after a successful save.
 */
export async function buildSiteImageGroupRows(
  only?: string,
): Promise<SiteImageGroupRows[]> {
  const [rows, altOverrides, catalogue] = await Promise.all([
    db.siteImage.findMany({
      select: {
        key: true,
        url: true,
        mobileUrl: true,
        focalX: true,
        focalY: true,
        draft: true,
      },
    }),
    readCopyOverridesForStudio(defaultLocale),
    import("../../messages/en.json").then((m) => m.default as MessageTree),
  ]);

  const overrides = new Map(rows.map((row) => [row.key, row]));

  return siteImageSlotsByGroup()
    .filter((bucket) => only === undefined || bucket.group === only)
    .map(({ group, slots }) => ({
      group,
      slots: slots.map((slot) => {
        const row = overrides.get(slot.key);
        const staged = readStagedImage(row?.draft);
        // Staged wins for DISPLAY; `overridden` still tracks whether a
        // published override exists, because that is what Reset acts on.
        const override = (staged?.url ?? row?.url)?.trim();
        const altDefault = slot.altKey ? lookup(catalogue, slot.altKey) : "";
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
    }));
}
