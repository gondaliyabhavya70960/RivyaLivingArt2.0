import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Plus } from "lucide-react";

import { DuplicatePageButton } from "@/components/studio/custom-pages/duplicate-button";
import { DemoBadge } from "@/components/studio/demo-badge";
import { PageHeader } from "@/components/studio/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listCustomPagesForStudio } from "@/lib/custom-pages-server";
import { scheduleState } from "@/lib/custom-pages";

export const metadata: Metadata = { title: "Landing Pages" };

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

const STATE_LABEL = {
  draft: "Draft",
  scheduled: "Scheduled",
  live: "Live",
} as const;

/**
 * Landing pages — the campaign surface.
 *
 * Separate from /studio/pages on purpose. That screen edits the standing pages
 * the footer links to, one Tiptap document each. This one builds a page out of
 * blocks for a season that ends, and the two have almost nothing in common
 * beyond the word "page".
 */
export default async function CustomPagesPage({
  searchParams,
}: {
  searchParams: Promise<{ demo?: string }>;
}) {
  // `?demo=1` narrows to Content Lab fixtures — the switch every other studio
  // list carries; a server component, so it is a link rather than a button.
  const { demo } = await searchParams;
  const demoOnly = demo === "1";
  const allPages = await listCustomPagesForStudio();
  const pages = demoOnly ? allPages.filter((p) => p.isDemo) : allPages;
  const now = new Date();

  return (
    <div>
      <PageHeader
        eyebrow="Storefront"
        title="Landing Pages"
        description="Pages you build for a season or a campaign, at /p/… — assembled from a small set of blocks so they still read as part of the site."
        actions={
          <Button asChild>
            <Link href="/studio/custom-pages/new">
              <Plus /> New landing page
            </Link>
          </Button>
        }
      />

      {allPages.some((p) => p.isDemo) && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link
            href={demoOnly ? "/studio/custom-pages" : "/studio/custom-pages?demo=1"}
            aria-pressed={demoOnly}
            role="button"
            className={
              demoOnly
                ? "inline-flex min-h-11 items-center rounded-full border border-sapphire-ink bg-sapphire-ink/10 px-4 text-small font-medium text-sapphire-ink outline-none focus-visible:ring-2 focus-visible:ring-focus"
                : "inline-flex min-h-11 items-center rounded-full border border-border px-4 text-small text-graphite outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
            }
          >
            Demo only
          </Link>
        </div>
      )}

      {pages.length === 0 ? (
        <p className="py-12 text-small text-graphite">
          {demoOnly
            ? "No demo landing pages — seed the Content Lab to see the demo lander here."
            : "No landing pages yet. The first one takes about twenty minutes."}
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {pages.map((page) => {
            const state = scheduleState(page, now);
            return (
              <li
                key={page.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3"
              >
                <div className="min-w-0 flex-1 basis-64">
                  <Link
                    href={`/studio/custom-pages/${page.id}`}
                    className="text-small font-medium text-foreground hover:underline"
                  >
                    {page.title}
                  </Link>
                  {page.isDemo && (
                    <span className="ms-2">
                      <DemoBadge />
                    </span>
                  )}
                  <p className="font-mono text-12 text-graphite">
                    /p/{page.slug} · {page._count.blocks} block
                    {page._count.blocks === 1 ? "" : "s"} · edited{" "}
                    {dateFormatter.format(page.updatedAt)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <DuplicatePageButton id={page.id} title={page.title} />
                  {page.noindex && <Badge variant="outline">No search</Badge>}
                  <Badge
                    variant={state === "live" ? "default" : "secondary"}
                    title={
                      state === "scheduled" && page.publishAt
                        ? `Goes live ${dateFormatter.format(page.publishAt)}`
                        : undefined
                    }
                  >
                    {STATE_LABEL[state]}
                  </Badge>
                  {state === "live" && (
                    <Button asChild variant="ghost" size="sm">
                      <a
                        href={`/p/${page.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink aria-hidden className="size-4" />
                        <span className="sr-only">
                          Open /p/{page.slug} in a new tab
                        </span>
                      </a>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
