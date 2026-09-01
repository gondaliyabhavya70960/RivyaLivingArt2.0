import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Content-Security-Policy for the app (SEC-001 / Prompt 08).
 * Enforced with strict directives for frame-ancestors, object-src,
 * media-src, worker-src, connect-src, and form-action.
 */
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  // img-src allows all https: — the imported four-tier catalog carries
  // product imagery on many source-store hosts (Shopify CDN, kanhakreation,
  // 3dzone, …) that cannot be enumerated ahead of the full sheet export.
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' https://va.vercel-scripts.com https://connect.facebook.net https://www.googletagmanager.com",
  "connect-src 'self' https://vitals.vercel-insights.com https://va.vercel-scripts.com https://connect.facebook.net https://www.facebook.com https://www.google-analytics.com https://region1.google-analytics.com https://*.public.blob.vercel-storage.com https://blob.vercel-storage.com",
  "media-src 'self' blob: data: https://*.public.blob.vercel-storage.com https://res.cloudinary.com",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "form-action 'self'",
  // Stream violations to /api/csp-report (SEC-103). report-uri is legacy-but-widely-
  // supported; report-to pairs with the Reporting-Endpoints header below.
  "report-uri /api/csp-report",
  "report-to csp",
].join("; ");

/** Enforced response headers applied to every route (SEC-001). */
const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Names the reporting group used by the CSP `report-to csp` directive.
  { key: "Reporting-Endpoints", value: 'csp="/api/csp-report"' },
  { key: "Content-Security-Policy", value: CSP },
];

const nextConfig: NextConfig = {
  experimental: {
    // View Transitions (guide Phase 2): Next 16.3 has no viewTransition
    // flag and React 19 stable ships no <ViewTransition>, so the shop-card
    // → PDP morph runs through next-view-transitions (MorphLink +
    // <ViewTransitions> in the locale layout) — no config needed here.
    // CSS in globals.css scopes timing to A5 tokens and disables the
    // animation under reduced motion; unsupported browsers navigate
    // instantly.
    serverActions: {
      // Studio media uploads travel through server actions. 17mb: the media
      // action itself allows 16MB (videos/GLB, MAX_BYTES_LARGE) and multipart
      // encoding adds overhead — at "12mb" a valid 12–16MB upload passed the
      // action's own validation only to be rejected at the transport layer
      // (Part 0 audit A5-004).
      bodySizeLimit: "17mb",
    },
    // With per-tree root layouts (I18N-901) there is no app-level
    // not-found.tsx; global-not-found handles fully-unmatched URLs with a
    // real 404 status (a [locale] catch-all route would stream a soft 200
    // through the loading boundary instead — see ENG-813).
    globalNotFound: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // Next 16 rejects any quality not allow-listed here (default [75]).
    // 80 is the v2.0 hero spec (DESIGN.md B2 §1 hero photography).
    qualities: [75, 80],
    remotePatterns: [
      // Vercel Blob public store (production media).
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      // Cloudinary — branded Rivya Living Art imagery (hero, About, categories).
      { protocol: "https", hostname: "res.cloudinary.com" },
      // The owner's Tier-1 catalog imagery (four-tier sheet import). Only
      // this host is optimizer-eligible — the long-tail scraped hosts
      // (Shopify CDN etc.) render unoptimized so catalog scale can't
      // exhaust the Vercel image-optimization source-image quota.
      { protocol: "https", hostname: "kanhakreation.com" },
    ],
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      // The admin must never be framed — deny outright (clickjacking of
      // logged-in destructive actions). Overrides the SAMEORIGIN above.
      {
        source: "/studio/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
