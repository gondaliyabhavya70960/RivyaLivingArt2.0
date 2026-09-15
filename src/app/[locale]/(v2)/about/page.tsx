import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight } from "lucide-react";

import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/seo";
import { AccordionGallery } from "@/components/storefront/accordion-gallery";
import { Button } from "@/components/storefront/button";
import { CraftChapters } from "@/components/storefront/craft-chapters";
import { MeniscusImage } from "@/components/storefront/meniscus-image";
import { Reveal } from "@/components/motion/reveal";
import {
  Eyebrow,
  SectionHeading,
} from "@/components/storefront/section-heading";
import { StudioGallery } from "@/components/storefront/studio-gallery";
import { getPageSections } from "@/lib/page-sections-server";
import { getSiteImageRefs, getSiteImages } from "@/lib/site-images-server";
import { SlotImage } from "@/components/storefront/slot-image";
import type { SiteImageKey } from "@/lib/site-images";
import { getSiteSettings } from "@/lib/site-settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About.meta" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: localeAlternates("/about", locale),
  };
}

/** ISR so the studio address (Site Settings) stays fresh. */
export const revalidate = 300;

/** Alt text for the four material frames — the Process namespace owns the
 *  material copy (§11.4), and next-intl cannot key off a template literal in
 *  a way the message-extraction tooling can follow, so the keys are listed. */
const MATERIAL_ALT_KEYS = [
  "materials.alt1",
  "materials.alt2",
  "materials.alt3",
  "materials.alt4",
] as const;

/* ————————————————— page —————————————————
 *
 * About — REDESIGN.md §11.3. "Content unchanged; presentation rebuilt."
 *
 * The order is the argument. The maker used to sit last, with no photograph,
 * under everything else on the page; §11.3 moves that block **up**, because
 * "a single artist makes this by hand" is the whole proposition and it should
 * not be the last thing a reader finds. What follows it is evidence: how the
 * work is made, what it is made of, and where.
 *
 * 1. Hero — full-screen, mono `THE STUDIO`, *Where resin meets reverence.*
 *    The texture band behind it is the page's LCP, so the heading stays
 *    static — nothing here may delay or animate the LCP element (Part 14).
 * 2. The story in THREE chapters — THE BEGINNING · THE MATERIAL · THE
 *    PHILOSOPHY, large editorial type at a 68ch measure, with what the studio
 *    holds to carried inside the philosophy chapter as mono numerals rather
 *    than the old four icon cards (§3.7 forbids an icon per value). It carries
 *    no photograph: `about.chapter1–4` belong to the craft band at item 4,
 *    which is where the registry now records them too.
 * 3. THE MAKER — the fourth chapter, given a portrait and its own band.
 * 4. The craft — **one** vertical sticky story (it used to render twice,
 *    heading and all) that links out to the full process.
 * 5. Materials — the same four cards Process describes (§11.4's canonical
 *    instance), through `AccordionGallery`: hover, focus or a tap widens one
 *    strip and brings its macro forward, replacing the old always-static
 *    grid with a crossfaded hover-macro card each. Order and visibility come
 *    from `getPageSections("materials")` — the SAME arrangeable list
 *    Process's own materials band reads, so moving one here moves it there.
 * 6. The studio — three photographs, and the address and opening hours when
 *    the owner has filled them. Never a placeholder (Part 0): an unset field
 *    yields no row at all.
 * 7. The closing invitation — the last word and the commission button, on a
 *    sand ground so nothing dark meets the obsidian footer.
 *
 * Every OTHER band's words rise in on scroll (`Reveal`) — never the hero, and
 * never wrapped around a photograph (`MeniscusImage` already owns its own
 * reveal, and `Reveal` fading its wrapper in as well would double up).
 *
 * Band rhythm (§3.1): dark hero → story → maker → dark craft → materials →
 * studio → SAND close. TWO dark bands in <main>, never adjacent — the closing
 * invitation is deliberately light, because the footer below it is obsidian
 * and a dark close would put three dark grounds in a row down the bottom of
 * the page. `craft` cannot be dragged against the footer either: `closing` is
 * `movable: false` at the last index and `applyReorder` pins an immovable
 * section there whatever the board asks.
 */
