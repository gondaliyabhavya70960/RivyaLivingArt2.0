import type { ReactNode, SVGProps } from "react";

import { cn } from "@/lib/utils";

/* ————————————————————————————————————————————————————————————————
   RIVYA CRAFT ICONS — the hand-authored SVG registry (§4.5, owner decisions
   14 and 15).

   STYLE, and it is a contract rather than a preference. Every mark in this
   file obeys all of it; a new one that does not is a mark that will read as
   borrowed:

     · 24px grid · viewBox "0 0 24 24", always, whatever size it renders at
     · 1.5px stroke, round caps, round joins
     · fill="none" · stroke="currentColor"
     · duotone fill is champagne at 18%, and only on the brand set
     · optical alignment over mathematical centring
     · aria-hidden unless the icon is the only label, and then a <title>

   `currentColor` is the load-bearing one. Every mark inherits the ink of
   wherever it is dropped, so a mark in a champagne row goes champagne and the
   same mark in a mist row goes mist — no variant, no prop, no second file.
   A hard-coded stroke here would be a light patch on a dark screen the day
   someone drops it in a new scope.

   ## WHAT IS NOT HERE, AND WHY

   `lucide-react` stays for functional Studio UI (owner decision 14 — which
   corrects `design/implementation-plan.md §4.5`'s "zero libraries" line to
   mean "no SECOND icon package"). Search, edit, delete, save, settings,
   chevron, close and their kind are interface glyphs a person already knows;
   replacing them with abstract brand art costs recognition and buys nothing.
   What is hand-authored is what lucide cannot know: this studio's CRAFT (a
   pour, a cure, a varmala), and this schema's STATE.

   ## THE STATUS MARKS COME FROM THE REAL ENUMS

   Every status name below was read out of `prisma/schema.prisma`, not from a
   brief. Three of the four merged briefs proposed statuses this project does
   not have — "poured" and "shipped" are not in `InquiryStatus`, and one brief
   assumed five roles where `Role` has two. A status mark for a state that
   cannot exist is worse than a missing one: it renders in a legend, and a
   person reasonably concludes the pipeline has a stage it does not.

   ## SIZES

   16 dense/table · 18 navigation · 20 primary toolbar · 24 page headers and
   empty-state art. `size` takes any of them; the grid never changes, so a
   mark at 16 is the same mark, not a redrawn one.
   ———————————————————————————————————————————————————————————————— */

export type IconSize = 16 | 18 | 20 | 24;

export type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & {
  size?: IconSize;
  /**
   * The accessible name, WHEN THIS MARK IS THE ONLY LABEL. Omit it — the
   * default — and the icon is `aria-hidden`, which is correct beside visible
   * text: announcing "clock, in production" reads the state twice.
   */
  title?: string;
};

/**
 * The shared `<svg>`. Every mark is this plus a path, which is what keeps the
 * style contract above true by construction instead of by review: the grid,
 * the stroke width, the caps and the `currentColor` are set once, here, and a
 * mark cannot opt out of them without being written differently on purpose.
 */
function Svg({
  size = 20,
  title,
  className,
  children,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      // `aria-hidden` when there is no title, `role="img"` with one when there
      // is. Never both, and never a title that duplicates adjacent text.
      {...(title
        ? { role: "img" as const }
        : { "aria-hidden": true, focusable: false })}
      className={cn("shrink-0", className)}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

/* ————————————————————— CRAFT MARKS —————————————————————
   What this studio actually makes and does. Reusable on the storefront where
   they already belong (the process band, the tier doorways) — that is §4.5's
   own allowance, and the reason these are not named `studio-*`. */

/** A live-edge table: the slab, its resin channel, two legs. */
export const TableIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 8h19" />
    <path d="M2.5 8c3.2 1.4 6 .4 9-.6 3-1 5.8-1 7.5.6" />
    <path d="M5 8v11" />
    <path d="M19 8v11" />
  </Svg>
);

/** A wall panel: the frame, and the flow across it. */
export const WallPanelIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="3.5" width="18" height="17" rx="1" />
    <path d="M3 13c3-2.5 5.5 1.5 9-.5s5.5-3 9-1" />
  </Svg>
);

