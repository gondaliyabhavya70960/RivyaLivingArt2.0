import type { ComponentType } from "react";

import * as R from "./registry";
import type { IconProps } from "./registry";

/* ————————————————————————————————————————————————————————————————
   THE TYPED NAME UNION — one lookup, checked by the compiler.

   `registry.tsx` holds the marks; this file is the map a caller uses, and the
   reason it exists is that a Studio row renders a mark for a VALUE it has
   (`inquiry.status`), not for a component it imported. Without a map, every
   table writes its own switch, and the fifth one forgets a case — which is
   exactly how the scrape-tier list reached five hand-written copies before
   anyone noticed (CLAUDE.md records that, and the fifth copy is why three new
   tiers once shipped invisible).

   ## The enum maps are EXHAUSTIVE BY TYPE

   Each map below is typed `Record<SomeEnum, IconName>`. Add a value to
   `InquiryStatus` in `prisma/schema.prisma`, regenerate, and this file stops
   compiling until the new state has a mark. That is the whole point: a status
   with no icon should be a build error, not a blank cell somebody notices in
   production.

   The enums are imported from the GENERATED client, so the check is against
   what the database actually has — not against a list re-typed here, which
   would compile forever while drifting.
   ———————————————————————————————————————————————————————————————— */

export type { IconProps, IconSize } from "./registry";

export const ICONS = {
  // craft
  table: R.TableIcon,
  "wall-panel": R.WallPanelIcon,
  vessel: R.VesselIcon,
  pour: R.PourIcon,
  cure: R.CureIcon,
  polish: R.PolishIcon,
  varmala: R.VarmalaIcon,
  frame: R.FrameIcon,
  "clock-face": R.ClockFaceIcon,
  keychain: R.KeychainIcon,
  gift: R.GiftIcon,
  nameplate: R.NameplateIcon,
  "print-layer": R.PrintLayerIcon,
  bench: R.BenchIcon,
  whatsapp: R.WhatsAppIcon,
  // status
  "status-draft": R.StatusDraftIcon,
  "status-review": R.StatusReviewIcon,
  "status-published": R.StatusPublishedIcon,
  "status-archived": R.StatusArchivedIcon,
  "status-declined": R.StatusDeclinedIcon,
  "status-new": R.StatusNewIcon,
  "status-talking": R.StatusTalkingIcon,
  "status-quoted": R.StatusQuotedIcon,
  "status-confirmed": R.StatusConfirmedIcon,
  "status-in-production": R.StatusInProductionIcon,
  "status-delivered": R.StatusDeliveredIcon,
  "status-closed": R.StatusClosedIcon,
  "status-queued": R.StatusQueuedIcon,
  "status-running": R.StatusRunningIcon,
  "status-failed": R.StatusFailedIcon,
  "owner-touched": R.OwnerTouchedIcon,
  demo: R.DemoIcon,
  // media + roles
  "media-image": R.MediaImageIcon,
  "media-video": R.MediaVideoIcon,
  "media-document": R.MediaDocumentIcon,
  "media-model3d": R.MediaModel3dIcon,
  "provenance-ai": R.ProvenanceAiIcon,
  "role-admin": R.RoleAdminIcon,
  "role-editor": R.RoleEditorIcon,
} as const satisfies Record<string, ComponentType<IconProps>>;

export type IconName = keyof typeof ICONS;

/** Every name, for the design-lab sheet and the registry test. */
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/**
 * Render a mark by name.
 *
 * `<Icon name={STATUS_ICON[inquiry.status]} />` is the shape every Studio
 * table uses. A bad name is a type error, so there is no runtime fallback and
 * no "unknown" glyph — an unknown glyph is a silent failure wearing a shape.
 */
export function Icon({ name, ...props }: IconProps & { name: IconName }) {
  const Mark = ICONS[name];
  return <Mark {...props} />;
}
