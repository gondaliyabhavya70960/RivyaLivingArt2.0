import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MessageCircle, Phone } from "lucide-react";

import { localeCanonical } from "@/i18n/seo";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/storefront/button";
import { Eyebrow } from "@/components/storefront/section-heading";
import { db } from "@/lib/db";
import { getSiteSettings } from "@/lib/site-settings";
import { hashToken } from "@/lib/tokens";
import {
  buildWaLink,
  defaultWaGreeting,
  formatInquiryNumber,
} from "@/lib/whatsapp";

import { CopyMessageButton } from "./copy-button";

// Landing pad after Place Order: if the WhatsApp popup was blocked (or the
// tab was lost), the saved message and a fresh deep link live here.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "WhatsAppOrder" });
  return {
    title: t("metaTitle"),
    robots: { index: false, follow: false },
    // Canonical-only: without this the [locale] layout's baseline languages
    // map (built for "/") merged in, mislabeling the HOMEPAGE as this page's
    // language alternates; hreflang is pointless on a noindex route anyway
    // (SEO-512).
    alternates: localeCanonical("/whatsapp-order", locale),
  };
}

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** Order links go stale after a day — older ids fall back to the greeting. */
function recentCutoff(): Date {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

/**
 * The success screen — REDESIGN.md §10.6.
 *
 * > "A real screen, not just a redirect: `Your brief is with the maker.` +
 * > what happens next + a fallback `Open WhatsApp` link + `See recent
 * > commissions`."
 *
 * Which is what this route now is. Its **behaviour is unchanged**: it still
 * re-reads the saved message only for the holder of the one-time claim token
 * (ENG-811), still renders that message verbatim, still shows the `#RR`
 * reference, still offers copy and the studio's dialable number, and still
 * falls back to a plain localized greeting when the link has expired. What is
 * new is that it reads like an arrival instead of an apology:
 *
 * - the three steps that follow, stated plainly, so the visitor knows the
 *   conversation is the next thing and not a form they missed;
 * - `See recent commissions` beside the WhatsApp action;
 * - the heading follows the flow the inquiry actually came from — a bespoke
 *   brief is not a product order, and `source` already records which is which.
 *
 * No `Reveal` anywhere: everything here is fold-one recovery content and must
 * never wait on JS.
 */
export default async function WhatsappOrderPage({
  params,
  searchParams,
}: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;
  const idParam = Array.isArray(sp.i) ? sp.i[0] : sp.i;
  const tokenParam = Array.isArray(sp.t) ? sp.t[0] : sp.t;

  // The saved message carries customer PII, so it is only re-served to the
  // holder of the one-time claim token issued at submit time (ENG-811) — not
  // to anyone who can guess or intercept the (timestamp-ordered) inquiry id.
  const inquiry =
    idParam && tokenParam
      ? await db.inquiry
          .findFirst({
            where: {
              id: idParam,
              claimTokenHash: hashToken(tokenParam),
              createdAt: { gte: recentCutoff() },
            },
            select: { whatsappMessage: true, number: true, source: true },
          })
          .catch(() => null)
      : null;

  const message = inquiry?.whatsappMessage ?? null;
  const isCommission = inquiry?.source === "CUSTOM_ORDER";
  const { whatsappNumber, phoneDisplay, phoneTel } = await getSiteSettings();
  // Expired/missing order link → fall back to the visitor's localized
  // greeting, like every other chrome CTA — this recovery page is part of
  // the localized funnel too (I18N-903).
  const [tWa, t] = await Promise.all([
    getTranslations({ locale, namespace: "WhatsApp" }),
    getTranslations({ locale, namespace: "WhatsAppOrder" }),
  ]);
  const waHref = buildWaLink(
    message ?? defaultWaGreeting(tWa("greeting")),
    whatsappNumber,
  );

  const heading = !message
    ? t("headingExpired")
    : isCommission
      ? t("headingCommission")
      : t("headingSaved");
  const body = !message
    ? t("bodyExpired")
    : isCommission
      ? t("bodyCommission")
      : t("bodySaved");

  return (
    <section className="section-standard bg-background">
      <div className="u-shell grid gap-12 lg:grid-cols-12">
        {/* ————— the statement ————— */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          <Eyebrow>{message ? t("eyebrowSaved") : t("eyebrowExpired")}</Eyebrow>
          <h1 className="max-w-[16ch] font-display text-h1 leading-h1 tracking-display text-ink">
            {heading}
          </h1>
          {inquiry ? (
            <p className="u-num text-25 text-ink">
              {formatInquiryNumber(inquiry.number)}
            </p>
          ) : null}
          <p className="u-prose font-body text-body leading-relaxed text-graphite">
            {body}
          </p>

          {/* ————— actions —————
              The fresh deep link is THE action; copy and call are the two
              quiet ways out when WhatsApp itself is the problem. */}
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <Button variant="whatsapp" size="lg" asChild>
              <a href={waHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle
                  aria-hidden
                  strokeWidth={1.5}
                  className="size-4"
                />
                {t("openWhatsApp")}
              </a>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/portfolio">{t("seeCommissions")}</Link>
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-hairline pt-6">
            {message ? <CopyMessageButton message={message} /> : null}
            {/* No WhatsApp at all → the studio's number, dialable. */}
            <a
              href={`tel:${phoneTel}`}
              className="inline-flex min-h-11 items-center gap-2 font-mono text-16 text-sapphire-ink outline-none transition-colors duration-(--dur-fast) ease-(--ease-luxury) hover:text-sapphire-hi motion-reduce:transition-none"
            >
              <Phone
                aria-hidden
                strokeWidth={1.5}
                className="size-4 shrink-0"
              />
              {phoneDisplay}
            </a>
          </div>

          {/* ————— what happens next (§10.6) —————
              Only where there is a brief to follow: step 01 describes the
              message this page is holding, and an expired link is holding
              nothing. */}
          {message ? (
            <ol className="mt-4 flex flex-col gap-5 border-t border-hairline pt-8">
              {(["step1", "step2", "step3"] as const).map((step, index) => (
                <li key={step} className="flex items-baseline gap-4">
                  <span aria-hidden className="u-micro shrink-0">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <p className="u-prose font-body text-body leading-relaxed text-graphite">
                    {t(`next.${step}`)}
                  </p>
                </li>
              ))}
            </ol>
          ) : null}

          <p className="u-micro">{t("replyHours")}</p>

          <p className="font-body text-14 leading-relaxed text-graphite">
            {t("changedMind")}{" "}
            <Link
              href="/shop"
              className="font-medium text-sapphire-ink underline underline-offset-4 transition-colors duration-(--dur-fast) ease-(--ease-luxury) hover:text-sapphire-hi motion-reduce:transition-none"
            >
              {t("keepBrowsing")}
            </Link>
          </p>
        </div>

        {/* ————— the saved message —————
            The exact text `wa.me` receives, mono on sand, selectable so a
            manual copy always works and scroll-contained so a long
            commission brief cannot run the page off the screen. */}
        {message ? (
          <aside className="lg:col-span-4 lg:col-start-9">
            <div className="rounded-[4px_4px_4px_0] border border-hairline bg-sand p-5">
              <p className="u-micro mb-3">{t("messageLabel")}</p>
              <pre
                /* Focusable + named: Safari doesn't auto-focus scrollable
                   regions, and keyboard users must be able to scroll a long
                   summary. */
                tabIndex={0}
                role="region"
                aria-label={t("messageLabel")}
                className="max-h-96 overflow-y-auto font-mono text-12 leading-relaxed break-words whitespace-pre-wrap text-ink"
              >
                {message}
              </pre>
            </div>
          </aside>
        ) : null}
      </div>
    </section>
  );
}
