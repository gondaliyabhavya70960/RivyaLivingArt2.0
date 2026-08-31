"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { SITE } from "@/lib/constants";
import { db } from "@/lib/db";
import { sendContactNotification } from "@/lib/email";
import { attributionJson, attributionSchema } from "@/lib/attribution-schema";
import { clientIp, passesSpamChecks, rateLimit } from "@/lib/rate-limit";

// Public (unauthenticated) server actions. No requireStaff here — these are
// called by visitors. Abuse protection = honeypot + fill-time + per-IP rate
// limit, all failing with generic copy that never reveals the spam checks.

/**
 * Error CODES, not copy: these actions serve a 9-locale storefront, so the
 * client maps each code onto its `Errors.*` message key (Part 0 audit S-01).
 * The code set is closed — adding one means adding its key to all 9
 * messages/*.json files.
 */
export type PublicActionError =
  | "generic"
  | "invalidEmail"
  | "contactRateLimited"
  | "subscribeRateLimited";

export type PublicActionResult =
  | { ok: true; silent?: boolean }
  | { ok: false; error: PublicActionError };

const GENERIC_ERROR = "generic" as const;

const contactSchema = z.object({
  name: z.string().trim().min(2),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9+\-() ]{8,17}$/),
  email: z.email().optional().or(z.literal("")),
  message: z.string().trim().min(10).max(2000),
  /** Honeypot — humans never see or fill this field. */
  honeypot: z.string(),
  /** Server-signed mount timestamp (S-06 — /api/form-token). */
  formToken: z.string().max(256),
  /** First-touch marketing attribution (optional, S-05). */
  attribution: attributionSchema,
});

export type ContactInquiryInput = z.input<typeof contactSchema>;

/** Contact form → Inquiry (source CONTACT) + optional email notification. */
export async function submitContactInquiry(
  input: ContactInquiryInput,
): Promise<PublicActionResult> {
  try {
    const parsed = contactSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: GENERIC_ERROR };
    const { name, phone, email, message, honeypot, formToken } =
      parsed.data;

    // Bots fail with generic copy that never reveals the spam checks.
    if (!passesSpamChecks({ honeypot, formToken }).ok) {
      return { ok: false, error: GENERIC_ERROR };
    }

    const ip = clientIp(await headers());
    const limited = rateLimit(`contact:${ip}`, {
      limit: 5,
      windowMs: 600_000,
    });
    if (!limited.ok) {
      return { ok: false, error: "contactRateLimited" };
    }

    const siteHost = SITE.url.replace(/^https?:\/\//, "");
    const whatsappMessage = [
      "Hello Rivya Living Art, I sent a message via your contact page.",
      "",
      `Name: ${name}`,
      `Phone: ${phone}`,
      ...(email ? [`Email: ${email}`] : []),
      `Message: ${message}`,
      "",
      `(Sent from ${siteHost})`,
    ].join("\n");

    await db.inquiry.create({
      data: {
        source: "CONTACT",
        customerName: name,
        phone,
        email: email || null,
        notes: message,
        whatsappMessage,
        selections: {},
        referenceImageUrls: [],
        // Same first-touch attribution the order actions persist (S-05) —
        // contact leads now attribute to their campaign too.
        attribution: attributionJson(parsed.data.attribution),
      },
    });

    // Await the notification (it never throws by design) so it completes
    // before the serverless function can suspend — an un-awaited promise can
    // be dropped when Vercel freezes the instance after the response (ENG-804).
    // Cost is one HTTP round-trip; the inquiry is already persisted above.
    await sendContactNotification({
      name,
      phone,
      email: email || undefined,
      message,
    });

    return { ok: true };
  } catch (error) {
    console.error("submitContactInquiry failed:", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}

// ————————————————————— Newsletter / lead capture (MKT-003) —————————————————————

const subscribeSchema = z.object({
  email: z.email(),
  /** Where they subscribed from — footer, launching-soon, etc. */
  source: z.string().trim().max(40).optional(),
  honeypot: z.string(),
  /** Server-signed mount timestamp (S-06 — /api/form-token). */
  formToken: z.string().max(256),
});

export type SubscribeInput = z.input<typeof subscribeSchema>;

/**
 * Owned top-of-funnel email capture: stores a Subscriber so high-intent
 * visitors who aren't ready to open WhatsApp still stay reachable for launches
 * and gifting. Idempotent by email; bots get a silent success.
 */
export async function subscribeEmail(
  input: SubscribeInput,
): Promise<PublicActionResult> {
  try {
    const parsed = subscribeSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: "invalidEmail" };
    }
    const { email, source, honeypot, formToken } = parsed.data;

    // Silent fake-success is reserved for the HONEYPOT — a filled honeypot
    // is proof of a bot, and silence avoids tipping it off (A6-004). A token
    // failure is NOT proof: a fetch blip, a 429, or a stale tab hits it too
    // (re-audit R-002), so those return an honest error — the human retries
    // and their now-aged token passes.
    const spam = passesSpamChecks({ honeypot, formToken });
    if (!spam.ok) {
      return spam.reason === "honeypot"
        ? { ok: true, silent: true }
        : { ok: false, error: GENERIC_ERROR };
    }

    const ip = clientIp(await headers());
    const limited = rateLimit(`subscribe:${ip}`, {
      limit: 5,
      windowMs: 600_000,
    });
    if (!limited.ok) {
      return { ok: false, error: "subscribeRateLimited" };
    }

    // Re-subscribing is a no-op success, never a duplicate error.
    await db.subscriber.upsert({
      where: { email: email.toLowerCase() },
      update: {},
      create: { email: email.toLowerCase(), source: source || null },
    });

    return { ok: true };
  } catch (error) {
    console.error("subscribeEmail failed:", error);
    return { ok: false, error: GENERIC_ERROR };
  }
}
