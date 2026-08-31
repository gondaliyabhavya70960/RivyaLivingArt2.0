/**
 * SSRF guard for staff-triggered outbound fetches (scraper probes, robots.txt,
 * image mirroring). A pasted job URL — or an image URL inside a scraped
 * storefront — must never let the Vercel function reach loopback, private
 * (RFC1918), carrier-grade-NAT, or link-local addresses (incl. the cloud
 * metadata endpoint 169.254.169.254). We resolve the host, reject any
 * non-public address, and re-validate on every redirect hop (SEC-107).
 *
 * Node runtime only — never import from the edge/middleware.
 */
import dns from "node:dns/promises";
import net from "node:net";

export class SsrfError extends Error {
  constructor(host: string) {
    super(`Refusing to fetch a non-public address: ${host}`);
    this.name = "SsrfError";
  }
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return true;
  const [a, b] = parts;
  if (a === 0) return true; // "this" network
  if (a === 10) return true; // private
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local (incl. metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // multicast / reserved
  return false;
}

/**
 * Extract an embedded IPv4 from an IPv4-mapped (`::ffff:…`) or NAT64
 * (`64:ff9b::…`) IPv6 address, in either dotted (`::ffff:127.0.0.1`) or
 * hex-group (`::ffff:7f00:1`) rendering — so a mapped loopback/private
 * address is caught regardless of how the resolver prints it.
 */
function embeddedIpv4(v6: string): string | null {
  const dotted = v6.match(/(?:^|:)((?:\d{1,3}\.){3}\d{1,3})$/);
  if (dotted) return dotted[1];
  const hex = v6.match(/^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return `${(hi >> 8) & 255}.${hi & 255}.${(lo >> 8) & 255}.${lo & 255}`;
  }
  return null;
}

function isBlockedIpv6(ip: string): boolean {
  const v = ip.toLowerCase();
  if (v === "::1" || v === "::") return true; // loopback / unspecified
  if (v.startsWith("fc") || v.startsWith("fd")) return true; // unique-local fc00::/7
  if (v.startsWith("fe80")) return true; // link-local
  const v4 = embeddedIpv4(v); // IPv4-mapped / NAT64 → check the embedded v4
  if (v4) return isBlockedIpv4(v4);
  return false;
}

function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isBlockedIpv4(ip);
  if (net.isIPv6(ip)) return isBlockedIpv6(ip);
  return true; // unrecognisable → block
}

async function assertPublicHost(hostname: string): Promise<void> {
  // URL hostnames keep IPv6 literals bracketed ("[::1]") — strip them so
  // net.isIP recognises the literal instead of falling through to DNS.
  const host =
    hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1)
      : hostname;

  // A literal-IP host is checked directly (no DNS).
  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new SsrfError(hostname);
    return;
  }
  let addrs: { address: string }[];
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new SsrfError(hostname); // unresolvable → refuse
  }
  if (addrs.length === 0) throw new SsrfError(hostname);
  for (const { address } of addrs) {
    if (isBlockedIp(address)) throw new SsrfError(hostname);
  }
}

/** Parse + validate a URL: must be http(s) and resolve to a public address. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SsrfError(raw);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError(url.href);
  }
  await assertPublicHost(url.hostname);
  return url;
}

/**
 * fetch() that validates the target — and every redirect hop — is a public
 * http(s) address before the request goes out. Drop-in for the scraper's
 * `fetch(url, { redirect: "follow" })` calls; throws SsrfError when a hop
 * points somewhere internal, which the callers already treat as "skip".
 *
 * Residual: this validates by hostname and fetch() re-resolves at connect, so
 * a low-TTL DNS-rebinding attacker who controls the target's DNS could still
 * win the resolve→connect race. Closing it fully needs to pin the validated
 * IP into the connection (a custom undici dispatcher) — deferred, since the
 * pinned-lookup path is unreliable behind this deploy's egress proxy. This
 * guard still blocks the direct vectors: literal private IPs and hostnames
 * that resolve to private/loopback/link-local/metadata addresses.
 */
export async function safeFetch(
  input: string,
  init: RequestInit = {},
  maxRedirects = 5,
): Promise<Response> {
  let current = input;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res;
      current = new URL(location, current).href;
      continue;
    }
    return res;
  }
  throw new SsrfError("too many redirects");
}
