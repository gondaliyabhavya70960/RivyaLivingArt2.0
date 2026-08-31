import { BRAND } from "@/lib/brand-colors";
import { SITE } from "@/lib/constants";

/**
 * Server-only email helpers (Resend REST API — no SDK dependency).
 * Email is strictly optional: when RESEND_API_KEY is not configured, or the
 * request fails for any reason, the helper reports { sent: false } and the
 * caller carries on — the Inquiry row in the database is the source of truth.
 */

type ContactNotificationInput = {
  name: string;
  phone: string;
  email?: string;
  message: string;
};

/**
 * Notify the studio inbox about a new contact-form inquiry.
 * NEVER throws — returns { sent: false } on missing key or any failure.
 */
export async function sendContactNotification(
  input: ContactNotificationInput,
): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false };

  const text = [
    "New inquiry from the Rivya Living Art contact form.",
    "",
    `Name: ${input.name}`,
    `Phone: ${input.phone}`,
    `Email: ${input.email || "—"}`,
    "",
    "Message:",
    input.message,
    "",
    `Sent from ${SITE.url}`,
  ].join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Use the resolved verified-domain sender (ENG-003) so notifications
        // deliver in production instead of dying on the Resend sandbox sender.
        from: studioFrom(),
        to: [SITE.email],
        subject: `New contact inquiry from ${input.name}`,
        text,
      }),
    });
    if (!res.ok) {
      console.error("sendContactNotification: Resend responded", res.status);
      return { sent: false };
    }
    return { sent: true };
  } catch (error) {
    console.error("sendContactNotification failed:", error);
    return { sent: false };
  }
}

type OrderNotificationInput = {
  inquiryId: string;
  source: "PRODUCT" | "CUSTOM_ORDER";
  customerName: string;
  phone: string;
  email?: string;
  productTitle?: string;
  whatsappMessage: string;
};

/**
 * Notify the studio inbox about a new WhatsApp order / custom commission
 * (MKT-207). For a WhatsApp-only business, an owner who never sees a
 * blocked-popup or abandoned order loses the highest-intent leads — this
 * pushes them a copy with a ready reply link. NEVER throws; returns
 * { sent: false } on missing key or any failure (the Inquiry row is the
 * source of truth). Mirrors sendContactNotification.
 */
export async function sendOrderNotification(
  input: OrderNotificationInput,
): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false };

  const label = input.source === "PRODUCT" ? "product order" : "custom commission";
  const replyWa = `https://wa.me/${input.phone.replace(/[^0-9]/g, "")}`;
  const text = [
    `New ${label} inquiry on Rivya Living Art.`,
    "",
    `Customer: ${input.customerName}`,
    `Phone: ${input.phone}`,
    `Email: ${input.email || "—"}`,
    ...(input.productTitle ? [`Product: ${input.productTitle}`] : []),
    `Reply on WhatsApp: ${replyWa}`,
    "",
    "Order summary:",
    input.whatsappMessage,
    "",
    `Open in studio: ${SITE.url}/studio/inquiries/${input.inquiryId}`,
  ].join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: studioFrom(),
        to: [SITE.email],
        subject: `New ${label} from ${input.customerName}`,
        text,
      }),
    });
    if (!res.ok) {
      console.error("sendOrderNotification: Resend responded", res.status);
      return { sent: false };
    }
    return { sent: true };
  } catch (error) {
    console.error("sendOrderNotification failed:", error);
    return { sent: false };
  }
}

/**
 * Sender for studio auth mail. Preference order:
 *  1. EMAIL_FROM / RESEND_FROM — a full "Name <addr>" you set explicitly.
 *  2. RESEND_EMAIL_DOMAIN — just the verified domain; we build studio@<domain>.
 *  3. Resend's shared sandbox sender (only delivers to your own Resend email).
 */
function studioFrom(): string {
  if (process.env.EMAIL_FROM) return process.env.EMAIL_FROM;
  if (process.env.RESEND_FROM) return process.env.RESEND_FROM;
  const domain = process.env.RESEND_EMAIL_DOMAIN?.trim();
  if (domain) return `Rivya Living Art Studio <studio@${domain}>`;
  return "Rivya Living Art Studio <onboarding@resend.dev>";
}

/**
 * Emails a staff member their self-service password-reset link.
 * Email is optional: when RESEND_API_KEY is missing (or the send fails) the
 * link is logged to the server console — visible in Vercel runtime logs — so
 * the owner can still recover access. NEVER throws.
 */
export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<{ sent: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  const logFallback = () =>
    console.warn(
      `[email] password reset link for ${input.to} (not delivered — copy from here): ${input.resetUrl}`,
    );

  if (!apiKey) {
    logFallback();
    return { sent: false };
  }

  const greetingName = input.name?.trim() || "there";
  const text = [
    `Hi ${greetingName},`,
    "",
    "We received a request to reset your Rivya Living Art Studio password.",
    "Open the link below to choose a new one. It expires in one hour.",
    "",
    input.resetUrl,
    "",
    "If you didn't request this, you can safely ignore this email.",
    "",
    "— Rivya Living Art Studio",
  ].join("\n");

  // Palette pulled from BRAND so a brand retune updates the token layer and this
  // transactional email together instead of drifting (DS-706).
  const html = `
  <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:${BRAND.navyMidnight}">
    <p style="font-size:22px;font-weight:600;color:${BRAND.royal};margin:0 0 24px">Rivya Living Art<span style="color:${BRAND.gold}">.</span></p>
    <p style="margin:0 0 12px">Hi ${greetingName},</p>
    <p style="margin:0 0 20px;line-height:1.6">We received a request to reset your Rivya Living Art Studio password. Choose a new one using the button below. This link expires in one hour.</p>
    <p style="margin:0 0 28px"><a href="${input.resetUrl}" style="display:inline-block;background:${BRAND.royal};color:${BRAND.ivory};text-decoration:none;padding:12px 28px;border-radius:9999px;font-weight:500">Reset password</a></p>
    <p style="margin:0 0 8px;font-size:13px;color:${BRAND.mutedInk};line-height:1.6">If the button doesn't work, paste this link into your browser:<br /><a href="${input.resetUrl}" style="color:${BRAND.royal};word-break:break-all">${input.resetUrl}</a></p>
    <p style="margin:24px 0 0;font-size:13px;color:${BRAND.mutedInk};line-height:1.6">If you didn't request this, you can safely ignore this email — your password will stay the same.</p>
    <p style="margin:24px 0 0;font-size:13px;color:${BRAND.mutedInk}">— Rivya Living Art Studio</p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: studioFrom(),
        to: [input.to],
        subject: "Reset your Rivya Living Art Studio password",
        html,
        text,
      }),
    });
    if (!res.ok) {
      console.error("sendPasswordResetEmail: Resend responded", res.status);
      logFallback();
      return { sent: false };
    }
    return { sent: true };
  } catch (error) {
    console.error("sendPasswordResetEmail failed:", error);
    logFallback();
    return { sent: false };
  }
}
