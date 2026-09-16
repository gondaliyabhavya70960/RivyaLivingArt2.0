import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState, PageHeader } from "@/components/studio/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { largeFormatPageData } from "@/lib/scraper/large-format-query";
import { SHORTLIST_STATE_LABELS } from "@/lib/scraper/shortlist";

export const metadata: Metadata = { title: "Large-format workspace" };

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/**
 * The large-format workspace (A9, plan §6 — Prompt 22): image-first cards
 * for the large-format pieces being actively benchmarked (shortlisted and
 * confirmed — human-gated, rule 8), each with its dimensions, its alias-
 * resolved material stack, its reference price, and the pieces that look
 * like it (B9). The reference board below is the funnel's INSPIRATION_ONLY
 * state rendered as the image wall it exists to be.
 */
export default async function LargeFormatWorkspacePage() {
  const data = await largeFormatPageData();

  return (
    <>
      <PageHeader
        title="Large-format workspace"
        description="The furniture end of the corpus, image-first: shortlisted and confirmed large-format pieces with dimensions, material stack, and their nearest neighbours. The reference board is your inspiration-only wall."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/studio/scraper">Scraper hub</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/studio/scraper/analytics">Analytics</Link>
            </Button>
          </div>
        }
      />

      <p className="mb-4 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {data.cards.length} in the workspace
        </span>{" "}
        from {data.considered} researched large-format product(s)
        {!data.embeddingsLive && (
          <> · neighbours appear after the first embeddings recompute</>
        )}
      </p>

      {data.cards.length === 0 ? (
        <EmptyState
          title="Nothing in the workspace yet"
          description="Shortlist large-format pieces in the review inbox — the workspace is where picked pieces get worked with, so nothing arrives here on its own."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.cards.map((card) => (
            <article
              key={card.researchProductId}
              className="overflow-hidden rounded-card border border-border bg-card"
            >
              {card.image ? (
                // Staged competitor imagery, hotlinked — research reference,
                // never catalog media. No next/image: these are remote URLs
                // we do not own or optimize.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.image}
                  alt={card.imageAlt}
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                  No image staged
                </div>
              )}
              <div className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <a
                      href={card.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-foreground hover:underline"
                    >
                      {card.title}
                    </a>
                    <p className="text-xs text-muted-foreground">
                      {card.sourceName}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {SHORTLIST_STATE_LABELS[card.state]}
                  </Badge>
                </div>

                <dl className="space-y-1 text-xs">
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-muted-foreground">
                      Dimensions
                    </dt>
                    <dd className="text-foreground">
                      {card.dimensions ?? "—"}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-muted-foreground">
                      Materials
                    </dt>
                    <dd className="flex flex-wrap gap-1">
                      {card.materials.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        card.materials.map((m) => (
                          <Badge key={m} variant="outline">
                            {m}
                          </Badge>
                        ))
                      )}
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-20 shrink-0 text-muted-foreground">
                      Reference
                    </dt>
                    <dd className="tabular-nums text-foreground">
                      {card.referencePriceMinor === null
                        ? "quote only"
                        : `₹${inr.format(card.referencePriceMinor / 100)}`}
                      <span className="ml-1 text-muted-foreground">
                        · {card.variantCount} variant(s)
                      </span>
                    </dd>
                  </div>
                </dl>

                {card.neighbours.length > 0 && (
                  <ul className="space-y-1 border-t border-border/60 pt-2">
                    {card.neighbours.map((n) => (
                      <li
                        key={n.researchProductId}
                        className="flex items-baseline justify-between gap-2 text-xs"
                      >
                        <span className="min-w-0 truncate text-muted-foreground">
                          {n.title}
                        </span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {(n.similarity * 100).toFixed(0)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <section className="mt-10 space-y-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Reference board
          </h2>
          <p className="text-sm text-muted-foreground">
            Pieces marked Inspiration only in the review inbox — kept as a
            mood board, never a benchmark row.
          </p>
        </div>
        {data.referenceBoard.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nothing pinned yet — mark a listing Inspiration only in the review
            inbox and it hangs here.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {data.referenceBoard.map((tile) => (
              <a
                key={tile.researchProductId}
                href={tile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group overflow-hidden rounded-card border border-border bg-card"
              >
                {tile.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={tile.image}
                    alt={tile.imageAlt}
                    className="aspect-square w-full object-cover transition-transform group-hover:scale-[1.02]"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                    No image
                  </div>
                )}
                <p className="truncate px-2 py-1.5 text-xs text-muted-foreground">
                  {tile.title}
                </p>
              </a>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
