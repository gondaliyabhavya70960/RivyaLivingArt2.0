"use server";

import { draftMode, headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { locales } from "@/i18n/config";
import { attributionJson, attributionSchema } from "@/lib/attribution-schema";
import { db } from "@/lib/db";
import { sendOrderNotification } from "@/lib/email";
import { canOrderProduct } from "@/lib/order-visibility";
import { clientIp, passesSpamChecks, rateLimit } from "@/lib/rate-limit";
import { getSiteSettings } from "@/lib/site-settings";
import { generateOpaqueToken } from "@/lib/tokens";
import {
  bilingualLabel,
  buildOrderMessage,
  buildWaLink,
  ENGLISH_ORDER_LABELS,
  formatInquiryNumber,
  localizedOrderLabels,
  withDemoPrefix,
  type OrderMessageLabels,
} from "@/lib/whatsapp";

// PUBLIC (unauthenticated) order actions — the business-critical path.
// Same abuse protection as src/actions/public.ts: honeypot + fill-time +
// per-IP rate limit, all failing with generic copy.

export type OrderActionResult =
  | {
      ok: true;
      data: { whatsappUrl: string; inquiryId: string; claimToken: string };
    }
  | { ok: false; error: string };

const GENERIC_ERROR =
  "Something went wrong — please try again or message us on WhatsApp.";

const RATE_LIMITED_ERROR =
  "You've placed a few orders in a row — please wait a little while, or reach us directly on WhatsApp.";

/**
 * Error copy in the visitor's language (backlog #6): the forms render these
 * strings directly, so a Hindi customer should not hit an English failure
 * message. English fast-paths the catalog load; any translation hiccup falls
 * back to the English constants — an error path must never throw.
 */
async function orderErrorText(
  locale: (typeof locales)[number] | undefined,
  key: "generic" | "rateLimited",
): Promise<string> {
  const en = key === "generic" ? GENERIC_ERROR : RATE_LIMITED_ERROR;
  if (!locale || locale === "en") return en;
  try {
    const t = await getTranslations({ locale, namespace: "OrderErrors" });
    return t(key);
  } catch {
    return en;
  }
}

/** "Please fill: X, Y" in the visitor's language (same fallback contract). */
async function missingFieldsText(
  locale: (typeof locales)[number] | undefined,
  fields: string[],
): Promise<string> {
  const en = `Please fill: ${fields.join(", ")}`;
  if (!locale || locale === "en") return en;
  try {
    const t = await getTranslations({ locale, namespace: "OrderErrors" });
    return t("missingFields", { fields: fields.join(", ") });
  } catch {
    return en;
  }
}

/** Best-effort locale from a raw (possibly unparsed) action input. */
function rawLocale(input: unknown): (typeof locales)[number] | undefined {
  const value =
    typeof input === "object" && input !== null
      ? (input as { locale?: unknown }).locale
      : undefined;
  return typeof value === "string"
    ? (locales as readonly string[]).includes(value)
      ? (value as (typeof locales)[number])
      : undefined
    : undefined;
}

const selectionSchema = z.object({
  label: z.string().trim().min(1).max(80),
  value: z.string().trim().min(1).max(300),
});

/**
 * Reference images come from OUR upload endpoint only: an https URL on the
 * Vercel Blob host in production, or a site-relative "/uploads/…" path from
 * the local driver. Restricting the host (SEC-010) stops an attacker from
 * persisting arbitrary URLs that staff would later open from the inbox.
 */
const referenceUrlSchema = z
  .string()
  .max(500)
  .refine((v) => {
    if (v.startsWith("/uploads/")) return true;
    try {
      const u = new URL(v);
      return (
        u.protocol === "https:" &&
        u.hostname.endsWith(".public.blob.vercel-storage.com")
      );
    } catch {
      return false;
    }
  }, "Invalid reference image URL");

const customerFields = {
  name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-() ]{8,17}$/),
  email: z.email().optional().or(z.literal("")),
  /** Honeypot — humans never see or fill this field. */
  honeypot: z.string(),
  /** Server-signed mount timestamp (S-06 — /api/form-token). */
  formToken: z.string().max(256),
  /** First-touch marketing attribution (optional). */
  attribution: attributionSchema,
  /**
   * The visitor's UI locale — drives the WhatsApp message language (customer
   * text + bilingual structure labels the operator can always read). Unknown
   * or missing values fall back to English.
   */
  locale: z.enum(locales).optional(),
};

