import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/seo";
import { Button } from "@/components/storefront/button";
import { EmptyState } from "@/components/storefront/empty-state";
import { MeniscusImage } from "@/components/storefront/meniscus-image";
import {
  Eyebrow,
  SectionHeading,
} from "@/components/storefront/section-heading";
import { StudioGallery } from "@/components/storefront/studio-gallery";
import { db } from "@/lib/db";
import { isOptimizableImageSrc, isRenderableSrc } from "@/lib/image-src";
import { localize } from "@/lib/localize";
import { getPageSections } from "@/lib/page-sections-server";
import { getSiteImageRefs, getSiteImages } from "@/lib/site-images-server";
import { SlotImage } from "@/components/storefront/slot-image";
import type { SiteImageKey } from "@/lib/site-images";
import { getSiteSettings } from "@/lib/site-settings";
import { formatPriceBand } from "@/lib/utils";
import { buildWaLink } from "@/lib/whatsapp";

import { WorkshopWaitlist } from "./waitlist-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Workshops.meta" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates("/workshops", locale),
  };
}

// Workshop sessions are managed in the studio — refresh every 5 minutes.
export const revalidate = 300;

/**
 * The three reasons to come, as photographs — §11.5 item 3 and §3.7: "large
 * photographic cards, **not** icons". The old page put a Lucide glyph above
 * each one, which is exactly the "icon per benefit" the spec rules out.
 */
const BENEFITS = [
  { key: "point1", image: "workshops.benefit1" },
  { key: "point2", image: "workshops.benefit2" },
  { key: "point3", image: "workshops.benefit3" },
] as const satisfies readonly { key: string; image: SiteImageKey }[];

/** ARRIVE → MIX → POUR → CREATE → TAKE HOME (§11.5 item 4). */
const BEATS = ["arrive", "mix", "pour", "create", "takeHome"] as const;

/** The four mono facts the page can state before any date exists (§11.5). */
const FACTS = ["duration", "seats", "materials", "place"] as const;

/**
 * The seats line, when the owner has recorded one. `Product.lexical` is the
 * studio's own label/value list, so a session that has been counted carries a
 * row like `Seats · 3 / 8` and the card prints it as a mono fraction. Nothing
 * is computed and nothing is guessed: no row, no fraction (Part 0).
 */
function seatsValue(lexical: unknown): string | null {
  if (!Array.isArray(lexical)) return null;
  for (const entry of lexical) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const label = typeof row.label === "string" ? row.label : "";
    const value = typeof row.value === "string" ? row.value.trim() : "";
    if (value && /seat/i.test(label)) return value;
  }
  return null;
}

/* ————————————————— page —————————————————
 *
 * Workshops — REDESIGN.md §11.5, "an experiential page".
 *
 * The page's job is to make someone want to be in the room, and then to give
 * them something to do about it. So it publishes concrete facts before any
 * date exists (§11.5 item 2), argues in photographs rather than icons
 * (§3.7), walks through the session as a five-beat timeline, and — because
 * the studio has no dates scheduled today — closes the sessions block with a
 * **real waitlist form** and an empty state that invites rather than
 * apologises. The form posts to the newsletter's existing Server Action under
 * a `workshops-waitlist` source; there is no new endpoint.
 *
 * Band rhythm (§3.1): dark hero → facts → benefits → the session → sessions →
 * dark private band → the room. Two dark bands, not adjacent, and
 * `section-major` is spent once, on the private band.
 *
 * Every wa.me message is unchanged from the shipped page, so the studio's
 * inbox keeps reading the same sentences it already knows.
 */
