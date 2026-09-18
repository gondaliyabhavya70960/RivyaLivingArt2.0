import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/seo";
import { CustomOrderForm } from "@/components/sections/custom-order-form";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/storefront/accordion";
import { Button } from "@/components/storefront/button";
import { CollectionCard } from "@/components/storefront/collection-card";
import { CureLine, type CureMark } from "@/components/storefront/cure-line";
import { MeniscusImage } from "@/components/storefront/meniscus-image";
import {
  Eyebrow,
  SectionHeading,
} from "@/components/storefront/section-heading";
import { TestimonialWall } from "@/components/storefront/testimonial-wall";
import { db } from "@/lib/db";
import { isOptimizableImageSrc, isRenderableSrc } from "@/lib/image-src";
import { localize, TRANSLATABLE_FIELDS } from "@/lib/localize";
import { getTestimonials } from "@/lib/testimonials";
import { getPageSections } from "@/lib/page-sections-server";
import { getSiteImageRefs } from "@/lib/site-images-server";
import { getFormOptions } from "@/lib/form-options-server";
import { showDemoContent } from "@/lib/demo-content";
import { demoClause } from "@/lib/demo-clause";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "CustomOrder.meta" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates("/custom-order", locale),
  };
}

// ISR: pick up newly-added testimonials within 5 minutes (matches the PDP).
export const revalidate = 300;

/**
 * §10.2 — "What people commission."
 *
 * Four tiles, each pointing at a category that actually exists: the slugs are
 * checked against the catalogue, and the tile photography is the owner's own
 * category image (Part 0 — nothing here is invented, including the pictures).
 *
 * **On the numbers.** The spec's tiles carry a *from* price and a typical
 * timeline, and decisions log #5 is explicit that the patterns are kept only
 * if they carry Rivya Living Art's real figures. The timelines are real and
 * published: the studio's own two bands are "small pieces 7–10 days" and
 * "statement pieces — tables, large wall art and layered preservation work —
 * 3–6 weeks" (`About.timelines`), which is where each tile's band below comes
 * from; two of the four are named in that sentence verbatim.
 *
 * The prices are not stated, because no honest one exists yet. The catalogue's
 * cheapest published row in Wedding Photo Frames is a ₹7 bezel finding and in
 * Resin Furniture & Surfaces a ₹350 table-top ornament; a "from" price derived
 * from those would be a real number attached to the wrong thing, which is
 * worse than no number at all. When the owner sets commission floors, they
 * belong here.
 */
const COMMISSION_TILES = [
  {
    key: "varmala",
    slug: "varmala-preservation",
    href: "/shop/varmala-preservation",
    lead: "statement",
  },
  {
    key: "frames",
    slug: "wedding-photo-frames",
    href: "/shop/wedding-photo-frames",
    lead: "small",
  },
  {
    key: "lettering",
    slug: "gift-collections",
    href: "/shop/gift-collections",
    lead: "small",
  },
  {
    key: "surfaces",
    slug: "resin-furniture-surfaces",
    href: "/shop/resin-furniture-surfaces",
    lead: "statement",
  },
] as const;

const TILE_SLUGS: string[] = COMMISSION_TILES.map((tile) => tile.slug);

/**
 * The bespoke page — REDESIGN.md Part 10.
 *
 * The old page opened with a full-bleed photograph, a headline and a button
 * that scrolled to a wall of eleven controls. Everything it carried is still
 * here; the order of persuasion changed:
 *
 * 1. a split hero that anchors the timeline before anything is asked (§10.1),
 * 2. what people actually commission, with real destinations (§10.2),
 * 3. how a commission runs,
 * 4. the guided brief itself (§10.3–10.5),
 * 5. the studio's answers, its past work and its customers' words — each
 *    rendered only when the owner has actually written them.
 *
 * One dark band (the hero), so the light→dark→light rhythm holds and the
 * three-band ceiling is nowhere near. The cure line runs the reserved left
 * gutter; the form's own `01 / 04` rail sits inside the shell and rhymes with
 * it (§10.3).
 */
