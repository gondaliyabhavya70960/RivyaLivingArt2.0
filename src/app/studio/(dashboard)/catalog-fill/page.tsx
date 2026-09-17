import type { Metadata } from "next";
import Link from "next/link";
import {
  CircleAlert,
  CircleCheck,
  Globe,
  ImageOff,
  Layers,
  PackageX,
  RefreshCw,
} from "lucide-react";
import { db } from "@/lib/db";
import {
  externalCatalogImageWhere,
  type CatalogMirrorCounts,
} from "@/lib/catalog-mirror";
import { mirrorNextCatalogBatch } from "@/actions/catalog-mirror";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/studio/page-header";
import {
  FillPreview,
  SizeTierSplit,
} from "@/components/studio/catalog-fill/fill-preview";
import { CatalogFillPolicy } from "@/components/studio/catalog-fill-policy";
import { StudioTableHead } from "@/components/studio/studio-table-head";
import {
  IMPORT_LIST_FILE,
  IMPORT_LISTS,
  importListLabel,
  type ImportList,
} from "@/lib/import-list";
import { importListStripHref } from "@/components/studio/products/product-filter-links";
import type { TierFillSizeTierTally } from "@/lib/import/tier-fill";

export const metadata: Metadata = { title: "Catalog fill" };

/**
 * Preview and Run now execute the whole fill — ~4,400 row reads across the
 * four lists against the production database. The default function budget is
 * for a page render, not for that; the review page and the cron routes that
 * do the same kind of work declare theirs too. (Until 2026-09-17 both
 * buttons read no file at all and returned in milliseconds, so the budget
 * never mattered — see ROOT in `tier-fill.ts`.)
 */
export const maxDuration = 300;

/**
 * The owner brief's import volume per list — the caps `tier-fill.ts` applies
 * (all · 1,000 · 2,500 · 500), as words. The list's name, label and file stem
 * come from `import-list.ts`, the one copy of that vocabulary.
 */
const LIST_TARGET: Record<ImportList, string> = {
  1: "all rows",
  2: "top 1,000",
  3: "top 2,500",
  4: "top 500",
};

/**
 * One list's entry in the stored `sheet-import` meta (`meta.tiers[stem]`) —
 * `TierFillTierSummary` as JSON. `tier` is the LIST number. `sizeTiers` is
 * optional HERE and only here: it was added on 2026-09-17, and every run
 * recorded before that carries no such key, so the table shows "—" for it
 * rather than a broken cell.
 */
