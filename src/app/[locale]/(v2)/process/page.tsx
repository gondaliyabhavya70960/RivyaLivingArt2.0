import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/seo";
import { AccordionGallery } from "@/components/storefront/accordion-gallery";
import { Button } from "@/components/storefront/button";
import { CureLine, type CureMark } from "@/components/storefront/cure-line";
import { HeroMedia } from "@/components/storefront/hero-media";
import { MeniscusImage } from "@/components/storefront/meniscus-image";
import {
  Eyebrow,
  SectionHeading,
} from "@/components/storefront/section-heading";
import { getPageSections } from "@/lib/page-sections-server";
import { getSiteImageRefs, getSiteImages } from "@/lib/site-images-server";
import type { SiteImageKey } from "@/lib/site-images";
import { getSiteSettings } from "@/lib/site-settings";
import { buildWaLink, defaultWaGreeting } from "@/lib/whatsapp";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Process.meta" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates("/process", locale),
  };
}

/** ISR so the WhatsApp number and the quoting line stay fresh. */
export const revalidate = 300;

/* ————————————————— page —————————————————
 *
 * The process — REDESIGN.md §11.4, and the cure line's native habitat.
 *
 * Ten stages now, not six (owner decision, 2026-09-03 — `PROCESS_STEPS` in
 * `src/lib/process-steps.ts`): Concept · Material selection · Wood
 * preparation · Resin composition · Casting · Curing · Surface refinement ·
 * Hand finishing · Quality inspection · Delivery. The last is delivery
 * only — the studio states no installation service. Their order and
 * visibility are their own arrangeable list, `getPageSections("process-
 * steps")`, one level below this page's own `stages` band; the cure line's
 * marks are built from that SAME resolved list, so hiding a stage here
 * removes its tick too rather than leaving a gap in the rail.
 *
 * The four materials are a second such list, `getPageSections("materials")`,
 * shared with About (§11.4's "canonical instance" — reordering a material
 * here moves it there too). They render through `AccordionGallery`, which
 * replaces the plain four-card grid this band used to be.
 *
 * Desktop lays each stage out as a sticky photograph in columns 1–5 with the
 * stage itself in 7–12; the photograph holds while its own stage scrolls past
 * and hands over at the next one. No pin, no scrub, no scroll-jacking — one
 * CSS `sticky` per stage, which also means mobile gets Part 13's vertical
 * cards for free from the same markup.
 *
 * Band rhythm (§3.1): dark hero → stages → materials → timelines → dark
 * close. Two dark bands, not adjacent. `section-major` is spent once, on
 * the close.
 */
