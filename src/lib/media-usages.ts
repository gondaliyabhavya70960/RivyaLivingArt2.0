/**
 * Media-usage lookups shared by the studio delete actions. Lives OUTSIDE the
 * "use server" action modules on purpose: every export of an action module is
 * a public POST endpoint, and this helper carries no auth of its own — as an
 * action it let anonymous callers probe which URLs live content references
 * (Part 0 audit A5-001). Import it server-side only.
 */
import { db } from "@/lib/db";
import { readStagedImage } from "@/lib/site-image-draft";
import { extractTiptapImageUrls } from "@/lib/tiptap-media";

/**
 * Returns the subset of `urls` that are still referenced by live content —
 * product/portfolio galleries, category covers, blog covers, product/portfolio
 * media, testimonial avatars/installation photos/films/posters, the site
 * logo/hero, the named editorial slots
 * behind /studio/site-images (the desktop and mobile crop of both the live and
 * the STAGED value), landing-page social images and block pictures, and Tiptap
 * rich-text body images (blog posts, legal pages, richText landing blocks) — so
 * a delete never silently 404s the live site (ENG-806 / UIUX-605).
 *
 * "Live content" includes what is staged. On the draft surfaces a save writes
 * only the draft column, so scanning the live column alone let a staged picture
 * be deleted, which broke the staff preview at once and the public page at the
 * next Publish — the fourth time this header rule was broken, and the fourth
 * time the breakage was silent.
 *
 * Tiptap body images (Json) in BlogPost.content, Page.content and the landing
 * pages' `richText` blocks (and their translation overlays) are walked and
 * guarded so bulk sweeps cannot delete body pictures.
 *
 * Every new table that stores a media URL must be added here in the same
 * commit that introduces it, or the guard silently stops guarding.
 */
export async function findMediaUsages(urls: string[]): Promise<Set<string>> {
  const details = await findMediaUsageDetails(urls);
  return new Set(details.keys());
}

/**
 * Same scan, but labeled: url → the places that reference it (with counts for
 * repeated gallery use, e.g. "Product gallery ×3"). Drives the library's
 * per-file "Used in" line (audit §32) on top of the delete guard.
 */
