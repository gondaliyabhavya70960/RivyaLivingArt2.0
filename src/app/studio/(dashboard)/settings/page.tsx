import type { Metadata } from "next";

import { requireStaffPage } from "@/actions/helpers";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/studio/page-header";
import { SettingsForm } from "@/components/studio/settings/settings-form";
import { toSiteSettingsValues } from "@/components/studio/settings/site-settings-values";
import { Role } from "@/generated/prisma/enums";

export const metadata: Metadata = { title: "Site Settings" };

export default async function SettingsPage() {
  // Settings are ADMIN-only (DESIGN.md C: "editor never sees Settings").
  await requireStaffPage([Role.ADMIN]);

  const settings = await db.siteSettings.findUnique({
    where: { id: "main" },
  });

  return (
    <div>
      <PageHeader
        title="Site Settings"
        description="Brand, contact and storefront-wide details — every public page reads from here."
      />
      <SettingsForm settings={toSiteSettingsValues(settings)} />
    </div>
  );
}
