import { ImageResponse } from "next/og";

import { ogBrand } from "@/app/og-brand";
import { SITE } from "@/lib/constants";
import { db } from "@/lib/db";
import { BRAND, porcelainAlpha } from "@/lib/brand-colors";

// Prisma needs Node — the default edge runtime cannot open the pg pool.
export const runtime = "nodejs";

// `alt` is read at module scope, so it cannot await Settings. It names the
// shipped default rather than repeating the literal.
export const alt = `${SITE.name} — notes from the studio`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type ImageProps = { params: Promise<{ slug: string }> };

/** Keep satori happy: hard-cap the title so lineClamp never overflows. */
function clampTitle(title: string): string {
  return title.length > 90 ? `${title.slice(0, 87)}…` : title;
}

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/**
 * Per-post share card on the same blue template as the site default:
 * "the journal" eyebrow, two-line title, publish date, gold-ruled url line.
 */
export default async function OpengraphImage({ params }: ImageProps) {
  const brand = await ogBrand();
  const { slug } = await params;
  const post = await db.blogPost.findUnique({
    where: { slug },
    select: { title: true, publishedAt: true, createdAt: true },
  });

  const title = post ? clampTitle(post.title) : brand.name;
  const dateLabel = post
    ? dateFormatter.format(post.publishedAt ?? post.createdAt)
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
        the journal
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
          color: porcelainAlpha(0.7),
          fontSize: 30,
        }}
      >
        {dateLabel}
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