/** A turned vessel. */
export const VesselIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.5 3h7l-.7 3.2a6.5 6.5 0 0 0 1.2 5.4 6.8 6.8 0 0 1-2.4 10.3 4.8 4.8 0 0 1-3.2 0A6.8 6.8 0 0 1 8 11.6a6.5 6.5 0 0 0 1.2-5.4Z" />
    <path d="M8.1 11.6c2.6 1.2 5.2 1.2 7.8 0" />
  </Svg>
);

/** The pour — a droplet mid-fall, with the surface it is about to meet. */
export const PourIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2.5c2.6 3.5 4 5.9 4 7.6a4 4 0 1 1-8 0c0-1.7 1.4-4.1 4-7.6Z" />
    <path d="M3.5 18.5c2.5-1.3 4.5 1 7-.2 2.5-1.2 5-1.2 8 .4" />
  </Svg>
);

/** The cure — a clock, because curing is measured in hours, not in doing. */
export const CureIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7v5.2l3.3 2" />
  </Svg>
);

/** The polish — a facet catching light at 3000 grit. */
export const PolishIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 3 6.5 5.2-2.5 10h-8L5.5 8.2 12 3Z" />
    <path d="m5.5 8.2 6.5 2 6.5-2" />
    <path d="M12 10.2v8" />
  </Svg>
);

/** Varmala — the preserved garland. */
export const VarmalaIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 4.5a5 5 0 0 0-5 5c0 4 5 9.5 5 9.5s5-5.5 5-9.5a5 5 0 0 0-5-5Z" />
    <circle cx="12" cy="9.3" r="2.2" />
  </Svg>
);

/** A frame — the preserved photograph. */
export const FrameIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="1" />
    <rect x="7" y="7" width="10" height="10" rx="0.5" />
  </Svg>
);

/** A clock face, as an OBJECT — the product, not the cure time. */
export const ClockFaceIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 4v1.6M20 12h-1.6M12 20v-1.6M4 12h1.6" />
    <path d="M12 8.4v3.8l2.6 1.6" />
  </Svg>
);

/** A keychain. */
export const KeychainIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="4.5" />
    <path d="m11.4 11 4.2 4.2" />
    <path d="m14.6 14.2 4 4-2.4 2.4-4-4" />
  </Svg>
);

/** A gift. */
export const GiftIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="9" width="18" height="11.5" rx="1" />
    <path d="M2 9h20" />
    <path d="M12 9v11.5" />
    <path d="M12 9c-1-2.8-2.3-4.2-4-4.2a2.1 2.1 0 0 0 0 4.2Z" />
    <path d="M12 9c1-2.8 2.3-4.2 4-4.2a2.1 2.1 0 0 1 0 4.2Z" />
  </Svg>
);

/** A nameplate. */
export const NameplateIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="6.5" width="19" height="11" rx="1" />
    <path d="M6.5 11h7M6.5 14h4" />
  </Svg>
);

/** 3D print — stacked layers. */
export const PrintLayerIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m12 3 8 4-8 4-8-4 8-4Z" />
    <path d="m4 11.5 8 4 8-4" />
    <path d="m4 16 8 4 8-4" />
  </Svg>
);

/** The workshop bench. */
export const BenchIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 9.5h19v3h-19z" />
    <path d="M5 12.5v8M19 12.5v8" />
    <path d="M5 16.5h14" />
    <path d="M9 9.5V6.5h6v3" />
  </Svg>
);

