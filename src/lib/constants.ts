export const SITE = {
  name: "ResinRiva",
  tagline: "Luxury custom resin art & 3D printing, made to order in India",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://store.bhavyagondaliya.co.in",
  whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "917096036250",
  phoneDisplay: "+91 7096036250",
  phoneTel: "+917096036250",
  email: "gondaliyabhavya70960@gmail.com",
  mapsUrl: "https://maps.app.goo.gl/L2NHDt9Akgqs2ZoT6",
} as const;

// `key` maps each link to its translation key in the shared `Nav` message
// namespace (messages/*.json); `href` stays the single source of truth for
// routing. The chrome renders `t(link.key)`.
/**
 * Primary navigation — REDESIGN.md §5.2: **four items only.**
 *
 *   Shop · Bespoke · Studio · Journal
 *
 * The header previously exposed Shop, Resin Art & Gifting, Studio Supplies,
 * 3D Printing, Custom Order, Workshops, Portfolio, Blog, Search, About,
 * Process, FAQ and Contact. That is thirteen destinations competing at one
 * visual weight, and it is the reason the site reads as a catalogue rather
 * than an atelier. The catalogue's real breadth now lives in the Shop mega
 * menu, where it is browsed by photograph; everything else demotes to
 * SECONDARY_NAV_LINKS (the mobile drawer's quiet second register) and the
 * footer's operational map.
 *
 * "Studio" fronts the brand story (/about); "Bespoke" is the commission
 * flow's public name (/custom-order); "Journal" is the blog's.
 */
export const NAV_LINKS = [
  { key: "shop", label: "Shop", href: "/shop" },
  { key: "bespoke", label: "Bespoke", href: "/custom-order" },
  { key: "studio", label: "Studio", href: "/about" },
  { key: "journal", label: "Journal", href: "/blog" },
] as const;

/** Demoted destinations — the mobile drawer's second group, below a divider
 *  at small size (§5.4), and the footer's four columns. */
export const SECONDARY_NAV_LINKS = [
  { key: "portfolio", label: "Portfolio", href: "/portfolio" },
  { key: "ourProcess", label: "Our Process", href: "/process" },
  { key: "workshops", label: "Workshops", href: "/workshops" },
  { key: "faq", label: "FAQ", href: "/faq" },
  { key: "contact", label: "Contact", href: "/contact" },
] as const;

/**
 * Footer map — REDESIGN.md §5.7: four columns, not a sitemap.
 *
 *   Explore  Shop · Collections · Bespoke
 *   Studio   About · Process · Workshops · Portfolio
 *   Journal  the index plus the two categories the studio actually writes
 *   Contact  resolved from Site Settings, not from this list
 *
 * "Do not repeat every navigation item" — the header sheds destinations so
 * the page can breathe; inlining all of them here puts the same IA back on
 * the screen it was removed from.
 */
export const FOOTER_LINKS = {
  explore: [
    { key: "shop", label: "Shop", href: "/shop" },
    // The shop page's collection strip — collections are browsed by
    // photograph (§7.3), so the doorway is the strip, not a list page.
    { key: "collections", label: "Collections", href: "/shop#collections" },
    { key: "bespoke", label: "Bespoke", href: "/custom-order" },
    // Appended, never inserted: prisma/bootstrap.ts writes `order` from the
    // array index, so a mid-array insert would give a fresh database one
    // order and every existing one another.
    { key: "largeFormat", label: "Large format", href: "/large-resin-art" },
  ],
  studio: [
    { key: "about", label: "About", href: "/about" },
    { key: "ourProcess", label: "Our Process", href: "/process" },
    { key: "workshops", label: "Workshops", href: "/workshops" },
    { key: "portfolio", label: "Portfolio", href: "/portfolio" },
  ],
  journal: [
    { key: "journal", label: "Journal", href: "/blog" },
    {
      key: "journalStories",
      label: "Stories",
      href: "/blog?category=behind-the-studio",
    },
    { key: "journalGuides", label: "Guides", href: "/blog?category=gift-guides" },
  ],
  legal: [
    { key: "privacy", label: "Privacy Policy", href: "/privacy" },
    { key: "terms", label: "Terms & Conditions", href: "/terms" },
  ],
} as const;
