"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Package, Search } from "lucide-react";

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
 * Two layers: every sidebar destination (role-filtered, same source of truth
 * as the nav), and a live product jump backed by the staff-only
 * `searchProductsForLink` action. cmdk's own Dialog handles the portal, the
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

  const go = (href: string) => {
    studioPaletteSignal.close();
    setQuery("");
    router.push(href);
  };

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
        <Command.Empty className="px-3 py-8 text-center text-small text-graphite">
          Nothing matches.
        </Command.Empty>

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