export default async function CustomOrderPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [
    t,
    tRoot,
    tHow,
    tFaq,
    tPortfolio,
    tCommon,
    imageRefs,
    formOptions,
    sections,
  ] = await Promise.all([
    getTranslations("CustomOrder.page"),
    // Rooted at the namespace, not the page, because `cureLabelKey` is
    // resolved as `<PascalCasePage>.<key>` (page-sections.test.ts) and the
    // rail below reads its labels straight off the manifest.
    getTranslations("CustomOrder"),
    getTranslations("Home.how"),
    getTranslations("Faq"),
    getTranslations("Portfolio"),
    getTranslations("Common"),
    // Refs, not bare URLs: the commission hero below is this page's LCP and
    // the ref is the only thing that carries its 20px LQIP. Same cached read
    // either way — `getSiteImages` is a narrowing of this one.
    getSiteImageRefs(),
    // The four dropdowns, resolved for this visitor's language.
    getFormOptions(locale),
    getPageSections("custom-order"),
  ]);

  // All empty-safe: a section renders nothing until real studio content
  // exists (no fabricated proof — Part 0). The Faq model has no draft state —
  // every row is live, same as /faq and the PDP (top 4 here).
  const includeDemo = await showDemoContent();
  const demo = demoClause(includeDemo);
  const [testimonials, faqRows, portfolios, tileCategories] = await Promise.all(
    [
      getTestimonials({ take: 6, locale, includeDemo }),
      db.faq.findMany({
        where: { status: "PUBLISHED", ...demo },
        orderBy: { order: "asc" },
        take: 4,
      }),
      db.portfolio.findMany({
        where: { status: "PUBLISHED", ...demo },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: {
          id: true,
          slug: true,
          title: true,
          translations: true,
          afterImageUrl: true,
          images: {
            select: { url: true, alt: true },
            orderBy: { order: "asc" },
            take: 1,
          },
        },
      }),
      db.category.findMany({
        where: { slug: { in: TILE_SLUGS }, visible: true },
        select: { slug: true, image: true },
      }),
    ],
  );

  // Per-locale FAQ overrides with English fallback (I3).
  const faqs = faqRows.map((faq) =>
    localize(faq, locale, TRANSLATABLE_FIELDS.faq),
  );

  const tileImages = new Map(
    tileCategories.map((row) => [row.slug, row.image]),
  );

  // Gallery of past commissions — only published rows with a renderable
  // image (same production guard as the catalog card); localized titles.
  const gallery = portfolios
    .map((piece) => {
      const cover = piece.afterImageUrl ?? piece.images[0]?.url;
      return {
        id: piece.id,
        slug: piece.slug,
        title: localize(piece, locale, ["title"]).title,
        cover: isRenderableSrc(cover) ? cover : null,
        alt: piece.images[0]?.alt?.trim() || null,
      };
    })
    .filter(
      (piece): piece is typeof piece & { cover: string } =>
        piece.cover !== null,
    );

  /* Idea → Quote → Make → Deliver (plan §2.4 · audit §3.5).
     The fourth step used to borrow `Process.timeline.step6` — "Curing" —
     while step 03 already read "Poured, cured & shipped": the band said
     cured twice, and said it AFTER shipping. Step 03 is now the making and
     step 04 is the delivery that was buried in step 03's last clause, so the
     four steps are four different things in the order they happen. Both are
     owner-editable slots like every other line here. */
  const steps = [
    { title: t("step1Title"), body: t("step1Body") },
    { title: t("step2Title"), body: t("step2Body") },
    { title: t("step3Title"), body: t("step3Body") },
    { title: t("step4Title"), body: t("step4Body") },
  ];

  const sectionNodes: Record<string, ReactNode> = {
    /* ════════ 01 · Hero — split screen, major (§10.1) ════════
            Left: the commission photograph. Right: the offer, the one action,
            and the mono anchor line that puts a real timeline in front of the
            visitor before the form asks for anything. The image is the LCP —
            `priority`, never revealed, never animated (Part 14). */
    commission: (
      <section
        id="commission"
        data-theme="navy"
        aria-labelledby="commission-heading"
        className="-mt-20 bg-obsidian text-mineral"
      >
        <div className="grid lg:min-h-svh lg:grid-cols-2">
          <div className="relative min-h-[46svh] lg:min-h-full">
            <Image
              src={imageRefs["customOrder.hero"].url}
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
              {...(imageRefs["customOrder.hero"].blurDataUrl
                ? {
                    placeholder: "blur" as const,
                    blurDataURL: imageRefs["customOrder.hero"].blurDataUrl,
                  }
                : {})}
            />
            {/* Header clearance: the chrome is transparent over this hero. */}
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-obsidian/70 to-transparent"
            />
          </div>

          <div className="flex flex-col justify-center gap-8 px-6 pt-20 pb-16 md:px-12 lg:px-16 lg:py-32">
            <Eyebrow rule={false} className="text-champagne">
              {t("heroEyebrow")}
            </Eyebrow>
            <h1
              id="commission-heading"
              className="max-w-[14ch] font-display text-h1 leading-h1 tracking-display text-mineral"
            >
              {t("heroHeadline")}
            </h1>
            <p className="u-prose font-body text-body leading-relaxed text-mist">
              {t("heroLead")}
            </p>
            <div className="flex flex-wrap items-center gap-4">
              {/* A plain hash href keeps the jump native — no locale
                      prefixing, no JS. */}
              <Button asChild variant="premium" size="lg">
                <a href="#brief">{t("heroCta")}</a>
              </Button>
            </div>
            {/* The anchor line (§10.1). Both bands are the studio's own
                    published figures, not a range invented for the page. */}
            <p className="u-micro flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-hairline-dk pt-6 text-mist">
              <span>{t("heroAnchorSmall")}</span>
              <span aria-hidden>·</span>
              <span>{t("heroAnchorStatement")}</span>
              <span aria-hidden>·</span>
              <span>{t("heroAnchorLayer")}</span>
            </p>
          </div>
        </div>
      </section>
    ),
    /* ════════ 02 · What people commission — standard (§10.2) ════════ */
    kinds: (
      <section
        id="kinds"
        aria-labelledby="kinds-heading"
        className="section-standard bg-background"
      >
        <div className="u-shell flex flex-col gap-12">
          <SectionHeading
            id="kinds-heading"
            eyebrow={t("kindsEyebrow")}
            title={t("kindsHeading")}
            intro={t("kindsIntro")}
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {COMMISSION_TILES.map((tile) => (
              <CollectionCard
                key={tile.key}
                href={tile.href}
                name={t(`kinds.${tile.key}.label`)}
                promise={t(`kinds.${tile.key}.name`)}
                image={tileImages.get(tile.slug)}
                imageAlt={t(`kinds.${tile.key}.alt`)}
                ratio="4/5"
              >
                {t(`leadTime.${tile.lead}`)}
              </CollectionCard>
            ))}
          </div>
        </div>
      </section>
    ),
    /* ════════ 03 · How a commission runs — standard ════════
            A horizontal timeline with a connecting hairline and mono numerals.
            No icon per step (§3.7). */
    how: (
      <section
        id="how"
        aria-labelledby="how-heading"
        className="section-standard bg-sand"
      >
        <div className="u-shell flex flex-col gap-12">
          <SectionHeading
            id="how-heading"
            eyebrow={t("howTitle")}
            title={tHow("heading")}
          />
          <ol className="relative grid gap-10 md:grid-cols-4 md:gap-6">
            <span
              aria-hidden
              className="absolute inset-x-0 top-3 hidden h-px bg-hairline md:block"
            />
            {steps.map((step, index) => (
              <li key={step.title} className="relative flex flex-col gap-3">
                <span className="relative flex items-center gap-3">
                  <span
                    aria-hidden
                    className="block size-1.5 shrink-0 rounded-full bg-champagne ring-4 ring-sand"
                  />
                  <span className="u-num text-14 text-graphite">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </span>
                <h3 className="font-body text-16 font-medium text-ink">
                  {step.title}
                </h3>
                <p className="font-body text-14 leading-relaxed text-graphite">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>
    ),
    /* ════════ 04 · The brief — major (§10.3–10.5) ════════
            The Part 0 conversion path: Server Action → Inquiry → wa.me. Rendered
            SSR-visible, never behind a reveal. `scroll-mt` clears the sticky
            header when the hero CTA jumps here. */
    brief: (
      <section
        id="brief"
        aria-labelledby="brief-heading"
        className="section-major scroll-mt-24 bg-background"
      >
        <div className="u-shell flex flex-col gap-14">
          <SectionHeading
            id="brief-heading"
            eyebrow={t("formEyebrow")}
            title={t("formHeading")}
            intro={t("formSubcopy")}
          />
          <CustomOrderForm options={formOptions} />
        </div>
      </section>
    ),
    /* ════════ 05 · Questions — standard ════════
            The studio's own FAQ rows; the band disappears when there are none. */
    questions:
      faqs.length > 0 ? (
        <section
          id="questions"
          aria-labelledby="questions-heading"
          className="section-standard bg-sand"
        >
          <div className="u-shell grid gap-12 lg:grid-cols-12">
            <SectionHeading
              id="questions-heading"
              eyebrow={tFaq("heroEyebrow")}
              title={tFaq("heroHeadline")}
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
                <Link href="/faq">{tCommon("viewAll")}</Link>
              </Button>
            </div>
          </div>
        </section>
      ) : null,
    /* ════════ 06 · Commissioned before — standard ════════ */
    work:
      gallery.length > 0 ? (
        <section
          id="work"
          aria-labelledby="work-heading"
          className="section-standard bg-background"
        >
          <div className="u-shell flex flex-col gap-12">
            <SectionHeading
              id="work-heading"
              eyebrow={tPortfolio("heroEyebrow")}
              title={tPortfolio("heroHeadline")}
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/portfolio">{t("seeCommissions")}</Link>
                </Button>
              }
            />
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-3">
              {gallery.map((piece, index) => (
                <article key={piece.id} className="group relative">
                  <MeniscusImage
                    src={piece.cover}
                    alt={piece.alt ?? piece.title}
                    width={900}
                    height={1125}
                    sizes="(min-width:1024px) 30vw, 45vw"
                    unoptimized={!isOptimizableImageSrc(piece.cover)}
                    className="aspect-[4/5] rounded-image bg-sand"
                    imageClassName="object-cover"
                  />
                  <p className="u-micro mt-4">
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <h3 className="mt-1 font-body text-16 leading-snug font-medium text-ink">
                    <Link
                      href={`/portfolio/${piece.slug}`}
                      className="outline-none after:absolute after:inset-0 focus-visible:after:ring-2 focus-visible:after:ring-focus focus-visible:after:ring-offset-3"
                    >
                      {piece.title}
                    </Link>
                  </h3>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null,
    /* ════════ 07 · In their words — standard ════════ */
    words:
      testimonials.length > 0 ? (
        <section
          aria-labelledby="proof-heading"
          className="section-standard bg-sand"
        >
          <div className="u-shell flex flex-col gap-12">
            <SectionHeading
              id="proof-heading"
              eyebrow={t("proofEyebrow")}
              title={t("proofHeading")}
            />
            <TestimonialWall testimonials={testimonials} editorialFirst />
          </div>
        </section>
      ) : null,
  };

  /**
   * §2.6 — one tick per section boundary, labelled in mono.
   *
   * GENERATED from the resolved manifest and the built nodes, the way the
   * homepage and /large-resin-art already do it. It used to be a literal array
   * of six entries, which was wrong in three separate ways the moment the
   * sections board shipped: it ignored `visible`, so a section an owner hid
   * kept its tick; it ignored order, so a reorder left the rail describing the
   * old page; and it had no entry for `words` at all, so the testimonial band
   * has been tickless since it was added. Asking `sectionNodes` covers the
   * conditional sections too — `questions`, `work` and `words` are ternaries
   * that collapse to null on a database with no FAQs, no portfolio and no
   * testimonials, and a tick whose `getElementById` misses does not break,
   * it silently redistributes the whole rail by even division.
   */
  const cureMarks: CureMark[] = sections
    .filter(
      (section) =>
        section.visible &&
        section.cureLabelKey &&
        sectionNodes[section.key] != null,
    )
    .map((section) => ({
      id: section.key,
      label: tRoot(section.cureLabelKey as "page.cure.commission"),
      ...(section.dark ? { dark: true } : {}),
    }));

  return (
    <>
      <CureLine marks={cureMarks} />
      {sections
        .filter((section) => section.visible)
        .map((section) => (
          <Fragment key={section.key}>{sectionNodes[section.key]}</Fragment>
        ))}
    </>
  );
}
