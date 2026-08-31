import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Server-issued form timestamps (Part 0 audit S-06). The old fill-time spam
 * gate trusted a client-supplied epoch (`formStartedAt`), so any bot could
 * claim it "started" minutes ago. Now /api/form-token issues an
 * HMAC-signed timestamp at form mount; the actions verify the signature and
 * that a human amount of time passed SERVER-side. Bots must fetch a token
 * and genuinely wait — the timestamp can no longer be forged.
 *
 * Format: "<epoch-ms>.<hex hmac-sha256(epoch-ms)>", keyed by AUTH_SECRET.
 */

const MAX_AGE_MS = 6 * 60 * 60 * 1000; // stale after 6h (abandoned tabs)

function sign(value: string): string {
  return createHmac("sha256", env.AUTH_SECRET).update(value).digest("hex");
}

/** Issue a signed now-timestamp. */
export function issueFormToken(): string {
  const ts = String(Date.now());
  return `${ts}.${sign(ts)}`;
}

/**
 * True when `token` is genuinely ours, at least `minFillMs` old, and not
 * stale. Constant-time signature comparison; any malformed input is false.
 */
export function verifyFormToken(
  token: string | null | undefined,
  minFillMs: number,
): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const ts = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  if (!/^\d{10,16}$/.test(ts) || !/^[0-9a-f]{64}$/.test(mac)) return false;
  const expected = Buffer.from(sign(ts), "hex");
  const provided = Buffer.from(mac, "hex");
  if (
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  ) {
    return false;
  }
  const age = Date.now() - Number(ts);
  return age >= minFillMs && age <= MAX_AGE_MS;
}
