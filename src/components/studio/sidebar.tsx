"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  FileText,
  FlaskConical,
  FolderTree,
  HelpCircle,
  Image as ImageIcon,
  Images,
  Download,
  Import,
  Workflow,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  Megaphone,
  ListChecks,
  Mail,
  MessageSquareQuote,
  Package,
  Radar,
  Search,
  Settings,
  Users,
  Type,
  SlidersHorizontal,
  Menu,
  Hammer,
  Palette,
  Pin,
} from "lucide-react";
import type { Role } from "@/generated/prisma/client";
import {
  getPinsServerSnapshot,
  getPinsSnapshot,
  pinnedItemsOf,
  subscribePins,
  togglePin,
} from "@/lib/studio-pins";
import { cn } from "@/lib/utils";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  /** Sections that arrive in a later phase render disabled. */
  phase?: string;
  /** ADMIN-only surfaces (DESIGN.md C: "editor never sees Settings"). */
  adminOnly?: boolean;
};

/**
 * Exported for the ⌘K palette and the breadcrumb topbar.
 *
 * §12.2 lists the nav as `Overview · Products · Collections · Commissions ·
 * Portfolio · Journal · Workshops · Media · Customers · Users · Settings`.
 * Four of those are not surfaces this Studio has — Collections is Categories,
 * Journal is Blog, Workshops are products in the `workshops` category, and
 * there are no Customers because there are no customer accounts (HARD RULES).
 * So the spec's VOCABULARY is applied to the routes that exist — Dashboard →
 * Overview, WhatsApp Orders → Commissions — and nothing is invented to fill
 * the gaps. Routes and URLs are untouched.
 */
