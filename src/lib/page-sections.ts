/**
 * The section manifest — what each page is made of, in the order it reads.
 *
 * This is the third registry, and the one that joins the other two. A section
 * declares the copy slots and image slots it owns, so a single screen can show
 * an owner "the Why band" as its words, its four pictures and its switches
 * rather than as `Home.why.*` and `home.why.*`.
 *
 * **A row in `PageSection` carries order and visibility, never content.**
 * Copy already lives in `SiteCopy` against a stable key and pictures in
 * `SiteImage` against a stable slot; moving them into a section blob would
 * give one headline two owners and strand nine translations. So the component
 * still calls `t()` and reads its slots exactly as before — it simply learns
 * whether it renders, and where in the order.
 *
 * Plain module, no server imports.
 */

export const SECTION_PAGES = [
  "home",
  "about",
  "process",
  "large-format",
  "custom-order",
  "contact",
  "workshops",
  "process-steps",
  "materials",
] as const;

export type SectionPageKey = (typeof SECTION_PAGES)[number];

/**
 * `SECTION_PAGES` entries that are not a routable page in their own right —
 * a finer-grained arrangement living INSIDE an existing page, reached from
 * its own Studio screen (`/studio/process`, `/studio/materials`) rather than
 * through the page-level picker. `"process-steps"` reorders the ten cards
 * inside `process`'s own `stages` band; `"materials"` reorders the four
 * material cards shared by `process`'s `materials` band and `about`'s.
 * Neither carries an `h1` — the page around it already has one — so the two
 * h1 invariants below (every OTHER page has exactly one, and it can never be
 * hidden) do not apply to these.
 */
export const SUBLIST_PAGES: ReadonlySet<SectionPageKey> = new Set([
  "process-steps",
  "materials",
]);

export type SectionDef = {
  /** Stable key. Also the DOM id, the cure-line anchor and the manifest key. */
  key: string;
  /** What the owner is moving, in their words. */
  label: string;
  /** One line on what the section is for. */
  description: string;
  /**
   * Whether the section paints a dark ground.
   *
   * DECLARED, never derived. The darkness is frequently painted by a child
   * component — `#material` is a `bg-mineral` section wrapping a
   * `bg-obsidian` scrub — so scanning the section's own classes gets the
   * answer wrong, and the band-rhythm rule depends on getting it right.
   */
  dark?: boolean;
  /** false for a section the page cannot lose. */
  hideable: boolean;
  /** false for a section pinned in place — the hero is always first. */
  movable: boolean;
  /**
   * Whether a fresh install ships this section turned on. Defaults to `true`
   * when absent, so every section written before this field existed keeps
   * behaving exactly as it always has.
   *
   * For a section the owner has to opt INTO rather than one the page ships
   * with — concept imagery standing in for photography the studio does not
   * have yet (§15.2), or a band that only reads well once real content backs
   * it. `false` here does not hide the section from the studio board or the
   * registry; it only changes what an UNSET row resolves to, so the owner
   * still sees it, still can turn it on, and a database with no row for it
   * renders the page without it rather than with a concept card nobody chose
   * to show.
   */
  defaultVisible?: boolean;
  /** True when the section carries the page's single `h1`. */
  ownsH1?: boolean;
  /** Copy slots this section owns, as key prefixes. */
  copyPrefixes: readonly string[];
  /** Image slots this section owns. */
  imageKeys: readonly string[];
  /** Whether the section renders only when its data exists. */
  conditional?: boolean;
  /**
   * The `Home.cure.*` key labelling this section's tick on the cure line.
   *
   * Absent means the section deliberately has no tick — the closing
   * invitation and the Why band never had one.
   */
  cureLabelKey?: string;
};

/**
 * The homepage, in its shipped order.
 *
 * Keys match the `<section id>` values the page already uses, which are also
 * the cure-line anchors — so the rail can be generated from this list rather
 * than hand-maintained beside it. The two sections with no id (the Why band
 * and the closing invitation) are exactly the two with no tick on the rail.
 */
