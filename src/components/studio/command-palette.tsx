"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  FileText,
  Image as ImageIcon,
  Import,
  Package,
  Plus,
  Radar,
  Search,
  Table,
} from "lucide-react";

import { searchProductsForLink } from "@/actions/products";
import { SECTIONS } from "@/components/studio/sidebar";
import type { Role } from "@/generated/prisma/client";
import { useOverlayOpen } from "@/hooks/use-overlay-signal";
import { studioPaletteSignal } from "@/lib/studio-palette-signal";

/**
 * ⌘K command palette — REDESIGN.md §12.2 ("shared ⌘K command palette with the
 * storefront"). Same keybinding, same visual language as
 * `storefront/search-overlay.tsx`: an obsidian scrim, a mono group heading, a
 * single field that keeps focus for the whole session. Separate component,
 * because the two search different things behind different auth — see
 * `lib/studio-palette-signal.ts`.
 *
 * Three layers: the VERBS an owner actually arrives wanting to do, every
 * sidebar destination (role-filtered, same source of truth as the nav), and a
 * live product jump backed by the staff-only `searchProductsForLink` action.
 *
 * The verbs NAVIGATE, they do not execute. "Run the scraper" opens the sources
 * screen where the run button and its confirmation live; firing a scrape from
 * a fuzzy-matched keystroke would be a side effect nobody asked for twice. cmdk's own Dialog handles the portal, the
 * focus trap and `Esc`; product results bypass cmdk filtering (they're already
 * server-filtered).
 *
 * Open state lives in the module signal, not in this component, so the
 * topbar's Search button can raise it without being an ancestor — and so
 * closing returns focus to whatever opened it (Part 17).
 */
export function CommandPalette({ role }: { role: Role }) {
  const router = useRouter();
  const open = useOverlayOpen(studioPaletteSignal);
  const [query, setQuery] = useState("");
  /* Results carry the query they belong to: rendering filters on that
     instead of clearing state from the effect (no cascading render, and no
     stale list flashing under a newer query). */
  const [results, setResults] = useState<{
    q: string;
    items: { id: string; title: string }[];
  }>({ q: "", items: [] });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        studioPaletteSignal.toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced product search once the query is substantial.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const term = query.trim();
    if (!open || term.length < 2) return;
    debounceRef.current = setTimeout(() => {
      void searchProductsForLink(term).then((result) => {
        if (result.ok) setResults({ q: term, items: result.data ?? [] });
      });
    }, 180);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  const term = query.trim();
  const products =
    open && term.length >= 2 && results.q === term ? results.items : [];
  /* Long enough to trigger a search, but the results in hand belong to an
     older query — so the product list is unknown, not empty. */
  const searching = open && term.length >= 2 && results.q !== term;

  const go = (href: string) => {
    studioPaletteSignal.close();
    setQuery("");
    router.push(href);
  };

  /**
   * §12.2's verbs. Each is a destination, so the palette stays a navigator —
   * the doing happens on the screen that owns the confirmation. `keywords`
   * carries the words an owner would actually type ("add", "new", "csv"),
   * because cmdk matches the value string and "Create product" does not
   * contain "add".
   */
  const ACTIONS: {
    label: string;
    href: string;
    keywords: string;
    icon: typeof Plus;
  }[] = [
    { label: "Create a product", href: "/studio/products/new", keywords: "add new create product item", icon: Plus },
    { label: "Write a journal post", href: "/studio/blog/new", keywords: "add new write blog journal post article", icon: FileText },
    { label: "Add a portfolio piece", href: "/studio/portfolio/new", keywords: "add new portfolio case study piece", icon: ImageIcon },
    { label: "Run the scraper", href: "/studio/scraper/sources", keywords: "run scrape scraper sources fetch", icon: Radar },
    { label: "Import from the sheet", href: "/studio/sheet-import", keywords: "import sheet google tiers sync", icon: Table },
    { label: "Bulk import products", href: "/studio/import", keywords: "import bulk csv upload", icon: Import },
    { label: "Upload media", href: "/studio/media", keywords: "upload media image file library", icon: ImageIcon },
  ];

  const navItems = SECTIONS.flatMap((section) =>
    section.items.filter(
      (item) => !item.phase && (!item.adminOnly || role === "ADMIN"),
    ),
  );

  const GROUP_HEADING =
    "[&_[cmdk-group-heading]]:u-micro [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2";
  const ITEM =
    "flex min-h-11 cursor-pointer items-center gap-3 rounded-input px-3 text-small text-foreground data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary";

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) studioPaletteSignal.open();
        else studioPaletteSignal.close();
      }}
      shouldFilter
      label="Studio command palette"
      className="fixed left-1/2 top-24 z-(--z-studio-palette) w-[min(38rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-modal border border-border bg-card shadow-e3"
      overlayClassName="fixed inset-0 z-(--z-studio-scrim) bg-obsidian/80"
    >
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Search
          aria-hidden
          strokeWidth={1.5}
          className="size-4 shrink-0 text-graphite"
        />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Jump to a page or search products…"
          className="h-14 w-full bg-transparent text-body text-foreground outline-none placeholder:text-graphite"
        />
        <kbd className="u-micro rounded-input border border-border px-2 py-1">
          esc
        </kbd>
      </div>
      <Command.List className="max-h-80 overflow-y-auto p-2">
        {/* "Nothing matches" is a claim, and while the debounced product
            search is still in flight the palette does not yet have grounds for
            it — it used to make it anyway, so a two-character query flashed a
            wrong answer before the right one arrived. The row below is flat on
            purpose: a spinner here would be motion for a wait measured in
            ~180ms plus a query. */}
        <Command.Empty className="px-3 py-8 text-center text-small text-graphite">
          {searching ? "Searching products…" : "Nothing matches."}
        </Command.Empty>

        <Command.Group heading="Do" className={GROUP_HEADING}>
          {ACTIONS.map((action) => (
            <Command.Item
              key={action.href}
              value={`do ${action.label} ${action.keywords}`}
              onSelect={() => go(action.href)}
              className={ITEM}
            >
              <action.icon
                aria-hidden
                strokeWidth={1.5}
                className="size-4 shrink-0"
              />
              {action.label}
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Go to" className={GROUP_HEADING}>
          {navItems.map((item) => (
            <Command.Item
              key={item.href}
              value={`nav ${item.label}`}
              onSelect={() => go(item.href)}
              className={ITEM}
            >
              <item.icon
                aria-hidden
                strokeWidth={1.5}
                className="size-4 shrink-0"
              />
              {item.label}
            </Command.Item>
          ))}
        </Command.Group>

        {products.length > 0 && (
          <Command.Group heading="Products" className={GROUP_HEADING}>
            {products.map((product) => (
              <Command.Item
                key={product.id}
                // Server-filtered already — force cmdk to keep the item
                // regardless of its own fuzzy match.
                value={`product ${query} ${product.id}`}
                onSelect={() => go(`/studio/products/${product.id}`)}
                className={ITEM}
              >
                <Package
                  aria-hidden
                  strokeWidth={1.5}
                  className="size-4 shrink-0"
                />
                <span className="min-w-0 truncate">{product.title}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