export async function findMediaUsageDetails(
  urls: string[],
): Promise<Map<string, string[]>> {
  const counts = new Map<string, Map<string, number>>();
  if (urls.length === 0) return new Map();

  // Named rather than a positional `Promise.all`: this list has grown to a
  // dozen entries across four phases, and an entry inserted in the wrong slot
  // silently hands one table's rows to another table's label. Every query is
  // started here, so they still run concurrently — awaiting an already
  // in-flight promise costs nothing.
  const pending = {
    productImages: db.productImage.findMany({
      where: { url: { in: urls } },
      select: { url: true },
    }),
    portfolioImages: db.portfolioImage.findMany({
      where: { url: { in: urls } },
      select: { url: true },
    }),
    categories: db.category.findMany({
      where: { image: { in: urls } },
      select: { image: true },
    }),
    posts: db.blogPost.findMany({
      where: { coverImage: { in: urls } },
      select: { coverImage: true },
    }),
    products: db.product.findMany({
      where: {
        OR: [
          { videoUrl: { in: urls } },
          { model3dUrl: { in: urls } },
          { ogImage: { in: urls } },
        ],
      },
      select: { videoUrl: true, model3dUrl: true, ogImage: true },
    }),
    portfolios: db.portfolio.findMany({
      where: {
        OR: [
          { beforeImageUrl: { in: urls } },
          { afterImageUrl: { in: urls } },
          { videoUrl: { in: urls } },
        ],
      },
      select: { beforeImageUrl: true, afterImageUrl: true, videoUrl: true },
    }),
    settings: db.siteSettings.findMany({
      where: {
        OR: [
          { logoUrl: { in: urls } },
          { heroVideoUrl: { in: urls } },
          { faviconUrl: { in: urls } },
          { appIconUrl: { in: urls } },
        ],
      },
      select: {
        logoUrl: true,
        heroVideoUrl: true,
        faviconUrl: true,
        appIconUrl: true,
      },
    }),
    // The default sharing picture lives inside the defaultSeo Json, so it
    // cannot be filtered in SQL. There is exactly one settings row.
    seoSettings: db.siteSettings.findMany({ select: { defaultSeo: true } }),
    // A testimonial carries up to four pictures: the customer's avatar, the
    // installed piece, a short film and its poster (B0 · testimonial system).
    testimonials: db.testimonial.findMany({
      where: {
        OR: [
          { avatarUrl: { in: urls } },
          { installationImageUrl: { in: urls } },
          { videoUrl: { in: urls } },
          { videoPosterUrl: { in: urls } },
        ],
      },
      select: {
        avatarUrl: true,
        installationImageUrl: true,
        videoUrl: true,
        videoPosterUrl: true,
      },
    }),
    // Named editorial slots (/studio/site-images), BOTH halves — live and
    // staged. Omitting these let a library file that a hero points at pass the
    // delete guard and 404 the storefront silently: an unset slot falls back to
    // its bundled default, but a slot pointing at a DELETED upload keeps
    // pointing at it.
    //
    // A save on this surface is a DRAFT: the studio writes the new url into
    // `draft` and leaves the live `url` alone. A staged picture was therefore
    // invisible to this scan, so deleting it passed the guard, broke the staff
    // preview at once, and then broke the live page for every visitor the
    // moment someone pressed Publish — publishing copies `draft.url` into
    // `url` without re-checking that the file still exists.
    //
    // `draft` is Json and cannot be filtered in SQL, and the table holds one
    // row per CHANGED slot (62 at the absolute most), so the whole set is read
    // unfiltered and matched in JS — the shape `customBlocks` below already
    // uses. `add()` drops anything the caller did not ask about, so reading
    // every row costs a tiny query and changes no result.
    siteImages: db.siteImage.findMany({
      select: { url: true, mobileUrl: true, key: true, draft: true },
    }),
    // Landing-page social images (Phase G).
    customPages: db.customPage.findMany({
      where: { ogImage: { in: urls } },
      select: { ogImage: true, title: true },
    }),
    // Landing-page block pictures and richText bodies live inside Json blobs.
    // hero/imageCta hold single images; richText holds Tiptap trees.
    customBlocks: db.customBlock.findMany({
      where: { type: { in: ["hero", "imageCta", "richText"] } },
      select: {
        type: true,
        data: true,
        translations: true,
        page: { select: { title: true } },
      },
    }),
    // Tiptap body images in blog posts and legal/custom pages (ENG-806 / UIUX-605).
    blogPostsContent: db.blogPost.findMany({
      select: { title: true, content: true, translations: true },
    }),
    pagesContent: db.page.findMany({
      select: { title: true, content: true, translations: true },
    }),
  };

  const productImages = await pending.productImages;
  const portfolioImages = await pending.portfolioImages;
  const categories = await pending.categories;
  const posts = await pending.posts;
  const products = await pending.products;
  const portfolios = await pending.portfolios;
  const settings = await pending.settings;
  const seoSettings = await pending.seoSettings;
  const testimonials = await pending.testimonials;
  const siteImages = await pending.siteImages;
  const customPages = await pending.customPages;
  const customBlocks = await pending.customBlocks;
  const blogPostsContent = await pending.blogPostsContent;
  const pagesContent = await pending.pagesContent;

  // Only URLs the caller asked about. A value pulled out of a Json blob can be
  // anything, and letting it into the map would report usage for files the
  // caller never mentioned.
  const wanted = new Set(urls);
  const add = (value: string | null | undefined, label: string) => {
    if (!value || !wanted.has(value)) return;
    const perUrl = counts.get(value) ?? new Map<string, number>();
    perUrl.set(label, (perUrl.get(label) ?? 0) + 1);
    counts.set(value, perUrl);
  };
  productImages.forEach((r) => add(r.url, "Product gallery"));
  portfolioImages.forEach((r) => add(r.url, "Portfolio gallery"));
  categories.forEach((r) => add(r.image, "Category cover"));
  posts.forEach((r) => add(r.coverImage, "Blog cover"));
  products.forEach((r) => {
    add(r.videoUrl, "Product video");
    add(r.model3dUrl, "Product 3D model");
    add(r.ogImage, "Product OG image");
  });
  portfolios.forEach((r) => {
    add(r.beforeImageUrl, "Portfolio before/after");
    add(r.afterImageUrl, "Portfolio before/after");
    add(r.videoUrl, "Portfolio film");
  });
  settings.forEach((r) => {
    add(r.logoUrl, "Site logo");
    add(r.heroVideoUrl, "Home hero video");
    add(r.faviconUrl, "Favicon");
    add(r.appIconUrl, "App icon");
  });
  seoSettings.forEach((r) => {
    const seo = r.defaultSeo as { ogImage?: unknown } | null;
    if (typeof seo?.ogImage === "string") {
      add(seo.ogImage, "Default sharing picture");
    }
  });
  testimonials.forEach((r) => {
    add(r.avatarUrl, "Testimonial avatar");
    add(r.installationImageUrl, "Testimonial installation photo");
    add(r.videoUrl, "Testimonial film");
    add(r.videoPosterUrl, "Testimonial film poster");
  });
  // Labelled per slot rather than "Site image ×3": when the guard blocks a
  // delete the owner needs to know WHICH picture they are about to break.
  siteImages.forEach((r) => {
    add(r.url, `Site image · ${r.key}`);
    // The mobile crop is a second URL on the same row (Phase B). Leaving it
    // out let a delete pass the guard and 404 the phone layout only, which is
    // the hardest kind of breakage to notice.
    add(r.mobileUrl, `Site image · ${r.key} (mobile)`);
    // The staged half, read through the SAME reader the preview and the board
    // use, so the guard and the screen can never disagree about what a staged
    // row means.
    const staged = readStagedImage(r.draft);
    if (staged) {
      add(staged.url, `Site image · ${r.key} (staged)`);
      add(staged.mobileUrl, `Site image · ${r.key} (staged, mobile)`);
    }
  });
  customPages.forEach((r) => add(r.ogImage, `Landing page · ${r.title}`));
  customBlocks.forEach((block) => {
    if (block.type === "richText") {
      const urls = extractTiptapImageUrls([block.data, block.translations]);
      for (const u of urls) {
        add(u, `Landing page · ${block.page.title}`);
      }
    } else {
      const data = block.data as { image?: unknown } | null;
      if (typeof data?.image === "string") {
        add(data.image, `Landing page · ${block.page.title}`);
      }
    }
  });
  blogPostsContent.forEach((post) => {
    const urls = extractTiptapImageUrls([post.content, post.translations]);
    for (const u of urls) {
      add(u, `Blog post · ${post.title}`);
    }
  });
  pagesContent.forEach((page) => {
    const urls = extractTiptapImageUrls([page.content, page.translations]);
    for (const u of urls) {
      add(u, `Page · ${page.title}`);
    }
  });

  const details = new Map<string, string[]>();
  for (const [url, perUrl] of counts) {
    details.set(
      url,
      [...perUrl].map(([label, n]) => (n > 1 ? `${label} ×${n}` : label)),
    );
  }
  return details;
}