const HOME: readonly SectionDef[] = [
  {
    key: "pour",
    label: "Hero",
    description: "The full-bleed opening, with the headline and two buttons.",
    dark: true,
    hideable: false,
    movable: false,
    ownsH1: true,
    copyPrefixes: ["Home.hero"],
    imageKeys: ["home.hero"],
    cureLabelKey: "cure.pour",
  },
  {
    key: "manifesto",
    label: "Manifesto",
    description: "The two-line statement under the hero.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Home.manifesto"],
    imageKeys: [],
    cureLabelKey: "cure.manifesto",
  },
  {
    key: "pieces",
    label: "Featured pieces",
    description: "Four products — one large, three beside it.",
    hideable: true,
    movable: true,
    conditional: true,
    copyPrefixes: ["Home.featured"],
    imageKeys: [],
    cureLabelKey: "cure.pieces",
  },
  {
    key: "large-format",
    label: "Large format",
    description: "Four tiles pointing at work commissioned at scale.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Home.largeFormat"],
    imageKeys: [
      "largeFormat.k1",
      "largeFormat.k2",
      "largeFormat.k3",
      "largeFormat.k4",
    ],
    cureLabelKey: "cure.largeFormat",
  },
  {
    key: "material",
    label: "The material story",
    description: "The pinned pour scrub and its four stages.",
    dark: true,
    hideable: true,
    // One of the two sanctioned scroll pins (REDESIGN.md Part 14). Moving it
    // would put a 400svh pinned scrub somewhere the page was not paced for.
    movable: false,
    copyPrefixes: ["Home.showcase"],
    imageKeys: [],
    cureLabelKey: "cure.material",
  },
  {
    key: "collections",
    label: "The collections",
    description: "Six editorial tiles, each a doorway into the catalogue.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Home.collections"],
    imageKeys: [],
    cureLabelKey: "cure.collections",
  },
  {
    /* Concept imagery, not the catalogue: the studio takes furniture on
       commission but carries none in stock, so these six tiles are captioned
       as concepts (D5) rather than presented as products. Off by default —
       an owner turns it on once real installed work exists to back it, or
       leaves the concept framing on deliberately; either is a choice, not
       the page's own opinion. */
    key: "furniture",
    label: "What we commission",
    description: "Six kinds of furniture the studio takes on, as concepts.",
    hideable: true,
    movable: true,
    defaultVisible: false,
    copyPrefixes: ["Home.furniture"],
    imageKeys: [
      "home.furniture.dining",
      "home.furniture.coffee",
      "home.furniture.side",
      "home.furniture.console",
      "home.furniture.chair",
      "home.furniture.bench",
    ],
    cureLabelKey: "cure.furniture",
  },
  {
    key: "maker",
    label: "The maker",
    description: "The portrait and the paragraph beside it.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Home.maker"],
    imageKeys: ["home.maker"],
    cureLabelKey: "cure.maker",
  },
  {
    /* Also concept imagery (D5) — four rooms furnished with the kind of
       piece the studio commissions, captioned as a concept on the page.
       Off by default for the same reason `furniture` is. */
    key: "rooms",
    label: "In the room",
    description: "Four rooms shown with a commissioned piece in place.",
    hideable: true,
    movable: true,
    defaultVisible: false,
    copyPrefixes: ["Home.rooms"],
    imageKeys: [
      "home.rooms.living",
      "home.rooms.dining",
      "home.rooms.study",
      "home.rooms.bedroom",
    ],
    cureLabelKey: "cure.rooms",
  },
  {
    key: "work",
    label: "Recent commissions",
    description: "A mosaic of published portfolio cases.",
    hideable: true,
    movable: true,
    conditional: true,
    copyPrefixes: ["Home.portfolio"],
    imageKeys: [],
    cureLabelKey: "cure.work",
  },
  {
    /* The proof pair. Recent commissions show the work; this shows the people
       who bought it, immediately before the band that asks for a commission.
       `Home.testimonials.*` shipped translated into all nine locales and
       registered as owner-editable copy — pointing at a section that was never
       built, so the words were editable and unreachable.
       Light ground on purpose: the page is already at Part 19.1's three-dark
       -band ceiling (pour · material · bespoke) and mineral keeps the strict
       alternation either side (work=sand → words=mineral → bespoke=obsidian). */
    key: "words",
    label: "In their words",
    description: "Customer quotes, with the photograph when one is set.",
    hideable: true,
    movable: true,
    conditional: true,
    copyPrefixes: ["Home.testimonials"],
    imageKeys: [],
    cureLabelKey: "cure.words",
  },
  {
    key: "bespoke",
    label: "Commission band",
    description: "The dark band inviting a bespoke enquiry.",
    dark: true,
    hideable: true,
    movable: true,
    copyPrefixes: ["Home.custom"],
    imageKeys: ["home.bespoke"],
    cureLabelKey: "cure.bespoke",
  },
  {
    key: "print",
    label: "Print studio",
    description: "The 3D-printing block.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Home.printStudio"],
    imageKeys: ["home.print"],
    cureLabelKey: "cure.print",
  },
  {
    key: "process",
    label: "How it works",
    description: "The four steps from idea to delivery.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Home.how"],
    imageKeys: [],
    cureLabelKey: "cure.process",
  },
  {
    key: "why",
    label: "Why Rivya Living Art",
    description: "Four reasons, each with a picture.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Home.why"],
    imageKeys: [
      "home.why.handcrafted",
      "home.why.bespoke",
      "home.why.slowMade",
      "home.why.heirloom",
    ],
  },
  {
    key: "journal",
    label: "Journal",
    description: "The latest writing from the studio.",
    hideable: true,
    movable: true,
    conditional: true,
    copyPrefixes: ["Home.journal"],
    imageKeys: [],
    cureLabelKey: "cure.journal",
  },
  {
    key: "closing",
    label: "Closing invitation",
    description: "The last word and the commission button.",
    hideable: false,
    movable: false,
    copyPrefixes: ["Home.cta"],
    imageKeys: [],
  },
];

