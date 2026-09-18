import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";

import { SystemPage } from "@/components/storefront/system-page";
import { routing } from "@/i18n/routing";
import { localePath, systemPageFooter } from "@/lib/system-page-copy";

/**
 * The post-inquiry thank-you — §2.10, and THE ONE PAGE IN THIS FAMILY THAT
 * MUST NOT FEEL LIKE AN ERROR.
 *
 * It shares the shell because the shell is the atelier's voice at a moment
 * when the normal page is not what the visitor needs, and that is as true of
 * "we have your brief" as it is of "this is gone". What keeps it from reading
 * as a failure is the content, not a different layout: an eyebrow that carries
 * the inquiry number rather than a status code, three lines saying what
 * happens next, and a primary action that opens the conversation instead of
 * offering a way out of it.
 *
 * ## No reference code
 *
 * Every other page in the family gets a cosmetic `ERR-<route>-<hex>`. This one
 * gets the REAL inquiry number, so a made-up string beside it would be noise
 * at best and would invite a visitor to quote the wrong one at worst.
 *
 * ## Why the number is a query parameter and why that is safe
 *
 * The Server Action that saves the `Inquiry` redirects here with it. The value
 * is echoed into an eyebrow and nowhere else — it is never used to look
 * anything up, so there is no object to enumerate and nothing to authorize.
 * It is still validated to a short reference shape before rendering, because
 * unvalidated visitor input in a heading is how a page becomes a phishing
 * surface: a crafted `?ref=` could otherwise put an arbitrary sentence in
 * Instrument Serif on a real rivyalivingart.com URL. A value that fails the
 * shape is dropped, and the page renders its generic eyebrow.
 *
 * ## `noindex`
 *
 * A confirmation page has nothing to rank for, and a thank-you in the index is
 * a page people arrive at without having done the thing it thanks them for.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** Letters, digits and dashes, short. An inquiry reference, not a sentence. */
const REFERENCE = /^[A-Za-z0-9-]{1,24}$/;

export default async function ThankYouPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string; wa?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { ref } = await searchParams;

  const [t, footer] = await Promise.all([
    getTranslations({ locale, namespace: "SystemPages" }),
    systemPageFooter(locale),
  ]);

  const reference = ref && REFERENCE.test(ref) ? ref : null;

  return (
    <SystemPage
      eyebrow={
        reference
          ? t("thankYou.eyebrow", { number: reference })
          : t("thankYou.statement")
      }
      statement={t("thankYou.statement")}
      support={t("thankYou.support")}
      primary={footer.whatsapp.label === t("thankYou.primary")
        ? footer.whatsapp
        : { ...footer.whatsapp, label: t("thankYou.primary") }}
      secondaries={[
        { label: t("thankYou.secondary"), href: localePath(locale, "/shop") },
      ]}
      footer={footer}
    >
      {/* Three facts, in order, in the register the rest of the site uses for
          process: what we do, when you hear back, and what you are not
          committed to. The third line is the one that matters — this project
          takes no payment and holds no cart, so "nothing is charged" is a
          statement of how the business works rather than reassurance. */}
      <div className="flex flex-col gap-3">
        <p className="u-micro">{t("thankYou.nextLabel")}</p>
        <ol className="flex flex-col gap-2">
          {[
            t("thankYou.next1"),
            t("thankYou.next2"),
            t("thankYou.next3"),
          ].map((line, i) => (
            <li key={line} className="flex gap-3 font-body text-body text-mist">
              {/* Mist, not champagne. Three numerals in the accent would
                  spend the viewport's whole §3.1 budget (two) on list
                  markers, leaving none for the eyebrow and the pill — which
                  is what the design is actually using it for. The mono
                  figures already read as an index without the colour. */}
              <span aria-hidden className="u-num font-mono text-mist">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
      </div>
    </SystemPage>
  );
}
