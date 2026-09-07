import { ImageResponse } from "next/og";

import { ogBrand } from "@/app/og-brand";
import { SITE } from "@/lib/constants";
import { db } from "@/lib/db";
import { demoWhere } from "@/lib/demo-content";
import { BRAND, mineralAlpha } from "@/lib/brand-colors";

// Prisma needs Node — the default edge runtime cannot open the pg pool.
export const runtime = "nodejs";

// `alt` is read at module scope, so it cannot await Settings. It names the
// shipped default rather than repeating the literal.
export const alt = `${SITE.name} — a bespoke commission`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type ImageProps = { params: Promise<{ slug: string }> };

/** Keep satori happy: hard-cap the title so lineClamp never overflows. */
function clampTitle(title: string): string {
  return title.length > 90 ? `${title.slice(0, 87)}…` : title;
}

/**
 * Fallback share card for portfolio pieces that have no renderable photo — on
 * the same blue template as the blog/root cards so an image-less commission
 * still shares with a branded card instead of nothing (MKT-204). Pieces WITH a
 * photo use it directly via generateMetadata's openGraph.images.
 */
export default async function OpengraphImage({ params }: ImageProps) {
  const brand = await ogBrand();
  const { slug } = await params;
  // Every public reader selects PUBLISHED and spreads the demo clause; this
  // one did neither, so a draft, a row in review or an archived one rendered
  // its title at a guessable URL. It falls back to the brand card instead.
  const portfolio = await db.portfolio.findFirst({
    where: { slug, status: "PUBLISHED", ...(await demoWhere()) },
    select: { title: true, category: { select: { name: true } } },
  });

  const title = portfolio ? clampTitle(portfolio.title) : brand.name;
  const eyebrow = portfolio?.category?.name
    ? portfolio.category.name
    : "bespoke commission";

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "72px 96px",
        background: `linear-gradient(135deg, ${BRAND.obsidian} 0%, ${BRAND.deepOcean} 48%, ${BRAND.sapphire} 100%)`,
        fontFamily: "Georgia, serif",
      }}
    >
      <div
        style={{
          color: BRAND.champagne,
          fontSize: 26,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          marginTop: 28,
          maxWidth: 1000,
          color: BRAND.mineral,
          fontSize: 76,
          fontWeight: 700,
          lineHeight: 1.12,
          letterSpacing: "-0.02em",
          display: "block",
          lineClamp: 2,
        }}
      >
        {title}
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
          style={{ width: 44, height: 2, backgroundColor: BRAND.champagne }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontFamily: "monospace",
            color: mineralAlpha(0.6),
            fontSize: 26,
            letterSpacing: "0.08em",
          }}
        >
          {brand.name}
          <span style={{ color: BRAND.champagne }}>.</span>
          <span style={{ marginLeft: 20 }}>{brand.domain}</span>
        </div>
      </div>
    </div>,
    size,
  );
}