/** WhatsApp — the order channel. Hand-authored to the 24 grid like the rest. */
export const WhatsAppIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 20.5l1.3-4.2A8.2 8.2 0 1 1 8 19.3l-4.5 1.2Z" />
    <path d="M9 9c.3 1.5 1.2 3 2.4 4.1 1.2 1.1 2.5 1.7 3.6 1.9l1-1.5 1.7.9-.5 1.6c-1.9.5-4.3-.5-6.2-2.3S8 9.6 8.4 7.8L10 7.3l.8 1.8L9 9Z" />
  </Svg>
);

/* ————————————————————— STATUS MARKS —————————————————————
   Read from prisma/schema.prisma, never from a brief. Each one is a SHAPE a
   person can tell apart at 16px without reading its colour — §16 forbids
   communicating state by colour alone, and a status dot that differs only in
   hue is exactly that rule being broken with an icon instead of a swatch. */

/** DRAFT · a page with a folded corner: started, not finished. */
export const StatusDraftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8l-5-5Z" />
    <path d="M14 3v5h5" />
  </Svg>
);

/** REVIEW / PENDING · an eye: written, waiting to be looked at. */
export const StatusReviewIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.8" />
  </Svg>
);

/** PUBLISHED / APPROVED / VERIFIED · a check in a ring. */
export const StatusPublishedIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.3 12.2 2.6 2.6 4.8-5.2" />
  </Svg>
);

/** ARCHIVED · a box with a lid: kept, closed. */
export const StatusArchivedIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="4" rx="1" />
    <path d="M5 8v10.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V8" />
    <path d="M10 12h4" />
  </Svg>
);

/** REJECTED / LOST · a cross in a ring. Terminal, not an error. */
export const StatusDeclinedIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
  </Svg>
);

/** NEW · a spark. The only status that is an arrival rather than a state. */
export const StatusNewIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v3.2M12 17.8V21M21 12h-3.2M6.2 12H3M18.4 5.6l-2.3 2.3M7.9 16.1l-2.3 2.3M18.4 18.4l-2.3-2.3M7.9 7.9 5.6 5.6" />
    <circle cx="12" cy="12" r="2.8" />
  </Svg>
);

/** CONTACTED / DISCUSSION · a conversation. */
export const StatusTalkingIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20 13.5a2 2 0 0 1-2 2H8l-4 3.5v-13a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" />
    <path d="M8.5 8.5h7M8.5 11.5h4" />
  </Svg>
);

/** QUOTED · a price has been named. A tag, no number on it. */
export const StatusQuotedIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 11.4V4.5a1 1 0 0 1 1-1h6.9a1 1 0 0 1 .7.3l8.1 8.1a1 1 0 0 1 0 1.4l-6.9 6.9a1 1 0 0 1-1.4 0L3.8 12.1a1 1 0 0 1-.3-.7Z" />
    <circle cx="7.8" cy="7.8" r="1.3" />
  </Svg>
);

/** CONFIRMED · a handshake reduced to its gesture: two hands meeting. */
export const StatusConfirmedIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 10.5 6 7l4 3 2-1.5 2 1.5 4-3 3.5 3.5" />
    <path d="M6 7v8.5a1.5 1.5 0 0 0 1.5 1.5H12" />
    <path d="M18 7v8.5a1.5 1.5 0 0 1-1.5 1.5H12" />
  </Svg>
);

/** IN_PRODUCTION · on the bench. Reuses the craft vocabulary deliberately. */
export const StatusInProductionIcon = PourIcon;

/** DELIVERED · it has left the studio. */
export const StatusDeliveredIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 7.5 12 3l9.5 4.5v9L12 21l-9.5-4.5Z" />
    <path d="m2.5 7.5 9.5 4.5 9.5-4.5" />
    <path d="M12 12v9" />
  </Svg>
);

/** CLOSED · the file is shut. Distinct from LOST: this one simply ended. */
export const StatusClosedIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3.5" y="4" width="17" height="16" rx="1.5" />
    <path d="M8 12h8" />
  </Svg>
);