export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [
    t,
    tProcess,
    tAccordion,
    tCommon,
    settings,
    images,
    imageRefs,
    sections,
    materialSections,
  ] = await Promise.all([
    getTranslations("About"),
    getTranslations("Process"),
    getTranslations("AccordionGallery"),
    getTranslations("Common"),
    getSiteSettings(),
    getSiteImages(),
    // Both resolve from the same cached read, so asking for the refs as well
    // costs nothing — the hero needs the crop, the rest only need a URL.
    getSiteImageRefs(),
    getPageSections("about"),
    getPageSections("materials"),
  ]);

  /* The three written chapters. The fourth — THE MAKER — is the block below
     them, because a chapter with a portrait is not a paragraph. */
  const chapters = [
    {
      key: "beginning",
      label: t("chapterLabels.beginning"),
      body: t("story.p1"),
    },
    {
      key: "material",
      label: t("chapterLabels.material"),
      body: t("story.p2"),
    },
    {
      key: "philosophy",
      label: t("chapterLabels.philosophy"),
      body: t("story.p3"),
    },
  ] as const;

  const values = (["v1", "v2", "v3", "v4"] as const).map((key) => ({
    key,
    title: t(`values.${key}Title`),
    copy: t(`values.${key}Copy`),
  }));

  /* §11.3 item 4 — the four stages of the craft, once. */
  const craft = [
    {
      title: t("craft.panel1Title"),
      copy: t("craft.panel1Copy"),
      image: {
        src: images["about.chapter1"],
        blurDataURL: imageRefs["about.chapter1"].blurDataUrl,
        alt: t("chapters.alt1"),
      },
    },
    {
      title: t("chapters.embedTitle"),
      copy: t("chapters.embedCopy"),
      image: {
        src: images["about.chapter2"],
        blurDataURL: imageRefs["about.chapter2"].blurDataUrl,
        alt: t("chapters.alt2"),
      },
    },
    {
      title: t("craft.panel2Title"),
      copy: t("craft.panel2Copy"),
      image: {
        src: images["about.chapter3"],
        blurDataURL: imageRefs["about.chapter3"].blurDataUrl,
        alt: t("chapters.alt3"),
      },
    },
    {
      title: t("craft.panel3Title"),
      copy: t("craft.panel3Copy"),
      image: {
        src: images["about.chapter4"],
        blurDataURL: imageRefs["about.chapter4"].blurDataUrl,
        alt: t("chapters.alt4"),
      },
    },
  ];

  /* §11.4's canonical materials list, resolved and filtered — the same four
     cards Process's own materials band reads, so an owner reordering or
     hiding one here moves or hides it there too. */
  const visibleMaterials = materialSections.filter(
    (material) => material.visible,
  );
  const materialItems = visibleMaterials.map((material) => {
    const n = material.key.slice(1);
    const index = Number(n) - 1;
    const slot = `about.material${n}.image` as SiteImageKey;
    return {
      key: material.key,
      src: images[slot],
      blurDataURL: imageRefs[slot].blurDataUrl,
      macroSrc: images[`about.material${n}.macro` as SiteImageKey],
      alt: tProcess(MATERIAL_ALT_KEYS[index]),
      title: tProcess(`materials.m${n}Title`),
      copy: tProcess(`materials.m${n}Copy`),
    };
  });

  /* Part 0 — each fact is printed only when the owner has actually set it; an
     unset field yields no row rather than a placeholder.

     Opening hours were missing here on the grounds that "the data model has no
     field for them", which stopped being true when `SiteSettings.businessHours`
     landed: it is owner-editable free text, `toOpeningHours` already parses it
     into the LocalBusiness JSON-LD in [locale]/layout.tsx, and it reached
     Google without ever reaching the visitor standing outside the door. It is
     printed VERBATIM here — `toOpeningHours`'s normalisation exists to satisfy
     schema.org, and "Mo-Sa 10:00-19:00" is not how a person reads a sign.
     `readBusinessHours` has already dropped every row missing either half. */
  const address = settings.address.trim();
  const businessHours = settings.businessHours
    .map((row) => `${row.days} ${row.hours}`.trim())
    .filter(Boolean)
    .join(" · ");
  const studioFacts = [
    ...(address
      ? [
          {
            label: t("studio.addressLabel"),
            value: address,
            href: settings.mapsUrl || undefined,
            newTabLabel: settings.mapsUrl ? tCommon("openInNewTab") : undefined,
          },
        ]
      : []),
    ...(businessHours
      ? [{ label: t("studio.hoursLabel"), value: businessHours }]
      : []),
  ];

  const sectionNodes: Record<string, ReactNode> = {
    /* ════════ 01 · Hero — full-screen, dark ════════
            `/about` is a transparent-navbar route, so the band pulls up under
            the 80px header slot. The macro is the LCP: `priority`, never
            revealed, never animated (Part 14) — and the heading beside it
            stays static for the same reason. */
    hero: (
      <section
        data-theme="navy"
        aria-labelledby="about-heading"
        className="relative -mt-20 flex min-h-svh flex-col justify-end overflow-hidden bg-obsidian text-mineral"
      >
        <div aria-hidden className="absolute inset-0">
          <SlotImage
            slot={imageRefs["about.hero"]}
            alt=""
            fill
            priority
            fetchPriority="high"
            quality={80}
            sizes="100vw"
            className="object-cover"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-obsidian/90 via-obsidian/55 to-obsidian/45" />
        </div>

        <div className="u-shell relative flex flex-col gap-8 pt-32 pb-24">
          <Eyebrow rule={false} className="text-champagne">
            {t("hero.eyebrow")}
          </Eyebrow>
          <h1
            id="about-heading"
            className="max-w-[14ch] font-display text-hero leading-hero tracking-display text-mineral"
          >
            {t("hero.headline")}
          </h1>
          <p className="u-prose font-body text-body leading-relaxed text-mist">
            {t("hero.lead")}
          </p>
        </div>
      </section>
    ),
    /* ════════ 02 · The story, in chapters ════════
            §11.3: "Story in chapters rather than three stacked paragraphs …
            large editorial type, 68ch measure." */
    story: (
      <section
        aria-labelledby="story-heading"
        className="section-standard bg-mineral"
      >
        <div className="u-shell flex flex-col gap-16">
          <SectionHeading
            id="story-heading"
            eyebrow={t("story.eyebrow")}
            title={t("story.heading")}
          />

          <Reveal>
            <ol className="flex flex-col gap-16">
              {chapters.map((chapter, index) => (
                <li
                  key={chapter.key}
                  className="grid gap-6 border-t border-hairline pt-8 lg:grid-cols-12"
                >
                  <h3 className="u-micro lg:col-span-3">
                    {String(index + 1).padStart(2, "0")} · {chapter.label}
                  </h3>
                  {/* Seven columns, not eight: `u-prose` caps at 68ch, and 68ch
                          of 20px Inter is 858px — over the 600–720px measure §3.2
                          calls the preferred one. The column is what actually holds
                          the line to ~72 characters. */}
                  <div className="flex flex-col gap-8 lg:col-span-7 lg:col-start-4">
                    {/* §11.3 asks for large editorial type here, and §3.2 puts
                          running prose in Inter — Instrument Serif is listed for
                          headings, campaign statements and pull-quotes, not for
                          four paragraphs of body copy at display contrast. "Large"
                          is delivered by size, measure and leading instead. */}
                    <p className="u-prose font-body text-20 leading-[1.7] text-ink">
                      {chapter.body}
                    </p>

                    {/* What the studio holds to, inside the chapter that
                          argues for it. Mono numerals and words — §3.7 rules out
                          the icon-per-value grid this replaces. */}
                    {chapter.key === "philosophy" ? (
                      <ol className="grid gap-8 sm:grid-cols-2">
                        {values.map((value, i) => (
                          <li key={value.key} className="flex flex-col gap-2">
                            <p className="u-micro">
                              {String(i + 1).padStart(2, "0")}
                            </p>
                            <h4 className="font-body text-16 font-medium text-ink">
                              {value.title}
                            </h4>
                            <p className="font-body text-14 leading-relaxed text-graphite">
                              {value.copy}
                            </p>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>
    ),
    /* ════════ 03 · The maker — moved up ════════
            §11.3 item 3: large portrait, mono THE MAKER, the name, the
            description, `Start a conversation`. The portrait keeps its own
            meniscus reveal; only the text column rises on scroll. */
    maker: (
      <section
        aria-labelledby="maker-heading"
        className="section-standard bg-sand"
      >
        <div className="u-shell grid items-center gap-12 lg:grid-cols-12">
          <MeniscusImage
            src={images["about.maker"]}
            blurDataURL={imageRefs["about.maker"].blurDataUrl}
            alt={t("maker.imageAlt")}
            width={1200}
            height={1500}
            sizes="(min-width:1024px) 45vw, 90vw"
            className="aspect-[4/5] rounded-image lg:col-span-5"
            imageClassName="object-cover"
          />
          <Reveal className="lg:col-span-6 lg:col-start-7">
            <div className="flex flex-col gap-6">
              <Eyebrow>{t("chapterLabels.maker")}</Eyebrow>
              <h2
                id="maker-heading"
                className="font-display text-h2 leading-[1.05] tracking-display"
              >
                {t("maker.name")}
              </h2>
              <p className="u-prose font-body text-body leading-relaxed text-graphite">
                {t("maker.body")}
              </p>
              <Button asChild variant="primary" size="lg" className="w-fit">
                <Link href="/contact">{t("maker.ctaConversation")}</Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    ),
    /* ════════ 04 · The craft — one sticky story, one heading ════════ */
    craft: (
      <CraftChapters
        eyebrow={tProcess("hero.eyebrow")}
        heading={t("craft.heading")}
        headingId="craft-heading"
        chapters={craft}
        action={
          <Button asChild variant="secondary" size="sm">
            <Link href="/process">
              {t("craft.seeProcess")}
              <ArrowRight
                aria-hidden
                strokeWidth={1.5}
                className="size-4 rtl:-scale-x-100"
              />
            </Link>
          </Button>
        }
      />
    ),
    /* ════════ 05 · Materials — the canonical four, shared with Process ═══
            AccordionGallery replaces the always-static grid: hover, focus or
            a tap widens one strip and brings its macro forward — the same
            crossfade the old cards did on hover, now with a keyboard and
            touch path too. */
    materials: (
      <section
        aria-labelledby="materials-heading"
        className="section-standard bg-mineral"
      >
        <div className="u-shell flex flex-col gap-12">
          <Reveal>
            <SectionHeading
              id="materials-heading"
              eyebrow={t("materials.eyebrow")}
              title={t("sustain.heading")}
              intro={t("sustain.body")}
            />
          </Reveal>
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
    /* ════════ 06 · The studio ════════ */
    studio: (
      <StudioGallery
        tone="sand"
        headingId="studio-heading"
        eyebrow={t("studio.eyebrow")}
        heading={t("studio.heading")}
        intro={t("studio.body")}
        facts={studioFacts}
        photos={[
          {
            src: images["about.studio1"],
            blurDataURL: imageRefs["about.studio1"].blurDataUrl,
            alt: t("studio.alt1"),
          },
          {
            src: images["about.studio2"],
            blurDataURL: imageRefs["about.studio2"].blurDataUrl,
            alt: t("studio.alt2"),
          },
          {
            src: images["about.studio3"],
            blurDataURL: imageRefs["about.studio3"].blurDataUrl,
            alt: t("studio.alt3"),
          },
        ]}
      />
    ),
    /* The page's closing band is LIGHT, and the footer's own CTA band
            immediately below it is the dark close. §3.1 allows no two dark
            grounds to touch, and the footer is obsidian on every page — a dark
            closer here would make a twelve-hundred-pixel dark run carrying two
            competing calls to action. */
    closing: (
      <section
        aria-labelledby="about-cta-heading"
        className="section-major bg-sand"
      >
        <div className="u-shell flex flex-col gap-8">
          <h2
            id="about-cta-heading"
            className="max-w-[16ch] font-display text-h1 leading-h1 tracking-display"
          >
            {t("cta.heading")}
          </h2>
          <p className="u-prose font-body text-body leading-relaxed text-graphite">
            {t("cta.body")}
          </p>
          <Button asChild variant="primary" size="lg" className="w-fit">
            <Link href="/custom-order">
              {t("cta.planCustom")}
              <ArrowRight
                aria-hidden
                strokeWidth={1.5}
                className="size-4 rtl:-scale-x-100"
              />
            </Link>
          </Button>
        </div>
      </section>
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