export default async function WorkshopsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [t, tCommon, tShop, images, imageRefs, sections] = await Promise.all([
    getTranslations("Workshops"),
    getTranslations("Common"),
    getTranslations("Shop"),
    getSiteImages(),
    getSiteImageRefs(),
    getPageSections("workshops"),
  ]);

  // Select only what the session rows render (plus the wa.me builder's
  // English title) — no full-row hydration of description/SEO/timestamps.
  const workshops = await db.product.findMany({
    where: {
      status: "PUBLISHED",
      category: { slug: "workshops" },
      NOT: { title: { startsWith: "DEMO" } },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      shortTagline: true,
      materials: true,
      timeline: true,
      showPrice: true,
      priceMin: true,
      priceMax: true,
      lexical: true,
      translations: true,
      images: {
        select: { url: true, alt: true },
        orderBy: { order: "asc" },
        take: 1,
      },
    },
  });

  const { whatsappNumber } = await getSiteSettings();
  const askWaHref = buildWaLink(
    "Hello ResinRiva, I'd like to know about your upcoming resin art workshops.",
    whatsappNumber,
  );
  const privateWaHref = buildWaLink(
    "Hello ResinRiva, I'd like to plan a private or corporate workshop session. Could you share how it works?",
    whatsappNumber,
  );

  const sectionNodes: Record<string, ReactNode> = {
    /* ════════ 01 · Hero — the table, dark ════════
            `/workshops` is a transparent-navbar route, so the band pulls up
            under the 80px header slot. The photograph is the LCP: `priority`,
            never revealed, never animated (Part 14). */
    hero: (
      <section
        data-theme="navy"
        aria-labelledby="workshops-heading"
        className="relative -mt-20 flex min-h-svh flex-col justify-end overflow-hidden bg-obsidian text-mineral"
      >
        <div aria-hidden className="absolute inset-0">
          <SlotImage
            slot={imageRefs["workshops.hero"]}
            alt=""
            fill
            priority
            fetchPriority="high"
            quality={80}
            sizes="100vw"
            className="object-cover"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-obsidian/90 via-obsidian/50 to-obsidian/35" />
        </div>

        <div className="u-shell relative flex flex-col gap-8 pt-32 pb-24">
          <Eyebrow rule={false} className="text-champagne">
            {t("hero.eyebrow")}
          </Eyebrow>
          <h1
            id="workshops-heading"
            className="max-w-[13ch] font-display text-hero leading-[0.95] tracking-display text-mineral"
          >
            {t("hero.headline")}
          </h1>
          <p className="u-prose font-body text-body leading-relaxed text-mist">
            {t("hero.lead")}
          </p>
          <Button variant="primary" size="lg" asChild className="w-fit">
            <a
              href={askWaHref}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source="workshops_hero"
            >
              {t("hero.cta")}
              <span className="sr-only"> {tCommon("openInNewTab")}</span>
            </a>
          </Button>
        </div>
      </section>
    ),
    /* ════════ 02 · The facts strip — compact ════════
            §11.5: "Publish concrete facts even before dates exist." */
    facts: (
      <section aria-label={t("facts.label")} className="bg-sand">
        <div className="u-shell section-compact">
          <p className="u-micro flex flex-wrap items-center gap-x-4 gap-y-2">
            {/* The separator trails its own fact rather than leading the
                    next one, so a wrapped strip never opens a line with a dot. */}
            {FACTS.map((fact, index) => (
              <span key={fact} className="flex items-center gap-4">
                <span>{t(`facts.${fact}`)}</span>
                {index < FACTS.length - 1 ? <span aria-hidden>·</span> : null}
              </span>
            ))}
          </p>
        </div>
      </section>
    ),
    /* ════════ 03 · Why come — three photographs ════════ */
    why: (
      <section
        aria-labelledby="benefits-heading"
        className="section-standard bg-mineral"
      >
        <div className="u-shell flex flex-col gap-12">
          <SectionHeading
            id="benefits-heading"
            eyebrow={t("intro.eyebrow")}
            title={t("intro.heading")}
          />
          <ul className="grid gap-8 md:grid-cols-3">
            {BENEFITS.map((benefit, index) => (
              <li key={benefit.key} className="flex flex-col gap-5">
                <MeniscusImage
                  src={images[benefit.image]}
                  alt={t(`intro.alt${index + 1}`)}
                  width={900}
                  height={1125}
                  sizes="(min-width:768px) 30vw, 90vw"
                  className="aspect-[4/5] rounded-image"
                  imageClassName="object-cover"
                />
                <h3 className="font-display text-h3 leading-[1.15] text-ink">
                  {t(`intro.${benefit.key}Title`)}
                </h3>
                <p className="u-prose font-body text-body leading-relaxed text-graphite">
                  {t(`intro.${benefit.key}Copy`)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    ),
    /* ════════ 04 · The session, beat by beat ════════ */
    session: (
      <section
        aria-labelledby="experience-heading"
        className="section-standard bg-sand"
      >
        <div className="u-shell flex flex-col gap-12">
          <SectionHeading
            id="experience-heading"
            eyebrow={t("experience.eyebrow")}
            title={t("experience.heading")}
          />

          <div className="relative">
            {/* The connecting rule. Decorative — the ordered list already
                    carries the sequence — and a sibling of the <ol> rather than a
                    child of it: a <span> inside <ol> is invalid nesting. */}
            <span
              aria-hidden
              className="absolute inset-x-0 top-3 hidden h-px bg-hairline md:block"
            />
            <ol className="grid gap-8 md:grid-cols-5 md:gap-4">
              {BEATS.map((beat, index) => (
                <li key={beat} className="relative flex flex-col gap-3">
                  <span className="relative flex items-center gap-3">
                    <span
                      aria-hidden
                      className="block size-1.5 shrink-0 rounded-full bg-sapphire ring-4 ring-sand"
                    />
                    <span className="u-num text-14 text-graphite">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </span>
                  <h3 className="u-micro text-ink">
                    {t(`experience.${beat}`)}
                  </h3>
                </li>
              ))}
            </ol>
          </div>

          {/* What the beat "take home" actually means. Mono numerals and
                  words — no icon per item (§3.7). */}
          <div className="flex flex-col gap-8 border-t border-hairline pt-10">
            <h3 className="font-display text-h3 leading-[1.15] text-ink">
              {t("takeHome.heading")}
            </h3>
            <ul className="grid gap-8 md:grid-cols-3">
              {(["item1", "item2", "item3"] as const).map((item, index) => (
                <li key={item} className="flex flex-col gap-2">
                  <p className="u-micro">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h4 className="font-body text-16 font-medium text-ink">
                    {t(`takeHome.${item}Title`)}
                  </h4>
                  <p className="font-body text-14 leading-relaxed text-graphite">
                    {t(`takeHome.${item}Copy`)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    ),
    /* ════════ 05 · Sessions ════════
            Owner-managed Product rows only (Part 0). With none scheduled, the
            block is an invitation plus a real waitlist — never an apology. */
    sessions: (
      <section
        aria-labelledby="sessions-heading"
        className="section-standard bg-mineral"
      >
        <div className="u-shell flex flex-col gap-12">
          <SectionHeading
            id="sessions-heading"
            eyebrow={t("sessions.eyebrow")}
            title={t("sessions.heading")}
          />

          {workshops.length > 0 ? (
            <ul className="flex flex-col">
              {workshops.map((workshop) => {
                const image = workshop.images[0];
                // Localize the row's prose for display; the wa.me book
                // message keeps the English title so the studio's inbox stays
                // consistent.
                const wl = localize(workshop, locale, [
                  "title",
                  "shortTagline",
                ]);
                const bookHref = buildWaLink(
                  `Hello ResinRiva, I'd like to book the workshop: ${workshop.title}. Please share upcoming dates.`,
                  whatsappNumber,
                );
                const seats = seatsValue(workshop.lexical);

                return (
                  <li
                    key={workshop.id}
                    className="grid items-center gap-6 border-t border-hairline py-8 last:border-b md:grid-cols-12"
                  >
                    {image && isRenderableSrc(image.url) ? (
                      <MeniscusImage
                        src={image.url}
                        alt={image.alt || wl.title}
                        width={600}
                        height={450}
                        sizes="(min-width:768px) 18vw, 90vw"
                        unoptimized={!isOptimizableImageSrc(image.url)}
                        className="aspect-[4/3] rounded-image md:col-span-2"
                        imageClassName="object-cover"
                      />
                    ) : null}

                    <div className="flex flex-col gap-2 md:col-span-5">
                      <h3 className="font-display text-h3 leading-[1.15] text-ink">
                        <Link
                          href={`/product/${workshop.slug}`}
                          className="rounded-input outline-none transition-colors duration-(--dur-fast) ease-(--ease-settle) hover:text-sapphire focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3 motion-reduce:transition-none"
                        >
                          {wl.title}
                        </Link>
                      </h3>
                      {wl.shortTagline ? (
                        <p className="u-prose font-body text-14 leading-relaxed text-graphite">
                          {wl.shortTagline}
                        </p>
                      ) : null}
                      {workshop.materials ? (
                        <p className="u-micro">{workshop.materials}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-1 md:col-span-2">
                      <p className="u-num text-16 text-ink">
                        {workshop.showPrice
                          ? formatPriceBand(
                              workshop.priceMin,
                              workshop.priceMax,
                            )
                          : tCommon("enquire")}
                      </p>
                      {workshop.timeline ? (
                        <p className="u-micro">{workshop.timeline}</p>
                      ) : null}
                      {/* Seats remaining as a mono fraction (§11.5). */}
                      {seats ? (
                        <p className="u-micro text-champagne-ink">
                          {t("card.seats", { seats })}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 md:col-span-3 md:justify-end">
                      <Button variant="secondary" size="md" asChild>
                        <a
                          href={bookHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-wa-source="workshops_book"
                        >
                          {t("card.book")}
                          <span className="sr-only">
                            {" "}
                            {tCommon("openInNewTab")}
                          </span>
                        </a>
                      </Button>
                      <Button variant="ghost" size="md" asChild>
                        <Link href={`/product/${workshop.slug}`}>
                          {tShop("card.viewDetails")}
                        </Link>
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-10">
              {/* §16: conditionally rendered, and phrased as an invitation. */}
              <EmptyState
                statement={t("empty.statement")}
                direction={t("empty.body")}
                headingLevel="h3"
              />
              <div className="flex w-full max-w-xl flex-col items-center gap-6">
                <WorkshopWaitlist />
                <Button variant="secondary" size="md" asChild>
                  <a
                    href={askWaHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    data-wa-source="workshops_empty"
                  >
                    {t("empty.cta")}
                    <span className="sr-only"> {tCommon("openInNewTab")}</span>
                  </a>
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    ),
    /* ════════ 06 · Private workshops — dark band ════════ */
    private: (
      <section
        data-theme="navy"
        aria-labelledby="private-heading"
        className="relative section-major overflow-hidden bg-obsidian text-mineral"
      >
        <SlotImage
          slot={imageRefs["workshops.private"]}
          alt=""
          fill
          sizes="100vw"
          className="object-cover opacity-30"
        />
        <span
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/85 to-obsidian/40"
        />
        <div className="u-shell relative flex flex-col gap-8">
          {/* Rule off — §3.1 caps a viewport at two champagne elements. */}
          <Eyebrow rule={false} className="text-champagne">
            {t("private.eyebrow")}
          </Eyebrow>
          <h2
            id="private-heading"
            className="max-w-[14ch] font-display text-h1 leading-[1.02] tracking-display text-mineral"
          >
            {t("private.headingShort")}
          </h2>
          <p className="u-prose font-body text-body leading-relaxed text-mist">
            {t("private.body")}
          </p>
          <Button variant="whatsapp" size="lg" asChild className="w-fit">
            <a
              href={privateWaHref}
              target="_blank"
              rel="noopener noreferrer"
              data-wa-source="workshops_private"
            >
              {t("private.cta")}
              <ArrowRight
                aria-hidden
                strokeWidth={1.5}
                className="size-4 rtl:-scale-x-100"
              />
              <span className="sr-only"> {tCommon("openInNewTab")}</span>
            </a>
          </Button>
        </div>
      </section>
    ),
    /* ════════ 07 · The room — four photographs ════════ */
    room: (
      <StudioGallery
        tone="sand"
        headingId="room-heading"
        eyebrow={t("room.eyebrow")}
        heading={t("room.heading")}
        intro={t("room.body")}
        photos={[
          { src: images["workshops.room1"], alt: t("room.alt1") },
          { src: images["workshops.room2"], alt: t("room.alt2") },
          { src: images["workshops.room3"], alt: t("room.alt3") },
          { src: images["workshops.room4"], alt: t("room.alt4") },
        ]}
      />
    ),
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
