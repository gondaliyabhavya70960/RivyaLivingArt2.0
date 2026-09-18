import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, MessageCircle } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/seo";
import { ContactForm } from "@/components/sections/contact-form";
import { StudioMap } from "@/components/sections/studio-map";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/storefront/accordion";
import { Button } from "@/components/storefront/button";
import {
  Eyebrow,
  SectionHeading,
} from "@/components/storefront/section-heading";
import { db } from "@/lib/db";
import { localize, TRANSLATABLE_FIELDS } from "@/lib/localize";
import { getPageSections } from "@/lib/page-sections-server";
import { getSiteImageRefs } from "@/lib/site-images-server";
import { getSiteSettings } from "@/lib/site-settings";
import { buildWaLink, defaultWaGreeting } from "@/lib/whatsapp";
import { demoWhere } from "@/lib/demo-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Contact.meta" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates("/contact", locale),
  };
}

// Settings and FAQs are edited in the studio — refresh every 5 minutes.
export const revalidate = 300;

/**
 * Contact — REDESIGN.md §11.7.
 *
 * Split-screen hero, then **four large blocks — PHONE · WHATSAPP · EMAIL ·
 * STUDIO — each with an expected response time in mono**, the WhatsApp block
 * visually dominant because it is the channel that actually answers fastest.
 *
 * **On the response times.** They are the studio's own published claims and
 * nothing more: "we reply fastest on WhatsApp, usually within a few hours,
 * 10am–8pm IST." The spec's illustrative `USUALLY UNDER 2 H` is not used —
 * inventing a tighter SLA than the site promises would be a business claim
 * dressed as a design detail.
 *
 * **On the address.** `getSiteSettings().address` is empty until the owner
 * fills it in Settings, so the studio block renders the address only when
 * there is one — never a placeholder, never a fabricated street.
 */
