import type { Metadata } from "next";

import { requireStaffPage } from "@/actions/helpers";
import { db } from "@/lib/db";
import { demoStatus } from "@/lib/demo/apply";
import { describeDemoHost } from "@/lib/demo/guard";
import { Role } from "@/generated/prisma/enums";
import { PageHeader } from "@/components/studio/page-header";
import { FormSection } from "@/components/studio/form-section";
import { Badge } from "@/components/ui/badge";
import { CountsTable } from "@/components/studio/content-lab/counts-table";
import { ActionsPanel } from "@/components/studio/content-lab/actions-panel";
import { PublicToggle } from "@/components/studio/content-lab/public-toggle";

export const metadata: Metadata = { title: "Content Lab" };

const timeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * Content Lab (`/studio/content-lab`) — the owner's control panel for the
 * demo fixtures that let every page render with content before the real
 * catalogue, journal, portfolio and testimonials exist. §15 of the plan:
 * demo rows live "in the database, in the Studio and on the website" —
 * always marked, never in the sitemap, and public only when the switch below
 * says so (default off in production; off the production database the
 * fixtures are always visible, since there is nothing real for them to
 * crowd out).
 */
export default async function ContentLabPage() {
  await requireStaffPage([Role.ADMIN]);

  const [status, settings] = await Promise.all([
    demoStatus(db),
    db.siteSettings.findUnique({
      where: { id: "main" },
      select: { demoContentPublic: true },
    }),
  ]);
  const host = describeDemoHost(process.env.DATABASE_URL);

  return (
    <div>
      <PageHeader
        eyebrow="THE FIXTURES"
        title="Content Lab"
        description="Sample products, journal posts, case studies, testimonials and more — seeded so every page and Studio screen has something to render before the real catalogue does."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-6">
          <FormSection title="Database">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Host</dt>
                <dd className="u-num text-end text-foreground">{host.host}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">
                  Allow-listed for demo writes
                </dt>
                <dd>
                  <Badge variant={host.allowed ? "success" : "warning"}>
                    {host.allowed ? "Yes" : "No"}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Looks like production</dt>
                <dd>
                  <Badge variant={host.production ? "alert" : "success"}>
                    {host.production ? "Yes" : "No"}
                  </Badge>
                </dd>
              </div>
            </dl>
          </FormSection>

          <FormSection
            title="Write fixtures"
            description="Seed loads every fixture (idempotent — safe to run again). Remove deletes every demo row and nothing else."
          >
            <ActionsPanel canWrite={host.allowed} />
            <dl className="mt-2 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Last seeded</dt>
                <dd className="text-end text-foreground">
                  {status.lastSeed
                    ? `${timeFormatter.format(new Date(status.lastSeed.at))}${status.lastSeed.who ? ` · ${status.lastSeed.who}` : ""}`
                    : "Never"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Last removed</dt>
                <dd className="text-end text-foreground">
                  {status.lastRemove
                    ? `${timeFormatter.format(new Date(status.lastRemove.at))}${status.lastRemove.who ? ` · ${status.lastRemove.who}` : ""}`
                    : "Never"}
                </dd>
              </div>
            </dl>
          </FormSection>

          <FormSection
            title="Public visibility"
            description="Off the production database, demo content always renders — this switch only decides whether it also renders in production."
          >
            <PublicToggle initial={settings?.demoContentPublic ?? false} />
          </FormSection>
        </div>

        <FormSection
          title="Rows by table"
          description="Every row seeded by Content Lab carries isDemo: true — this is that count, table by table."
        >
          <CountsTable counts={status.counts} />
        </FormSection>
      </div>
    </div>
  );
}
