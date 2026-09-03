import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { localeAlternates } from "@/i18n/seo";
import { JsonLd } from "@/components/seo/json-ld";
import { Breadcrumb } from "@/components/storefront/breadcrumb";
import { Button } from "@/components/storefront/button";
import { EmptyState } from "@/components/storefront/empty-state";
import { FaqExplorer } from "@/components/storefront/faq-explorer";
import { Eyebrow } from "@/components/storefront/section-heading";
import { db } from "@/lib/db";
import { localize, TRANSLATABLE_FIELDS } from "@/lib/localize";
import { getSiteSettings } from "@/lib/site-settings";
import { buildWaLink, defaultWaGreeting } from "@/lib/whatsapp";
import { demoWhere } from "@/lib/demo-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Faq.meta" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates("/faq", locale),
  };
}

// FAQs are edited in the studio — refresh every 5 minutes.
export const revalidate = 300;

/* ————————————————— page —————————————————
 *
 * FAQ — REDESIGN.md §11.6.
 *
 * > "Large heading · search field · category filters · accordion list.
 * > Desktop two-column: categories left (sticky, scroll-spied), questions
 * > right. Mobile: single-column accordions. Every answer deep-linkable by
 * > hash with a copy-link affordance — operationally useful for WhatsApp
 * > replies."
 *
 * Everything here is that, with one substitution the data forces and the
 * build contract requires me to report rather than paper over: the `Faq`
 * model has no category column, so the sticky left rail indexes the real
 * questions instead of inventing topics for them. See `faq-explorer.tsx` for
 * the full reasoning.
 *
 * The deep links are the point of this page. The owner answers on WhatsApp
 * all day; `…/faq#<id>` pasted into a reply is a complete answer with the
 * studio's voice around it, and the copy-link button on every row is how it
 * gets onto the clipboard in one tap.
 *
 * Band rhythm: mineral masthead → sand answers → obsidian close. One dark
 * band, none adjacent, no `section-major`.
 */
export default async function FaqPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tNav, tCommon, tWa, faqRows, settings] = await Promise.all([
    getTranslations("Faq"),
    getTranslations("Nav"),
    getTranslations("Common"),
    getTranslations("WhatsApp"),
    db.faq.findMany({
      where: { status: "PUBLISHED", ...(await demoWhere()) },
      orderBy: { order: "asc" },
    }),
    getSiteSettings(),
  ]);

  // Per-locale overrides with English fallback (I3) — the accordion and the
  // FAQPage JSON-LD below read the SAME localized rows, so the schema.org
  // payload always matches what the visitor sees.
  const faqs = faqRows.map((faq) =>
    localize(faq, locale, TRANSLATABLE_FIELDS.faq),
  );

  const waHref = buildWaLink(
    defaultWaGreeting(tWa("greeting")),
    settings.whatsappNumber,
  );

  /* ——— schema.org: FAQPage from the live studio-managed questions ——— */

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <>
      {faqs.length > 0 && <JsonLd data={faqJsonLd} />}

      {/* ════════ 01 · Masthead — standard ════════ */}
      <section
        aria-labelledby="faq-heading"
        className="section-standard bg-mineral"
      >
        <div className="u-shell flex flex-col gap-12">
          <Breadcrumb
            ariaLabel={tCommon("breadcrumb")}
            items={[
              { label: tCommon("home"), href: "/" },
              { label: tNav("faq") },
            ]}
          />
          <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
            <div className="flex flex-col gap-5 lg:col-span-7">
              <Eyebrow>{t("heroEyebrow")}</Eyebrow>
              <h1
                id="faq-heading"
                className="max-w-[13ch] font-display text-h1 leading-[1.02] tracking-display"
              >
                {t("heroHeadline")}
              </h1>
            </div>
            <p className="u-lede font-body text-body leading-relaxed text-graphite lg:col-span-4 lg:col-start-9">
              {t("heroLead")}
            </p>
          </div>
        </div>
      </section>

      {/* ════════ 02 · The answers — standard ════════
          Two columns on desktop, one on mobile. Part 16: the empty state is
          conditionally rendered, so an unanswered FAQ shows the invitation
          instead of an empty accordion (§4.6: a panel with no content must
          not render). */}
      <section className="section-standard bg-sand">
        <div className="u-shell">
          {faqs.length > 0 ? (
            <FaqExplorer
              entries={faqs.map((faq) => ({
                id: faq.id,
                question: faq.question,
                answer: faq.answer,
              }))}
              whatsappHref={waHref}
              labels={{
                searchLabel: t("searchLabel"),
                searchPlaceholder: t("searchPlaceholder"),
                indexHeading: t("indexHeading"),
                indexLabel: t("indexLabel"),
                answersLabel: t("answersLabel"),
                // Pre-formatted per possible count: a function cannot cross
                // the server/client boundary, and the plural rules stay with
                // next-intl on the server.
                resultCounts: Array.from({ length: faqs.length + 1 }, (_, n) =>
                  t("resultCount", { count: n }),
                ),
                noMatchStatement: t("noMatchStatement"),
                noMatchDirection: t("noMatchDirection"),
                copyAnswerLink: t("copyAnswerLink"),
                answerLinkCopied: t("answerLinkCopied"),
                askOnWhatsApp: t("askOnWhatsApp"),
                openInNewTab: tCommon("openInNewTab"),
              }}
            />
          ) : (
            <EmptyState
              statement={t("emptyStatement")}
              direction={t("emptyDirection")}
              action={
                <Button variant="primary" size="lg" asChild>
                  <a
                    href={waHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-wa-source="faq_empty"
                  >
                    {t("askOnWhatsApp")}
                    <span className="sr-only"> {tCommon("openInNewTab")}</span>
                  </a>
                </Button>
              }
            />
          )}
        </div>
      </section>

      {/* The page's closing band is LIGHT, and the footer's own CTA band
          immediately below it is the dark close. §3.1 allows no two dark
          grounds to touch, and the footer is obsidian on every page — a dark
          closer here would make a twelve-hundred-pixel dark run carrying two
          competing calls to action. */}
      <section
        aria-labelledby="faq-close-heading"
        className="section-standard bg-sand"
      >
        <div className="u-shell flex flex-col gap-8">
          <h2
            id="faq-close-heading"
            className="max-w-[14ch] font-display text-h2 leading-[1.04] tracking-display"
          >
            {t("closingHeading")}
          </h2>
          <p className="u-lede font-body text-body leading-relaxed text-graphite">
            {t("closingBody")}
          </p>
          <Button variant="whatsapp" size="lg" asChild className="w-fit">
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source="faq_close"
            >
              <MessageCircle aria-hidden strokeWidth={1.5} className="size-5" />
              {t("askOnWhatsApp")}
              <span className="sr-only"> {tCommon("openInNewTab")}</span>
            </a>
          </Button>
        </div>
      </section>
    </>
  );
}
