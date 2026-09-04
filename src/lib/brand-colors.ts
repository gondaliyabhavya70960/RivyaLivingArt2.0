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
 * `brand-colors.test.ts` reads `tokens.css` back and asserts every value
 * here matches its token by name, so this file cannot drift from the design
 * system's actual palette the way the v2.0 "Midnight Gild" set once did.
 */
export const BRAND = {
  obsidian: "#080a0e",
  deepOcean: "#08283a",
  sapphire: "#164e6b",
  sapphireHi: "#1d6389",
  mineral: "#f4f1e9",
  sand: "#e7e0d5",
  champagne: "#b89b63",
  ink: "#12141a",
  graphite: "#5b6068",
  mist: "#a9b4bc",
  whatsapp: "#128c7e",
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