/**
 * Resolve the structure labels for the visitor's locale. English short-circuits
 * (no catalog load); other locales read the `WhatsApp` message namespace via
 * `t.raw` (the labels are plain strings; `sentFrom` keeps its literal `{host}`
 * slot for `buildOrderMessage` to fill).
 */
async function orderLabelsFor(
  locale: (typeof locales)[number] | undefined,
): Promise<OrderMessageLabels> {
  if (!locale || locale === "en") return ENGLISH_ORDER_LABELS;
  const t = await getTranslations({ locale, namespace: "WhatsApp" });
  return localizedOrderLabels((key) => String(t.raw(key)), locale);
}

/**
 * Enquiry-framed intro for out-of-stock pieces (audit H2) — mirrors the
 * client panel's preview so what the customer saw is what WhatsApp receives.
 * Locales that haven't synced the `Product.oosWaIntro` key yet fall back to
 * the English catalog value — never a raw key path, never a thrown error.
 */
async function oosIntroFor(
  locale: (typeof locales)[number] | undefined,
): Promise<string> {
  if (locale && locale !== "en") {
    try {
      const t = await getTranslations({ locale, namespace: "Product" });
      if (t.has("oosWaIntro")) return t("oosWaIntro");
    } catch {
      // fall through to the English catalog
    }
  }
  const t = await getTranslations({ locale: "en", namespace: "Product" });
  return t("oosWaIntro");
}

/* ————————————————— product orders ————————————————— */

const productOrderSchema = z.object({
  // Not `z.cuid()`: catalogue rows are cuids, but the Content Lab's demo
  // pieces carry deterministic ids ("demo-product-001") and their order
  // flow must reach the same wa.me handoff (D7/D8 — the message is prefixed
  // "[DEMO] "). The id is looked up below; an unknown one is refused there.
  productId: z.string().trim().min(1).max(64),
  selections: z.array(selectionSchema).max(20),
  referenceImageUrls: z.array(referenceUrlSchema).max(5),
  notes: z.string().trim().max(1500).optional(),
  ...customerFields,
});

export type ProductOrderInput = z.input<typeof productOrderSchema>;

