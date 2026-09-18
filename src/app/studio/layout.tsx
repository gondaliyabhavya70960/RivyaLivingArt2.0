import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { instrumentSerif, inter, jetbrainsMono } from "@/app/fonts";
import { SHARED_METADATA } from "@/app/shared-metadata";
import { BRAND } from "@/lib/brand-colors";
import "../globals.css";

export const metadata: Metadata = SHARED_METADATA;

/**
 * D30 · the browser paints its own chrome (the mobile address bar, the tab
 * strip on some desktop builds) from this, not from the page's CSS. Without
 * it, a Studio screen is an obsidian panel under a white system bar.
 */
export const viewport: Viewport = { themeColor: BRAND.obsidian };

/**
 * Studio ROOT layout (the app has per-tree root layouts so the public
 * [locale] tree can server-render `<html lang/dir>` per locale — I18N-901).
 * The admin is English-only, so a fixed lang="en" is correct here.
 *
 * D30 (tokens.css) · THE STUDIO IS FORCED DARK AND NO LONGER FOLLOWS THE OS.
 * This comment used to describe the opposite — a `.studio-v2` scope carrying a
 * `prefers-color-scheme: dark` block, so the tree followed the operator's
 * system setting and anything styled here had to hold in BOTH schemes. That
 * media query is gone: its fourteen values were promoted into `:root`, which
 * is where D30's whole palette came from, and the scope now overrides exactly
 * one token (`--surface`, one rung up for the Studio's denser screens).
 *
 * What survives from that era and is still binding: Studio seams use
 * `border-border`, never the storefront's `rule` utility. The rest of the old
 * warning does not — there is one scheme to hold in now.
 *
 * The (dashboard) shell and the auth pages nest below.
 */
export default function StudioRootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${instrumentSerif.variable} ${inter.variable} ${jetbrainsMono.variable} studio-v2 h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