/**
 * /about — the brand story.
 *
 * Two of its seven blocks are components rather than inline `<section>`s
 * (`CraftChapters`, `StudioGallery`). The manifest keys the BLOCK, not the
 * tag, so that difference never reaches the owner.
 */
const ABOUT: readonly SectionDef[] = [
  {
    key: "hero",
    label: "Hero",
    description: "The full-bleed opening and the page's heading.",
    dark: true,
    hideable: false,
    movable: false,
    ownsH1: true,
    copyPrefixes: ["About.hero"],
    imageKeys: ["about.hero"],
  },
  {
    key: "story",
    label: "The story",
    description: "Four chapters, each with a picture.",
    hideable: true,
    movable: true,
    copyPrefixes: ["About.story", "About.chapters", "About.chapterLabels"],
    imageKeys: [
      "about.chapter1",
      "about.chapter2",
      "about.chapter3",
      "about.chapter4",
    ],
  },
  {
    key: "maker",
    label: "The maker",
    description: "The portrait and the paragraph beside it.",
    hideable: true,
    movable: true,
    copyPrefixes: ["About.maker"],
    imageKeys: ["about.maker"],
  },
  {
    key: "craft",
    label: "The craft",
    description: "The sticky chapter story, and the link into Process.",
    hideable: true,
    movable: true,
    copyPrefixes: ["About.craft"],
    imageKeys: [],
  },
  {
    key: "materials",
    label: "Materials",
    description: "Four cards, each revealing a macro of the surface.",
    hideable: true,
    movable: true,
    copyPrefixes: ["About.materials", "About.sustain"],
    imageKeys: [],
  },
  {
    key: "studio",
    label: "The studio",
    description: "Three photographs and the studio facts.",
    hideable: true,
    movable: true,
    copyPrefixes: ["About.studio"],
    imageKeys: ["about.studio1", "about.studio2", "about.studio3"],
  },
  {
    key: "closing",
    label: "Closing invitation",
    description: "The last word and the commission button.",
    hideable: false,
    movable: false,
    copyPrefixes: ["About.cta"],
    imageKeys: [],
  },
];

/**
 * /process — how a piece is made.
 *
 * The `cureLabelKey` values match the rail this page already builds, so the
 * marks can be generated from the resolved list exactly as the homepage's are.
 */
