/**
 * Named site-image slots.
 *
 * Every editorial photograph on the storefront used to be a hardcoded
 * `/media/…` string, which meant the owner could not change a hero without a
 * deploy — and meant one file did duty in five places at once (REDESIGN.md
 * §15.3 calls that out as the incoherence the Part 15 asset set exists to fix).
 *
 * Each of those call sites is now a SLOT: a stable key, the ratio the layout
 * actually renders it at, and the file bundled in `public/media` as its
 * default. `/studio/site-images` lists them grouped by surface and lets the
 * owner replace any one of them; a `SiteImage` row overrides the default and
 * deleting it restores the bundled file. Nothing here can break the site — an
 * unset slot always resolves to something that exists in the repo.
 *
 * Plain module, no server imports: the registry is read by the RSC pages, the
 * studio client screen and the import script alike.
 *
 * Two deliberate exclusions:
 *  - `public/sequences/pour-cure/*` — 121 canvas-scrub frames. They are a
 *    single animation, not editorial imagery, and 121 remote fetches would
 *    wreck the scrub. They stay bundled.
 *  - `CANONICAL_CATEGORIES[].image` in catalog-taxonomy.ts — those are seed
 *    defaults for `Category.image`, which the owner already edits in the
 *    category editor. Slotting them too would give one picture two owners.
 */

export type SiteImageSlot = {
  key: string;
  /** Surface the slot belongs to — the studio screen groups by this. */
  group: SiteImageGroup;
  /** What the owner is choosing, in their words. */
  label: string;
  /** Where it appears, so the choice can be made without hunting for it. */
  where: string;
  /** The ratio the layout crops to (REDESIGN.md §15.1). */
  ratio: string;
  /** Bundled file used when no override exists. */
  fallback: string;
  /** Anything the owner needs to know before replacing it. */
  note?: string;
  /**
   * The copy slot that describes this picture, edited inline on the Site
   * Images board.
   *
   * Alt text lives in `messages/*.json` and became editable with the copy
   * layer — but on a different screen from the photograph it describes. An
   * owner who swaps a material macro will not think to go and fix
   * `About.materials.alt2`, and the site would then confidently describe the
   * picture it used to have. Naming the key here lets one screen edit both.
   *
   * Absent means the image is deliberately decorative (`alt=""`) or its alt is
   * built dynamically and has no single key. Never invent one: a wrong key
   * would edit some other picture's description.
   */
  altKey?: string;
};

export const SITE_IMAGE_GROUPS = [
  "Homepage",
  "About",
  "Process",
  "Workshops",
  "Commission",
  "Large format",
  "Contact",
  "Portfolio",
  "Shop",
  "Navigation",
  "Studio",
] as const;

export type SiteImageGroup = (typeof SITE_IMAGE_GROUPS)[number];

