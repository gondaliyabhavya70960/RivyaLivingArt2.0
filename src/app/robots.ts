import type { MetadataRoute } from "next";
import { SITE } from "@/lib/constants";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // /studio is deliberately NOT crawl-blocked: robots.txt disallow would
      // stop compliant bots from ever SEEING the X-Robots-Tag noindex header
      // next.config sets on /studio/:path*, leaving URL-only indexing
      // possible. Crawlable-but-noindexed guarantees de-indexing (Part 0
      // audit A3-004).
      disallow: ["/api"],
    },
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