const PROCESS: readonly SectionDef[] = [
  {
    key: "pour",
    label: "Hero",
    description: "The full-bleed pour and the page's heading.",
    dark: true,
    hideable: false,
    movable: false,
    ownsH1: true,
    copyPrefixes: ["Process.hero"],
    imageKeys: ["process.hero"],
  },
  {
    key: "stages",
    label: "The ten stages",
    description: "Idea to delivery, one numbered stage at a time.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Process.timeline"],
    imageKeys: [],
  },
  {
    key: "materials",
    label: "Materials",
    description: "What the studio works in, and why.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Process.materials"],
    imageKeys: [],
  },
  {
    key: "timelines",
    label: "Timelines",
    description: "The published lead-time bands, as two cards.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Process.timelines"],
    imageKeys: [],
  },
  {
    key: "closing",
    label: "Closing invitation",
    description: "The last word and the commission button.",
    hideable: false,
    movable: false,
    copyPrefixes: ["Process.cta"],
    imageKeys: [],
  },
];

/**
 * The ten process steps, as their own arrangeable list — the `stages` band
 * above renders whichever of these are visible, in this order, and the cure
 * line on `/process` regenerates from the same resolved list. One row per
 * `PROCESS_STEPS` entry (`src/lib/process-steps.ts`) by construction; a test
 * pins the two counts together.
 *
 * `step1` and `step10` spell out their four copy keys explicitly rather than
 * a `"Process.timeline.step1"` / `"Process.timeline.step10"` prefix — a
 * prefix match would let `"step1"` also claim every `step10*` key. `step2`
 * through `step9` have no such collision, so a single prefix is enough.
 */
const PROCESS_STEPS_LIST: readonly SectionDef[] = [
  {
    key: "step1",
    label: "01 · Concept",
    description: "The opening WhatsApp conversation and the brief.",
    hideable: true,
    movable: true,
    copyPrefixes: [
      "Process.timeline.step1Title",
      "Process.timeline.step1Copy",
      "Process.timeline.step1Meta",
      "Process.timeline.step1Alt",
    ],
    imageKeys: ["process.step1"],
  },
  {
    key: "step2",
    label: "02 · Material selection",
    description:
      "Choosing the resin, wood, pigment and any preserved botanicals.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Process.timeline.step2"],
    imageKeys: ["process.step2"],
  },
  {
    key: "step3",
    label: "03 · Wood preparation",
    description:
      "Planing, sanding and sealing the wood before resin ever meets it.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Process.timeline.step3"],
    imageKeys: ["process.step3"],
  },
  {
    key: "step4",
    label: "04 · Resin composition",
    description: "Mixing and testing pigment before a full pour.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Process.timeline.step4"],
    imageKeys: ["process.step4"],
  },
  {
    key: "step5",
    label: "05 · Casting",
    description: "Pouring the resin into the mould, layer by layer.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Process.timeline.step5"],
    imageKeys: ["process.step5"],
  },
  {
    key: "step6",
    label: "06 · Curing",
    description: "Each layer left to cure before the next goes in.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Process.timeline.step6"],
    imageKeys: ["process.step6"],
  },
  {
    key: "step7",
    label: "07 · Surface refinement",
    description: "Sanding from 400 up to 3000 grit, then polishing.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Process.timeline.step7"],
    imageKeys: ["process.step7"],
  },
  {
    key: "step8",
    label: "08 · Hand finishing",
    description: "Hardware fitted and every edge checked by hand.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Process.timeline.step8"],
    imageKeys: ["process.step8"],
  },
  {
    key: "step9",
    label: "09 · Quality inspection",
    description: "Checked against the brief before photographs go to you.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Process.timeline.step9"],
    imageKeys: ["process.step9"],
  },
  {
    key: "step10",
    label: "10 · Delivery",
    description: "Packed fragile-proof and sent with tracked shipping.",
    hideable: true,
    movable: true,
    copyPrefixes: [
      "Process.timeline.step10Title",
      "Process.timeline.step10Copy",
      "Process.timeline.step10Meta",
      "Process.timeline.step10Alt",
    ],
    imageKeys: ["process.step10"],
  },
];

/**
 * The four materials, as their own arrangeable list — shared by `process`'s
 * `materials` band and `about`'s. Each row owns the one copy pair Process
 * carries plus the alt text, and every picture of that material on either
 * page: `process.material<n>` and the About page's frame + macro pair.
 * Reordering or hiding a material here moves or hides it on BOTH pages —
 * §11.4 already treats Process as the canonical description of what a piece
 * is made of, and this is that same claim applied to arrangement.
 */