export const SECTIONS: { heading: string; items: NavItem[] }[] = [
  {
    // What you open the Studio to look at. Analytics sits here rather than
    // under research for the same reason Overview does: it answers "how is the
    // business doing", not "what should we source next".
    heading: "today",
    items: [
      { label: "Overview", href: "/studio", icon: LayoutDashboard },
      { label: "Commissions", href: "/studio/inquiries", icon: Inbox },
      { label: "Analytics", href: "/studio/analytics", icon: BarChart3 },
      { label: "Activity", href: "/studio/activity", icon: Activity },
    ],
  },
  {
    // Products and the three ways they get here. Import lives WITH the
    // catalogue because importing is how the catalogue is filled — it was
    // filed under "growth", which is a strategy word for a data-entry job.
    heading: "catalogue",
    items: [
      { label: "Products", href: "/studio/products", icon: Package },
      { label: "Categories", href: "/studio/categories", icon: FolderTree },
      { label: "Media Library", href: "/studio/media", icon: ImageIcon },
      { label: "Bulk Import", href: "/studio/import", icon: Import },
      // A DIFFERENT icon, deliberately (plan §3 S8). These two sit adjacent
      // and did the opposite jobs behind the same glyph: Bulk Import is a
      // file an operator hands over; Catalog fill is a pipeline that runs
      // itself on deploy. `Workflow` says the second thing; `Import` said the
      // first twice.
      //
      // The LABEL stays "Catalog fill". The plan proposes "Catalog pipeline
      // (auto)", but the words also render inside a provenance string on the
      // product form ("Catalog fill · kanha-kreation") and in the activity
      // log's action map, where the parenthetical reads as a mistake. The
      // icon carries the distinction the rename was for.
      { label: "Catalog fill", href: "/studio/catalog-fill", icon: Workflow },
      { label: "Exports", href: "/studio/exports", icon: Download },
      // The three research surfaces, folded in from their own group (S13,
      // 2026-09-18). They looked like a separate concern and are not: every
      // one of them exists to decide what goes INTO this catalogue. The
      // scraper's output lands in the review inbox, Research reads the staged
      // rows, and Content Gaps names what the catalogue is missing — so they
      // sit after the surfaces that fill it, in the order a row travels.
      //
      // Content Gaps had already been moved once, out of "today", because an
      // analysis screen beside the dashboard left the scraper's own analysis
      // two groups away. This puts all three in one place instead.
      { label: "Product Scraper", href: "/studio/scraper", icon: Radar },
      { label: "Research", href: "/studio/research", icon: FlaskConical },
      { label: "Content Gaps", href: "/studio/content-gaps", icon: ListChecks },
    ],
  },
  {
    // The site's own words, pictures and arrangement — every surface in the
    // "registry → overrides → total resolver" family. Process Steps and
    // Materials are Page Sections pre-filtered (`SUBLIST_PAGES`), so they
    // belong beside it rather than in a group of their own.
    //
    // "content", not "site content" (S13, 2026-09-18). The qualifier was
    // doing no work: nothing else in this Studio is content that is not the
    // site's, and S13 names the five groups as Today · Catalogue · Content ·
    // Editorial · Settings.
    heading: "content",
    items: [
      { label: "Site Copy", href: "/studio/site-copy", icon: Type },
      { label: "Site Images", href: "/studio/site-images", icon: Images },
      {
        label: "Page Sections",
        href: "/studio/sections",
        icon: LayoutTemplate,
      },
      { label: "Process Steps", href: "/studio/process", icon: Hammer },
      { label: "Materials", href: "/studio/materials", icon: Palette },
      {
        label: "Navigation",
        href: "/studio/navigation",
        icon: Menu,
        adminOnly: true,
      },
      {
        label: "Commission Form",
        href: "/studio/forms",
        icon: SlidersHorizontal,
        adminOnly: true,
      },
    ],
  },
  {
    // Things the owner WRITES, as opposed to the chrome above that they
    // adjust. Each is a body of published work with its own editor.
    heading: "editorial",
    items: [
      { label: "Journal", href: "/studio/blog", icon: FileText },
      { label: "Portfolio", href: "/studio/portfolio", icon: ImageIcon },
      {
        label: "Testimonials",
        href: "/studio/testimonials",
        icon: MessageSquareQuote,
      },
      { label: "FAQs", href: "/studio/faqs", icon: HelpCircle },
      { label: "Pages", href: "/studio/pages", icon: FileText },
      {
        label: "Landing Pages",
        href: "/studio/custom-pages",
        icon: Megaphone,
      },
    ],
  },
  {
    heading: "settings",
    items: [
      {
        label: "Site Settings",
        href: "/studio/settings",
        icon: Settings,
        adminOnly: true,
      },
      // SEO edits SiteSettings (site-wide fallback metadata) — a settings
      // surface, so it follows the settings rule: admins only. It was under
      // "growth" with its own comment saying it was a settings surface.
      { label: "SEO", href: "/studio/seo", icon: Search, adminOnly: true },
      { label: "Users", href: "/studio/users", icon: Users, adminOnly: true },
      { label: "Subscribers", href: "/studio/subscribers", icon: Mail },
      {
        label: "Content Lab",
        href: "/studio/content-lab",
        icon: FlaskConical,
        adminOnly: true,
      },
    ],
  },
];
/**
 * Studio nav — §12.2. Lives on the obsidian chrome, which carries
 * `data-theme="navy"`, so inks resolve mineral/mist and focus rings resolve
 * champagne (Part 16).
 *
 * The active item is marked by a **champagne line** — a 2px start rule, the
 * one place champagne appears in the shell. It is never a fill and never a
 * background (contract §2, "champagne discipline"): the active row's own
 * surface is a 6%-mineral wash, which is what actually reads as "you are here"
 * at a glance, with the champagne rule as the precision mark beside it.
 * Inactive rows keep a transparent 2px rule so labels never shift.
 */