export const SITE_IMAGE_SLOTS = [
  /* ————————————————— Homepage ————————————————— */
  {
    key: "home.hero",
    group: "Homepage",
    label: "Hero",
    where: "Homepage, full-bleed behind the headline",
    ratio: "16:9",
    fallback: "/media/v3/hero-pour.avif",
    note: "This is the largest thing on the site and the page's LCP — keep it under ~300 KB. Used as the poster when a hero video is set in Site Settings.",
  },
  {
    key: "home.maker",
    group: "Homepage",
    label: "The maker",
    where: "Homepage · 06 The maker",
    ratio: "4:5",
    fallback: "/media/hands-polish.webp",
    note: "A real photograph of the studio, never a generated one.",
    altKey: "Home.maker.imageAlt",
  },
  {
    key: "home.bespoke",
    group: "Homepage",
    label: "Commission band",
    where: "Homepage · 08 Bespoke, behind the dark band at 35% opacity",
    ratio: "16:9",
    fallback: "/media/v3/bespoke-petals.avif",
    note: "Renders dimmed behind text — pick something with a calm, dark area.",
  },
  {
    key: "home.print",
    group: "Homepage",
    label: "Print studio",
    where: "Homepage · 09 Print studio",
    ratio: "4:3",
    fallback: "/media/v3/print-head.avif",
    note: "Rendered in greyscale.",
    altKey: "Home.printStudio.imageAlt",
  },
  {
    key: "home.why.handcrafted",
    group: "Homepage",
    label: "Why · Handcrafted",
    where: "Homepage · Why Rivya Living Art, first of four",
    ratio: "4:5",
    fallback: "/media/v3/studio-hands.avif",
    altKey: "Home.why.proof.handcrafted.alt",
  },
  {
    key: "home.why.bespoke",
    group: "Homepage",
    label: "Why · Bespoke",
    where: "Homepage · Why Rivya Living Art, second of four",
    ratio: "4:5",
    fallback: "/media/v3/tile-preserve.avif",
    altKey: "Home.why.proof.bespoke.alt",
  },
  {
    key: "home.why.slowMade",
    group: "Homepage",
    label: "Why · Slow made",
    where: "Homepage · Why Rivya Living Art, third of four",
    ratio: "4:5",
    fallback: "/media/v3/story-cure.avif",
    altKey: "Home.why.proof.slowMade.alt",
  },
  {
    key: "home.why.heirloom",
    group: "Homepage",
    label: "Why · Heirloom",
    where: "Homepage · Why Rivya Living Art, fourth of four",
    ratio: "4:5",
    fallback: "/media/v3/story-polish.avif",
    altKey: "Home.why.proof.heirloom.alt",
  },

  /* ————————————————— About ————————————————— */
  {
    key: "about.hero",
    group: "About",
    label: "Hero texture",
    where: "About, full-bleed behind the headline",
    ratio: "21:9",
    fallback: "/media/v3/texture-band.avif",
    note: "A macro texture reads better here than a scene — the headline sits on top of it.",
  },
  {
    key: "about.maker",
    group: "About",
    label: "The maker",
    where: "About · the maker section",
    ratio: "4:5",
    fallback: "/media/hands-polish.webp",
    note: "A real photograph of the studio, never a generated one.",
    altKey: "About.maker.imageAlt",
  },
  {
    key: "about.material1.image",
    group: "About",
    label: "Material 1 · frame",
    where: "About · materials, first pair",
    ratio: "4:5",
    fallback: "/media/v3/story-pour.avif",
    note: "Shared with the matching material on the other page — About and Process describe the same four materials, so this description changes in both places.",
    altKey: "Process.materials.alt1",
  },
  {
    key: "about.material1.macro",
    group: "About",
    label: "Material 1 · macro",
    where: "About · materials, first pair",
    ratio: "1:1",
    fallback: "/media/v3/macro-epoxy.avif",
  },
  {
    key: "about.material2.image",
    group: "About",
    label: "Material 2 · frame",
    where: "About · materials, second pair",
    ratio: "4:5",
    fallback: "/media/v3/tile-live.avif",
    note: "Shared with the matching material on the other page — About and Process describe the same four materials, so this description changes in both places.",
    altKey: "Process.materials.alt2",
  },
  {
    key: "about.material2.macro",
    group: "About",
    label: "Material 2 · macro",
    where: "About · materials, second pair",
    ratio: "1:1",
    fallback: "/media/v3/macro-teak.avif",
  },
  {
    key: "about.material3.image",
    group: "About",
    label: "Material 3 · frame",
    where: "About · materials, third pair",
    ratio: "4:5",
    fallback: "/media/v3/tile-create.avif",
    note: "Shared with the matching material on the other page — About and Process describe the same four materials, so this description changes in both places.",
    altKey: "Process.materials.alt3",
  },
  {
    key: "about.material3.macro",
    group: "About",
    label: "Material 3 · macro",
    where: "About · materials, third pair",
    ratio: "1:1",
    fallback: "/media/v3/macro-pigment.avif",
  },
  {
    key: "about.material4.image",
    group: "About",
    label: "Material 4 · frame",
    where: "About · materials, fourth pair",
    ratio: "4:5",
    fallback: "/media/v3/tile-preserve.avif",
    note: "Shared with the matching material on the other page — About and Process describe the same four materials, so this description changes in both places.",
    altKey: "Process.materials.alt4",
  },
  {
    key: "about.material4.macro",
    group: "About",
    label: "Material 4 · macro",
    where: "About · materials, fourth pair",
    ratio: "1:1",
    fallback: "/media/v3/macro-flower.avif",
  },
  {
    key: "about.chapter1",
    group: "About",
    label: "Craft chapter 1 · pour",
    where: "About · the craft, first panel",
    ratio: "4:5",
    fallback: "/media/v3/story-pour.avif",
    altKey: "About.chapters.alt1",
  },
  {
    key: "about.chapter2",
    group: "About",
    label: "Craft chapter 2 · embed",
    where: "About · the craft, second panel",
    ratio: "4:5",
    fallback: "/media/v3/story-gild.avif",
    altKey: "About.chapters.alt2",
  },
  {
    key: "about.chapter3",
    group: "About",
    label: "Craft chapter 3 · cure",
    where: "About · the craft, third panel",
    ratio: "4:5",
    fallback: "/media/v3/story-cure.avif",
    altKey: "About.chapters.alt3",
  },
  {
    key: "about.chapter4",
    group: "About",
    label: "Craft chapter 4 · finish",
    where: "About · the craft, fourth panel",
    ratio: "4:5",
    fallback: "/media/v3/story-polish.avif",
    altKey: "About.chapters.alt4",
  },
  {
    key: "about.studio1",
    group: "About",
    label: "Studio photo 1",
    where: "About · the studio, photo strip",
    ratio: "4:3",
    fallback: "/media/v3/workshop-table.avif",
    altKey: "About.studio.alt1",
  },
  {
    key: "about.studio2",
    group: "About",
    label: "Studio photo 2",
    where: "About · the studio, photo strip",
    ratio: "4:3",
    fallback: "/media/v3/studio-interior.avif",
    altKey: "About.studio.alt2",
  },
  {
    key: "about.studio3",
    group: "About",
    label: "Studio photo 3",
    where: "About · the studio, photo strip",
    ratio: "4:3",
    fallback: "/media/v3/tile-live.avif",
    altKey: "About.studio.alt3",
  },

  /* ————————————————— Large format ————————————————— */
  {
    key: "largeFormat.hero",
    group: "Large format",
    label: "Large format · hero",
    where: "Large resin art, full-bleed behind the headline",
    ratio: "16:9",
    fallback: "/media/v3/studio-interior.avif",
    note: "This is the page's LCP. It must show the WORK — the bench, the formwork, a pour — never a finished piece presented as a commission we delivered (§15.2). The shipped file is shared with /contact's hero; replacing it is the first thing worth doing here.",
  },
  {
    key: "largeFormat.k1",
    group: "Large format",
    label: "Large format · tables and surfaces",
    where: "Large resin art · four kinds of large work, first tile",
    ratio: "4:5",
    fallback: "/media/v3/tile-live.avif",
    altKey: "LargeFormat.scope.k1Alt",
  },
  {
    key: "largeFormat.k2",
    group: "Large format",
    label: "Large format · wall panels",
    where: "Large resin art · four kinds of large work, second tile",
    ratio: "4:5",
    fallback: "/media/v3/macro-epoxy.avif",
    altKey: "LargeFormat.scope.k2Alt",
  },
  {
    key: "largeFormat.k3",
    group: "Large format",
    label: "Large format · sculptural pieces",
    where: "Large resin art · four kinds of large work, third tile",
    ratio: "4:5",
    fallback: "/media/v3/story-cure.avif",
    altKey: "LargeFormat.scope.k3Alt",
  },
  {
    key: "largeFormat.k4",
    group: "Large format",
    label: "Large format · preservation at scale",
    where: "Large resin art · four kinds of large work, fourth tile",
    ratio: "4:5",
    fallback: "/media/v3/tile-preserve.avif",
    altKey: "LargeFormat.scope.k4Alt",
  },

  /* ————————————————— Process ————————————————— */
  {
    key: "process.heroVideo",
    group: "Process",
    label: "Hero video",
    where: "Process, full-bleed behind the headline",
    ratio: "16:9",
    fallback: "/media/v3/process-pour.mp4",
    note: "MP4 only, muted and loopable, ideally under 2.5 MB. Leave it on the default if you have no video — the poster carries the band on its own. The bundled default now has a WebM twin beside it (§15.3 asks for both) which HeroMedia offers first; an owner override is served as-is, so a replacement is MP4-only and that is fine.",
  },
  {
    key: "process.heroPoster",
    group: "Process",
    label: "Hero poster",
    where: "Process — shown before the video loads and under reduced motion",
    ratio: "16:9",
    /* Cut from frame 0 of the encoded loop rather than shot separately: this
       is the LCP and the only thing reduced-motion, touch and no-JS visitors
       ever see, so it has to be the frame the video actually starts on. That
       constraint is why this pair stayed on the pre-v3 files while the other
       53 slots moved. */
    fallback: "/media/v3/process-pour-poster.avif",
  },
  {
    key: "process.step1",
    group: "Process",
    label: "Step 1",
    where: "Process · the six stages",
    ratio: "4:5",
    fallback: "/media/v3/workshop-table.avif",
    altKey: "Process.timeline.step1Alt",
  },
  {
    key: "process.step2",
    group: "Process",
    label: "Step 2",
    where: "Process · the six stages",
    ratio: "4:5",
    fallback: "/media/v3/print-head.avif",
    altKey: "Process.timeline.step2Alt",
  },
  {
    key: "process.step3",
    group: "Process",
    label: "Step 3",
    where: "Process · the six stages",
    ratio: "4:5",
    fallback: "/media/v3/story-gild.avif",
    altKey: "Process.timeline.step3Alt",
  },
  {
    key: "process.step4",
    group: "Process",
    label: "Step 4",
    where: "Process · the six stages",
    ratio: "4:5",
    fallback: "/media/v3/story-pour.avif",
    altKey: "Process.timeline.step4Alt",
  },
  {
    key: "process.step5",
    group: "Process",
    label: "Step 5",
    where: "Process · the six stages",
    ratio: "4:5",
    fallback: "/media/v3/studio-hands.avif",
    altKey: "Process.timeline.step5Alt",
  },
  {
    key: "process.step6",
    group: "Process",
    label: "Step 6",
    where: "Process · the six stages",
    ratio: "4:5",
    fallback: "/media/v3/tile-gift.avif",
    altKey: "Process.timeline.step6Alt",
  },
  {
    key: "process.material1",
    group: "Process",
    label: "Material 1",
    where: "Process · the four materials",
    ratio: "4:5",
    fallback: "/media/v3/story-pour.avif",
    note: "Shared with the matching material on the other page — About and Process describe the same four materials, so this description changes in both places.",
    altKey: "Process.materials.alt1",
  },
  {
    key: "process.material2",
    group: "Process",
    label: "Material 2",
    where: "Process · the four materials",
    ratio: "4:5",
    fallback: "/media/v3/tile-live.avif",
    note: "Shared with the matching material on the other page — About and Process describe the same four materials, so this description changes in both places.",
    altKey: "Process.materials.alt2",
  },
  {
    key: "process.material3",
    group: "Process",
    label: "Material 3",
    where: "Process · the four materials",
    ratio: "4:5",
    fallback: "/media/v3/tile-create.avif",
    note: "Shared with the matching material on the other page — About and Process describe the same four materials, so this description changes in both places.",
    altKey: "Process.materials.alt3",
  },
  {
    key: "process.material4",
    group: "Process",
    label: "Material 4",
    where: "Process · the four materials",
    ratio: "4:5",
    fallback: "/media/v3/tile-preserve.avif",
    note: "Shared with the matching material on the other page — About and Process describe the same four materials, so this description changes in both places.",
    altKey: "Process.materials.alt4",
  },

  /* ————————————————— Workshops ————————————————— */
  {
    key: "workshops.hero",
    group: "Workshops",
    label: "Hero",
    where: "Workshops, full-bleed behind the headline",
    ratio: "16:9",
    fallback: "/media/v3/workshop-table.avif",
  },
  {
    key: "workshops.benefit1",
    group: "Workshops",
    label: "Reason 1",
    where: "Workshops · the three reasons to come",
    ratio: "4:5",
    fallback: "/media/v3/workshop-private.avif",
    altKey: "Workshops.intro.alt1",
  },
  {
    key: "workshops.benefit2",
    group: "Workshops",
    label: "Reason 2",
    where: "Workshops · the three reasons to come",
    ratio: "4:5",
    fallback: "/media/v3/tile-create.avif",
    altKey: "Workshops.intro.alt2",
  },
  {
    key: "workshops.benefit3",
    group: "Workshops",
    label: "Reason 3",
    where: "Workshops · the three reasons to come",
    ratio: "4:5",
    fallback: "/media/v3/story-pour.avif",
    altKey: "Workshops.intro.alt3",
  },
  {
    key: "workshops.private",
    group: "Workshops",
    label: "Private workshop band",
    where: "Workshops · private sessions, behind the dark band at 30% opacity",
    ratio: "16:9",
    fallback: "/media/v3/workshop-private.avif",
  },
  {
    key: "workshops.room1",
    group: "Workshops",
    label: "The room · photo 1",
    where: "Workshops · the room, photo strip",
    ratio: "4:3",
    fallback: "/media/v3/workshop-table.avif",
    altKey: "Workshops.room.alt1",
  },
  {
    key: "workshops.room2",
    group: "Workshops",
    label: "The room · photo 2",
    where: "Workshops · the room, photo strip",
    ratio: "4:3",
    fallback: "/media/v3/tile-create.avif",
    altKey: "Workshops.room.alt2",
  },
  {
    key: "workshops.room3",
    group: "Workshops",
    label: "The room · photo 3",
    where: "Workshops · the room, photo strip",
    ratio: "4:3",
    fallback: "/media/v3/studio-interior.avif",
    altKey: "Workshops.room.alt3",
  },
  {
    key: "workshops.room4",
    group: "Workshops",
    label: "The room · photo 4",
    where: "Workshops · the room, photo strip",
    ratio: "4:3",
    fallback: "/media/v3/tile-live.avif",
    altKey: "Workshops.room.alt4",
  },

  /* ————————————————— Everything else ————————————————— */
  {
    key: "customOrder.hero",
    group: "Commission",
    label: "Hero",
    where: "Commission a piece, the left half of the split hero",
    ratio: "4:5",
    fallback: "/media/v3/tile-preserve.avif",
    altKey: "CustomOrder.page.heroImageAlt",
  },
  {
    key: "contact.hero",
    group: "Contact",
    label: "Hero",
    where: "Contact, the left half of the split hero",
    ratio: "4:5",
    fallback: "/media/v3/studio-interior.avif",
    altKey: "Contact.page.heroImageAlt",
  },
  {
    key: "portfolio.hero",
    group: "Portfolio",
    label: "Archive banner",
    where: "Portfolio, full-bleed behind the headline",
    ratio: "21:9",
    fallback: "/media/v3/texture-band.avif",
  },
  {
    key: "shop.editorialBreak",
    group: "Shop",
    label: "Editorial break",
    where: "Shop · the full-width break after the third row of products",
    ratio: "3:2",
    fallback: "/media/v3/story-cure.avif",
    altKey: "Shop.editorialBreak.imageAlt",
  },
  {
    key: "shop.group.art",
    group: "Shop",
    label: "Collection fallback · Resin art",
    where: "A resin-art collection page with no image of its own",
    ratio: "16:9",
    fallback: "/media/v3/hero-pour.avif",
    note: "Only shown when the category itself has no image — set that in the category editor first.",
  },
  {
    key: "shop.group.supplies",
    group: "Shop",
    label: "Collection fallback · Supplies",
    where: "A supplies collection page with no image of its own",
    ratio: "16:9",
    fallback: "/media/v3/tile-create.avif",
    note: "Only shown when the category itself has no image — set that in the category editor first.",
  },
  {
    key: "shop.group.print",
    group: "Shop",
    label: "Collection fallback · 3D print",
    where: "A print collection page with no image of its own",
    ratio: "16:9",
    fallback: "/media/v3/tile-print.avif",
    note: "Only shown when the category itself has no image — set that in the category editor first.",
  },
  {
    key: "nav.art",
    group: "Navigation",
    label: "Mega menu · Resin art",
    where: "The Shop mega menu, first tile",
    ratio: "3:4",
    fallback: "/media/v3/tile-live.avif",
  },
  {
    key: "nav.print",
    group: "Navigation",
    label: "Mega menu · 3D print",
    where: "The Shop mega menu, second tile",
    ratio: "3:4",
    fallback: "/media/v3/tile-print.avif",
  },
  {
    key: "nav.supplies",
    group: "Navigation",
    label: "Mega menu · Supplies",
    where: "The Shop mega menu, third tile",
    ratio: "3:4",
    fallback: "/media/v3/tile-create.avif",
  },
  {
    key: "studio.login",
    group: "Studio",
    label: "Login backdrop",
    where: "The /studio sign-in screen",
    ratio: "16:9",
    fallback: "/media/v3/login-backdrop.avif",
    note: "Staff only — nobody outside the studio ever sees this.",
  },
] as const satisfies readonly SiteImageSlot[];