const MATERIALS_LIST: readonly SectionDef[] = [
  {
    key: "m1",
    label: "Material 1",
    description: "Epoxy resin — shown on Process and About.",
    hideable: true,
    movable: true,
    copyPrefixes: [
      "Process.materials.m1Title",
      "Process.materials.m1Copy",
      "Process.materials.alt1",
    ],
    imageKeys: [
      "process.material1",
      "about.material1.image",
      "about.material1.macro",
    ],
  },
  {
    key: "m2",
    label: "Material 2",
    description: "Teak & river wood — shown on Process and About.",
    hideable: true,
    movable: true,
    copyPrefixes: [
      "Process.materials.m2Title",
      "Process.materials.m2Copy",
      "Process.materials.alt2",
    ],
    imageKeys: [
      "process.material2",
      "about.material2.image",
      "about.material2.macro",
    ],
  },
  {
    key: "m3",
    label: "Material 3",
    description: "Mineral pigments — shown on Process and About.",
    hideable: true,
    movable: true,
    copyPrefixes: [
      "Process.materials.m3Title",
      "Process.materials.m3Copy",
      "Process.materials.alt3",
    ],
    imageKeys: [
      "process.material3",
      "about.material3.image",
      "about.material3.macro",
    ],
  },
  {
    key: "m4",
    label: "Material 4",
    description: "Preserved botanicals — shown on Process and About.",
    hideable: true,
    movable: true,
    copyPrefixes: [
      "Process.materials.m4Title",
      "Process.materials.m4Copy",
      "Process.materials.alt4",
    ],
    imageKeys: [
      "process.material4",
      "about.material4.image",
      "about.material4.macro",
    ],
  },
];

/**
 * /custom-order — the commission page.
 *
 * The brief is the business. It is the form that becomes an Inquiry and then a
 * WhatsApp message, so it is neither hideable nor movable: a commission page
 * whose form an owner can switch off, or push below three optional bands, is
 * not a commission page.
 */
const CUSTOM_ORDER: readonly SectionDef[] = [
  {
    key: "commission",
    label: "Hero",
    description: "The split-screen opening and the page's heading.",
    dark: true,
    hideable: false,
    movable: false,
    ownsH1: true,
    copyPrefixes: ["CustomOrder.page.hero"],
    imageKeys: ["customOrder.hero"],
  },
  {
    key: "kinds",
    label: "What people commission",
    description: "The four kinds of commission, as tiles.",
    hideable: true,
    movable: true,
    copyPrefixes: ["CustomOrder.page.kinds"],
    imageKeys: [],
  },
  {
    key: "how",
    label: "How a commission runs",
    description: "The four steps from brief to delivery.",
    hideable: true,
    movable: true,
    copyPrefixes: ["CustomOrder.page.how"],
    imageKeys: [],
  },
  {
    key: "brief",
    label: "The brief",
    description: "The form itself — where a commission actually starts.",
    hideable: false,
    movable: false,
    copyPrefixes: ["CustomOrder.page.brief", "CustomOrder.form"],
    imageKeys: [],
  },
  {
    key: "questions",
    label: "Questions",
    description: "Questions answered on the FAQ, shown here too.",
    hideable: true,
    movable: true,
    conditional: true,
    copyPrefixes: ["CustomOrder.page.faq"],
    imageKeys: [],
  },
  {
    key: "work",
    label: "Commissioned before",
    description: "A gallery of finished commissions.",
    hideable: true,
    movable: true,
    conditional: true,
    copyPrefixes: ["CustomOrder.page.work"],
    imageKeys: [],
  },
  {
    key: "words",
    label: "In their words",
    description: "What previous clients said.",
    hideable: true,
    movable: true,
    conditional: true,
    copyPrefixes: ["CustomOrder.page.testimonials"],
    imageKeys: [],
  },
];

/** /contact — four ways in, and the form. */
const CONTACT: readonly SectionDef[] = [
  {
    key: "hero",
    label: "Hero",
    description: "The split-screen opening and the page's heading.",
    dark: true,
    hideable: false,
    movable: false,
    ownsH1: true,
    copyPrefixes: ["Contact.hero"],
    imageKeys: ["contact.hero"],
  },
  {
    key: "channels",
    label: "Four ways in",
    description: "WhatsApp, phone, email and the studio address.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Contact.channels"],
    imageKeys: [],
  },
  {
    key: "write",
    label: "The form",
    description: "The message form — the reason the page exists.",
    hideable: false,
    movable: false,
    copyPrefixes: ["Contact.form"],
    imageKeys: [],
  },
  {
    key: "faq",
    label: "Asked often",
    description: "Questions answered on the FAQ, shown here too.",
    hideable: true,
    movable: true,
    conditional: true,
    copyPrefixes: ["Contact.faq"],
    imageKeys: [],
  },
];