export function StudioNav({
  role,
  onNavigate,
}: {
  role: Role;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const pinned = useSyncExternalStore(
    subscribePins,
    getPinsSnapshot,
    getPinsServerSnapshot,
  );

  /* S13's pinned row. It FILTERS the nav rather than mapping the stored list,
     so an href that has since been renamed or removed drops out instead of
     rendering a dead link — and the row keeps the sidebar's own order rather
     than the order things were pinned in, so it reads like a shortcut to the
     nav below it and not like a second, differently-sorted nav.

     Admin-only rows are filtered per section below; a pinned one is filtered
     here for the same reason, so an editor who once had ADMIN cannot keep a
     shortcut to Users. */
  const pinnedItems = pinnedItemsOf(SECTIONS, pinned).filter(
    (item) => !item.adminOnly || role === "ADMIN",
  );

  const sections: { heading: string; items: NavItem[] }[] = [
    ...(pinnedItems.length > 0
      ? [{ heading: "pinned", items: pinnedItems }]
      : []),
    ...SECTIONS,
  ];

  return (
    <nav aria-label="Studio" className="flex flex-col gap-7">
      {sections.map((section) => {
        const items = section.items.filter(
          (item) => !item.adminOnly || role === "ADMIN",
        );
        if (items.length === 0) return null;
        return (
          <div key={section.heading}>
            <p className="u-micro px-3 text-mist/70 max-lg:hidden [[data-sidebar-collapsed]_&]:hidden">
              {section.heading}
            </p>
            <ul className="mt-2 space-y-px">
              {items.map((item) => {
                const active =
                  item.href === "/studio"
                    ? pathname === "/studio"
                    : pathname.startsWith(item.href);
                if (item.phase) {
                  return (
                    <li key={item.href}>
                      <span
                        className="flex min-h-11 cursor-not-allowed items-center gap-3 border-s-2 border-transparent px-3 py-2 text-small text-mist/40 max-lg:justify-center"
                        title={`Coming in Phase ${item.phase}`}
                      >
                        <item.icon className="size-4" strokeWidth={1.5} />
                        <span className="max-lg:hidden">{item.label}</span>
                        <span className="u-micro ms-auto rounded-full border border-hairline-dk px-2 py-px max-lg:hidden">
                          {item.phase}
                        </span>
                      </span>
                    </li>
                  );
                }
                const isPinned = pinned.includes(item.href);
                return (
                  /* `relative` so the pin button can sit at the end of the row
                     WITHOUT nesting a button inside the link — nested
                     interactive elements are invalid and unreachable by
                     keyboard in that order. `group/row` drives its hover
                     reveal; it is always visible once pinned, and always
                     reachable by Tab regardless, because a control that only
                     exists on hover is a control a keyboard cannot find. */
                  <li key={item.href} className="group/row relative">
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      title={item.label}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 border-s-2 px-3 py-2 pe-10 text-small outline-none transition-colors max-lg:justify-center max-lg:pe-3 [[data-sidebar-collapsed]_&]:lg:justify-center [[data-sidebar-collapsed]_&]:lg:pe-3 duration-(--dur-fast) ease-(--ease-settle) focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset motion-reduce:transition-none",
                        active
                          ? "border-champagne bg-mineral/6 font-medium text-mineral"
                          : "border-transparent text-mist hover:bg-mineral/4 hover:text-mineral",
                      )}
                    >
                      <item.icon
                        aria-hidden
                        className="size-4 shrink-0"
                        strokeWidth={1.5}
                      />
                      <span className="min-w-0 truncate max-lg:hidden [[data-sidebar-collapsed]_&]:hidden">
                        {item.label}
                      </span>
                    </Link>
                    <button
                      type="button"
                      onClick={() => togglePin(item.href)}
                      aria-pressed={isPinned}
                      className={cn(
                        /* `focus:` for the OPACITY, `focus-visible:` for the RING, and
                           the split is deliberate. `:focus-visible` decides
                           whether to DRAW a focus ring; whether a focused
                           control can be SEEN at all should not depend on how
                           the focus arrived. `:focus-visible` does not match a
                           programmatic `.focus()`, so a script moving focus here
                           — a skip link, a restore after a dialog — would land
                           on an invisible button.

                           Keyboard Tab is covered twice over, by this and by
                           `group-focus-within/row` on the row; the belt is
                           cheap and the braces are the case above. */
                        "absolute end-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-mist outline-none transition-[color,opacity] duration-(--dur-fast) ease-(--ease-settle) hover:text-mineral focus:opacity-100 focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none",
                        /* Icon-only widths have no room beside the label, and
                           the whole row is 44px there — a 36px overlay would
                           eat most of the tap target it sits on. */
                        "max-lg:hidden [[data-sidebar-collapsed]_&]:lg:hidden",
                        isPinned
                          ? "text-champagne opacity-100"
                          : "opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100",
                      )}
                    >
                      <Pin
                        aria-hidden
                        className="size-3.5"
                        strokeWidth={1.5}
                        fill={isPinned ? "currentColor" : "none"}
                      />
                      <span className="sr-only">
                        {isPinned
                          ? `Unpin ${item.label}`
                          : `Pin ${item.label}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
