import { createHash, randomBytes } from "node:crypto";

/**
 * Single-use tokens for self-service password reset. The raw token travels in
 * the emailed link; only its SHA-256 hash is stored, so a database leak can
 * never be replayed into a reset. Runs in the Node runtime only (server
 * actions) — never import from middleware or client components.
 */
export function generateResetToken(): { token: string; hash: string } {
  return generateOpaqueToken();
}

/**
 * A generic 32-byte URL-safe token plus its SHA-256 hash. The raw token is
 * handed to the client; only the hash is persisted, so possessing the stored
 * value can never reconstruct the capability. Used for password reset and the
 * one-time /whatsapp-order claim token (ENG-811).
 */
export function generateOpaqueToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** How long a reset link stays valid. */
export const RESET_TOKEN_TTL_MS = 1000 * 60 * 60; // 1 hour
