import { SITE } from "@/lib/constants";

/**
 * Builds a wa.me deep link. Number is international format with no "+",
 * spaces, or dashes; exactly one ?text= parameter (encodeURIComponent
 * turns newlines into %0A). `number` lets callers pass the studio-configured
 * WhatsApp number (ENG-001) instead of the SITE constant.
 */
export function buildWaLink(message?: string, number?: string): string {
  // Enforce the format the docstring promises rather than trusting the caller.
  // `number` is usually the studio-configured value, which an owner types by
  // hand — the live site was serving `wa.me/+917096036250` because Site
  // Settings holds the number with its leading `+`. wa.me documents a bare
  // international number, and a stored space or dash would break the URL
  // outright rather than merely being non-canonical. `email.ts` already
  // sanitises the customer's number this way for the studio's reply link.
  const configured = (number ?? "").replace(/\D/g, "");
  const num = configured || SITE.whatsappNumber;
  const base = `https://wa.me/${num}`;
  if (!message) return base;
  return `${base}?text=${encodeURIComponent(message)}`;
}

/** The English greeting — the operator's lingua franca and the en catalog value. */
const EN_GREETING =
  "Hello Rivya Living Art, I'd like to know more about your custom resin art.";

/**
 * Default greeting used by the floating WhatsApp button and page CTAs.
 * Pass the visitor's localized greeting (from the `WhatsApp.greeting` message
 * key) to send it in their language; a non-English greeting also carries the
 * English line in parentheses so the operator can always read the intent
 * (locale-aware funnel, English fallback for the studio).
 */
export function defaultWaGreeting(localizedGreeting?: string): string {
  const lines = [localizedGreeting || EN_GREETING];
  if (localizedGreeting && localizedGreeting !== EN_GREETING) {
    lines.push(`(${EN_GREETING})`);
  }
  lines.push(`(Sent from ${SITE.url.replace(/^https?:\/\//, "")})`);
  return lines.join("\n");
}

/** Structure labels for the order message. `sentFrom` keeps a `{host}` slot. */
export type OrderMessageLabels = {
  intro: string;
  product: string;
  budget: string;
  timeline: string;
  referenceImages: string;
  notes: string;
  customerDetails: string;
  name: string;
  phone: string;
  email: string;
  sentFrom: string;
};

/** English labels — the operator-readable baseline and the en-locale set. */
export const ENGLISH_ORDER_LABELS: OrderMessageLabels = {
  intro: "Hello Rivya Living Art,\nI would like to order:",
  product: "Product",
  budget: "Budget",
  timeline: "Timeline",
  referenceImages: "Reference Images",
  notes: "Additional Notes",
  customerDetails: "Customer Details",
  name: "Name",
  phone: "Phone",
  email: "Email",
  sentFrom: "Sent from {host}",
};

/**
 * Compose the labels for a visitor's locale from a `WhatsApp`-namespace
 * translator (client `useTranslations` or server `getTranslations` — both
 * have the `(key) => string` shape). Non-English labels render bilingually
 * ("उत्पाद / Product") so the customer reads their language while the studio
 * operator can always parse the structure — the master-brief "message body in
 * the customer's language + English fallback for the operator".
 */
/**
 * Compose one bilingual "localized / English" label (identical strings
 * collapse to English). Also used for data-driven selection labels like the
 * custom-commission Material/Occasion rows (I18N-902).
 */
export function bilingualLabel(localized: string, english: string): string {
  return localized === english ? english : `${localized} / ${english}`;
}

export function localizedOrderLabels(
  lookup: (key: string) => string,
  locale: string,
): OrderMessageLabels {
  if (locale === "en") return ENGLISH_ORDER_LABELS;
  const bi = (key: keyof OrderMessageLabels): string =>
    bilingualLabel(lookup(key), ENGLISH_ORDER_LABELS[key]);
  return {
    // Intro + provenance stay single-language (the bilingual labels carry the
    // operator's structure); a bilingual greeting would double the header.
    intro: lookup("intro"),
    sentFrom: lookup("sentFrom"),
    product: bi("product"),
    budget: bi("budget"),
    timeline: bi("timeline"),
    referenceImages: bi("referenceImages"),
    notes: bi("notes"),
    customerDetails: bi("customerDetails"),
    name: bi("name"),
    phone: bi("phone"),
    email: bi("email"),
  };
}

