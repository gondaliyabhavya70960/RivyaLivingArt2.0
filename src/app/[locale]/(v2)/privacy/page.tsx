import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { cache } from "react";

import { localeAlternates } from "@/i18n/seo";
import { Breadcrumb } from "@/components/storefront/breadcrumb";
import { Eyebrow } from "@/components/storefront/section-heading";
import { db } from "@/lib/db";
import { withHeadingAnchors } from "@/lib/document-toc";
import { localize, TRANSLATABLE_FIELDS } from "@/lib/localize";
import { renderTiptapToHtml } from "@/lib/tiptap-render";

// Legal copy is edited in the studio — refresh every 5 minutes.
export const revalidate = 300;

/**
 * Dates are formatted on the server; the formatter itself is built per
 * request from the active locale.
 */
const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
};

/**
 * Legal prose — REDESIGN.md §11.10: "Single column, cols 1–8, 68ch,
 * `LAST UPDATED` in mono, sticky TOC, anchor-linked headings, 48px between
 * sections."
 *
 * `mt-12` on `h2` IS the 48px. The heading rule above each section is the
 * site's only divider (Part 3.5), `scroll-mt-32` keeps an anchored heading
 * clear of the sticky header when a fragment lands on it, and links are
 * sapphire because sapphire is the one interactive colour.
 *
 * Applied to the wrapper that receives the server-rendered Tiptap HTML; the
 * render mechanism itself is untouched.
 */
const PROSE_LEGAL = [
  "u-prose font-body text-body leading-[1.8] text-graphite",
  "[&_h2]:font-display [&_h2]:tracking-display [&_h2]:mt-12 [&_h2]:scroll-mt-32 [&_h2]:border-t [&_h2]:border-hairline [&_h2]:pt-8 [&_h2]:text-h3 [&_h2]:leading-snug [&_h2]:text-ink",
  "[&_h3]:font-display [&_h3]:tracking-display [&_h3]:mt-10 [&_h3]:scroll-mt-32 [&_h3]:text-25 [&_h3]:leading-snug [&_h3]:text-ink",
  "[&_p]:mt-4",
  "[&_li]:mt-2 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:ps-6",
  "[&_ol]:mt-4 [&_ol]:list-decimal [&_ol]:ps-6",
  "[&_a]:rounded-input [&_a]:text-sapphire [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-sapphire-hi",
  "[&_blockquote]:mt-6 [&_blockquote]:border-t [&_blockquote]:border-champagne [&_blockquote]:pt-4 [&_blockquote]:font-display [&_blockquote]:text-h3 [&_blockquote]:leading-snug [&_blockquote]:text-ink",
  "[&_hr]:my-10 [&_hr]:border-hairline",
  "[&_img]:mt-6 [&_img]:max-w-full [&_img]:rounded-image",
  "[&_strong]:text-ink",
].join(" ");

// cache() dedupes the query between generateMetadata and the page render.
const getPage = cache(() => db.page.findUnique({ where: { slug: "privacy" } }));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const [row, t] = await Promise.all([
    getPage(),
    getTranslations({ locale, namespace: "Legal" }),
  ]);
  const page = row && localize(row, locale, TRANSLATABLE_FIELDS.page);
  return {
    title: page?.seoTitle ?? page?.title ?? t("privacyTitle"),
    description: page?.seoDescription ?? undefined,
    alternates: localeAlternates("/privacy", locale),
  };
}

/**
 * The privacy policy — REDESIGN.md §11.10.
 *
 * A document, not a page: one reading column, a mono effective date, and a
 * sticky index of its own sections so a long policy stays navigable and any
 * clause can be linked to directly. No dark band and no `section-major` — a
 * legal page earns nothing from drama, and the mineral → sand surface shift
 * is the divider (Part 3.5).
 */
export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [row, t, tNav, tCommon] = await Promise.all([
    getPage(),
    getTranslations("Legal"),
    getTranslations("Nav"),
    getTranslations("Common"),
  ]);
  if (!row) notFound();

  // Per-locale { title, content } overrides with English fallback (I3),
  // resolved before the Tiptap render below.
  const page = localize(row, locale, TRANSLATABLE_FIELDS.page);

  // Server-side date formatting in the request locale (no client hydration).
  const dateFormatter = new Intl.DateTimeFormat(locale, DATE_FORMAT_OPTIONS);

  // Anchors land in the served HTML, so a pasted `/privacy#…` works before
  // any JavaScript runs.
  const { html, headings } = withHeadingAnchors(
    renderTiptapToHtml(page.content),
    [2],
  );

  return (
    <>
      {/* ════════ 01 · Masthead — standard ════════ */}
      <section
        aria-labelledby="legal-heading"
        className="section-standard bg-mineral"
      >
        <div className="u-shell flex flex-col gap-12">
          <Breadcrumb
            ariaLabel={tCommon("breadcrumb")}
            items={[
              { label: tCommon("home"), href: "/" },
              { label: tNav("privacy") },
            ]}
          />
          <div className="flex flex-col gap-5">
            <Eyebrow>{t("eyebrow")}</Eyebrow>
            <h1
              id="legal-heading"
              className="max-w-[16ch] font-display text-h1 leading-[1.02] tracking-display"
            >
              {page.title}
            </h1>
            {/* §11.10 · `LAST UPDATED` in mono. */}
            <p className="u-micro border-t border-hairline pt-5">
              {t("lastUpdated", {
                date: dateFormatter.format(page.updatedAt),
              })}
            </p>
          </div>
        </div>
      </section>

      {/* ════════ 02 · The document — standard ════════
          Reading column in cols 1–8; the sticky index sits in 10–12 and only
          renders when the document actually has sections to index. */}
      <section className="section-standard bg-sand">
        <div className="u-shell grid gap-12 lg:grid-cols-12 lg:gap-x-16">
          {/* The index leads in the DOM so it comes first on a phone, where a
              long policy is otherwise a wall; explicit row/column placement
              puts it back in cols 10–12 beside the text on desktop. */}
          {headings.length > 1 ? (
            <nav
              aria-label={t("contentsLabel")}
              className="lg:sticky lg:top-28 lg:col-span-3 lg:col-start-10 lg:row-start-1 lg:self-start"
            >
              <p className="u-micro border-t border-hairline pt-4">
                {t("contents")}
              </p>
              <ol className="mt-3 flex flex-col">
                {headings.map((heading) => (
                  <li key={heading.id}>
                    <a
                      href={`#${heading.id}`}
                      className="flex min-h-11 items-center py-1 font-body text-14 leading-snug text-graphite transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-sapphire motion-reduce:transition-none"
                    >
                      {heading.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          <div
            className={`${PROSE_LEGAL} lg:col-span-8 lg:col-start-1 lg:row-start-1`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </section>
    </>
  );
}
