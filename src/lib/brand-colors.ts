/**
 * Brand color hex values for layers CSS custom properties can't reach —
 * inline style strings, Satori OG images, transactional email (DS-006/009).
 * v2.0 "Midnight Gild" (DESIGN.md A2 / Appendix A) plus the shared Satori/
 * email inks. The v7 Sapphire keys were retired by the md-sweep pass once
 * their last consumers (per-route OG cards, email, order-panel swatches)
 * migrated. Keep values in lockstep with src/styles/tokens.css.
 */
export const BRAND = {
  /* ——— v2.0 Midnight Gild ——— */
  royal: "#1e4fd8",
  sapphireV2: "#142f86",
  navyMidnight: "#0a1a2f",
  ivory: "#f5f2ec",
  canvas: "#faf9f5",
  bronzeInk: "#8c6a1d",
  gold: "#d4af37",
  /* ——— shared Satori/email inks ——— */
  /** Deep blue-black canvas base for Satori OG cards — bluer/darker than a
   *  neutral black so the void→navy→royal gradient starts from true shadow. */
  voidBlue: "#05080f",
  /** Bright near-white for dark Satori/email surfaces (kept alongside ivory:
   *  OG typography wants the extra contrast pop). */
  porcelain: "#f8f9fa",
  /** Muted body ink for transactional email (mirrors --muted-foreground). */
  mutedInk: "#44586f",
  /** WhatsApp brand green — wa.me actions only (Part 0 hard rule). */
  whatsapp: "#25d366",
} as const;

/** `#rrggbb` → `"r, g, b"`, for composing rgba() strings from a brand hex. */
function rgbChannels(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/**
 * Porcelain at an alpha — Satori OG typography dims through rgba so the
 * off-white stays sourced from the token layer instead of drifting to a
 * hand-typed value (DS-006).
 */
export function porcelainAlpha(alpha: number): string {
  return `rgba(${rgbChannels(BRAND.porcelain)}, ${alpha})`;
}
