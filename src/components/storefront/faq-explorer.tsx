"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageCircle } from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/storefront/accordion";
import { Button } from "@/components/storefront/button";
import { EmptyState } from "@/components/storefront/empty-state";
import { TextField } from "@/components/storefront/form-field";
import { cn } from "@/lib/utils";

/**
 * The FAQ's two-column reading surface — REDESIGN.md §11.6:
 *
 * > "Large heading · search field · category filters · accordion list.
 * > Desktop two-column: categories left (sticky, scroll-spied), questions
 * > right. Mobile: single-column accordions. Every answer deep-linkable by
 * > hash with a copy-link affordance — operationally useful for WhatsApp
 * > replies."
 *
 * ## The left column is a question index, not categories
 *
 * `Faq` has four columns: `question`, `answer`, `order`, `translations`.
 * There is no category — and adding one is a data-model change, which the
 * build contract (§1) forbids this pass from making. Rather than hard-code a
 * topic per row (which invents an association the owner never authored, and
 * silently mis-files the seventh question the day it is written), the sticky
 * left rail indexes the real rows and scroll-spies them. It does the job §11.6
 * wanted from the category column — orientation in a long list, and a jump
 * to any answer — from data that actually exists. The search field below is
 * the filter.
 *
 * ## The search is client-side on purpose
 *
 * `/faq` is one query returning every published row, so filtering in the
 * browser is instant and adds no URL surface — the contract also forbids new
 * query semantics on an existing route. Deep links therefore stay pure
 * fragments, which is exactly what the copy-link affordance produces.
 *
 * ## Deep links use the row id
 *
 * `#cmt4l3v…` is uglier than a slug and it is the right choice: it survives
 * the owner rewording a question, and a link pasted into a saved WhatsApp
 * reply has to keep working after an edit. The `Accordion` root takes
 * `deepLink`, each item takes `copyLink`.
 */

export type FaqEntry = {
  id: string;
  question: string;
  answer: string;
};

export type FaqExplorerLabels = {
  searchLabel: string;
  searchPlaceholder: string;
  indexHeading: string;
  indexLabel: string;
  answersLabel: string;
  /**
   * The result line for every possible match count, indexed by count —
   * `["No matches", "1 question", "2 questions", …]`. An array rather than a
   * formatter function because a Server Component cannot hand a function to a
   * Client Component, and the plural rules belong to next-intl on the server
   * rather than to a second formatting path in the browser.
   */
  resultCounts: string[];
  noMatchStatement: string;
  noMatchDirection: string;
  copyAnswerLink: string;
  answerLinkCopied: string;
  askOnWhatsApp: string;
  openInNewTab: string;
};

/** Case- and accent-insensitive enough for a six-row list in nine locales. */
function normalize(value: string): string {
  return value.toLowerCase().normalize("NFKD");
}

export function FaqExplorer({
  entries,
  labels,
  whatsappHref,
  className,
}: {
  entries: FaqEntry[];
  labels: FaqExplorerLabels;
  whatsappHref: string;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const matches = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return entries;
    return entries.filter(
      (entry) =>
        normalize(entry.question).includes(needle) ||
        normalize(entry.answer).includes(needle),
    );
  }, [entries, query]);

  /* The visible id list as one dependency value: the spy re-arms when the
     search filters the list, and nothing is written to a ref during render. */
  const idsKey = matches.map((entry) => entry.id).join("|");

  useEffect(() => {
    const ids = idsKey ? idsKey.split("|") : [];
    let frame = 0;

    const measure = () => {
      frame = 0;
      // The reading line: 30% down the viewport. The last row above it is
      // the one being read — monotonic, unlike "is visible", which flickers
      // whenever two short rows share the screen.
      const line = window.innerHeight * 0.3;
      let current: string | null = null;
      for (const id of ids) {
        const node = document.getElementById(id);
        if (!node) continue;
        if (node.getBoundingClientRect().top <= line) current = id;
        else break;
      }
      setActiveId(current);
    };

    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    // The first measurement rides the same rAF as every later one, so no
    // state is written synchronously from this effect body.
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [idsKey]);

  return (
    <div
      data-slot="sf-faq-explorer"
      className={cn("grid gap-12 lg:grid-cols-12 lg:gap-x-16", className)}
    >
      {/* ——— The sticky, scroll-spied index. Desktop only: on mobile the
          accordions ARE the index (§11.6, Part 13). ——— */}
      <nav
        aria-label={labels.indexLabel}
        className="hidden lg:col-span-3 lg:block lg:self-start lg:sticky lg:top-28"
      >
        <p className="u-micro border-t border-hairline pt-4">
          {labels.indexHeading}
        </p>
        <ol className="mt-3 flex flex-col">
          {matches.map((entry) => {
            const active = entry.id === activeId;
            return (
              <li key={entry.id}>
                <a
                  href={`#${entry.id}`}
                  aria-current={active ? "location" : undefined}
                  className={cn(
                    "flex min-h-11 items-start gap-3 py-2 font-body text-14 leading-snug",
                    "transition-colors duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none",
                    active ? "text-ink" : "text-graphite hover:text-sapphire-ink",
                  )}
                >
                  {/* A rule, not a fill — the site's one "you are here" mark. */}
                  <span
                    aria-hidden
                    className={cn(
                      "mt-2.5 block h-px w-4 shrink-0 transition-colors duration-(--dur-fast) ease-(--ease-settle) motion-reduce:transition-none",
                      active ? "bg-champagne" : "bg-hairline",
                    )}
                  />
                  <span className="min-w-0">{entry.question}</span>
                </a>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="flex flex-col gap-8 lg:col-span-8 lg:col-start-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
          <TextField
            type="search"
            label={labels.searchLabel}
            name="faq-search"
            placeholder={labels.searchPlaceholder}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoComplete="off"
            className="w-full sm:max-w-sm"
          />
          {/* Live count — mono, announced politely as the list re-filters. */}
          <p role="status" className="u-micro whitespace-nowrap sm:pb-4">
            {labels.resultCounts[matches.length] ?? ""}
          </p>
        </div>

        {matches.length > 0 ? (
          <>
            <h2 className="sr-only">{labels.answersLabel}</h2>
            {/* `deepLink` makes the URL fragment drive which answer is open;
                `copyLink` gives each row the affordance that produces it. */}
            <Accordion type="single" collapsible deepLink>
              {matches.map((entry) => (
                <AccordionItem
                  key={entry.id}
                  value={entry.id}
                  copyLink={{
                    label: labels.copyAnswerLink,
                    copiedLabel: labels.answerLinkCopied,
                  }}
                >
                  <AccordionTrigger>{entry.question}</AccordionTrigger>
                  <AccordionContent className="u-prose leading-relaxed whitespace-pre-line">
                    {entry.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </>
        ) : (
          /* Part 16 · conditionally rendered, never beside a populated list. */
          <EmptyState
            statement={labels.noMatchStatement}
            direction={labels.noMatchDirection}
            action={
              <Button variant="secondary" size="lg" asChild>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-wa-source="faq_no_match"
                >
                  <MessageCircle
                    aria-hidden
                    strokeWidth={1.5}
                    className="size-4"
                  />
                  {labels.askOnWhatsApp}
                  <span className="sr-only"> {labels.openInNewTab}</span>
                </a>
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
