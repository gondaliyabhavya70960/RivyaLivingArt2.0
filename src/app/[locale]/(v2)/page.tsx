import type { Metadata } from "next";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { localeAlternates } from "@/i18n/seo";
import { Button } from "@/components/storefront/button";
import { CollectionDoors } from "@/components/storefront/collection-doors";
import { DemoMark } from "@/components/storefront/demo-mark";
import { FeaturedRail } from "@/components/storefront/featured-rail";
import { FeaturedTestimonial } from "@/components/storefront/featured-testimonial";
import { QuoteRotator } from "@/components/storefront/quote-rotator";
import { CureLine, type CureMark } from "@/components/storefront/cure-line";
import {
  Eyebrow,
  SectionHeading,
} from "@/components/storefront/section-heading";
import { HeroMedia } from "@/components/storefront/hero-media";
import { JournalList } from "@/components/storefront/journal-list";
import { Magnetic } from "@/components/ui/magnetic";
import { BUNDLED_VIDEOS } from "@/lib/site-videos";
import { HeroParallax } from "@/components/motion/hero-parallax";
import { MeniscusImage } from "@/components/storefront/meniscus-image";
import { PourCureShowcase } from "@/components/storefront/pour-cure-showcase";
import { Reveal } from "@/components/motion/reveal";
import { CANONICAL_CATEGORIES } from "@/lib/catalog-taxonomy";
import { db } from "@/lib/db";
import { FURNITURE_KINDS } from "@/lib/furniture-kinds";
import {
  isOptimizableImageSrc,
  isRenderableSrc,
  sizedExternalSrc,
} from "@/lib/image-src";
import { localize, localizeName } from "@/lib/localize";
import {
  buildProductWhere,
  DEFAULT_ECOSYSTEM,
  fetchProductsPage,
} from "@/lib/shop";
import type { SiteImageKey } from "@/lib/site-images";
import { getSiteImageRefs, getSiteImages } from "@/lib/site-images-server";
import { getPageSections } from "@/lib/page-sections-server";
import { SlotImage } from "@/components/storefront/slot-image";
import { getSiteSettings } from "@/lib/site-settings";
import { getTestimonials } from "@/lib/testimonials";
import { buildWaLink, defaultWaGreeting } from "@/lib/whatsapp";
import { demoWhere } from "@/lib/demo-content";

/** ISR: home reflects studio edits within 5 minutes. */
export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Home.meta" });
  return {
    title: { absolute: t("title") },
    description: t("description"),
    alternates: localeAlternates("/", locale),
  };
}

/**
 * The six editorial collection tiles — REDESIGN.md §6 05.
 *
 * "Reduce the many visible categories to six editorial tiles." Each one is a
 * doorway with a real destination; nothing here is invented, and the imagery
 * comes from the owner's own category rows (Part 0: the catalogue is
 * owner-fed). This block absorbs and replaces BOTH the eight-link collections
 * list and the separate "three studios" block, which used to compete on
 * adjacent screens.
 */
const COLLECTION_TILES = [
  {
    key: "preserve",
    slug: "varmala-preservation",
    href: "/shop/varmala-preservation",
  },
  {
    key: "keep",
    slug: "wedding-photo-frames",
    href: "/shop/wedding-photo-frames",
  },
  { key: "live", slug: "resin-home-decor", href: "/shop/resin-home-decor" },
  { key: "gift", slug: "gift-collections", href: "/shop/gift-collections" },
  { key: "create", slug: null, href: "/custom-order" },
  { key: "print", slug: "print-decor", href: "/shop?type=print" },
] as const;

/** The subset of tiles backed by a real category row. */
const TILE_CATEGORY_SLUGS: string[] = COLLECTION_TILES.map(
  (tile) => tile.slug,
).filter((slug): slug is NonNullable<typeof slug> => slug !== null);

/**
 * The homepage's large-format teaser, reusing `/large-resin-art`'s own
 * "scope" tiles and alt text (`LargeFormat.scope.k1Alt`…) rather than a
 * second, drifting copy of the same four pictures.
 */
const LARGE_FORMAT_TILES = [
  { key: "k1", slot: "largeFormat.k1", altKey: "scope.k1Alt" },
  { key: "k2", slot: "largeFormat.k2", altKey: "scope.k2Alt" },
  { key: "k3", slot: "largeFormat.k3", altKey: "scope.k3Alt" },
  { key: "k4", slot: "largeFormat.k4", altKey: "scope.k4Alt" },
] as const satisfies readonly {
  key: string;
  slot: SiteImageKey;
  altKey: string;
}[];

/** The four rooms band's captioned cards. */
const ROOM_KEYS = ["living", "dining", "study", "bedroom"] as const;

/**
 * The three session facts the homepage workshops band quotes.
 *
 * `place` is the fourth on /workshops and is left out here: this band already
 * says Surat in its own body copy, and the strip is a teaser rather than the
 * page's own facts row.
 */
const WORKSHOP_FACTS = ["duration", "seats", "materials"] as const;

