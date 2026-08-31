"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";

import {
  productsForGridBySlugs,
  searchProductsForGrid,
} from "@/actions/products";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isOptimizableImageSrc } from "@/lib/image-src";

type Found = {
  slug: string;
  title: string;
  image: string | null;
  published: boolean;
};

/**
 * Picking the pieces a landing page's grid shows.
 *
 * This replaced a textarea that asked the owner to type "the last part of a
 * product's URL, one per line". That is a slug, and an owner running a resin
 * studio has no reason to know what a slug is or to type one exactly. They
 * recognise a piece by its photograph, so the picker shows photographs.
 *
 * The chosen list keeps its ORDER — the storefront renders manual grids in the
 * order picked, so the arrows are not decoration.
 *
 * A draft product is offered but labelled. It is a legitimate choice (the piece
 * goes live before the campaign does) and a silent one would be worse: the grid
 * would simply render short on the day.
 */
export function ProductPicker({
  chosen,
  onChange,
}: {
  chosen: string[];
  onChange: (next: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Found[] | null>(null);
  const [known, setKnown] = useState<Record<string, Found>>({});
  const [busy, setBusy] = useState(false);
  // Slugs the server has answered for. A chosen slug that is checked and still
  // unknown has no product behind it — the grid will render short.
  const [checked, setChecked] = useState<string[]>([]);
  const hydrated = useRef(false);

  // Show what is ALREADY picked as titles and photographs, not as slugs. The
  // block arrives holding slugs and nothing else, and a picker that renders
  // them raw until the owner runs a search is the textarea it replaced.
  //
  // Once, on mount: the chosen list changes only through this component, and
  // every change here goes through a row we already know.
  useEffect(() => {
    if (hydrated.current || chosen.length === 0) return;
    hydrated.current = true;
    let live = true;
    void productsForGridBySlugs(chosen).then((res) => {
      if (!live || !res.ok) return;
      setKnown((prev) => ({
        ...prev,
        ...Object.fromEntries((res.data ?? []).map((r) => [r.slug, r])),
      }));
      setChecked((prev) => [...new Set([...prev, ...chosen])]);
    });
    return () => {
      live = false;
    };
  }, [chosen]);

  async function search(term: string) {
    setBusy(true);
    const res = await searchProductsForGrid(term);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    const rows = res.data ?? [];
    setResults(rows);
    // Remember what each slug looks like, so a chosen row can still show its
    // photograph after the search that found it is cleared.
    setKnown((prev) => ({
      ...prev,
      ...Object.fromEntries(rows.map((r) => [r.slug, r])),
    }));
  }

  function add(slug: string) {
    if (chosen.includes(slug)) return;
    onChange([...chosen, slug]);
  }

  function remove(slug: string) {
    onChange(chosen.filter((s) => s !== slug));
  }

  function move(slug: string, delta: number) {
    const next = [...chosen];
    const from = next.indexOf(slug);
    const to = from + delta;
    if (to < 0 || to >= next.length) return;
    [next[from], next[to]] = [next[to], next[from]];
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <Label>Which pieces</Label>

      {chosen.length === 0 ? (
        <p className="text-xs text-graphite">
          Nothing picked yet — the grid will not appear on the page.
        </p>
      ) : (
        <ol className="space-y-1">
          {chosen.map((slug, index) => {
            const meta = known[slug];
            const missing = !meta && checked.includes(slug);
            return (
              <li
                key={slug}
                className="flex items-center gap-2 rounded-lg border border-border p-2"
              >
                <span className="u-num text-12 text-graphite">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {meta?.image ? (
                  <span className="relative size-10 shrink-0 overflow-hidden rounded">
                    <Image
                      src={meta.image}
                      alt=""
                      fill
                      sizes="40px"
                      unoptimized={!isOptimizableImageSrc(meta.image)}
                      className="object-cover"
                    />
                  </span>
                ) : (
                  <span className="size-10 shrink-0 rounded bg-muted" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-small text-foreground">
                    {meta?.title ?? slug}
                  </span>
                  <span
                    className={`block truncate font-mono text-12 ${missing ? "text-alert" : "text-graphite"}`}
                  >
                    {slug}
                    {missing ? " · no such product" : ""}
                    {meta && !meta.published ? " · not published" : ""}
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={index === 0}
                  onClick={() => move(slug, -1)}
                >
                  <ArrowUp aria-hidden className="size-4" />
                  <span className="sr-only">Move {meta?.title ?? slug} up</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={index === chosen.length - 1}
                  onClick={() => move(slug, 1)}
                >
                  <ArrowDown aria-hidden className="size-4" />
                  <span className="sr-only">
                    Move {meta?.title ?? slug} down
                  </span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => remove(slug)}
                >
                  <X aria-hidden className="size-4" />
                  <span className="sr-only">Remove {meta?.title ?? slug}</span>
                </Button>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          placeholder="Search the catalogue…"
          aria-label="Search products to add"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              search(q);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => search(q)}
          disabled={busy}
        >
          {busy ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <Search aria-hidden className="size-4" />
          )}
          Find
        </Button>
      </div>

      {results !== null && (
        <div className="rounded-lg border border-border p-2">
          {results.length === 0 ? (
            <p className="text-xs text-graphite">
              Nothing in the catalogue matches that.
            </p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {results.map((r) => {
                const already = chosen.includes(r.slug);
                return (
                  <li key={r.slug}>
                    <button
                      type="button"
                      disabled={already}
                      onClick={() => add(r.slug)}
                      className="flex w-full items-center gap-2 rounded p-1 text-start hover:bg-muted disabled:opacity-50"
                    >
                      {r.image ? (
                        <span className="relative size-10 shrink-0 overflow-hidden rounded">
                          <Image
                            src={r.image}
                            alt=""
                            fill
                            sizes="40px"
                            unoptimized={!isOptimizableImageSrc(r.image)}
                            className="object-cover"
                          />
                        </span>
                      ) : (
                        <span className="size-10 shrink-0 rounded bg-muted" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-small text-foreground">
                          {r.title}
                        </span>
                        <span className="block truncate font-mono text-12 text-graphite">
                          {r.published ? r.slug : `${r.slug} · not published`}
                        </span>
                      </span>
                      {already && (
                        <span className="text-12 text-graphite">added</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
