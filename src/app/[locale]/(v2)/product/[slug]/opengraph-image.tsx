import { ImageResponse } from "next/og";

import { ogBrand } from "@/app/og-brand";
import { SITE } from "@/lib/constants";
import { db } from "@/lib/db";
import { BRAND, porcelainAlpha } from "@/lib/brand-colors";
import { formatPriceBand } from "@/lib/utils";

// Prisma needs Node — the default edge runtime cannot open the pg pool.
export const runtime = "nodejs";

// `alt` is read at module scope, so it cannot await Settings. It names the
// shipped default rather than repeating the literal.
export const alt = `${SITE.name} — made-to-order piece`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type ImageProps = { params: Promise<{ slug: string }> };

/** Keep satori happy: hard-cap the title so lineClamp never overflows. */
function clampTitle(title: string): string {
  return title.length > 90 ? `${title.slice(0, 87)}…` : title;
}

/**
 * Per-product share card on the same blue template as the site default:
 * category eyebrow, two-line title, price band, gold-ruled url line.
 */
export default async function OpengraphImage({ params }: ImageProps) {
  const brand = await ogBrand();
  const { slug } = await params;
  const product = await db.product.findUnique({
    where: { slug },
    select: {
      title: true,
      priceMin: true,
      priceMax: true,
      showPrice: true,
      category: { select: { name: true } },
    },
  });

  const eyebrow = product?.category.name ?? "made to order";
  const title = product ? clampTitle(product.title) : brand.name;
  const priceLabel = product
    ? product.showPrice
      ? formatPriceBand(product.priceMin, product.priceMax)
      : "Enquire on WhatsApp"
    : brand.tagline;

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "72px 96px",
        background: `linear-gradient(135deg, ${BRAND.voidBlue} 0%, ${BRAND.navyMidnight} 48%, ${BRAND.royal} 100%)`,
        fontFamily: "Georgia, serif",
      }}
    >
      <div
        style={{
          color: BRAND.gold,
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
          color: BRAND.porcelain,
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
          marginTop: 32,
          color: porcelainAlpha(0.85),
          fontSize: 40,
        }}
      >
        {priceLabel}
      </div>
      <div
        style={{
          marginTop: 56,
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div style={{ width: 44, height: 2, backgroundColor: BRAND.gold }} />
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            color: porcelainAlpha(0.6),
            fontSize: 26,
            letterSpacing: "0.08em",
          }}
        >
          {brand.name}
          <span style={{ color: BRAND.gold }}>.</span>
          <span style={{ marginLeft: 20 }}>{brand.domain}</span>
        </div>
      </div>
    </div>,
    size,
  );
}