/** Product order form → Inquiry (source PRODUCT) + wa.me deep link. */
export async function submitProductOrder(
  input: ProductOrderInput,
): Promise<OrderActionResult> {
  try {
    const errLocale = rawLocale(input);
    const parsed = productOrderSchema.safeParse(input);
    if (!parsed.success)
      return { ok: false, error: await orderErrorText(errLocale, "generic") };
    const {
      productId,
      selections,
      referenceImageUrls,
      notes,
      name,
      phone,
      email,
      honeypot,
      formToken,
    } = parsed.data;

    if (!passesSpamChecks({ honeypot, formToken }).ok) {
      return { ok: false, error: await orderErrorText(errLocale, "generic") };
    }

    const limited = rateLimit(`order:${clientIp(await headers())}`, {
      limit: 6,
      windowMs: 600_000,
    });
    if (!limited.ok)
      return {
        ok: false,
        error: await orderErrorText(errLocale, "rateLimited"),
      };

    // DRAFT is allowed on purpose: staff place preview orders from the
    // draft-preview product page. That allowance is gated below on the
    // draft-mode cookie — it used to be gated on nothing at all.
    const product = await db.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        title: true,
        status: true,
        inStock: true,
        isDemo: true,
        customFields: {
          where: { required: true },
          select: { label: true },
        },
      },
    });
    if (!product)
      return { ok: false, error: await orderErrorText(errLocale, "generic") };

    // An unpublished product is orderable only inside staff draft preview
    // (SEC-201). The product page already refuses to render one to a visitor,
    // but the action is reachable directly — a Server Action is a POST
    // endpoint, and the id is a client-supplied field — so hiding the page
    // was never the control. Without this, anyone who learned a DRAFT
    // product's cuid could file an order against unreleased stock and get its
    // title back in the WhatsApp message.
    //
    // The failure is the SAME generic error a missing product returns, so the
    // action cannot be used to probe which ids exist.
    if (
      !canOrderProduct({
        status: product.status,
        previewEnabled: (await draftMode()).isEnabled,
      })
    ) {
      return { ok: false, error: await orderErrorText(errLocale, "generic") };
    }

    // Required-field enforcement: every required customization label must
    // be present with a non-empty value (schema already trims + min(1)).
    const provided = new Set(
      selections.map((s) => s.label.trim().toLowerCase()),
    );
    const missing = product.customFields
      .map((f) => f.label)
      .filter((label) => !provided.has(label.trim().toLowerCase()));
    if (missing.length > 0) {
      return { ok: false, error: await missingFieldsText(errLocale, missing) };
    }

    const { whatsappNumber } = await getSiteSettings();
    // Out of stock is NOT a rejection (audit H2): the enquiry is recorded
    // like any order — the studio wants the restock conversation — but the
    // message opens with the availability-enquiry framing (mirroring the
    // panel's live preview) so neither the customer nor the operator can
    // mistake it for a shippable order.
    const labels = await orderLabelsFor(parsed.data.locale);
    const messageLabels = product.inStock
      ? labels
      : { ...labels, intro: await oosIntroFor(parsed.data.locale) };
    const messageInput = {
      productTitle: product.title,
      selections,
      referenceImageUrls,
      notes,
      customer: { name, phone, email: email || undefined },
    };
    // Content Lab (batch G): a demo product's order button still has to
    // work — a dead button on a live card is worse than a marked one — but
    // both the saved row and the message the customer sends carry the mark,
    // so nobody mistakes a fixture for a real commission.
    const whatsappMessage = withDemoPrefix(
      buildOrderMessage(messageInput, messageLabels),
      product.isDemo,
    );

    // One-time claim token: only the submitter can re-read this inquiry's PII
    // from the public /whatsapp-order fallback (ENG-811). We store its hash.
    const { token: claimToken, hash: claimTokenHash } = generateOpaqueToken();
    const inquiry = await db.inquiry.create({
      data: {
        source: "PRODUCT",
        productId: product.id,
        customerName: name,
        phone,
        email: email || null,
        selections,
        referenceImageUrls,
        notes: notes ?? "",
        whatsappMessage,
        claimTokenHash,
        attribution: attributionJson(parsed.data.attribution),
        isDemo: product.isDemo,
      },
      select: { id: true, number: true },
    });

    // E6 Phase 3: the sent message carries the human-readable reference. The
    // number only exists after insert, so rebuild with it and persist
    // best-effort — a failed stamp still leaves a complete message in the row
    // while the customer sends the numbered one.
    const finalMessage = withDemoPrefix(
      buildOrderMessage(
        { ...messageInput, inquiryNumber: formatInquiryNumber(inquiry.number) },
        messageLabels,
      ),
      product.isDemo,
    );
    try {
      await db.inquiry.update({
        where: { id: inquiry.id },
        data: { whatsappMessage: finalMessage },
      });
    } catch (error) {
      console.error("inquiry number stamp failed:", error);
    }

    // Notify the owner so a blocked popup / abandoned order isn't lost (MKT-207).
    // Awaited (never throws) so the serverless instance can't drop it; instant
    // no-op when RESEND_API_KEY is unset.
    await sendOrderNotification({
      inquiryId: inquiry.id,
      source: "PRODUCT",
      customerName: name,
      phone,
      email: email || undefined,
      productTitle: product.title,
      whatsappMessage: finalMessage,
    });

    return {
      ok: true,
      data: {
        whatsappUrl: buildWaLink(finalMessage, whatsappNumber),
        inquiryId: inquiry.id,
        claimToken,
      },
    };
  } catch (error) {
    console.error("submitProductOrder failed:", error);
    return {
      ok: false,
      error: await orderErrorText(rawLocale(input), "generic"),
    };
  }
}

/* ————————————————— custom commissions ————————————————— */

const customOrderSchema = z.object({
  designIdea: z.string().trim().min(10).max(2000),
  materials: z.string().trim().max(80).optional(),
  occasion: z.string().trim().max(60).optional(),
  budgetRange: z.string().trim().max(60).optional(),
  timeline: z.string().trim().max(80).optional(),
  referenceImageUrls: z.array(referenceUrlSchema).max(5),
  notes: z.string().trim().max(1500).optional(),
  ...customerFields,
});