/**
 * /workshops — the sessions.
 *
 * Two dark bands: the hero and the private-workshop invitation. They sit five
 * sections apart as shipped, and `describeArrangementProblem` refuses any
 * order that would bring them together.
 */
const WORKSHOPS: readonly SectionDef[] = [
  {
    key: "hero",
    label: "Hero",
    description: "The full-bleed table and the page's heading.",
    dark: true,
    hideable: false,
    movable: false,
    ownsH1: true,
    copyPrefixes: ["Workshops.hero"],
    imageKeys: ["workshops.hero"],
  },
  {
    key: "facts",
    label: "The facts strip",
    description: "Duration, group size and what is included.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Workshops.facts"],
    imageKeys: [],
  },
  {
    key: "why",
    label: "Why come",
    description: "Three reasons, each with a photograph.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Workshops.why"],
    imageKeys: [],
  },
  {
    key: "session",
    label: "The session",
    description: "The workshop beat by beat.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Workshops.session"],
    imageKeys: [],
  },
  {
    key: "sessions",
    label: "Sessions",
    description: "The dated sessions an owner has listed.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Workshops.sessions"],
    imageKeys: [],
  },
  {
    key: "private",
    label: "Private workshops",
    description: "The dark band inviting a private booking.",
    dark: true,
    hideable: true,
    movable: true,
    copyPrefixes: ["Workshops.private"],
    imageKeys: ["workshops.private"],
  },
  {
    key: "room",
    label: "The room",
    description: "Four photographs of the space.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Workshops.room"],
    imageKeys: [],
  },
];

/**
 * /large-resin-art — the bespoke capability page for work at scale.
 *
 * Deliberately NOT a category listing. The catalogue holds no large-format
 * furniture today (the two categories that would carry it hold five small
 * decor items, three of them drafts), so a gallery-led page would be a room
 * of empty frames. This page sells the CONVERSATION — what the studio can
 * take on, how a large commission runs, and what to send to get a quote —
 * and shows real pieces only in the one section that can be empty without
 * leaving a hole.
 *
 * Bands: obsidian · mineral · mineral · obsidian · sand · mineral · mineral ·
 * mineral · sand · sand · sand · sand(major). Two dark, never adjacent, and
 * the last band is light so it does not run into the obsidian footer
 * (Part 19.1).
 */
