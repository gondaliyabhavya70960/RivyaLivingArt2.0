/**
 * Swatch colour names → CSS colours — moved verbatim out of
 * `order-panel.tsx` (A3/D21). Product DATA, not design tokens: these are the
 * owner's own colour option strings mapped to something paintable, which is
 * why the literals live here and never leak into a token-only component
 * (§9.3's `ColourSwatches` takes the resolver as a prop).
 *
 * A pure move — `order-panel.tsx`'s markup, behaviour and every value below
 * are byte-identical to what shipped before this file existed; only the
 * import site changed.
 *
 * "gold" carries its own literal like the other forty-three. It briefly read
 * `BRAND.gold`, a v2 alias `brand-colors.ts` marked deprecated and promised to
 * drop "once A3 migrates that file" — this file IS that migration, so the
 * promise came due. A product's gold swatch is the owner's colour option, not
 * the champagne brand role; the two being equal today is a coincidence this
 * table should not depend on, since repointing the brand accent must never
 * silently repaint a customer's chosen finish.
 */
export const SWATCH_COLORS: Record<string, string> = {
  white: "#f4f4f1",
  ivory: "#f3ecd8",
  cream: "#f2e8cf",
  beige: "#d9c7a7",
  sand: "#d8c39a",
  black: "#15181d",
  charcoal: "#33383f",
  grey: "#8a8f98",
  gray: "#8a8f98",
  silver: "#c0c5cc",
  blue: "#0f52ba",
  navy: "#0a1a2f",
  sky: "#7db8ea",
  azure: "#3b82f6",
  teal: "#0f766e",
  turquoise: "#2dd4bf",
  aqua: "#67d5d0",
  mint: "#a7e3c4",
  ocean: "#0e3a53",
  green: "#2f7d4f",
  emerald: "#0f9d63",
  olive: "#6b7233",
  yellow: "#eac54f",
  mustard: "#d9a521",
  gold: "#b89b63",
  amber: "#e8a33d",
  orange: "#e07b39",
  peach: "#f3b192",
  coral: "#e8705f",
  red: "#b3382c",
  maroon: "#6d2430",
  burgundy: "#712f3e",
  wine: "#7b3045",
  pink: "#e88aa8",
  rose: "#d76c86",
  blush: "#eebbc3",
  magenta: "#b53389",
  purple: "#6d4a9e",
  violet: "#7c5cbf",
  lavender: "#b9a7dd",
  lilac: "#c8a2c8",
  brown: "#6f4a2f",
  copper: "#b06f45",
  bronze: "#9c6b30",
};

/** Colour name → dot colour; unknown names fall back to sapphire. */
export function swatchColor(name: string): string {
  const key = name.trim().toLowerCase();
  if (SWATCH_COLORS[key]) return SWATCH_COLORS[key];
  const lastWord = key.split(/[\s/-]+/).pop();
  return (lastWord && SWATCH_COLORS[lastWord]) || "#0f52ba";
}
