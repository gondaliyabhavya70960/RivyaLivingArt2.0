#!/usr/bin/env node
/**
 * A local origin that stands in for a protected Vercel preview deployment, so
 * every audit in this repo runs unchanged with `BASE_URL=http://localhost:3000`.
 *
 *   node scripts/preview-proxy.mjs "<shareable url>" [port]
 *
 * **Why this exists.** `redesign-audit`, `a11y-audit`, `keyboard-audit`,
 * `shots` and `e2e-smoke` all need a running server; a running server needs
 * `npm run build`; and that needs `DATABASE_URL`. A session without one could
 * not run a single gate in the definition of done — it could only push and
 * hope. But the PR's own Vercel preview IS a running server, built from the
 * commit under test. It is simply behind Vercel Authentication.
 *
 * A `_vercel_share` link exchanges for a session cookie. This holds that
 * cookie and replays it on every request, so the audits see an ordinary
 * unauthenticated origin on localhost.
 *
 * Get the link from the Vercel dashboard (Share on the deployment), or from
 * the Vercel MCP server's `get_access_to_vercel_url`. Use the DEPLOYMENT url
 * (`<project>-<hash>-<team>.vercel.app`), not the branch alias — a share token
 * minted for the alias bounces to the login page. Tokens last 23 hours.
 *
 * **Three things it does not do**, so nobody reads a green run as more than it
 * is:
 *
 *   1. Assets on absolute third-party URLs (catalog photography on supplier
 *      hosts, anything not served from the deployment) are fetched by the
 *      browser DIRECTLY, not through here. Behind an intercepting corporate or
 *      agent proxy those fail TLS. `redesign-audit`'s image rule is scoped to
 *      `public/`-derived roots, which DO come through this proxy, so that rule
 *      is unaffected — but do not read "no image failures" as covering
 *      supplier hosts.
 *   2. The preview points at whatever database the project gives it, so the
 *      five demo detail routes (`/product/demo-product-001` and friends) are
 *      present only if that database carries the seeded demo set. Audit the 13
 *      public routes here and leave the demo routes to CI, which seeds them.
 *   3. It is a read-only convenience for auditing. Never point a write path at
 *      it — the cookie it replays is a real session on a real deployment.
 *
 * Node must be able to reach the deployment: behind a proxy, run this with
 * `NODE_USE_ENV_PROXY=1` (Node >= 22.21) so `fetch` honours `HTTPS_PROXY`.
 */
import { createServer } from "node:http";

const SHARE = process.argv[2];
const PORT = Number(process.argv[3] ?? 3000);
if (!SHARE) {
  console.error('usage: preview-proxy.mjs "<shareable url>" [port]');
  process.exit(1);
}
const ORIGIN = new URL(SHARE).origin;

/** Exchange the share token for the session cookie, following redirects. */
async function authCookie() {
  // The chain goes deployment → vercel.com/sso-api → deployment, so it leaves
  // the origin on purpose. Cookies are kept only from responses the DEPLOYMENT
  // itself served; vercel.com's own session cookies are not ours to replay.
  const jar = new Map();
  let url = SHARE;
  let carried = "";
  for (let hop = 0; hop < 8; hop++) {
    const from = new URL(url).origin;
    const res = await fetch(url, {
      redirect: "manual",
      headers: carried && from === ORIGIN ? { cookie: carried } : {},
    });
    if (from === ORIGIN) {
      for (const raw of res.headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(";");
        const i = pair.indexOf("=");
        if (i > 0) jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
      }
      carried = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    }
    const loc = res.headers.get("location");
    if (!loc) break;
    url = new URL(loc, url).toString();
  }
  if (jar.size === 0)
    throw new Error("no cookie came back from the share link");
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}

const cookie = await authCookie();
console.log(`cookie: ${cookie.slice(0, 40)}…`);

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "content-encoding",
  "content-length",
]);

const server = createServer(async (req, res) => {
  const target = new URL(req.url, ORIGIN);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (HOP_BY_HOP.has(k) || k === "host" || k === "cookie") continue;
    headers.set(k, Array.isArray(v) ? v.join(", ") : String(v));
  }
  headers.set("cookie", cookie);
  const body =
    req.method === "GET" || req.method === "HEAD"
      ? undefined
      : await new Promise((ok) => {
          const parts = [];
          req.on("data", (c) => parts.push(c));
          req.on("end", () => ok(Buffer.concat(parts)));
        });
  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
    });
    const out = {};
    upstream.headers.forEach((v, k) => {
      if (!HOP_BY_HOP.has(k)) out[k] = v;
    });
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.writeHead(upstream.status, out);
    res.end(buf);
  } catch (err) {
    res.writeHead(502, { "content-type": "text/plain" });
    res.end(String(err));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`PREVIEW PROXY READY http://localhost:${PORT} → ${ORIGIN}`);
});