/**
 * The first `take` library rows nothing references.
 *
 * Deliberately built on `findMediaUsages` rather than on a stored
 * `usageCount`. A counter would have to be maintained at every site that ever
 * writes a media URL — which is precisely the thing that silently stops
 * happening, and a stale counter behind a DELETE button is worse than no
 * button. So this pages through the library and asks the live scan, in
 * batches, until it has enough.
 *
 * Bounded on purpose: `scanned` says how far it got, so the screen can say
 * "the first 200 unused of the 2,000 checked" instead of implying it swept
 * the whole library.
 */
export async function findUnusedMedia(
  where: object,
  take: number,
  maxScan = 2000,
): Promise<{ ids: string[]; scanned: number; exhausted: boolean }> {
  const BATCH = 200;
  const ids: string[] = [];
  let cursor: string | undefined;
  let scanned = 0;

  while (ids.length < take && scanned < maxScan) {
    const rows = await db.media.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: BATCH,
      select: { id: true, url: true },
    });
    if (rows.length === 0) {
      return { ids, scanned, exhausted: true };
    }
    scanned += rows.length;
    cursor = rows[rows.length - 1].id;

    const used = await findMediaUsages(rows.map((r) => r.url));
    for (const row of rows) {
      if (used.has(row.url)) continue;
      ids.push(row.id);
      if (ids.length >= take) break;
    }
    if (rows.length < BATCH) {
      return { ids, scanned, exhausted: true };
    }
  }

  return { ids, scanned, exhausted: false };
}