/**
 * The v3 homepage — REDESIGN.md Part 6.
 *
 * **Seventeen sections, one of them `major`** — and Part 6's own header still
 * says thirteen and two, which is why the divergence is now recorded there
 * rather than only here. `largeFormat`, `furniture`, `rooms` and `words` came
 * after the spec was written; `furniture` and `rooms` ship OFF, so the default
 * page is fifteen, and the four `conditional` sections render nothing on an
 * empty database, so a fresh install is eleven. §01 is spec'd `major` and
 * carries no `section-major` class on purpose: it is `min-h-svh` with its own
 * padding. Both `major` slots are already allocated by the spec (§01 and §08),
 * so the audit's count of one is a measurement artifact and not headroom for a
 * third climax band.
 *
 * The content the old page carried is all still here; what changed is that it
 * now has a hierarchy. The deletions the audit called for are real deletions:
 *
 * - the duplicate "From liquid to light" (it rendered twice)
 * - the eight-link collections list (absorbed into §05's six tiles)
 * - the separate "three studios" block (same)
 * - the arbitrary single-featured-piece spotlight
 * - the second portfolio strip and the second marquee
 * - the standalone duplicate newsletter section
 * - the undefendable stat row (100% handcrafted / 500+ hours / 1 of 1)
 *
 * **Band rhythm.** §3.1 allows a maximum of three dark bands and forbids two
 * adjacent. The spec's own section list would put a dark §08 (bespoke) next
 * to a dark §09 (3D printing), so §09 keeps its technical, monochrome
 * character on a sand ground instead — the absolute rule wins over the
 * sectional description. Dark bands: the hero, §08 and §13.
 *
 * **The cure line** (§2.6) runs the whole page in the reserved left gutter.
 */
