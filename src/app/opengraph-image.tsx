import { ImageResponse } from "next/og";

import { ogBrand, wordmarkSize } from "@/app/og-brand";
import { BRAND, mineralAlpha } from "@/lib/brand-colors";
import { SITE } from "@/lib/constants";

// `alt` is read at module scope, so it cannot await Settings. It names the
// shipped default rather than repeating the literal a third time.
export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Default share card: obsidian→sapphire gradient, giant serif wordmark with
 * a champagne full stop, tagline and a mono site-url line. Georgia stands in
 * for Instrument Serif — bundling the display TTF isn't possible offline.
 */
export default async function OpengraphImage() {
  const brand = await ogBrand();
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "80px 96px",
        background: `linear-gradient(135deg, ${BRAND.obsidian} 0%, ${BRAND.deepOcean} 48%, ${BRAND.sapphire} 100%)`,
        fontFamily: "Georgia, serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          flexWrap: "wrap",
          color: BRAND.mineral,
          fontSize: wordmarkSize(brand.name),
          lineHeight: 1.05,
          fontWeight: 700,
          letterSpacing: "-0.03em",
        }}
      >
        {brand.name}
        <span style={{ color: BRAND.champagne }}>.</span>
      </div>
      <div
        style={{
          marginTop: 36,
          maxWidth: 900,
          color: mineralAlpha(0.82),
          fontSize: 34,
          lineHeight: 1.4,
        }}
      >
        {brand.tagline}
      </div>
      <div
        style={{
          marginTop: 56,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            width: 44,
            height: 2,
            backgroundColor: BRAND.champagne,
          }}
        />
        <div
          style={{
            fontFamily: "monospace",
            color: mineralAlpha(0.6),
            fontSize: 26,
            letterSpacing: "0.08em",
          }}
        >
          {brand.domain}
        </div>
      </div>
    </div>,
    size,
  );
}