export type SiteImageKey = (typeof SITE_IMAGE_SLOTS)[number]["key"];

/** Every slot's bundled default, keyed. The resolver layers overrides on top. */
export const SITE_IMAGE_FALLBACKS: Record<SiteImageKey, string> =
  Object.fromEntries(
    SITE_IMAGE_SLOTS.map((slot) => [slot.key, slot.fallback]),
  ) as Record<SiteImageKey, string>;

const SLOT_BY_KEY = new Map<string, SiteImageSlot>(
  SITE_IMAGE_SLOTS.map((slot) => [slot.key, slot]),
);

export function isSiteImageKey(key: string): key is SiteImageKey {
  return SLOT_BY_KEY.has(key);
}

export function siteImageSlot(key: SiteImageKey): SiteImageSlot {
  const slot = SLOT_BY_KEY.get(key);
  if (!slot) throw new Error(`Unknown site-image slot: ${key}`);
  return slot;
}

/** Slots in registry order, bucketed by surface — the studio screen's layout. */
export function siteImageSlotsByGroup(): {
  group: SiteImageGroup;
  slots: SiteImageSlot[];
}[] {
  return SITE_IMAGE_GROUPS.map((group) => ({
    group,
    slots: SITE_IMAGE_SLOTS.filter((slot) => slot.group === group),
  })).filter((bucket) => bucket.slots.length > 0);
}

