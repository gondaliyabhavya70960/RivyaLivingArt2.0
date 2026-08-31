/**
 * Coerce a stored `translations` JSON blob (Prisma `Json?`, so it may be null,
 * `{}`, or a stray non-object) into the react-hook-form shape used by the studio
 * translation editor: `{ [locale]: { [field]: value } }`. A brand-new row has no
 * translations, so anything unexpected collapses to an empty object.
 *
 * Client-safe (no Prisma / server imports) — shared by every studio form that
 * embeds `<TranslationsSection />`.
 */
export function toTranslationsRecord(
  value: unknown,
): Record<string, Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, Record<string, unknown>> = {};
  for (const [locale, fields] of Object.entries(
    value as Record<string, unknown>,
  )) {
    if (fields && typeof fields === "object" && !Array.isArray(fields)) {
      out[locale] = { ...(fields as Record<string, unknown>) };
    }
  }
  return out;
}