const LARGE_FORMAT: readonly SectionDef[] = [
  {
    key: "scale",
    label: "Hero",
    description: "The full-height opening band and the page's h1.",
    dark: true,
    hideable: false,
    movable: false,
    ownsH1: true,
    copyPrefixes: ["LargeFormat.hero"],
    imageKeys: ["largeFormat.hero"],
    cureLabelKey: "cure.scale",
  },
  {
    key: "scope",
    label: "Four kinds of large work",
    description:
      "The shapes a large brief usually takes, with one picture each.",
    hideable: true,
    movable: true,
    copyPrefixes: ["LargeFormat.scope"],
    imageKeys: [
      "largeFormat.k1",
      "largeFormat.k2",
      "largeFormat.k3",
      "largeFormat.k4",
    ],
    cureLabelKey: "cure.scope",
  },
  {
    key: "philosophy",
    label: "Philosophy",
    description: "Why large work is planned before it is priced.",
    hideable: true,
    movable: true,
    copyPrefixes: ["LargeFormat.philosophy"],
    imageKeys: [],
    cureLabelKey: "cure.philosophy",
  },
  {
    key: "how",
    label: "How it runs",
    description: "The four stages of a large commission, in order.",
    dark: true,
    hideable: true,
    movable: true,
    copyPrefixes: ["LargeFormat.how"],
    imageKeys: [],
    cureLabelKey: "cure.how",
  },
  {
    key: "brief",
    label: "What to send",
    description:
      "What makes a quote quick — the room, the measurements, the use.",
    hideable: true,
    movable: true,
    copyPrefixes: ["LargeFormat.brief"],
    imageKeys: [],
    cureLabelKey: "cure.brief",
  },
  {
    /* Reuses the Process namespace's four materials rather than duplicating
       the copy for a second page — About and Process already describe the
       same four materials this way (see `about.material1.image`'s note). */
    key: "materials",
    label: "Materials",
    description:
      "The same four materials the small work is made of, in more of it.",
    hideable: true,
    movable: true,
    copyPrefixes: ["Process.materials"],
    imageKeys: [
      "process.material1",
      "process.material2",
      "process.material3",
      "process.material4",
    ],
    cureLabelKey: "cure.materials",
  },
  {
    /* Reuses the homepage's furniture tiles rather than a second set of
       concept photography — same six slots, same D5 concept framing. Off by
       default for the same reason `home.furniture` is. */
    key: "pieces",
    label: "Pieces we commission",
    description:
      "The six furniture tiles, shown again for a visitor who came in here.",
    hideable: true,
    movable: true,
    defaultVisible: false,
    copyPrefixes: ["LargeFormat.pieces", "Home.furniture"],
    imageKeys: [
      "home.furniture.dining",
      "home.furniture.coffee",
      "home.furniture.side",
      "home.furniture.console",
      "home.furniture.chair",
      "home.furniture.bench",
    ],
    cureLabelKey: "cure.pieces",
  },
  {
    key: "work",
    label: "Commissioned before",
    description: "Published portfolio cases, when there are any to show.",
    hideable: true,
    movable: true,
    conditional: true,
    copyPrefixes: ["LargeFormat.work"],
    imageKeys: [],
    cureLabelKey: "cure.work",
  },
  {
    key: "words",
    label: "In their words",
    description: "Testimonials given about large-format work.",
    hideable: true,
    movable: true,
    conditional: true,
    copyPrefixes: ["LargeFormat.words"],
    imageKeys: [],
    cureLabelKey: "cure.words",
  },
  {
    key: "faq",
    label: "Questions",
    description: "Large-format questions answered on the FAQ, shown here too.",
    hideable: true,
    movable: true,
    conditional: true,
    copyPrefixes: ["LargeFormat.faq"],
    imageKeys: [],
    cureLabelKey: "cure.faq",
  },
  {
    key: "gallery",
    label: "Large pieces",
    description:
      "Published products in the large-format categories. Renders an invitation instead of a grid when there are none.",
    hideable: true,
    movable: true,
    copyPrefixes: ["LargeFormat.gallery"],
    imageKeys: [],
    cureLabelKey: "cure.gallery",
  },
  {
    key: "commission",
    label: "Start the conversation",
    description: "The closing invitation into the existing commission flow.",
    hideable: false,
    movable: false,
    copyPrefixes: ["LargeFormat.cta"],
    imageKeys: [],
  },
];

export const PAGE_SECTIONS: Record<SectionPageKey, readonly SectionDef[]> = {
  home: HOME,
  about: ABOUT,
  process: PROCESS,
  "large-format": LARGE_FORMAT,
  "custom-order": CUSTOM_ORDER,
  contact: CONTACT,
  workshops: WORKSHOPS,
  "process-steps": PROCESS_STEPS_LIST,
  materials: MATERIALS_LIST,
};

/** What the owner is arranging, in their words — the studio screen's tabs. */
export const PAGE_SECTION_LABELS: Record<
  SectionPageKey,
  { title: string; path: string }
> = {
  home: { title: "Homepage", path: "/" },
  about: { title: "About", path: "/about" },
  process: { title: "Process", path: "/process" },
  "large-format": { title: "Large format", path: "/large-resin-art" },
  "custom-order": { title: "Bespoke", path: "/custom-order" },
  contact: { title: "Contact", path: "/contact" },
  workshops: { title: "Workshops", path: "/workshops" },
  // Fragment paths — never a page of their own. `pageKeyForPath` matches
  // paths exactly, so `/process#stages` and `/process#materials` never
  // collide with the `process` entry above.
  "process-steps": { title: "Process steps", path: "/process#stages" },
  materials: { title: "Materials", path: "/process#materials" },
};

