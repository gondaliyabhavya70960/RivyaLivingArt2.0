import { OCCASIONS } from "@/components/studio/products/occasions";

/**
 * The commission form's four dropdowns, as data.
 *
 * These lists used to be `as const` string arrays inside
 * `custom-order-form.tsx`. That made them two problems at once:
 *
 * 1. **Business configuration behind a deploy.** Adding a "₹50,000–₹1,00,000"
 *    band, or a new material the studio started offering, meant a code change.
 * 2. **A live i18n bug.** The render sites mapped `value → { value, label:
 *    value }` verbatim, so a French visitor read "Under ₹2,000" and "Not sure
 *    — advise me" in English, inside a form whose labels, placeholders and
 *    hints all went through next-intl.
 *
 * Both are fixed by moving the lists into `FormOption` rows — with the bundled
 * arrays below kept as the seed and as the fallback, so the form still renders
 * its shipped choices when the table is empty or the database is unreachable.
 * Same contract as the image slots and the copy catalogue: defaults live in
 * git, the database only ever holds what the owner changed.
 *
 * Plain module, no server imports: read by the RSC page, the studio screen and
 * the seed alike.
 */

export const FORM_OPTION_LISTS = [
  "MATERIAL",
  "OCCASION",
  "BUDGET",
  "TIMELINE",
] as const;

export type FormOptionListKey = (typeof FORM_OPTION_LISTS)[number];

/** One choice in a dropdown, resolved for a locale. */
export type FormOptionChoice = {
  /**
   * What gets stored on the Inquiry and sent to WhatsApp. Minted once and
   * immutable — renaming a band must not rewrite what a past customer asked
   * for, and the WhatsApp message keeps carrying the canonical English so the
   * studio reads one vocabulary across nine locales.
   */
  value: string;
  /** What the customer reads, in their language. */
  label: string;
};

export type FormOptionSet = Record<FormOptionListKey, FormOptionChoice[]>;

/**
 * The shipped defaults, verbatim from the component they replaced.
 *
 * Values must stay byte-identical to the strings the form used to submit:
 * every existing `Inquiry` row holds one of these, and the seed matches on
 * value, so changing a character here would orphan history and duplicate rows.
 */
export const FORM_OPTION_DEFAULTS: Record<
  FormOptionListKey,
  readonly string[]
> = {
  MATERIAL: [
    "Epoxy resin",
    "Resin + wood",
    "Jesmonite",
    "3D printed",
    "Not sure — advise me",
  ],
  /**
   * Seeded from the product taxonomy so the two start in step — but they are
   * independent from then on, and deliberately so. `OCCASIONS` answers "what
   * occasions is this product suited to", a catalogue facet used by the
   * product form and its upsert check. This list answers "what is this
   * commission for", which is free text on an Inquiry and never validated
   * against the catalogue. Editing one does not and should not move the
   * other.
   */
  OCCASION: [...OCCASIONS, "Other"],
  BUDGET: [
    "Under ₹2,000",
    "₹2,000–₹5,000",
    "₹5,000–₹15,000",
    "₹15,000–₹50,000",
    "Above ₹50,000",
    "Flexible",
  ],
  TIMELINE: [
    "No rush",
    "Within 2 weeks",
    "Within a month",
    "A specific date (mention in notes)",
  ],
};

/** The bundled lists as choices — English label equals the canonical value. */
export const FORM_OPTION_FALLBACK: FormOptionSet = Object.fromEntries(
  FORM_OPTION_LISTS.map((list) => [
    list,
    FORM_OPTION_DEFAULTS[list].map((value) => ({ value, label: value })),
  ]),
) as FormOptionSet;

export function isFormOptionList(value: string): value is FormOptionListKey {
  return (FORM_OPTION_LISTS as readonly string[]).includes(value);
}

/** What the owner is editing, in their words — the studio screen's tab names. */
export const FORM_OPTION_LABELS: Record<
  FormOptionListKey,
  { title: string; where: string }
> = {
  MATERIAL: {
    title: "Material",
    where: "What the piece should be made of",
  },
  OCCASION: {
    title: "Occasion",
    where: "What the commission is for",
  },
  BUDGET: {
    title: "Budget",
    where: "The band the customer is comfortable with",
  },
  TIMELINE: {
    title: "Timeline",
    where: "When they need it by",
  },
};

/**
 * Resolve a stored label blob for one locale.
 *
 * Falls back to the canonical value, which is the English text the form
 * shipped with — so an untranslated option reads as English rather than as
 * nothing, and a brand-new option is usable the moment it is added.
 */
export function resolveOptionLabel(
  label: unknown,
  locale: string,
  value: string,
): string {
  if (label && typeof label === "object" && !Array.isArray(label)) {
    const map = label as Record<string, unknown>;
    const exact = map[locale];
    if (typeof exact === "string" && exact.trim()) return exact.trim();
    const english = map.en;
    if (typeof english === "string" && english.trim()) return english.trim();
  }
  return value;
}
