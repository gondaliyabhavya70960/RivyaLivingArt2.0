import type { Metadata } from "next";

import { requireStaffPage } from "@/actions/helpers";
import { PageHeader } from "@/components/studio/page-header";
import {
  FormOptionsBoard,
  type FormOptionListRows,
} from "@/components/studio/forms/form-options-board";
import { Role } from "@/generated/prisma/enums";
import { defaultLocale, localeLabels, locales } from "@/i18n/config";
import {
  FORM_OPTION_DEFAULTS,
  FORM_OPTION_LABELS,
  FORM_OPTION_LISTS,
  isFormOptionList,
  resolveOptionLabel,
} from "@/lib/form-options";
import { readFormOptionsForStudio } from "@/lib/form-options-server";

export const metadata: Metadata = { title: "Commission Form" };

/**
 * Commission Form — the four dropdowns on /custom-order.
 *
 * These lists were English string literals in the form component until Phase C:
 * adding a budget band meant a deploy, and every choice rendered in English in
 * all nine languages inside a form whose labels were already translated.
 *
 * ADMIN-only, matching the actions. This is the page that takes the orders,
 * and a list edited badly is visible to every customer immediately.
 *
 * Reads rows directly rather than through `getFormOptions()`: that resolver is
 * cached for 24h for the storefront's benefit, and an editing screen must show
 * the row that was just written.
 */
export default async function FormsPage() {
  await requireStaffPage([Role.ADMIN]);

  const rows = await readFormOptionsForStudio();

  const lists: FormOptionListRows[] = FORM_OPTION_LISTS.map((list) => ({
    list,
    title: FORM_OPTION_LABELS[list].title,
    where: FORM_OPTION_LABELS[list].where,
    options: rows
      .filter((row) => isFormOptionList(row.list) && row.list === list)
      .map((row) => ({
        id: row.id,
        value: row.value,
        enabled: row.enabled,
        /** Per-locale labels, resolved so the board can show coverage. */
        labels: Object.fromEntries(
          locales.map((locale) => [
            locale,
            resolveOptionLabel(row.label, locale, row.value),
          ]),
        ),
        /** True where this locale has its own wording rather than English. */
        translated: Object.fromEntries(
          locales.map((locale) => [
            locale,
            Boolean(
              row.label &&
              typeof row.label === "object" &&
              !Array.isArray(row.label) &&
              typeof (row.label as Record<string, unknown>)[locale] ===
                "string",
            ),
          ]),
        ),
        bundled: (FORM_OPTION_DEFAULTS[list] as readonly string[]).includes(
          row.value,
        ),
      })),
  }));

  // Before the deploy seed has run — or on a fresh database — the table is
  // empty and the storefront is rendering the bundled arrays. Say so, rather
  // than showing four empty lists that look like a mistake.
  const seeded = rows.length > 0;

  return (
    <div>
      <PageHeader
        eyebrow="Storefront"
        title="Commission Form"
        description="The four dropdowns a customer picks from on the commission page. What they choose is stored on the enquiry and sent to WhatsApp."
      />
      <FormOptionsBoard
        lists={lists}
        locales={locales.map((code) => ({ code, label: localeLabels[code] }))}
        defaultLocale={defaultLocale}
        seeded={seeded}
      />
    </div>
  );
}
