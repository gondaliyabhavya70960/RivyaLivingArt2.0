import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { instrumentSerif, inter, jetbrainsMono } from "@/app/fonts";
import { SHARED_METADATA } from "@/app/shared-metadata";
import "../globals.css";

export const metadata: Metadata = SHARED_METADATA;

/**
 * Studio ROOT layout (the app has per-tree root layouts so the public
 * [locale] tree can server-render `<html lang/dir>` per locale — I18N-901).
 * The admin is English-only, so a fixed lang="en" is correct here. The
 * `.studio-v2` scope carries a live `prefers-color-scheme: dark` block
 * (globals.css) that re-points --bg/--surface/--text/--border/--focus and the
 * four named palette tokens the Studio's own surfaces consume, so this tree
 * follows the operating system rather than shipping light-only. Anything
 * styled here has to hold in BOTH schemes — which is why Studio seams use
 * `border-border` and never the storefront's `rule` utility, whose --hairline
 * is a dark line that disappears on obsidian. The (dashboard) shell and the
 * auth pages nest below.
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
