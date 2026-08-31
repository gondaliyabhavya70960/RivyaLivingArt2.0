import type { Metadata } from "next";
import Link from "next/link";
import {
  CircleAlert,
  CircleCheck,
  ExternalLink,
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
import { SheetFillPolicy } from "@/components/studio/sheet-fill-policy";
import { StudioTableHead } from "@/components/studio/studio-table-head";

export const metadata: Metadata = { title: "Sheet Import" };

/** The owner's source spreadsheet (four tier tabs, fetched by Actions). */
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1f4_cl3-8JrYIFTPNhSsuMEl8GAET1n61L9ZZKL8npa8/edit";

const TIER_META: Record<
  number,
  { tab: string; label: string; target: string }
> = {
  1: { tab: "Tier1_Owner", label: "Tier 1 — Owner", target: "all rows" },
  2: { tab: "Tier2_ResinGoods", label: "Tier 2 — Resin goods", target: "top 1,000" },
  3: { tab: "Tier3_Supplies", label: "Tier 3 — Supplies", target: "top 2,500" },
  4: { tab: "Tier4_3DPrint", label: "Tier 4 — 3D printing", target: "top 500" },
};

type RunTierStats = {
  tier: number;
  detected: number;
  selected: number;
  created: number;
  updated: number;
  unchanged: number;
  failed: number;
  demoted: number;
};

const dateFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default async function SheetImportPage() {
  const [settings, importRuns] = await Promise.all([
    db.siteSettings.findUnique({
      where: { id: "main" },
      select: {
        sheetFillEnabled: true,
        sheetFillOnDeploy: true,
        sheetFillMaxCreates: true,
      },
    }),
    db.importRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 8,
    }),
  ]);

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
    totals?: { created: number; updated: number; skipped: number; failed: number };
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
    { label: "Published from sheet", value: totalPublished, icon: CircleCheck },
    { label: "Held as drafts", value: totalDrafts, icon: Layers },
    { label: "Published without images", value: [...noImage.values()].reduce((a, b) => a + b, 0), icon: ImageOff },
    { label: "Out of stock (published)", value: outOfStock, icon: PackageX },
  ];

  return (
    <div>
      <PageHeader
        title="Sheet Import"
        description="The four-tier product import from the owner spreadsheet — live catalog state, the last run, and how the pipeline moves data."
        actions={
          <Button asChild variant="outline">
            <a href={SHEET_URL} target="_blank" rel="noopener noreferrer">
              Open source sheet <ExternalLink />
            </a>
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <SheetFillPolicy
          enabled={settings?.sheetFillEnabled ?? true}
          onDeploy={settings?.sheetFillOnDeploy ?? true}
          maxCreates={settings?.sheetFillMaxCreates ?? null}
        />

        {/* What the fills actually did. Before this the only record was a
            build log, which nobody keeps. */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
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
                  className="flex items-baseline justify-between gap-3 border-b border-border pb-2 last:border-0"
                >
                  <span className="text-muted-foreground">
                    {dateFormatter.format(run.startedAt)}
                    <span className="ms-2 text-xs uppercase">{run.trigger}</span>
                  </span>
                  {run.abortedReason ? (
                    <span className="text-end text-xs text-alert">
                      {run.abortedReason}
                    </span>
                  ) : (
                    <span className="shrink-0 tabular-nums">
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
            className="rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="flex items-center gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sand text-sapphire-ink">
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
            aria-label="Sheet rows"
            className="mt-6 overflow-x-auto rounded-2xl border border-border bg-card shadow-sm [contain:paint] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          >
        <table className="w-full text-sm">
          <thead>
            <StudioTableHead>
              <th className="py-3 pl-4 pr-4 font-medium">Tier tab</th>
              <th className="py-3 pr-4 font-medium">Import target</th>
              <th className="py-3 pr-4 text-right font-medium">Detected</th>
              <th className="py-3 pr-4 text-right font-medium">Published</th>
              <th className="py-3 pr-4 text-right font-medium">Drafts</th>
              <th className="py-3 pr-4 text-right font-medium">No images</th>
              <th className="py-3 pr-4 text-right font-medium">Last run</th>
            </StudioTableHead>
          </thead>
          <tbody>
            {[1, 2, 3, 4].map((tier) => {
              const meta = TIER_META[tier];
              const run = runByTier.get(tier);
              return (
                <tr
                  key={tier}
                  className="border-b border-border last:border-0"
                >
                  <td className="py-3 pl-4 pr-4">
                    <Link
                      href={`/studio/products?tier=${tier}`}
                      className="font-medium text-foreground hover:text-sapphire-ink"
                    >
                      {meta.label}
                    </Link>
                    <p className="text-xs text-muted-foreground">{meta.tab}</p>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {meta.target}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                    {run ? run.detected.toLocaleString("en-IN") : "—"}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {(published.get(tier) ?? 0).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums text-muted-foreground">
                    {(drafts.get(tier) ?? 0).toLocaleString("en-IN")}
                  </td>
                  <td className="py-3 pr-4 text-right tabular-nums">
                    {(noImage.get(tier) ?? 0) > 0 ? (
                      <Badge variant="outline" className="border-warning/40 text-warning">{noImage.get(tier)}</Badge>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
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
                <dd className="tabular-nums">
                  {runMeta.totals?.failed ?? 0}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">
              No import run has been recorded yet — summaries appear here after
              the next deploy-time import.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <CircleAlert className="size-4 text-sapphire-ink" aria-hidden />
            <h2 className="font-display text-lg text-foreground">
              How the pipeline works
            </h2>
          </div>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>
              A GitHub Actions workflow re-fetches the four tier tabs from the
              source sheet every two hours and commits them when anything
              changed.
            </li>
            <li>
              The next deploy imports the tabs: Tier 1 in full, Tiers 2–4 as
              the sheet-ordered top 1,000 / 2,500 / 500. Unchanged rows are
              skipped; rows that fall out of the selection move to draft —
              nothing is deleted.
            </li>
            <li>
              Imported fields (title, description, prices, images, category,
              availability) refresh from the sheet whenever a row changes;
              edit the sheet, not the product, for those fields.
            </li>
          </ol>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <Globe className="size-4 text-sapphire-ink" aria-hidden />
            <h2 className="font-display text-lg text-foreground">
              External imagery
            </h2>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Catalog images still served from scraped source hosts. A nightly
            job copies them to our own storage in batches; each batch resumes
            where the last one stopped, and failures keep their original URL.
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