type RunTierStats = {
  tier: number;
  detected: number;
  selected: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  demoted: number;
  sizeTiers?: TierFillSizeTierTally;
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function CatalogFillPage() {
  const [settings, importRuns] = await Promise.all([
    db.siteSettings.findUnique({
      where: { id: "main" },
      select: {
        catalogFillEnabled: true,
        catalogFillOnDeploy: true,
        catalogFillMaxCreates: true,
      },
    }),
    db.importRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 8,
    }),
  ]);

  const openConflicts = await db.importConflict.count({
    where: { status: "OPEN" },
  });

  const [
    byTierStatus,
    missingImages,
    outOfStock,
    lastRun,
    externalImages,
    mirroredImages,
    topHosts,
    lastMirror,
  ] = await Promise.all([
    db.product.groupBy({
      by: ["tier", "status"],
      where: { importSource: { startsWith: "sheet:" } },
      _count: { _all: true },
    }),
    db.product.groupBy({
      by: ["tier"],
      where: {
        importSource: { startsWith: "sheet:" },
        status: "PUBLISHED",
        images: { none: {} },
      },
      _count: { _all: true },
    }),
    db.product.count({
      where: {
        importSource: { startsWith: "sheet:" },
        status: "PUBLISHED",
        inStock: false,
      },
    }),
    db.activityLog.findFirst({
      where: { action: "sheet-import" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, meta: true },
    }),
    // External imagery visibility (audit C3 / M-A5) — same WHERE clause the
    // mirror pipeline batches on, so this count is exactly its backlog.
    db.productImage.count({ where: externalCatalogImageWhere }),
    db.productImage.count({
      where: {
        OR: [
          { url: { contains: ".public.blob.vercel-storage.com/catalog/" } },
          { url: { startsWith: "/uploads/catalog/" } },
        ],
      },
    }),
    db.$queryRaw<{ host: string | null; count: number }[]>`
      SELECT substring(pi.url from '^https?://([^/]+)') AS host,
             COUNT(*)::int AS count
      FROM "ProductImage" pi
      JOIN "Product" p ON p.id = pi."productId"
      WHERE p.status = 'PUBLISHED'
        AND pi.url LIKE 'http%'
        AND pi.url NOT LIKE '%.public.blob.vercel-storage.com%'
        AND pi.url NOT LIKE '%res.cloudinary.com%'
        AND pi.url NOT LIKE '%kanhakreation.com%'
      GROUP BY 1
      ORDER BY 2 DESC, 1 ASC
      LIMIT 5`,
    db.activityLog.findFirst({
      where: { action: "catalog-mirror" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, meta: true },
    }),
  ]);

  const published = new Map<number, number>();
  const drafts = new Map<number, number>();
  for (const row of byTierStatus) {
    if (row.tier == null) continue;
    const bucket = row.status === "PUBLISHED" ? published : drafts;
    bucket.set(row.tier, (bucket.get(row.tier) ?? 0) + row._count._all);
  }
  const noImage = new Map<number, number>(
    missingImages
      .filter((r) => r.tier != null)
      .map((r) => [r.tier as number, r._count._all]),
  );

  const totalPublished = [...published.values()].reduce((a, b) => a + b, 0);
  const totalDrafts = [...drafts.values()].reduce((a, b) => a + b, 0);

  const runMeta = (lastRun?.meta ?? {}) as {
    tiers?: Record<string, RunTierStats>;
    totals?: {
      created: number;
      updated: number;
      skipped: number;
      failed: number;
    };
  };
  const runByTier = new Map<number, RunTierStats>(
    Object.values(runMeta.tiers ?? {}).map((t) => [t.tier, t]),
  );

  const mirrorMeta = lastMirror
    ? (lastMirror.meta as Partial<CatalogMirrorCounts>)
    : null;
  const externalHosts = topHosts.filter(
    (h): h is { host: string; count: number } => h.host !== null,
  );

  const kpis = [
    {
      label: "Published from import",
      value: totalPublished,
      icon: CircleCheck,
    },
    { label: "Held as drafts", value: totalDrafts, icon: Layers },
    {
      label: "Published without images",
      value: [...noImage.values()].reduce((a, b) => a + b, 0),
      icon: ImageOff,
    },
    { label: "Out of stock (published)", value: outOfStock, icon: PackageX },
  ];

  return (
    <div>
      <PageHeader
        title="Catalog fill"
        description="The catalog fill from the four committed import lists in data/tiers/ — where a row came from, not what it is. Product tiers are filed by rule after a fill: Suggest tiers on the products screen shows the plan before it writes."
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/studio/catalog-fill/conflicts">
                Conflicts
                {openConflicts > 0 && (
                  <Badge variant="warning" className="ms-1.5">
                    {openConflicts}
                  </Badge>
                )}
              </Link>
            </Button>
          </>
        }
      />

      <div className="mb-6">
        <FillPreview />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <CatalogFillPolicy
          enabled={settings?.catalogFillEnabled ?? true}
          onDeploy={settings?.catalogFillOnDeploy ?? true}
          maxCreates={settings?.catalogFillMaxCreates ?? null}
        />

        {/* What the fills actually did. Before this the only record was a
            build log, which nobody keeps. */}
        <section className="rounded-card border border-border bg-card p-5 shadow-e1">
          <h2 className="font-medium text-foreground">Recent fills</h2>
          {importRuns.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              No fill has been recorded yet. The next deploy will add one.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {importRuns.map((run) => (
                <li
                  key={run.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border pb-2 last:border-0"
                >
                  <span className="text-muted-foreground">
                    {dateFormatter.format(run.startedAt)}
                    <span className="ms-2 text-xs uppercase">
                      {run.trigger}
                    </span>
                  </span>
                  {run.abortedReason ? (
                    <span className="text-end text-xs text-alert">
                      {run.abortedReason}
                    </span>
                  ) : (
                    <span className="ms-auto text-end tabular-nums">
                      +{run.created} new · {run.updated} updated ·{" "}
                      {run.unchanged} unchanged
                      {run.failed > 0 ? ` · ${run.failed} failed` : ""}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-card border border-border bg-card p-5 shadow-e1"
          >
            <div className="flex items-center gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-card bg-sand text-sapphire-ink">
                <Icon className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="font-display text-3xl text-foreground">
                  {value.toLocaleString("en-IN")}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {label}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div
        tabIndex={0}
        role="region"
        aria-label="Imported rows"
        className="mt-6 overflow-x-auto rounded-card border border-border bg-card shadow-e1 [contain:paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <table className="w-full text-sm">
          <thead>
            <StudioTableHead>
              <th className="py-3 pl-4 pr-4 font-medium">Import list</th>
              <th className="py-3 pr-4 font-medium">Import target</th>
              <th className="py-3 pr-4 text-right font-medium">Detected</th>
              <th className="py-3 pr-4 text-right font-medium">Published</th>
              <th className="py-3 pr-4 text-right font-medium">Drafts</th>
              <th className="py-3 pr-4 text-right font-medium">No images</th>
              <th className="py-3 pr-4 text-right font-medium">Last run</th>
              <th className="py-3 pr-4 text-right font-medium">
                Would file as
              </th>
            </StudioTableHead>
          </thead>
          <tbody>
            {IMPORT_LISTS.map((list) => {
              const run = runByTier.get(list);
              return (
                <tr key={list} className="border-b border-border last:border-0">
                  <td className="py-3 pl-4 pr-4">
                    <Link
                      href={importListStripHref(list)}
                      className="font-medium text-foreground hover:text-sapphire-ink"
                    >
                      {importListLabel(list)}
                    </Link>
                    <p className="font-mono text-xs text-muted-foreground">
                      data/tiers/{IMPORT_LIST_FILE[list]}.csv.gz
                    </p>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {LIST_TARGET[list]}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                    {run ? run.detected.toLocaleString("en-IN") : "—"}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {(published.get(list) ?? 0).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                    {(drafts.get(list) ?? 0).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {(noImage.get(list) ?? 0) > 0 ? (
                      <Badge variant="warning">{noImage.get(list)}</Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-right text-xs text-muted-foreground">
                    {run
                      ? `+${run.created} · ~${run.updated} · =${run.unchanged}` +
                        (run.failed > 0 ? ` · ✕${run.failed}` : "") +
                        (run.demoted > 0 ? ` · ↓${run.demoted}` : "")
                      : "no recorded run yet"}
                  </td>
                  <td className="py-3 pr-4 text-right text-xs text-muted-foreground">
                    {/* A run recorded before the tally existed shows a dash,
                        like Detected does before any run at all. */}
                    {run?.sizeTiers ? (
                      <SizeTierSplit tally={run.sizeTiers} />
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-card border border-border bg-card p-5 shadow-e1">
          <div className="flex items-center gap-3">
            <RefreshCw className="size-4 text-sapphire-ink" aria-hidden />
            <h2 className="font-display text-lg text-foreground">
              Last recorded run
            </h2>
          </div>
          {lastRun ? (
            <dl className="mt-3 space-y-1.5 text-sm text-muted-foreground">
              <div className="flex justify-between gap-4">
                <dt>When</dt>
                <dd className="text-foreground">
                  {dateFormatter.format(lastRun.createdAt)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Created</dt>
                <dd className="tabular-nums">{runMeta.totals?.created ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Updated</dt>
                <dd className="tabular-nums">{runMeta.totals?.updated ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Unchanged (skipped)</dt>
                <dd className="tabular-nums">{runMeta.totals?.skipped ?? 0}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>Failed</dt>
                <dd className="tabular-nums">{runMeta.totals?.failed ?? 0}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No import run has been recorded yet — summaries appear here after
              the next deploy-time import.
            </p>
          )}
        </div>

        <div className="rounded-card border border-border bg-card p-5 shadow-e1">
          <div className="flex items-center gap-3">
            <CircleAlert className="size-4 text-sapphire-ink" aria-hidden />
            <h2 className="font-display text-lg text-foreground">
              How the pipeline works
            </h2>
          </div>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>
              The four import lists are committed to the repository at{" "}
              <code className="font-mono text-xs">data/tiers/</code> —{" "}
              {IMPORT_LISTS.map((list, i) => (
                <span key={list}>
                  {i > 0 && ", "}
                  {importListLabel(list)} (
                  <code className="font-mono text-xs">
                    {IMPORT_LIST_FILE[list]}.csv.gz
                  </code>
                  )
                </span>
              ))}
              . They are the only copy: the spreadsheet they were exported from
              is no longer shared, and there is no workflow and no schedule.
              Refreshing a list means committing a new file.
            </li>
            <li>
              A fill — the next deploy with the switch on, or Run now above —
              imports them: List 1 in full, Lists 2–4 as the file-ordered top
              1,000 / 2,500 / 500. Unchanged rows are skipped; rows that fall
              out of the selection move to draft — nothing is deleted.
            </li>
            <li>
              Imported fields (title, description, prices, images, category,
              availability) refresh from the CSV whenever a row changes; change
              the CSV, not the product, for those fields.
            </li>
            <li>
              A list says where a row came from, never which product tier it is.
              After a fill, the deploy-time pass and the{" "}
              <Link
                href="/studio/products"
                className="font-medium text-foreground underline-offset-2 hover:text-sapphire-ink hover:underline"
              >
                Suggest tiers
              </Link>{" "}
              button on the products screen file untiered rows by rule — the
              category first, then the row&rsquo;s own words — and leave
              supplies untiered. &ldquo;Would file as&rdquo; above is that rule
              run over the last fill&rsquo;s rows.
            </li>
          </ol>
        </div>

        <div className="rounded-card border border-border bg-card p-5 shadow-e1">
          <div className="flex items-center gap-3">
            <Globe className="size-4 text-sapphire-ink" aria-hidden />
            <h2 className="font-display text-lg text-foreground">
              External imagery
            </h2>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Catalog images still served from scraped source hosts. A nightly job
            copies them to our own storage in batches; each batch resumes where
            the last one stopped, and failures keep their original URL.
          </p>
          <dl className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            <div className="flex justify-between gap-4">
              <dt>External images on published products</dt>
              <dd className="tabular-nums text-foreground">
                {externalImages.toLocaleString("en-IN")}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Mirrored to owned storage</dt>
              <dd className="tabular-nums text-foreground">
                {mirroredImages.toLocaleString("en-IN")}
              </dd>
            </div>
          </dl>
          {externalHosts.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-medium tracking-wide text-muted-foreground">
                Top external hosts
              </p>
              <ul className="mt-1.5 space-y-1 text-sm text-muted-foreground">
                {externalHosts.map((h) => (
                  <li key={h.host} className="flex justify-between gap-4">
                    <span className="min-w-0 truncate">{h.host}</span>
                    <span className="tabular-nums">
                      {h.count.toLocaleString("en-IN")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            {lastMirror && mirrorMeta
              ? `Last mirror run ${dateFormatter.format(lastMirror.createdAt)} — ` +
                `${mirrorMeta.mirrored ?? 0} mirrored, ${mirrorMeta.failed ?? 0} failed, ` +
                `${(mirrorMeta.remaining ?? 0).toLocaleString("en-IN")} remaining.`
              : "No mirror run recorded yet — the nightly job starts after the next deploy, or run a batch now."}
          </p>
          <form action={mirrorNextCatalogBatch} className="mt-4">
            <Button type="submit">Mirror next batch (200)</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
