import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand-colors";
import { getSiteSettings } from "@/lib/site-settings";

/**
 * The web-app manifest.
 *
 * Reads the brand marks from Settings so an owner who uploads a new icon sees
 * it on a phone home screen too, not only in the browser tab. Falls back to
 * the files bundled in `src/app`, which is what every environment starts with.
 *
 * Async, so this is no longer statically generated — it is one settings read
 * behind the same 24h cache the layout already uses, and a manifest is fetched
 * once per install rather than once per page.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { brandName, faviconUrl, appIconUrl, tagline } =
    await getSiteSettings();
  const icon = faviconUrl ?? "/icon.svg";
  const apple = appIconUrl ?? "/apple-icon.png";
  // A bundled SVG declares its type; an upload could be anything, so the
  // sizes/type hints are only claimed for the files we actually ship.
  const iconIsBundled = icon === "/icon.svg";

  return {
    name: brandName,
    short_name: brandName,
    description:
      tagline ||
      "Handcrafted resin art, made to order in India — every order finalized on WhatsApp.",
    start_url: "/",
    display: "standalone",
    theme_color: BRAND.obsidian,
    background_color: BRAND.mineral,
    icons: [
      {
        src: icon,
        sizes: "any",
        ...(iconIsBundled ? { type: "image/svg+xml" } : {}),
        purpose: "any",
      },
      {
        src: icon,
        sizes: "any",
        ...(iconIsBundled ? { type: "image/svg+xml" } : {}),
        purpose: "maskable",
      },
      ...(iconIsBundled
        ? [{ src: "/icon-512.png", sizes: "512x512", type: "image/png" }]
        : []),
      {
        src: apple,
        sizes: "180x180",
        ...(apple === "/apple-icon.png" ? { type: "image/png" } : {}),
      },
    ],
  };
}