export type OrderMessageInput = {
  productTitle?: string;
  selections: { label: string; value: string }[];
  referenceImageUrls: string[];
  notes?: string;
  customer: { name: string; phone: string; email?: string };
  budgetRange?: string;
  timeline?: string;
  siteHost?: string;
  /**
   * Human-readable reference ("#RR-1042") — assigned by the DB on insert, so
   * the server actions rebuild the message with it after creating the
   * Inquiry (E6 Phase 3). Client previews omit it. Rides in the provenance
   * line, so no per-locale label is needed ("#" is script-neutral).
   */
  inquiryNumber?: string;
};

/** The customer-facing reference for an Inquiry row's `number`. */
export function formatInquiryNumber(number: number): string {
  return `#RR-${number}`;
}

/**
 * Keep the WhatsApp text comfortably inside what wa.me links handle across
 * devices. Past this we truncate ONLY the notes — reference URLs and the
 * structured lines must always survive intact.
 */
const MAX_ORDER_MESSAGE_CHARS = 1500;

/**
 * The wa.me deep link carries the message via encodeURIComponent, where each
 * Devanagari/Gujarati/Arabic/CJK code point expands to ~9 encoded bytes — a
 * 1500-char Hindi message would be a ~13 KB URL, past what some Android
 * in-app browsers accept. So the ENCODED length is budgeted too (I18N-904);
 * Latin messages never hit this cap before the char cap.
 */
const MAX_ORDER_MESSAGE_ENCODED = 7000;

const fitsCaps = (msg: string): boolean =>
  msg.length <= MAX_ORDER_MESSAGE_CHARS &&
  encodeURIComponent(msg).length <= MAX_ORDER_MESSAGE_ENCODED;

/**
 * The canonical WhatsApp order text. Pure function — safe to import from
 * client components for the live order-summary preview; the server action
 * rebuilds it authoritatively before persisting. Pass `labels` (from
 * `localizedOrderLabels`) to emit the visitor's language; defaults to English.
 */
export function buildOrderMessage(
  input: OrderMessageInput,
  labels: OrderMessageLabels = ENGLISH_ORDER_LABELS,
): string {
  const host = input.siteHost || SITE.url.replace(/^https?:\/\//, "");

  const assemble = (notes: string | undefined): string => {
    let msg = `${labels.intro}\n`;
    if (input.productTitle)
      msg += `*${labels.product}:* ${input.productTitle}\n`;
    for (const { label, value } of input.selections) {
      msg += `*${label}:* ${value}\n`;
    }
    if (input.budgetRange) msg += `*${labels.budget}:* ${input.budgetRange}\n`;
    if (input.timeline) msg += `*${labels.timeline}:* ${input.timeline}\n`;
    if (input.referenceImageUrls.length > 0) {
      msg += `*${labels.referenceImages}:*\n${input.referenceImageUrls.join("\n")}\n`;
    }
    if (notes) msg += `*${labels.notes}:* ${notes}\n`;
    msg += `*${labels.customerDetails}:*\n${labels.name}: ${input.customer.name}\n${labels.phone}: ${input.customer.phone}\n`;
    if (input.customer.email)
      msg += `${labels.email}: ${input.customer.email}\n`;
    const provenance = labels.sentFrom.replace("{host}", host);
    msg += input.inquiryNumber
      ? `(${input.inquiryNumber} · ${provenance})`
      : `(${provenance})`;
    return msg;
  };

  const full = assemble(input.notes);
  if (fitsCaps(full)) return full;

  // Over budget: notes are the only elastic portion. Binary-search the
  // largest notes prefix whose assembled message fits BOTH caps (character
  // count and encoded length — the latter is what actually constrains
  // non-Latin scripts, I18N-904).
  if (input.notes) {
    let lo = 0;
    let hi = input.notes.length;
    let best = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const candidate = assemble(`${input.notes.slice(0, mid).trimEnd()}…`);
      if (fitsCaps(candidate)) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (best > 0) return assemble(`${input.notes.slice(0, best).trimEnd()}…`);
  }

  // Still over even without notes (e.g. many long reference URLs). The
  // URLs are the studio's source of truth — never drop them; wa.me still
  // encodes fine, just longer than ideal.
  return assemble(undefined);
}

/**
 * Mark a WhatsApp order message as a Content Lab demo order (batch G).
 *
 * Demo products are a seeded fixture, never a real catalogue item — the "no
 * invented products" hard rule means a demo product's order button must
 * still work (a dead button on a live card is worse), but the message it
 * sends has to say so up front, for both the customer's own record and the
 * studio operator reading the inbox. Applied once, on the final message, so
 * it survives the inquiry-number rebuild in `submitProductOrder` too.
 */
export function withDemoPrefix(message: string, isDemo: boolean): string {
  return isDemo ? `[DEMO] ${message}` : message;
}