export type CustomOrderInput = z.input<typeof customOrderSchema>;

/** Custom commission form → Inquiry (source CUSTOM_ORDER) + wa.me link. */
export async function submitCustomOrder(
  input: CustomOrderInput,
): Promise<OrderActionResult> {
  try {
    const errLocale = rawLocale(input);
    const parsed = customOrderSchema.safeParse(input);
    if (!parsed.success)
      return { ok: false, error: await orderErrorText(errLocale, "generic") };
    const {
      designIdea,
      materials,
      occasion,
      budgetRange,
      timeline,
      referenceImageUrls,
      notes,
      name,
      phone,
      email,
      honeypot,
      formToken,
    } = parsed.data;

    if (!passesSpamChecks({ honeypot, formToken }).ok) {
      return { ok: false, error: await orderErrorText(errLocale, "generic") };
    }

    const limited = rateLimit(`order:${clientIp(await headers())}`, {
      limit: 6,
      windowMs: 600_000,
    });
    if (!limited.ok)
      return {
        ok: false,
        error: await orderErrorText(errLocale, "rateLimited"),
      };

    // Selection labels localize like every other structure line — a Hindi
    // customer's message must not mix "बजट / Budget" with a raw English
    // "Material:" row (I18N-902). getTranslations is request-cached, so the
    // extra lookup after orderLabelsFor is free.
    const waLocale = parsed.data.locale;
    const tSel =
      !waLocale || waLocale === "en"
        ? null
        : await getTranslations({ locale: waLocale, namespace: "WhatsApp" });
    const selLabel = (key: "material" | "occasion", english: string): string =>
      tSel ? bilingualLabel(String(tSel.raw(key)), english) : english;

    const selections = [
      ...(materials
        ? [{ label: selLabel("material", "Material"), value: materials }]
        : []),
      ...(occasion
        ? [{ label: selLabel("occasion", "Occasion"), value: occasion }]
        : []),
    ];

    // The design idea is the heart of the brief; extra notes ride along.
    const combinedNotes = [designIdea, notes].filter(Boolean).join("\n");

    const { whatsappNumber } = await getSiteSettings();
    const messageLabels = await orderLabelsFor(parsed.data.locale);
    const messageInput = {
      productTitle: "Custom commission",
      selections,
      referenceImageUrls,
      notes: combinedNotes,
      customer: { name, phone, email: email || undefined },
      budgetRange,
      timeline,
    };
    const whatsappMessage = buildOrderMessage(messageInput, messageLabels);

    const { token: claimToken, hash: claimTokenHash } = generateOpaqueToken();
    const inquiry = await db.inquiry.create({
      data: {
        source: "CUSTOM_ORDER",
        customerName: name,
        phone,
        email: email || null,
        selections,
        referenceImageUrls,
        budgetRange: budgetRange || null,
        timeline: timeline || null,
        notes: combinedNotes,
        whatsappMessage,
        claimTokenHash,
        attribution: attributionJson(parsed.data.attribution),
      },
      select: { id: true, number: true },
    });

    // E6 Phase 3: rebuild with the assigned reference and persist best-effort
    // (see submitProductOrder).
    const finalMessage = buildOrderMessage(
      { ...messageInput, inquiryNumber: formatInquiryNumber(inquiry.number) },
      messageLabels,
    );
    try {
      await db.inquiry.update({
        where: { id: inquiry.id },
        data: { whatsappMessage: finalMessage },
      });
    } catch (error) {
      console.error("inquiry number stamp failed:", error);
    }

    await sendOrderNotification({
      inquiryId: inquiry.id,
      source: "CUSTOM_ORDER",
      customerName: name,
      phone,
      email: email || undefined,
      productTitle: "Custom commission",
      whatsappMessage: finalMessage,
    });

    return {
      ok: true,
      data: {
        whatsappUrl: buildWaLink(finalMessage, whatsappNumber),
        inquiryId: inquiry.id,
        claimToken,
      },
    };
  } catch (error) {
    console.error("submitCustomOrder failed:", error);
    return {
      ok: false,
      error: await orderErrorText(rawLocale(input), "generic"),
    };
  }
}
