import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Content-Security-Policy for the app (SEC-001). ENFORCED as of the F1
 * hygiene pass — the report-only period (below) ran clean, so the header key
 * is `Content-Security-Policy` rather than `Content-Security-Policy-Report-Only`.
 * The directive string is the report-only phase's plus ONE addition made at
 * the flip: `frame-src 'self' https://www.google.com`, because StudioMap on
 * /contact embeds a click-to-activate Google Maps iframe that report-only
 * mode never exercised as a blocking rule (commit 920e07f, CHANGELOG F1).
 * Nothing else was tightened or loosened.
 *
 * Rollback: rename the header key below back to
 * `Content-Security-Policy-Report-Only` — the directive string, report-uri
 * and report-to stay exactly as they are, so a rollback is a one-line key
 * rename, not a re-derivation of the policy.
 *
 * Nonces were considered and rejected: a per-request nonce would require
 * every page that uses one to opt out of static generation (the nonce has to
 * be minted per-request, which is exactly the boundary ISR exists to avoid),
 * and the storefront's 13 routes × 9 locales are prerendered specifically to
 * keep the database fan-out off the request path (see the `cpus: 4` note
 * below). `'unsafe-inline'` stays for Next's hydration + JSON-LD instead.
 *
 * Allowed sources reflect what the site actually loads:
 *  - images: self, data/blob, Cloudinary, Vercel Blob, Instagram + Behold CDNs
 *  - scripts/connect: self + Behold widget + Vercel analytics/insights +
 *    Meta Pixel + GA4 (see MarketingScripts/ConsentGate — env-gated, off by
 *    default, but the CSP has to allow the hosts for when the owner turns
 *    them on)
 *  - frame: self + Google Maps embed (StudioMap on /contact — the frame only
 *    mounts on a visitor click, but the host still has to be allow-listed)
 *  ('unsafe-inline' remains for Next's hydration + JSON-LD; tighten to nonces
 *   as a follow-up).
 */
const CSP_DIRECTIVES = [
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
  "connect-src 'self' https://vitals.vercel-insights.com https://va.vercel-scripts.com https://connect.facebook.net https://www.facebook.com https://www.google-analytics.com https://region1.google-analytics.com",
  // Google Maps embed, StudioMap (src/components/sections/studio-map.tsx),
  // click-to-activate on /contact — the only third-party frame the site
  // mounts.
  "frame-src 'self' https://www.google.com",
  "form-action 'self'",
  // Stream violations to /api/csp-report even while enforced, so a
  // mis-scoped directive still surfaces instead of only silently blocking
  // (SEC-103). report-uri is legacy-but-widely-supported; report-to pairs
  // with the Reporting-Endpoints header below.
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
  { key: "Content-Security-Policy", value: CSP_DIRECTIVES },
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
    /**
     * Caps the static-generation worker COUNT, because the prerender's
     * database fan-out is what it multiplies.
     *
     * The storefront prerenders 13 routes × 9 locales, and every one of them
     * reads the CMS resolvers — site copy, site images, nav menus. Next runs
     * those across one worker process per core, and each process builds its
     * own Prisma client with `max: 5` sockets (src/lib/db.ts). On Vercel's
     * build machine that is 30 cores, so the ceiling was 30 × 5 = 150
     * simultaneous connections against a hosted Postgres whose cap is far
     * below that. Deploys failed with `TooManyConnections` on role
     * `prisma_migration` while the database itself was healthy — preflight
     * connected, all 44 migrations applied, and only the prerender fell over.
     *
     * 4 workers puts the ceiling at 20 sockets. Raise it only alongside a
     * lower `max` in db.ts: it is the PRODUCT of the two that has to stay
     * under the provider's limit.
     *
     * CI never saw this because it builds against a throwaway Postgres
     * container with no meaningful connection cap — which is exactly why the
     * failure only ever appeared on Vercel.
     */
    cpus: 4,
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