export default async function ProcessPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [
    t,
    tAccordion,
    tFooter,
    tCommon,
    tWa,
    settings,
    images,
    imageRefs,
    sections,
    stepSections,
    materialSections,
  ] = await Promise.all([
    getTranslations("Process"),
    getTranslations("AccordionGallery"),
    getTranslations("Footer"),
    getTranslations("Common"),
    getTranslations("WhatsApp"),
    getSiteSettings(),
    getSiteImages(),
    getSiteImageRefs(),
    getPageSections("process"),
    getPageSections("process-steps"),
    getPageSections("materials"),
  ]);
  // Localized greeting — the bare defaultWaGreeting() sent the English
  // fallback to all 9 locales (Part 0 audit A6-002).
  const waHref = buildWaLink(
    defaultWaGreeting(tWa("greeting")),
    settings.whatsappNumber,
  );

  /* "Currently quoting" is driven by the SAME Site Settings field as the
     announcement bar (§11.4 item 5), read the same way the bar reads it: the
     first non-empty line of the owner's rotation, falling back to the stock
     line. One field, one claim, two places — never two truths. */
  const quoting =
    (settings.announcement ?? "")
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .find(Boolean) ?? tCommon("announcementDefault");

  const visibleSteps = stepSections.filter((step) => step.visible);
  const visibleMaterials = materialSections.filter(
    (material) => material.visible,
  );

  /* §2.6 — one tick per stage, labelled in mono, built from the SAME
     resolved-and-ordered list the timeline below renders — hiding a stage
     removes its tick, moving one moves the tick with it. */
  const cureMarks: CureMark[] = visibleSteps.map((step, index) => ({
    id: `stage-${String(index + 1).padStart(2, "0")}`,
    label: t(`timeline.${step.key}Title`),
  }));

  const materialItems = visibleMaterials.map((material) => {
    const n = material.key.slice(1);
    const slot = `process.material${n}` as SiteImageKey;
    return {
      key: material.key,
      src: images[slot],
      blurDataURL: imageRefs[slot].blurDataUrl,
      alt: t(`materials.alt${n}`),
      title: t(`materials.m${n}Title`),
      copy: t(`materials.m${n}Copy`),
    };
  });

  const sectionNodes: Record<string, ReactNode> = {
    /* ════════ 01 · Hero — the pour, full-bleed and dark ════════
            `/process` is a transparent-navbar route, so the band pulls up under
            the 80px header slot. HeroMedia keeps the poster as the LCP and
            gates the loop (motion-safe, fine pointer, shared pause chip); the
            slow drift sits on its own wrapper, never the poster `<img>`
            itself (Part 14 — the LCP element is never animated). */
    pour: (
      <section
        data-theme="navy"
        aria-labelledby="process-heading"
        className="relative -mt-20 flex min-h-svh flex-col justify-end overflow-hidden bg-obsidian text-mineral"
      >
        <div className="absolute inset-0">
          <HeroMedia
            videoUrl={images["process.heroVideo"]}
            poster={imageRefs["process.heroPoster"]}
            drift
          />
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-obsidian/90 via-obsidian/50 to-obsidian/35"
          />
        </div>

        <div className="u-shell relative flex flex-col gap-8 pt-32 pb-24">
          {/* `Eyebrow` has no style prop, so the stagger delay wraps it
              rather than reaching inside a shared component this batch does
              not own. */}
          <div className="sf-hero-rise" style={{ "--i": 0 } as CSSProperties}>
            <Eyebrow rule={false} className="text-champagne">
              {t("hero.eyebrow")}
            </Eyebrow>
          </div>
          <h1
            id="process-heading"
            style={{ "--i": 1 } as CSSProperties}
            className="sf-hero-rise max-w-[12ch] font-display text-hero leading-hero tracking-display text-mineral"
          >
            {t("hero.headline")}
          </h1>
          <p
            style={{ "--i": 2 } as CSSProperties}
            className="sf-hero-rise u-prose font-body text-body leading-relaxed text-mist"
          >
            {t("hero.lead")}
          </p>
        </div>
      </section>
    ),
    /* ════════ 02 · The ten stages ════════ */
    stages: (
      <section
        aria-labelledby="stages-heading"
        className="section-standard bg-background"
      >
        <div className="u-shell flex flex-col gap-16">
          <SectionHeading
            id="stages-heading"
            eyebrow={t("timeline.eyebrow")}
            title={t("timeline.heading")}
          />

          <ol className="flex flex-col gap-16 lg:gap-0">
            {visibleSteps.map((step, index) => {
              const number = String(index + 1).padStart(2, "0");
              const image = step.imageKeys[0] as SiteImageKey;
              return (
                <li
                  key={step.key}
                  id={`stage-${number}`}
                  className="grid scroll-mt-28 gap-6 lg:grid-cols-12 lg:gap-8 lg:py-16"
                >
                  {/* The visual sticks while its own stage scrolls; at the
                          next stage the next photograph takes over. */}
                  <div className="lg:col-span-5 lg:self-start lg:sticky lg:top-28">
                    <MeniscusImage
                      src={images[image]}
                      blurDataURL={imageRefs[image].blurDataUrl}
                      alt={t(`timeline.${step.key}Alt`)}
                      width={1000}
                      height={1250}
                      sizes="(min-width:1024px) 38vw, 90vw"
                      className="aspect-[4/3] rounded-image"
                      imageClassName="object-cover"
                    />
                  </div>

                  <div className="flex flex-col gap-4 lg:col-span-6 lg:col-start-7 lg:min-h-[64svh] lg:justify-center">
                    <p className="u-micro">{number}</p>
                    <h3 className="font-display text-h3 leading-h3 text-ink">
                      {t(`timeline.${step.key}Title`)}
                    </h3>
                    <p className="u-prose font-body text-body leading-relaxed text-graphite">
                      {t(`timeline.${step.key}Copy`)}
                    </p>
                    {/* The stage's own figure, in mono — every one of these
                            is a fact the copy above already states. */}
                    <p className="u-micro border-t border-hairline pt-4">
                      {t(`timeline.${step.key}Meta`)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>
    ),
    /* ════════ 03 · Materials — the canonical instance ════════ */
    materials: (
      <section
        aria-labelledby="materials-heading"
        className="section-standard bg-sand"
      >
        <div className="u-shell flex flex-col gap-12">
          <SectionHeading
            id="materials-heading"
            eyebrow={t("materials.eyebrow")}
            title={t("materials.headingEndure")}
            intro={t("materials.intro")}
          />
          <AccordionGallery
            items={materialItems}
            labels={{
              expand: tAccordion("expand"),
              collapse: tAccordion("collapse"),
            }}
          />
        </div>
      </section>
    ),
    /* ════════ 04 · Timelines — two editorial cards, not a table ════════ */
    timelines: (
      <section
        aria-labelledby="timelines-heading"
        className="section-standard bg-background"
      >
        <div className="u-shell flex flex-col gap-12">
          <SectionHeading
            id="timelines-heading"
            eyebrow={t("timelines.eyebrow")}
            title={t("timelines.heading")}
            intro={t("timelines.intro")}
          />

          <div className="grid gap-6 md:grid-cols-2">
            {(
              [
                { key: "e1", value: t("timelines.e1Value") },
                { key: "e2", value: t("timelines.e2Value") },
              ] as const
            ).map((band) => (
              <article
                key={band.key}
                className="flex flex-col gap-4 border-t border-hairline pt-8"
              >
                <p className="u-micro">{t(`timelines.${band.key}Title`)}</p>
                <p className="font-display text-h2 leading-h2 tracking-display text-ink">
                  <span className="u-num">{band.value}</span>
                </p>
                <p className="u-prose font-body text-body leading-relaxed text-graphite">
                  {t(`timelines.${band.key}Copy`)}
                </p>
              </article>
            ))}
          </div>

          {/* One field, two places: the quoting line and the announcement
                  strip read the same Site Settings value (§11.4 item 5). */}
          <p className="u-micro flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-hairline pt-6 text-champagne-ink">
            <span>{t("timelines.quotingLabel")}</span>
            <span aria-hidden>·</span>
            <span className="text-graphite">{quoting}</span>
          </p>

          <div className="flex flex-col gap-2">
            <p className="u-prose font-body text-14 leading-relaxed text-graphite">
              {t("timelines.e3Copy")}
            </p>
            <p className="u-prose font-body text-14 leading-relaxed text-graphite">
              {t("timelines.footnote")}
            </p>
          </div>
        </div>
      </section>
    ),
    /* The page's closing band is LIGHT, and the footer's own CTA band
            immediately below it is the dark close. §3.1 allows no two dark
            grounds to touch, and the footer is obsidian on every page — a dark
            closer here would make a twelve-hundred-pixel dark run carrying two
            competing calls to action. */
    closing: (
      <section
        aria-labelledby="process-cta-heading"
        className="section-major bg-sand"
      >
        <div className="u-shell flex flex-col gap-8">
          <h2
            id="process-cta-heading"
            className="max-w-[16ch] font-display text-h1 leading-h1 tracking-display"
          >
            {t("cta.heading")}
          </h2>
          <p className="u-prose font-body text-body leading-relaxed text-graphite">
            {t("cta.body")}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Button variant="primary" size="lg" asChild>
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                data-wa-source="process_cta"
              >
                {tFooter("chatOnWhatsApp")}
                <span className="sr-only"> {tCommon("openInNewTab")}</span>
              </a>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/custom-order">
                {t("cta.customOrder")}
                <ArrowRight
                  aria-hidden
                  strokeWidth={1.5}
                  className="size-4 rtl:-scale-x-100"
                />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    ),
  };

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