/** A resolved slot → URL map. Always total: every key resolves to something. */
export type SiteImageMap = Record<SiteImageKey, string>;

/**
 * A resolved slot with its crop information.
 *
 * `getSiteImages()` keeps returning bare URLs so the ~40 existing call sites
 * are untouched; a page that wants the mobile crop or the focal point asks for
 * refs instead. Two accessors over one cached read, rather than one breaking
 * change across every page in the app.
 */
export type SiteImageRef = {
  url: string;
  /** Separate crop below 768px. Null renders `url` at every width. */
  mobileUrl: string | null;
  /** object-position, 0–1. (0.5, 0.5) is CSS's own default. */
  focalX: number;
  focalY: number;
};

export type SiteImageRefMap = Record<SiteImageKey, SiteImageRef>;

/** Every slot's bundled default as a ref — centred, no mobile crop. */
export const SITE_IMAGE_DEFAULT_REFS: SiteImageRefMap = Object.fromEntries(
  SITE_IMAGE_SLOTS.map((slot) => [
    slot.key,
    { url: slot.fallback, mobileUrl: null, focalX: 0.5, focalY: 0.5 },
  ]),
) as SiteImageRefMap;

/**
 * The narrowest file that still looks right in this slot, from the ratio it
 * crops to (the guidance table in docs/studio-cms/03-image-layer.md §3.3).
 *
 * A guide rather than a gate: the picker warns below it and saves anyway,
 * because sometimes the only photograph that exists is the small one.
 */
export function siteImageMinWidth(ratio: string): number {
  if (ratio === "21:9" || ratio === "16:9") return 2400;
  if (ratio === "1:1") return 1400;
  if (ratio === "4:3" || ratio === "3:2") return 1400;
  return 1200; // 4:5, 3:4 — the portrait tiles
}

/**
 * Slots whose crop is wide enough to lose its subject on a phone.
 *
 * These are the ones a mobile crop actually earns: a 21:9 band at 390px keeps
 * roughly a third of the frame's height.
 */
export function needsMobileCrop(ratio: string): boolean {
  return ratio === "16:9" || ratio === "21:9";
}