/** QUEUED · waiting its turn. */
export const StatusQueuedIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M8.5 12h7" />
    <path d="M12 8.5v7" opacity="0" />
    <circle cx="8.5" cy="12" r="0.6" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
    <circle cx="15.5" cy="12" r="0.6" fill="currentColor" stroke="none" />
  </Svg>
);

/** RUNNING · in flight. Static — a spinner is a component, not an icon. */
export const StatusRunningIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" />
    <path d="M18 3v3.4h-3.4" />
  </Svg>
);

/** FAILED · something needs reading. */
export const StatusFailedIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10.7 3.9 2.5 18a1.5 1.5 0 0 0 1.3 2.2h16.4a1.5 1.5 0 0 0 1.3-2.2L13.3 3.9a1.5 1.5 0 0 0-2.6 0Z" />
    <path d="M12 9.5v4M12 17h.01" />
  </Svg>
);

/** OWNER-TOUCHED · a hand. The rule that outranks every other writer. */
export const OwnerTouchedIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 11V5.2a1.6 1.6 0 1 1 3.2 0V11" />
    <path d="M12.2 11V4.2a1.6 1.6 0 1 1 3.2 0V11" />
    <path d="M15.4 11.5V7.2a1.6 1.6 0 1 1 3.2 0v6.6a7 7 0 0 1-7 7h-.7a6 6 0 0 1-4.8-2.4l-2.4-3.2a1.6 1.6 0 0 1 2.5-2l1.8 1.9V8.2a1.6 1.6 0 1 1 3.2 0" />
  </Svg>
);

/** DEMO · a marked sample, never a real row. */
export const DemoIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 3h6" />
    <path d="M10 3v6.2L5.4 17.6A1.6 1.6 0 0 0 6.8 20h10.4a1.6 1.6 0 0 0 1.4-2.4L14 9.2V3" />
    <path d="M8 14h8" />
  </Svg>
);

/* ————————————————————— MEDIA + ROLE MARKS —————————————————————
   `MediaType` (IMAGE VIDEO DOCUMENT MODEL3D), `ProductImageRole`
   (HERO DETAIL IN_ROOM PROCESS), `Provenance` (UPLOAD BUNDLED AI) and `Role`
   (ADMIN EDITOR — two, not five). All four read from the schema. */

export const MediaImageIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4.5" width="18" height="15" rx="1.5" />
    <circle cx="8.5" cy="9.5" r="1.5" />
    <path d="m3.5 16.5 4.7-4a1.5 1.5 0 0 1 2 0l6.3 5.3" />
  </Svg>
);

export const MediaVideoIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.5" y="5" width="14" height="14" rx="1.5" />
    <path d="m16.5 10 5-2.5v9l-5-2.5Z" />
  </Svg>
);

export const MediaDocumentIcon = StatusDraftIcon;

export const MediaModel3dIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2.8 20.5 7v10L12 21.2 3.5 17V7Z" />
    <path d="m3.5 7 8.5 4.6L20.5 7" />
    <path d="M12 11.6v9.6" />
  </Svg>
);

/** Provenance AI — the one that must be tellable at a glance (§12.5). */
export const ProvenanceAiIcon = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4.5" y="4.5" width="15" height="15" rx="2" />
    <path d="M9 15.5 12 8l3 7.5M10 13.2h4" />
    <path d="M9 2.5v2M15 2.5v2M9 19.5v2M15 19.5v2M2.5 9h2M2.5 15h2M19.5 9h2M19.5 15h2" />
  </Svg>
);

export const RoleAdminIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 2.8 20 6v6c0 4.6-3.3 7.9-8 9.2-4.7-1.3-8-4.6-8-9.2V6Z" />
    <path d="m8.8 11.8 2.3 2.3 4.1-4.5" />
  </Svg>
);

export const RoleEditorIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
    <path d="m14.5 6 3 3" />
  </Svg>
);