export function isSectionPageKey(value: string): value is SectionPageKey {
  return (SECTION_PAGES as readonly string[]).includes(value);
}

export function sectionDef(
  pageKey: SectionPageKey,
  key: string,
): SectionDef | undefined {
  return PAGE_SECTIONS[pageKey].find((s) => s.key === key);
}

/** One section, resolved with the owner's order and visibility applied. */
export type ResolvedSection = SectionDef & {
  order: number;
  visible: boolean;
  /** Staged but not published — a visitor still sees the old arrangement. */
  unpublished: boolean;
  notes?: string;
};

/**
 * Apply a requested order, keeping every pinned section where it already is.
 *
 * Shared by the server action and the studio board on purpose: the board has
 * to predict exactly what the action will do, or its refusal message describes
 * an arrangement the server was never going to write.
 *
 * `current` is the arrangement as it stands, in render order. `keys` is what
 * the caller wants. Pinned sections keep their index whatever `keys` says —
 * the hero is always first, and the pinned scrub stays where the page is paced
 * for it — and the movable ones fill the gaps in the requested order.
 *
 * TOTAL over `current`: a section `keys` forgot to mention keeps its place in
 * the tail rather than falling off the page. A truncated or stale request from
 * the board must not be able to lose a section.
 */
export function applyReorder<T extends { key: string; movable: boolean }>(
  current: readonly T[],
  keys: readonly string[],
): T[] {
  const pinnedAt = new Map<number, T>();
  current.forEach((section, index) => {
    if (!section.movable) pinnedAt.set(index, section);
  });

  const byKey = new Map(current.map((s) => [s.key, s]));
  const seen = new Set<string>();
  const movable: T[] = [];
  for (const key of keys) {
    const section = byKey.get(key);
    if (!section || !section.movable || seen.has(key)) continue;
    seen.add(key);
    movable.push(section);
  }
  for (const section of current) {
    if (section.movable && !seen.has(section.key)) movable.push(section);
  }

  const next: T[] = [];
  let cursor = 0;
  for (let i = 0; i < current.length; i += 1) {
    const pinned = pinnedAt.get(i);
    if (pinned) next.push(pinned);
    else next.push(movable[cursor++]);
  }
  return next;
}

/* ═══════════════════════ the guardrails ═══════════════════════ */

/**
 * Why an arrangement is refused, in the owner's words.
 * Returns null when it is allowed.
 *
 * These are REDESIGN.md Part 3 rules that `scripts/redesign-audit.mjs` already
 * enforces in CI — but CI does not run when the owner presses Publish, so the
 * studio has to refuse first. A refusal names the sections involved, because
 * "that is not allowed" with no subject is a dead end.
 */
export function describeArrangementProblem(
  sections: readonly {
    key: string;
    label: string;
    dark?: boolean;
    visible: boolean;
    hideable: boolean;
    ownsH1?: boolean;
  }[],
): string | null {
  const shown = sections.filter((s) => s.visible);

  const missingH1 = sections.find((s) => s.ownsH1 && !s.visible);
  if (missingH1) {
    return `${missingH1.label} carries the page's only heading, so it cannot be hidden.`;
  }

  const unhideable = sections.find((s) => !s.hideable && !s.visible);
  if (unhideable) {
    return `${unhideable.label} is part of the page's structure and cannot be hidden.`;
  }

  // Every other list carries at least one unhideable section (the hero, at
  // minimum), so this can only ever fire for a list where every entry is
  // individually hideable — the ten process steps, the four materials. One
  // of those is allowed to lose nine members, never all ten.
  if (sections.length > 0 && shown.length === 0) {
    return "Every section here would be hidden, and the page cannot lose all of them. Leave at least one showing.";
  }

  const darkShown = shown.filter((s) => s.dark);
  if (darkShown.length > 3) {
    return `The page would have ${darkShown.length} dark bands — ${darkShown
      .map((s) => s.label)
      .join(
        ", ",
      )}. The design allows three. Hide one before turning another on.`;
  }

  for (let i = 1; i < shown.length; i += 1) {
    if (shown[i].dark && shown[i - 1].dark) {
      return `${shown[i - 1].label} and ${shown[i].label} are both dark bands and would sit edge to edge. Put a light section between them.`;
    }
  }

  return null;
}
