"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  FileText,
  FolderTree,
  HelpCircle,
  Image as ImageIcon,
  Images,
  Import,
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
} from "lucide-react";
import type { Role } from "@/generated/prisma/client";
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
    heading: "overview",
    items: [
      { label: "Overview", href: "/studio", icon: LayoutDashboard },
      {
        label: "Content Gaps",
        href: "/studio/content-gaps",
        icon: ListChecks,
      },
    ],
  },
  {
    heading: "catalog",
    items: [
      { label: "Products", href: "/studio/products", icon: Package },
      { label: "Categories", href: "/studio/categories", icon: FolderTree },
      { label: "Media Library", href: "/studio/media", icon: ImageIcon },
      { label: "Site Images", href: "/studio/site-images", icon: Images },
      { label: "Site Copy", href: "/studio/site-copy", icon: Type },
      {
        label: "Page Sections",
        href: "/studio/sections",
        icon: LayoutTemplate,
      },
      {
        label: "Commission Form",
        href: "/studio/forms",
        icon: SlidersHorizontal,
        adminOnly: true,
      },
      {
        label: "Navigation",
        href: "/studio/navigation",
        icon: Menu,
        adminOnly: true,
      },
    ],
  },
  {
    heading: "commissions & content",
    items: [
      { label: "Commissions", href: "/studio/inquiries", icon: Inbox },
      { label: "Analytics", href: "/studio/analytics", icon: BarChart3 },
      { label: "Subscribers", href: "/studio/subscribers", icon: Mail },
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
    heading: "growth",
    items: [
      { label: "Sheet Import", href: "/studio/sheet-import", icon: Import },
      { label: "Bulk Import", href: "/studio/import", icon: Import },
      { label: "Product Scraper", href: "/studio/scraper", icon: Radar },
      // SEO edits SiteSettings (site-wide fallback metadata) — a settings
      // surface, so it follows the settings rule: admins only.
      { label: "SEO", href: "/studio/seo", icon: Search, adminOnly: true },
    ],
  },
  {
    heading: "system",
    items: [
      {
        label: "Site Settings",
        href: "/studio/settings",
        icon: Settings,
        adminOnly: true,
      },
      { label: "Users", href: "/studio/users", icon: Users, adminOnly: true },
      { label: "Activity", href: "/studio/activity", icon: Activity },
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

  return (
    <nav aria-label="Studio" className="flex flex-col gap-7">
      {SECTIONS.map((section) => {
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
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      title={item.label}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center gap-3 border-s-2 px-3 py-2 text-small outline-none transition-colors max-lg:justify-center [[data-sidebar-collapsed]_&]:lg:justify-center duration-(--dur-fast) ease-(--ease-settle) focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-inset motion-reduce:transition-none",
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