export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tCommon, tWa, settings, faqRows, imageRefs, sections] =
    await Promise.all([
      getTranslations("Contact.page"),
      getTranslations("Common"),
      getTranslations("WhatsApp"),
      getSiteSettings(),
      db.faq.findMany({
        where: { status: "PUBLISHED", ...(await demoWhere()) },
        orderBy: { order: "asc" },
        take: 6,
      }),
      // Refs, not bare URLs: the hero below is this page's LCP and the ref is
      // the only thing that carries its 20px LQIP. Same cached read either
      // way — `getSiteImages` is a narrowing of this one.
      getSiteImageRefs(),
      getPageSections("contact"),
    ]);

  // Per-locale FAQ overrides with English fallback (I3).
  const faqs = faqRows.map((faq) =>
    localize(faq, locale, TRANSLATABLE_FIELDS.faq),
  );

  const waHref = buildWaLink(
    defaultWaGreeting(tWa("greeting")),
    settings.whatsappNumber,
  );

  /** The three quiet channels. WhatsApp gets its own block below. */
  const channels = [
    {
      key: "phone",
      label: t("phoneLabel"),
      meta: t("phoneMeta"),
      value: settings.phoneDisplay,
      href: `tel:${settings.phoneTel}`,
      external: false,
    },
    {
      key: "email",
      label: t("emailLabel"),
      meta: t("emailMeta"),
      value: settings.email,
      href: `mailto:${settings.email}`,
      external: false,
    },
  ];

  const hasStudio = Boolean(
    settings.mapsUrl || settings.address || settings.businessHours.length,
  );

  const sectionNodes: Record<string, ReactNode> = {
    /* ════════ 01 · Hero — split screen (§11.7) ════════
            Left: the studio at night. Right: the invitation. The chrome is not
            transparent on this route, so the copy column simply starts under a
            solid header. */
    hero: (
      <section
        data-theme="navy"
        aria-labelledby="contact-heading"
        className="bg-obsidian text-mineral"
      >
        <div className="grid lg:min-h-[70svh] lg:grid-cols-2">
          <div className="relative min-h-[38svh] lg:min-h-full">
            <Image
              src={imageRefs["contact.hero"].url}
              alt={t("heroImageAlt")}
              fill
              priority
              quality={80}
              sizes="(min-width:1024px) 50vw, 100vw"
              className="object-cover"
              // The slot's 20px LQIP (batch D). next/image paints it as a
              // background behind this `<img>` and drops it the moment the
              // real bytes decode — a ground, never a fade, so §2.7 holds and
              // the LCP element itself is untouched.
              {...(imageRefs["contact.hero"].blurDataUrl
                ? {
                    placeholder: "blur" as const,
                    blurDataURL: imageRefs["contact.hero"].blurDataUrl,
                  }
                : {})}
            />
          </div>
          <div className="flex flex-col justify-center gap-8 px-6 py-16 md:px-12 lg:px-16 lg:py-24">
            <Eyebrow rule={false} className="text-champagne">
              {t("heroEyebrow")}
            </Eyebrow>
            <h1
              id="contact-heading"
              className="max-w-[16ch] font-display text-h1 leading-h1 tracking-display text-mineral"
            >
              {t("heroHeadline")}
            </h1>
            <p className="u-prose font-body text-body leading-relaxed text-mist">
              {t("heroLead")}
            </p>
            <p className="u-micro border-t border-hairline-dk pt-6 text-mist">
              {t("heroBadge")}
            </p>
          </div>
        </div>
      </section>
    ),
    /* ════════ 02 · The four channels — standard ════════
            WhatsApp spans the row and carries the one filled green action on
            the page; phone and email sit beneath it as quiet hairline rows. */
    channels: (
      <section
        aria-labelledby="channels-heading"
        className="section-standard bg-background"
      >
        <div className="u-shell flex flex-col gap-12">
          <SectionHeading
            id="channels-heading"
            eyebrow={t("channelsEyebrow")}
            title={t("gridHeading")}
          />

          <div className="grid gap-x-10 gap-y-10 lg:grid-cols-12">
            {/* WHATSAPP — the dominant block. */}
            <div className="flex flex-col gap-6 border-t border-hairline py-10 lg:col-span-7 lg:pe-10">
              <p className="u-micro text-champagne-ink">
                {t("whatsappLabel")}
              </p>
              <p className="font-display text-h2 leading-h2 tracking-display text-ink">
                {t("whatsappHeadline")}
              </p>
              <p className="u-prose font-body text-body leading-relaxed text-graphite">
                {t("whatsappBody")}
              </p>
              <Button variant="primary" size="lg" className="w-fit" asChild>
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-wa-source="contact_channels"
                >
                  <MessageCircle
                    aria-hidden
                    strokeWidth={1.5}
                    className="size-4"
                  />
                  {t("whatsappCta")}
                  <span className="sr-only"> {tCommon("openInNewTab")}</span>
                </a>
              </Button>
              {/* The reply window sits UNDER the button, not on the eyebrow
                  above the headline (audit §3.6): it is the answer to the
                  question a visitor asks at the moment of pressing, and
                  reading it three paragraphs earlier is reading it too soon.
                  It moved here rather than being repeated — the same line in
                  two places is the noise this card already had once. */}
              <p className="u-micro -mt-2">{t("whatsappMeta")}</p>
            </div>

            {/* PHONE · EMAIL · STUDIO — the quiet three. */}
            <div className="flex flex-col lg:col-span-4 lg:col-start-9">
              {channels.map((channel) => (
                <div
                  key={channel.key}
                  className="flex flex-col gap-2 border-t border-hairline py-8"
                >
                  <p className="u-micro flex flex-wrap items-center gap-x-2">
                    <span className="text-champagne-ink">{channel.label}</span>
                    <span aria-hidden>·</span>
                    <span>{channel.meta}</span>
                  </p>
                  <a
                    href={channel.href}
                    className="inline-flex min-h-11 max-w-full items-center font-body text-20 break-words text-ink transition-colors duration-(--dur-fast) ease-(--ease-luxury) hover:text-sapphire-ink motion-reduce:transition-none [overflow-wrap:anywhere]"
                  >
                    {channel.value}
                  </a>
                </div>
              ))}

              {/* STUDIO — the fourth block. The address is real text (§11.7)
                      and appears only when the owner has entered one. */}
              {hasStudio ? (
                <div className="flex flex-col gap-2 border-t border-hairline py-8">
                  <p className="u-micro flex flex-wrap items-center gap-x-2">
                    <span className="text-champagne-ink">
                      {t("studioLabel")}
                    </span>
                    <span aria-hidden>·</span>
                    <span>{t("studioMeta")}</span>
                  </p>
                  {settings.address ? (
                    <address className="font-body text-20 leading-relaxed whitespace-pre-line text-ink not-italic">
                      {settings.address}
                    </address>
                  ) : null}
                  {/* Opening hours — nothing renders until the owner adds a
                          row in Settings, so the block reads exactly as it did
                          before this field existed. Days and hours are metadata,
                          so both are mono and the hours are tabular. */}
                  {settings.businessHours.length > 0 ? (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
                      {settings.businessHours.map((row) => (
                        <div key={row.days} className="contents">
                          <dt className="u-micro text-graphite">{row.days}</dt>
                          <dd className="u-num text-16 text-ink">
                            {row.hours}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {settings.mapsUrl ? (
                    <a
                      href={settings.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-2 font-body text-16 font-medium text-sapphire-ink underline underline-offset-4 transition-colors duration-(--dur-fast) ease-(--ease-luxury) hover:text-sapphire-hi motion-reduce:transition-none"
                    >
                      {t("mapsCta")}
                      <ArrowRight
                        aria-hidden
                        strokeWidth={1.5}
                        className="size-4 rtl:-scale-x-100"
                      />
                      <span className="sr-only">
                        {" "}
                        {tCommon("openInNewTab")}
                      </span>
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* The map the studio block describes — click-to-activate, and
                    nothing at all until there is an address to point it at. */}
            <StudioMap
              address={settings.address}
              activateLabel={t("mapActivate")}
              noteLabel={t("mapNote")}
              frameTitle={t("mapFrameTitle")}
              className="lg:col-span-7"
            />
          </div>

          <p className="u-micro border-t border-hairline pt-6">{t("hours")}</p>
        </div>
      </section>
    ),
    /* ════════ 03 · The form — standard ════════
            One column of large controls (§11.7), with the heading in the
            editorial left columns and the fields in 6–12. */
    write: (
      <section
        id="write"
        aria-labelledby="write-heading"
        className="section-standard bg-sand"
      >
        <div className="u-shell grid gap-12 lg:grid-cols-12">
          <SectionHeading
            id="write-heading"
            eyebrow={t("formEyebrow")}
            title={t("formHeading")}
            intro={t("formIntro")}
            className="lg:col-span-4 md:items-start"
          />
          <div className="lg:col-span-7 lg:col-start-6">
            <ContactForm />
          </div>
        </div>
      </section>
    ),
    /* ════════ 04 · Asked often — standard ════════ */
    faq:
      faqs.length > 0 ? (
        <section
          aria-labelledby="contact-faq-heading"
          className="section-standard bg-sand"
        >
          <div className="u-shell grid gap-12 lg:grid-cols-12">
            <SectionHeading
              id="contact-faq-heading"
              title={t("faqHeading")}
              className="lg:col-span-4 md:items-start"
            />
            <div className="flex flex-col gap-8 lg:col-span-7 lg:col-start-6">
              <Accordion type="single" collapsible>
                {faqs.map((faq) => (
                  <AccordionItem key={faq.id} value={faq.id}>
                    <AccordionTrigger>{faq.question}</AccordionTrigger>
                    <AccordionContent className="whitespace-pre-line">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
              <Button asChild variant="secondary" size="sm" className="w-fit">
                <Link href="/faq">{t("faqCta")}</Link>
              </Button>
            </div>
          </div>
        </section>
      ) : null,
  };

  return (
    <>
      {sections
        .filter((section) => section.visible)
        .map((section) => (
          <Fragment key={section.key}>{sectionNodes[section.key]}</Fragment>
        ))}
    </>
  );
}
