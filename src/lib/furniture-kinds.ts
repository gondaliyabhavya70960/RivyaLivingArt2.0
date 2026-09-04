/**
 * The six kinds of furniture the studio takes on commission.
 *
 * There is no `Product` row behind any of these — the studio carries no
 * furniture in stock (D5), so this is not a catalogue slice. It is the six
 * tiles the homepage's "What we commission" band and the large-format page's
 * "Pieces we commission" band both render, sharing one list rather than two
 * hand-kept copies drifting apart.
 *
 * Plain module, no server imports: read by the RSC pages and the site-images
 * registry alike.
 */

export const FURNITURE_KINDS = [
  {
    key: "dining",
    copyKey: "Home.furniture.kinds.dining",
    slot: "home.furniture.dining",
  },
  {
    key: "coffee",
    copyKey: "Home.furniture.kinds.coffee",
    slot: "home.furniture.coffee",
  },
  {
    key: "side",
    copyKey: "Home.furniture.kinds.side",
    slot: "home.furniture.side",
  },
  {
    key: "console",
    copyKey: "Home.furniture.kinds.console",
    slot: "home.furniture.console",
  },
  {
    key: "chair",
    copyKey: "Home.furniture.kinds.chair",
    slot: "home.furniture.chair",
  },
  {
    key: "bench",
    copyKey: "Home.furniture.kinds.bench",
    slot: "home.furniture.bench",
  },
] as const;

export type FurnitureKind = (typeof FURNITURE_KINDS)[number];
export type FurnitureKindKey = FurnitureKind["key"];
