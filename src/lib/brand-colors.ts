/**
 * Brand color hex values for layers CSS custom properties can't reach —
 * Satori OG images, the web-app manifest, the root error boundary (no
 * stylesheet is guaranteed to have loaded) and transactional email HTML.
 * v3 "Liquid Luxury" (REDESIGN.md Part 3.1 / `src/styles/tokens.css`): the
 * thirteen storefront roles, restated as literal hex, because none of those
 * four consumers can resolve a CSS custom property — Satori renders outside
 * any DOM/stylesheet, the manifest and the email are read by a phone/inbox
 * with no CSS context at all, and the error boundary replaces the entire
 * root layout on purpose, so it cannot assume `globals.css` loaded either.
 * `brand-colors.test.ts` reads `tokens.css` back and asserts these values
 * against it, so this file cannot drift from the design system the way the
 * v2.0 "Midnight Gild" set once did.
 *
 * D30 (tokens.css · dark is the only ground) makes that assertion a SPLIT
 * one, and owner decision 5 is why this file did not move with it: "OG images
 * and email keep their fixed look." Eight keys still mirror their token by
 * name. Five — `sand`, `ink`, `graphite`, `alert`, `success` — are pinned to
 * the values they had before D30, because the surface that reads them is not
 * the themed one.
 *
 * The password-reset email is the case that matters: it is a LIGHT document,
 * on whatever ground the recipient's mail client supplies, and it sets
 * `BRAND.ink` for its body text. Following tokens.css would have made that
 * #f4f1e9 on white — a blank email, delivered, with nothing failing. The test
 * names the split and asserts both halves; read it before editing a value
 * here.
 */
export const BRAND = {
  obsidian: "#080a0e",
  deepOcean: "#08283a",
  sapphire: "#164e6b",
  sapphireHi: "#1d6389",
  mineral: "#f4f1e9",
  champagne: "#b89b63",
  mist: "#a9b4bc",
  whatsapp: "#128c7e",
  // ————— pinned to their pre-D30 values (see the header) —————
  sand: "#e7e0d5",
  ink: "#12141a",
  graphite: "#5b6068",
  alert: "#9b3a2e",
  success: "#2c6b5b",
} as const;

/** `#rrggbb` → `"r, g, b"`, for composing rgba() strings from a brand hex. */
function rgbChannels(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/**
 * `mineral` at an alpha — Satori OG typography and the error boundary dim
 * their secondary lines through rgba so the off-white stays sourced from the
 * token layer instead of drifting to a hand-typed value. Replaces the v2.0
 * `porcelainAlpha` (the v2 palette's separate near-white `porcelain` value
 * is retired; `mineral` is the v3 role that plays the same part — light ink
 * on a dark Satori/email surface).
 */
export function mineralAlpha(alpha: number): string {
  return `rgba(${rgbChannels(BRAND.mineral)}, ${alpha})`;
}