export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("Home");
  const tCommon = await getTranslations("Common");
  // The furniture tiles quote the statement-piece timeline the process page
  // publishes — one key, so the figure cannot drift between the two pages.
  const tProcess = await getTranslations("Process");
  const tWa = await getTranslations("WhatsApp");
  // The large-format teaser and the furniture/rooms bands read alt text and
  // wording that already lives on the pages the tiles link to, rather than a
  // second, drifting copy of the same words.
  const tLargeFormat = await getTranslations("LargeFormat");
  // Same rule for the workshops band: it quotes the session facts the
  // Workshops page publishes rather than restating the duration, the seat
  // count and the city in a second, drifting place.
  const tWorkshops = await getTranslations("Workshops");

  const demo = await demoWhere();
  const [
    catalog,
    portfolioRows,
    tileCategories,
    posts,
    settings,
    commissionCount,
    images,
    imageRefs,
    sections,
    testimonials,
  ] = await Promise.all([
    // §03 takes four pieces — one hero and three supporting. "featured"
    // sort puts the owner's curated picks first.
    //
    // Constrained to the art ecosystem for the same reason Phase 2a
    // constrained `fetchDefaultShopFirstPage`: an unconstrained clause here
    // draws from all 4,373 published products, and the band renders art today
    // only because all 12 `featured` rows happen to be art. Feature one pigment
    // set — an ordinary thing for the owner to do, since supplies are published
    // and sellable — and "featured pieces" would show sanding kits directly
    // below a hero that says the studio makes large resin work to commission,
    // linking to a shop that would not contain them.
    fetchProductsPage({
      where: buildProductWhere({ type: DEFAULT_ECOSYSTEM }, demo),
      sort: "featured",
      take: 4,
      locale,
      withTotal: false,
    }),
    // §07 recent commissions: one huge, two smaller.
    db.portfolio.findMany({
      where: { status: "PUBLISHED", ...demo },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        slug: true,
        translations: true,
        afterImageUrl: true,
        images: {
          orderBy: { order: "asc" },
          take: 1,
          select: { url: true, alt: true },
        },
      },
    }),
    // §05 tile photography — the owner's own category images.
    db.category.findMany({
      where: { slug: { in: TILE_CATEGORY_SLUGS }, visible: true },
      select: { slug: true, image: true },
    }),
    // §12 journal: one featured, two smaller.
    db.blogPost.findMany({
      where: { status: "PUBLISHED", ...demo },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        coverImage: true,
        publishedAt: true,
        translations: true,
        blogCategory: { select: { name: true, translations: true } },
      },
    }),
    getSiteSettings(),
    // The hero's fact row states a real number, not a slogan (§6 11:
    // "replace with defensible mono facts").
    db.portfolio.count({ where: { status: "PUBLISHED", ...demo } }),
    // Slot-resolved editorial imagery (/studio/site-images). Falls back to the
    // bundled file for every slot the owner has not replaced.
    getSiteImages(),
    getSiteImageRefs(),
    getPageSections("home"),
    // §08 the proof pair: three voices beside the three commissions above.
    // Returns [] when the owner has published none, and the band renders
    // nothing rather than inventing a customer.
    getTestimonials(3, locale),
  ]);

  const waHref = buildWaLink(
    defaultWaGreeting(tWa("greeting")),
    settings.whatsappNumber,
  );

  const [heroPiece] = catalog.items;
  /* registry in code → override in the database → a TOTAL resolver. Every
     other surface in this app follows that shape; this band did not. It read
     `Category.image` alone, so a row whose image was never set fell straight
     past the picture the repo ships to a two-letter monogram on a flat block —
     and on the live site that was Gift and Print, two of the six commercial
     doorways, because nothing had ever written the canonical seed (fixed in
     `tier-fill.ts`, but only for rows created from here on).

     The fallback order is the owner's value, then the canonical seed, then the
     monogram. The monogram is still reachable — a category with no canonical
     entry at all has nothing to fall back to — so a genuinely unpictured
     doorway still announces itself. What it no longer does is announce a
     picture that is sitting in `public/media/v3/`. */
  const canonicalTileImage = new Map(
    CANONICAL_CATEGORIES.map((c) => [c.slug, c.image ?? null]),
  );
  const tileImages = new Map(
    tileCategories.map((row) => [
      row.slug,
      /* `||`, not `??`: the category editor normalises an emptied field to
         null (`image: parsed.image || null`), but the importer and the
         Cloudinary reconcile both write this column too, and an empty string
         reaching here would pass `??` and render the monogram again — the
         exact bug, one writer later. No image URL is legitimately falsy. */
      row.image || canonicalTileImage.get(row.slug) || null,
    ]),
  );

  const commissions = portfolioRows.map((piece) => {
    const cover = piece.afterImageUrl ?? piece.images[0]?.url;
    return {
      id: piece.id,
      slug: piece.slug,
      title: localize(piece, locale, ["title"]).title,
      cover: isRenderableSrc(cover) ? cover : null,
      coverAlt: piece.images[0]?.alt?.trim() || null,
    };
  });

  const journal = posts.map((post) => {
    const p = localize(post, locale, ["title", "excerpt"]);
    return {
      id: post.id,
      slug: post.slug,
      title: p.title,
      excerpt: p.excerpt,
      cover: isRenderableSrc(post.coverImage) ? post.coverImage : null,
      category: post.blogCategory
        ? localizeName(post.blogCategory, locale)
        : null,
      date: post.publishedAt,
    };
  });

  const dateFormatter = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  /**
   * The page, keyed by section.
   *
   * The JSX is unchanged — each block is exactly what it was, in the same
   * file. What changed is that the fragment no longer hard-codes the order:
   * the manifest below decides which of these render and in what sequence,
   * so the owner can reorder and hide sections without a deploy.
   *
   * Building a node the manifest then hides costs nothing — these are React
   * elements, not rendered output, and every query the page makes already
   * happened above.
   */
  const sectionNodes: Record<string, ReactNode> = {
    /* ════════ 01 · Fullscreen hero — major ════════
    100svh, full-bleed cinematic, text bottom-left (not centred), and a
    fact row in mono where the old page had three decorative chips. The
    poster image is the LCP: it is `priority`, never revealed, never
    animated (Part 14). */
    pour: (
      <section
        id="pour"
        data-theme="navy"
        aria-labelledby="hero-heading"
        className="relative -mt-20 flex min-h-svh flex-col justify-end overflow-hidden bg-obsidian text-mineral"
      >
        <div className="absolute inset-0">
          <HeroMedia
            // The owner's upload wins; the bundled pour loop is the floor.
            // It used to be `?? undefined`, which meant the delivered film sat
            // in the repo unreferenced and every environment showed the poster
            // alone until someone found the Settings field.
            videoUrl={settings.heroVideoUrl ?? BUNDLED_VIDEOS.homeHero}
            poster={imageRefs["home.hero"]}
            drift
          />
          {/* §6 01 specifies a flat rgba(8,10,14,.6) overlay. A gradient
              weighted to the text block does the same job with less of the
              photograph lost — but it must not drop below 60% anywhere the
              copy sits, or the mono eyebrow falls under the 3:1 floor over a
              bright frame of the pour. */}
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-t from-obsidian/92 via-obsidian/65 to-obsidian/20"
          />
        </div>

        <div className="u-shell relative flex flex-col gap-8 pt-32 pb-24">
          {/* Text entrance only — the poster above is the LCP and is never
              animated or delayed (Part 14). `--i` staggers each line 80ms
              apart (roadmap Phase 1b `sf-hero-rise`, globals.css). */}
          <div
            className="sf-hero-rise w-fit"
            style={{ "--i": 0 } as CSSProperties}
          >
            <Eyebrow rule={false} className="text-champagne">
              {t("hero.eyebrow")}
            </Eyebrow>
          </div>

          <h1
            id="hero-heading"
            className="sf-hero-rise max-w-[14ch] font-display text-hero leading-hero tracking-display text-mineral"
            style={{ "--i": 1 } as CSSProperties}
          >
            {t("hero.headline")}
          </h1>

          <p
            className="sf-hero-rise u-prose font-body text-body leading-relaxed text-mist"
            style={{ "--i": 2 } as CSSProperties}
          >
            {t("hero.lead")}
          </p>

          <div
            className="sf-hero-rise flex flex-wrap items-center gap-4"
            style={{ "--i": 3 } as CSSProperties}
          >
            {/* Bespoke is the studio's primary ask; browsing the shop is the
                secondary path.

                The WEIGHTS swap here, not the order. `primary` inverts to a
                cream fill on a dark band, and audit §2.4 names that as the
                first of the CTA system's four different-looking primaries
                ("cream fill on home, solid black in the shop header, black
                Customize + teal WhatsApp on PDP, teal on /large-resin-art").
                Spec §1.1's answer is one system: champagne-outline on dark,
                ink-solid on light. So the ask takes `premium` and the browse
                path drops to `secondary`.

                The champagne count is unchanged at two — the eyebrow above
                plus one pill — which is what `redesign-audit.mjs` caps at. A
                second champagne pill here would fail the build. */}
            <Magnetic>
              <Button asChild variant="premium" size="lg">
                <Link href="/custom-order">{t("hero.ctaBespoke")}</Link>
              </Button>
            </Magnetic>
            <Button asChild variant="secondary" size="lg">
              <Link href="/shop">{t("hero.ctaExplore")}</Link>
            </Button>
          </div>

          {/* The fact row. Every value is true and checkable: the studio's
              city, the house rule, the published lead-time band, and a
              commission count read from the database. */}
          <p className="u-micro flex flex-wrap items-center gap-x-3 gap-y-2 text-mist">
            <span>{t("hero.factPlace")}</span>
            <span aria-hidden>·</span>
            <span>{t("hero.factMadeToOrder")}</span>
            <span aria-hidden>·</span>
            <span>{t("hero.factLeadTime")}</span>
            <span aria-hidden>·</span>
            <span>{t("hero.factCommissions", { count: commissionCount })}</span>
          </p>
        </div>

        {/* Scroll indicator: a thin vertical line with a slowly pulsing
            champagne droplet at its head. */}
        <span
          aria-hidden
          className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 pb-6"
        >
          <span className="block h-10 w-px bg-gradient-to-b from-transparent to-champagne/50" />
          <span className="block size-1.5 rounded-full bg-champagne animate-droplet" />
        </span>
      </section>
    ),
    /* ════════ 02 · Manifesto — standard ════════
    Large blank space, centred type. THE ONLY CENTRED BLOCK ON THE SITE
    (§6 02). No cards, no CTA — this is the breathing room the old page
    never took. */
    manifesto: (
      <section
        id="manifesto"
        aria-labelledby="manifesto-heading"
        className="section-standard bg-mineral"
      >
        <Reveal className="u-shell flex flex-col items-center gap-8 text-center">
          {/* The manifesto's own scroll-linked brighten (§14, view-timeline —
              no JS) layers under Reveal's one-time entrance: Reveal fades the
              whole block in once, then each line keeps dimming and
              brightening with the band's own position as the visitor
              continues past it. */}
          <h2
            id="manifesto-heading"
            className="sf-manifesto-brighten max-w-[18ch] font-display text-h1 leading-h1 tracking-display text-balance"
          >
            {t("manifesto.line1")}
            <br />
            {t("manifesto.line2")}
          </h2>
          <p className="sf-manifesto-brighten u-lede font-body text-body text-graphite">
            {t("manifesto.body")}
          </p>
        </Reveal>
      </section>
    ),
    /* ════════ 03 · Featured pieces — standard ════════
    One hero piece plus three supporting — never eight dense cards. */
    pieces: heroPiece ? (
      <section
        id="pieces"
        aria-labelledby="pieces-heading"
        className="section-standard overflow-hidden bg-sand"
      >
        {/* v3.1 — the 1+3 grid becomes a pinned horizontal rail on
            fine-pointer desktops (overflow-x snap rail elsewhere). Cards are
            the house CatalogProductCard untouched; the rail changes the room,
            not the furniture. */}
        <FeaturedRail
          items={catalog.items}
          heading={
            <SectionHeading
              id="pieces-heading"
              eyebrow={t("featured.eyebrow")}
              title={t("featured.heading")}
            />
          }
          endHref="/shop"
          endLabel={t("featured.cta")}
        />
      </section>
    ) : null,
    /* ════════ new · Large format — standard ════════
    A teaser for /large-resin-art, reusing that page's own four "scope"
    tiles and alt text rather than a second set — the studio still only has
    the one page to send a large-format visitor to. */
    "large-format": (
      <section
        id="large-format"
        aria-labelledby="large-format-heading"
        className="section-standard bg-mineral"
      >
        <div className="u-shell flex flex-col gap-12">
          <SectionHeading
            id="large-format-heading"
            eyebrow={t("largeFormat.eyebrow")}
            title={t("largeFormat.heading")}
            intro={t("largeFormat.intro")}
            action={
              <Button asChild variant="secondary" size="sm">
                <Link href="/large-resin-art">{t("largeFormat.cta")}</Link>
              </Button>
            }
          />
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {LARGE_FORMAT_TILES.map((tile, index) => (
              <li key={tile.key} className="flex flex-col gap-3">
                <Link
                  href="/large-resin-art"
                  className="group relative block outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-3"
                >
                  <div className="relative aspect-[4/5] overflow-hidden rounded-image bg-sand">
                    <MeniscusImage
                      src={images[tile.slot]}
                      blurDataURL={imageRefs[tile.slot].blurDataUrl}
                      alt={tLargeFormat(tile.altKey)}
                      fill
                      sizes="(min-width:1024px) 22vw, (min-width:640px) 45vw, 90vw"
                      className="absolute inset-0"
                      imageClassName="object-cover transition-transform duration-(--dur-slow) ease-(--ease-luxury) group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    />
                  </div>
                  <p className="mt-3 flex items-center gap-2">
                    <span className="u-num text-graphite" aria-hidden>
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="sr-only">
                      {t("largeFormat.index", {
                        number: index + 1,
                        total: LARGE_FORMAT_TILES.length,
                      })}
                    </span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    ),
    /* ════════ 04 · Material story — major ════════
    The climax. Sticky visual, four steps scrubbing beside it. Rendered
    exactly once — the old page shipped this block twice. */
    material: (
      <section
        id="material"
        aria-labelledby="material-heading"
        className="bg-mineral"
      >
        <PourCureShowcase
          eyebrow={t("showcase.eyebrow")}
          heading={t("showcase.heading")}
          headingId="material-heading"
          stages={[
            {
              title: t("showcase.stage1Title"),
              copy: t("showcase.stage1Copy"),
            },
            {
              title: t("showcase.stage2Title"),
              copy: t("showcase.stage2Copy"),
            },
            {
              title: t("showcase.stage3Title"),
              copy: t("showcase.stage3Copy"),
            },
            {
              title: t("showcase.stage4Title"),
              copy: t("showcase.stage4Copy"),
            },
          ]}
          staticAlt={t("showcase.staticAlt")}
        />
      </section>
    ),
    /* ════════ 05 · Collections — standard ════════ */
    collections: (
      <section
        id="collections"
        aria-labelledby="collections-heading"
        className="section-standard bg-sand"
      >
        <div className="u-shell flex flex-col gap-12">
          <SectionHeading
            id="collections-heading"
            eyebrow={t("collections.eyebrow")}
            title={t("collections.heading")}
            intro={t("collections.intro")}
          />
          {/* v3.1 — the bento becomes six hover-expanding doors (pure CSS
              flex transition; stacked on touch). Same tiles, same
              destinations, same fallback order — only the vessel changes. */}
          <CollectionDoors
            tiles={COLLECTION_TILES.map((tile) => ({
              href: tile.href,
              name: t(`collections.tiles.${tile.key}.name`),
              promise: t(`collections.tiles.${tile.key}.promise`),
              image:
                /* Five tiles paint the owner's `Category.image`; the sixth
                   points at /custom-order, which is not a category, so it
                   falls back to its own slot rather than to the monogram.
                   A category row whose image the owner has cleared falls
                   back the same way it always did — to the monogram — which
                   is a state the category editor can see and fix. */
                tile.slug
                  ? tileImages.get(tile.slug)
                  : imageRefs["home.collections.create"].url,
              imageAlt: t(`collections.tiles.${tile.key}.alt`),
            }))}
          />
        </div>
      </section>
    ),
    /* ════════ new · Furniture — standard, off by default ════════
    Concept imagery only — the studio takes furniture on commission but
    carries none in stock (D5). Every tile is captioned CONCEPT through
    `DemoMark`'s own styling, and the lead-time line reuses the exact figure
    `Process.timelines` already publishes for statement-scale work rather
    than inventing a new one. No prices, no product rows. */
    furniture: (
      <section
        id="furniture"
        aria-labelledby="furniture-heading"
        className="section-standard bg-sand"
      >
        <div className="u-shell flex flex-col gap-12">
          <SectionHeading
            id="furniture-heading"
            eyebrow={t("furniture.eyebrow")}
            title={t("furniture.heading")}
            intro={t("furniture.intro")}
            action={
              <Button asChild variant="secondary" size="sm">
                <Link href="/custom-order">{t("furniture.cta")}</Link>
              </Button>
            }
          />
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FURNITURE_KINDS.map((kind) => (
              <li key={kind.key} className="flex flex-col gap-4">
                <div className="relative aspect-[4/5] overflow-hidden rounded-image bg-mineral">
                  <MeniscusImage
                    src={images[kind.slot]}
                    blurDataURL={imageRefs[kind.slot].blurDataUrl}
                    alt={t(
                      `furniture.kinds.${kind.key}.alt` as "furniture.kinds.dining.alt",
                    )}
                    fill
                    sizes="(min-width:1024px) 30vw, (min-width:640px) 45vw, 90vw"
                    className="absolute inset-0"
                    imageClassName="object-cover"
                  />
                </div>
                <DemoMark label={t("furniture.conceptLabel")} />
                <h3 className="font-body text-16 font-medium text-ink">
                  {t(
                    `furniture.kinds.${kind.key}.title` as "furniture.kinds.dining.title",
                  )}
                </h3>
                <p className="font-body text-14 leading-relaxed text-graphite">
                  {t(
                    `furniture.kinds.${kind.key}.lead` as "furniture.kinds.dining.lead",
                  )}
                </p>
                <p className="u-micro border-t border-hairline pt-3">
                  {tProcess("timelines.e2Value")}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    ),
    /* ════════ 06 · The maker — standard ════════
    Real photography. The maker portrait is never AI-generated (§15.2). */
    maker: (
      <section
        id="maker"
        aria-labelledby="maker-heading"
        className="section-standard bg-mineral"
      >
        <div className="u-shell grid items-center gap-12 lg:grid-cols-12">
          <MeniscusImage
            src={images["home.maker"]}
            blurDataURL={imageRefs["home.maker"].blurDataUrl}
            alt={t("maker.imageAlt")}
            width={1200}
            height={1500}
            sizes="(min-width:1024px) 45vw, 90vw"
            className="aspect-[4/5] lg:col-span-5"
            imageClassName="object-cover"
          />
          <Reveal className="flex flex-col gap-6 lg:col-span-6 lg:col-start-7">
            <Eyebrow>{t("maker.eyebrow")}</Eyebrow>
            <h2
              id="maker-heading"
              className="max-w-[16ch] font-display text-h2 leading-h2 tracking-display"
            >
              {t("maker.heading")}
            </h2>
            <p className="u-prose font-body text-body text-graphite">
              {t("maker.body")}
            </p>
            <Button asChild variant="secondary" size="md" className="w-fit">
              <Link href="/about">{t("maker.cta")}</Link>
            </Button>
          </Reveal>
        </div>
      </section>
    ),
    /* ════════ new · Rooms — standard, off by default ════════
    Also concept imagery (D5) — four rooms shown with a commissioned piece
    in place, captioned as a concept exactly like the furniture band above. */
    rooms: (
      <section
        id="rooms"
        aria-labelledby="rooms-heading"
        className="section-standard bg-mineral"
      >
        <div className="u-shell flex flex-col gap-12">
          <SectionHeading
            id="rooms-heading"
            eyebrow={t("rooms.eyebrow")}
            title={t("rooms.heading")}
            intro={t("rooms.intro")}
          />
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ROOM_KEYS.map((room) => {
              const slot = `home.rooms.${room}` as "home.rooms.living";
              return (
                <li key={room} className="flex flex-col gap-3">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-image bg-sand">
                    <MeniscusImage
                      src={images[slot]}
                      blurDataURL={imageRefs[slot].blurDataUrl}
                      alt={t(`rooms.${room}.alt` as "rooms.living.alt")}
                      fill
                      sizes="(min-width:1024px) 22vw, (min-width:640px) 45vw, 90vw"
                      className="absolute inset-0"
                      imageClassName="object-cover"
                    />
                  </div>
                  <DemoMark label={t("rooms.conceptLabel")} />
                  <h3 className="font-body text-16 font-medium text-ink">
                    {t(`rooms.${room}.title` as "rooms.living.title")}
                  </h3>
                  <p className="font-body text-14 text-graphite">
                    {t(`rooms.${room}.caption` as "rooms.living.caption")}
                  </p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>
    ),
    /* ════════ 07 · Recent commissions — standard ════════
    Editorial, not a grid: one huge image, two smaller, project numbers
    in mono over the corner. The strongest proof on the site, no longer
    sitting eighth. */
    work:
      commissions.length > 0 ? (
        <section
          id="work"
          aria-labelledby="work-heading"
          className="section-standard bg-sand"
        >
          <div className="u-shell flex flex-col gap-12">
            <SectionHeading
              id="work-heading"
              eyebrow={t("portfolio.eyebrow")}
              title={t("portfolio.heading")}
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/portfolio">{t("portfolio.cta")}</Link>
                </Button>
              }
            />
            <div className="grid gap-6 lg:grid-cols-12">
              {commissions.map((piece, index) => (
                <article
                  key={piece.id}
                  className={
                    index === 0
                      ? "group relative lg:col-span-8"
                      : "group relative lg:col-span-4"
                  }
                >
                  <div
                    className={
                      index === 0
                        ? "relative aspect-[16/10] overflow-hidden rounded-image bg-sand"
                        : "relative aspect-[4/3] overflow-hidden rounded-image bg-sand"
                    }
                  >
                    {piece.cover ? (
                      <MeniscusImage
                        src={sizedExternalSrc(piece.cover, 1400)}
                        alt={piece.coverAlt ?? piece.title}
                        fill
                        sizes={
                          index === 0
                            ? "(min-width:1024px) 66vw, 100vw"
                            : "(min-width:1024px) 33vw, 100vw"
                        }
                        unoptimized={!isOptimizableImageSrc(piece.cover)}
                        className="absolute inset-0"
                        imageClassName="object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="flex h-full w-full items-center justify-center bg-deep-ocean font-display text-49 text-mineral/70"
                      >
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    )}
                    <span className="u-micro absolute start-4 top-4 text-mineral mix-blend-difference">
                      {t("portfolio.projectNumber", {
                        number: String(index + 1).padStart(2, "0"),
                      })}
                    </span>
                  </div>
                  <h3 className="mt-4 font-body text-16 font-medium text-ink">
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
    /* ════════ 08 · In their words — standard ════════
       The proof pair. Recent commissions above show the work; this shows the
       people who bought it, and the bespoke band below asks. `Home.testimonials.*`
       has been translated into all nine locales and editable at
       /studio/site-copy since the copy layer shipped — it just had no section
       to render in. Light ground: the page is at Part 19.1's three-dark-band
       ceiling already, and mineral holds the alternation on both sides. */
    words:
      testimonials.length > 0 ? (
        <section
          id="words"
          aria-labelledby="words-heading"
          className="section-standard bg-mineral"
        >
          <div className="u-shell flex flex-col gap-12">
            <SectionHeading
              id="words-heading"
              eyebrow={t("testimonials.eyebrow")}
              title={t("testimonials.heading")}
            />
            {/* One quote at a time, oversized, rather than three cards side
                by side — spec §3.1 S6. The same three testimonials are still
                here; they take turns instead of competing, which is the whole
                difference between a proof band and a review grid.

                `FeaturedTestimonial` was built for this call site and left
                unmounted ("A2 (homepage) and A3 (PDP) own where it lands"),
                so this is that landing rather than a new component. It is an
                async server component, so the slides are rendered here and
                handed down as nodes — the arrangement `SnapRail` already
                used. No responsive fork: the rotator is one quote wide at
                every width, which is exactly what a phone wants too. */}
            <QuoteRotator
              items={testimonials.map((item) => (
                <FeaturedTestimonial key={item.id} testimonial={item} />
              ))}
              labels={{
                pause: t("testimonials.pause"),
                resume: t("testimonials.resume"),
                show: testimonials.map((_, i) =>
                  t("testimonials.show", { index: i + 1 }),
                ),
              }}
            />
          </div>
        </section>
      ) : null,
    /* ════════ 09 · Bespoke — major-weight dark band ════════ */
    bespoke: (
      <section
        id="bespoke"
        data-theme="navy"
        aria-labelledby="bespoke-heading"
        className="relative section-major overflow-hidden bg-obsidian text-mineral"
      >
        {/* Part 14 parallax, capped at 40px — wraps only the image layer,
            never the text above it. */}
        <HeroParallax className="absolute inset-0 z-0">
          <SlotImage
            slot={imageRefs["home.bespoke"]}
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-35"
          />
        </HeroParallax>
        <span
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-obsidian via-obsidian/80 to-obsidian/30"
        />
        <div className="u-shell relative flex flex-col gap-8">
          <Eyebrow rule={false} className="text-champagne">
            {t("custom.eyebrow")}
          </Eyebrow>
          <h2
            id="bespoke-heading"
            className="max-w-[14ch] font-display text-h1 leading-h1 tracking-display text-mineral"
          >
            {t("custom.heading")}
          </h2>
          <p className="font-display text-h3 leading-statement text-mineral/90">
            {t("custom.lineFlowers")}
            <br />
            {t("custom.lineNames")}
            <br />
            {t("custom.lineDates")}
          </p>
          <p className="u-prose font-body text-body text-mist">
            {t("custom.body")}
          </p>
          <Button asChild variant="premium" size="lg" className="w-fit">
            <Link href="/custom-order">{t("custom.cta")}</Link>
          </Button>
        </div>
      </section>
    ),
    /* ════════ new · Workshops — standard ════════
    /workshops is a live page with a real page hero, a session grid and a
    private-booking band, and until now NOTHING on the homepage pointed at
    it: the only routes in were the drawer's second group and the footer.
    This band is the third way to engage, between the commission band above
    and the print studio below — commission one, pour one, print one.

    The fact row reuses `Workshops.facts.*` rather than restating the
    duration, the seat count and the city in a second place. Two copies of a
    number are two chances to be wrong, and the owner edits that one in the
    Workshops copy surface.

    Sand ground: §09 above is dark and §10 below is mineral, so this keeps
    the page alternating rather than repeating a ground. */
    workshops: (
      <section
        id="workshops"
        aria-labelledby="workshops-heading"
        className="section-standard bg-sand"
      >
        <div className="u-shell grid items-center gap-12 lg:grid-cols-12 lg:gap-16">
          <MeniscusImage
            src={images["home.workshops"]}
            blurDataURL={imageRefs["home.workshops"].blurDataUrl}
            alt={t("workshops.imageAlt")}
            width={1600}
            height={900}
            sizes="(min-width:1024px) 45vw, 90vw"
            className="aspect-video lg:col-span-6"
            imageClassName="object-cover"
          />
          <Reveal className="flex flex-col gap-6 lg:col-span-5 lg:col-start-8">
            <Eyebrow>{t("workshops.eyebrow")}</Eyebrow>
            <h2
              id="workshops-heading"
              className="max-w-[16ch] font-display text-h2 leading-h2 tracking-display"
            >
              {t("workshops.heading")}
            </h2>
            <p className="u-prose font-body text-body text-graphite">
              {t("workshops.body")}
            </p>
            {/* Three of the four facts the Workshops page states, in the
                strip's own mono. A list, not a `<dl>`: "2.5 hours" and
                "Max 8 seats" name themselves, so the terms a definition list
                would need would all be the same word. The separator trails
                its own fact rather than leading the next one, so a wrapped
                row never opens a line with a dot — the same rule the
                Workshops strip follows. */}
            <ul
              aria-label={tWorkshops("facts.label")}
              className="u-micro flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline pt-5"
            >
              {WORKSHOP_FACTS.map((fact, index) => (
                <li key={fact} className="flex items-center gap-4">
                  <span>{tWorkshops(`facts.${fact}`)}</span>
                  {index < WORKSHOP_FACTS.length - 1 ? (
                    <span aria-hidden>·</span>
                  ) : null}
                </li>
              ))}
            </ul>
            <Button asChild variant="secondary" size="md" className="w-fit">
              <Link href="/workshops">{t("workshops.cta")}</Link>
            </Button>
          </Reveal>
        </div>
      </section>
    ),
    /* ════════ 09 · 3D printing — standard ════════
    Technical and monochrome, and deliberately NOT a dark band: §3.1
    forbids two dark sections touching, and §08 above is dark. */
    print: (
      <section
        id="print"
        aria-labelledby="print-heading"
        className="section-standard bg-mineral"
      >
        <div className="u-shell grid items-center gap-12 lg:grid-cols-12">
          <Reveal className="flex flex-col gap-6 lg:col-span-5">
            <Eyebrow>{t("printStudio.eyebrow")}</Eyebrow>
            <h2
              id="print-heading"
              className="max-w-[14ch] font-display text-h2 leading-h2 tracking-display"
            >
              {t("printStudio.headingLine1")}
              <br />
              {t("printStudio.headingLine2")}
            </h2>
            <p className="u-prose font-body text-body text-graphite">
              {t("printStudio.body")}
            </p>
            <dl className="flex flex-col gap-2 border-t border-hairline pt-5">
              {(["cad", "print", "finish"] as const).map((step, index) => (
                <div key={step} className="flex items-baseline gap-4">
                  <dt className="u-micro w-8 shrink-0">
                    {String(index + 1).padStart(2, "0")}
                  </dt>
                  <dd className="font-body text-14 text-ink">
                    {t(`printStudio.steps.${step}`)}
                  </dd>
                </div>
              ))}
            </dl>
            <Button asChild variant="secondary" size="md" className="w-fit">
              <Link href="/shop?type=print">{t("printStudio.cta")}</Link>
            </Button>
          </Reveal>
          <MeniscusImage
            src={images["home.print"]}
            blurDataURL={imageRefs["home.print"].blurDataUrl}
            alt={t("printStudio.imageAlt")}
            width={1400}
            height={1050}
            sizes="(min-width:1024px) 55vw, 90vw"
            className="aspect-[4/3] grayscale lg:col-span-6 lg:col-start-7"
            imageClassName="object-cover"
          />
        </div>
      </section>
    ),
    /* ════════ 10 · How it works — standard ════════
    A horizontal timeline with a connecting hairline, one numeral per
    step in mono, and the reassurance line the old page was missing. */
    process: (
      <section
        id="process"
        aria-labelledby="how-heading"
        className="section-standard bg-sand"
      >
        <div className="u-shell flex flex-col gap-12">
          <Reveal>
            <SectionHeading
              id="how-heading"
              eyebrow={t("how.eyebrow")}
              title={t("how.heading")}
            />
          </Reveal>
          <div className="relative">
            {/* The connecting rule. Decorative — the ordered list already
                carries the sequence — and a sibling of the <ol> rather than a
                child of it: a <span> inside <ol> is invalid nesting, and the
                parser relocates it, which breaks hydration. */}
            <span
              aria-hidden
              className="absolute inset-x-0 top-3 hidden h-px bg-hairline md:block"
            />
            <ol className="grid gap-10 md:grid-cols-4 md:gap-6">
              {(["step1", "step2", "step3", "step4"] as const).map(
                (step, index) => (
                  <li key={step} className="relative flex flex-col gap-3">
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
                      {t(`how.${step}Title`)}
                    </h3>
                    <p className="font-body text-14 leading-relaxed text-graphite">
                      {t(`how.${step}Copy`)}
                    </p>
                  </li>
                ),
              )}
            </ol>
          </div>
          <p className="u-micro border-t border-hairline pt-6 text-champagne-ink">
            {t("how.reassurance")}
          </p>
        </div>
      </section>
    ),
    /* ════════ 11 · Why Rivya Living Art — standard ════════
    Four proof points with photography and mono numerals — no icons
    (§3.7). The old page's stat row (100% handcrafted / 500+ hours /
    1 of 1) is gone: none of the three was checkable. */
    why: (
      <section
        aria-labelledby="why-heading"
        className="section-standard bg-mineral"
      >
        <div className="u-shell flex flex-col gap-12">
          <Reveal>
            <SectionHeading
              id="why-heading"
              eyebrow={t("why.eyebrow")}
              title={t("why.heading")}
            />
          </Reveal>
          <ul className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                {
                  key: "handcrafted",
                  image: imageRefs["home.why.handcrafted"],
                },
                { key: "bespoke", image: imageRefs["home.why.bespoke"] },
                { key: "slowMade", image: imageRefs["home.why.slowMade"] },
                { key: "heirloom", image: imageRefs["home.why.heirloom"] },
              ] as const
            ).map((proof) => (
              <li key={proof.key} className="flex flex-col gap-4">
                <MeniscusImage
                  src={proof.image.url}
                  blurDataURL={proof.image.blurDataUrl}
                  alt={t(`why.proof.${proof.key}.alt`)}
                  width={800}
                  height={1000}
                  sizes="(min-width:1024px) 22vw, (min-width:640px) 45vw, 90vw"
                  className="aspect-[4/5]"
                  imageClassName="object-cover"
                />
                <p className="u-micro">{t(`why.proof.${proof.key}.label`)}</p>
                <p className="font-body text-14 leading-relaxed text-graphite">
                  {t(`why.proof.${proof.key}.copy`)}
                </p>
              </li>
            ))}
          </ul>
          {/* Defensible mono facts replacing the old stat row. */}
          <p className="u-micro flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-hairline pt-6">
            <span>{t("why.factLayer")}</span>
            <span aria-hidden>·</span>
            <span>{t("why.factGrit")}</span>
            <span aria-hidden>·</span>
            <span>{t("why.factCommissions", { count: commissionCount })}</span>
          </p>
        </div>
      </section>
    ),
    /* ════════ 12 · Journal — standard ════════
    Three articles: one large featured, two smaller. No tag wall. The
    ONLY section on the site allowed the heading "Notes from the
    studio" (§6 12 + Part 17's no-duplicate-headings rule). */
    journal: journal.length > 0 ? (
      <section
        id="journal"
        aria-labelledby="journal-heading"
        className="section-standard bg-sand"
      >
        <div className="u-shell flex flex-col gap-12">
          <Reveal>
            <SectionHeading
              id="journal-heading"
              eyebrow={t("journal.eyebrow")}
              title={t("journal.heading")}
              action={
                <Button asChild variant="secondary" size="sm">
                  <Link href="/blog">{t("journal.cta")}</Link>
                </Button>
              }
            />
          </Reveal>
          {/* Spec §3.1 S8: an editorial list, not a featured-plus-two grid.
              Dates are formatted here rather than in the list, which is a
              client component — `dateFormatter` carries the request's locale
              and must not be re-derived on the other side of the boundary. */}
          <JournalList
            rows={journal.map((post) => ({
              id: post.id,
              slug: post.slug,
              title: post.title,
              dateLabel: post.date ? dateFormatter.format(post.date) : null,
              category: post.category,
              cover: post.cover,
            }))}
          />
        </div>
      </section>
    ) : null,
    /* ════════ 13 · Final CTA — compact ════════
    Two spec passages meet here and only one can be right. §6 13 lists
    this section as "Newsletter + final CTA — compact + dark band"; §5.8
    says the newsletter has "two placements only (footer, journal index)"
    and names the homepage's duplicate as the bug it is correcting. §5.8
    wins: it is the corrective statement, and the footer's own newsletter
    sits three hundred pixels below this line.

    The band is light for a second reason, and half of the reason this
    comment used to give was wrong. It said the hero, the material story and
    the bespoke band "already spend all three" of §3.1's dark bands; the
    material story is `bg-mineral`, so only two are spent and the count was
    never the blocker. The ADJACENCY is: §3.1 forbids two dark grounds edge to
    edge and the obsidian footer follows immediately, so a dark band here
    would sit against it however many slots were free.

    Spec §3.1's S9 — "obsidian, resin-mesh behind, one champagne pill" — is
    therefore built in the footer's own CTA band, which is already obsidian
    and already last. See `footer.tsx`. */
    closing: (
      <section
        aria-labelledby="closing-heading"
        className="section-standard bg-mineral"
      >
        <div className="u-shell flex flex-col gap-8">
          <Reveal>
            <h2
              id="closing-heading"
              className="max-w-[16ch] font-display text-h1 leading-h1 tracking-display"
            >
              {t("cta.headingLine1")}
              <br />
              {t("cta.headingLine2")}
            </h2>
          </Reveal>
          <div className="flex flex-wrap items-center gap-4">
            <Button asChild variant="primary" size="lg">
              <Link href="/custom-order">{t("cta.primary")}</Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                data-wa-source="home_closing"
              >
                {t("cta.whatsapp")}
                <span className="sr-only"> {tCommon("openInNewTab")}</span>
              </a>
            </Button>
          </div>
        </div>
      </section>
    ),
  };

  /**
   * §2.6 — one tick per section boundary, labelled in mono.
   *
   * GENERATED from the same resolved list the page renders, not maintained
   * beside it. The two used to be separate arrays kept in step by hand, which
   * was fine only while the order was fixed: the moment an owner could hide or
   * move a section, a hand-written rail would point at sections that are not
   * there and list them in an order the page no longer uses.
   *
   * Sections with no `cureLabelKey` — the closing invitation, the Why band —
   * deliberately have no tick, exactly as before.
   *
   * **`visible` is not enough, which is why this is computed here and not
   * beside the section list.** Four sections are `conditional` — pieces, work,
   * words and journal — and their nodes evaluate to `null` when the database
   * has no products, no portfolio cases, no testimonials or no posts. The
   * manifest still calls them visible, so a rail built off `visible` alone
   * rendered four labelled ticks (PIECES · WORK · WORDS · JOURNAL) pointing at
   * DOM ids that do not exist. `CureLine` cannot detect that: when
   * `getElementById` misses it falls back to even division, so the rail looked
   * correct and simply described a different page — on an empty database, on a
   * preview, and on any deploy where the owner had not yet added content. The
   * nodes are already built by this point, so asking whether one exists is the
   * same question the render below asks.
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
      label: t(section.cureLabelKey as "cure.pour"),
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
