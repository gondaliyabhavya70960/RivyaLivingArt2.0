import type { Metadata } from "next";
import { instrumentSerif, inter, jetbrainsMono } from "@/app/fonts";
import { NotFoundPanel } from "./[locale]/not-found";
import "./globals.css";

/**
 * App-wide 404 for URLs that match no route at all (experimental
 * `globalNotFound` — the designed companion to per-tree root layouts,
 * I18N-901). Renders its own <html> since no root layout applies, reusing the
 * branded panel from `[locale]/not-found.tsx`.
 *
 * The panel is imported as its *presentational* export and left on its
 * English defaults deliberately: there is no matched route here, therefore no
 * locale, no next-intl request config and no message provider — a boundary
 * that had to load messages could fail the way the request already did. The
 * in-tree `notFound()` calls (unknown product/blog/category slugs) render the
 * localized default export instead.
 *
 * Unlike a `[locale]` catch-all route, this returns a REAL 404 status (the
 * catch-all's notFound() streamed a 200 through the [locale] loading
 * boundary, ENG-813).
 */

export const metadata: Metadata = {
  title: "Page not found — ResinRiva",
  robots: { index: false },
};

export default function GlobalNotFound() {
  return (
    <html
      lang="en"
      // The panel renders the v3 trio, so those variables load here.
      className={`${instrumentSerif.variable} ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-obsidian">
        <NotFoundPanel />
      </body>
    </html>
  );
}
