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
 * `.studio-v2` scope ships light-only in Phase 4 — a studio dark mode is a
 * tracked Phase 7 item. The (dashboard) shell and auth pages nest below.
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
