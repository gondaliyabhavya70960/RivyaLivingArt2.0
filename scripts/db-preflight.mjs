#!/usr/bin/env node
/**
 * Say which database URL the build is about to use, and whether it is reachable.
 *
 * `prisma migrate deploy` fails with a bare `P1001: Can't reach database server
 * at [REDACTED]:5432` — no host, no clue which variable it read. That matters
 * here because the CLI and the running app deliberately read DIFFERENT ones:
 * prisma.config.ts prefers the UNPOOLED URL (migrations take advisory locks,
 * which a pgbouncer-style pooler does not support) while src/lib/db.ts uses
 * the pooled DATABASE_URL. So the site can serve perfectly while every build
 * dies, and the error names neither variable.
 *
 * THE VENDOR NAMES IN THIS FILE WERE STALE. It said "Neon" throughout; this
 * project's database is Prisma Postgres (`db.prisma.io`) — which the script
 * itself prints on every build, so the comment was contradicted by its own
 * output. The MECHANISM is unchanged and is why the handshake below exists:
 * it is a property of any pooled, proxied Postgres, not of one vendor.
 *
 * This prints the resolved host (never the credentials), resolves DNS, opens a
 * TCP socket AND completes a real Postgres handshake.
 *
 * The handshake is the part that matters. A bare TCP probe proves almost
 * nothing against a hosted Postgres: every connection lands on a SHARED
 * proxy, which accepts the socket whether or not the database is reachable
 * behind it, and routes by SNI once TLS starts. A first version of this script reported
 * "tcp open" on all three URLs in the same build where migrate died with
 * P1001 — true, and useless. Only `SELECT 1` distinguishes "the proxy answered"
 * from "the database answered".
 *
 * Always exits 0 — it is a diagnostic, not a gate. `prisma migrate deploy`
 * remains the thing that decides whether the build proceeds.
 */
import { lookup } from "node:dns/promises";
import net from "node:net";
import pg from "pg";

/** Same precedence as prisma.config.ts — keep the two in step. */
const CANDIDATES = [
  "DATABASE_URL_UNPOOLED",
  "POSTGRES_URL_NON_POOLING",
  "DATABASE_URL",
];

const TIMEOUT_MS = 6000;

function describe(raw) {
  try {
    const u = new URL(raw);
    return {
      host: u.hostname,
      port: u.port || "5432",
      database: u.pathname.replace(/^\//, "") || "(none)",
      user: u.username ? "set" : "MISSING",
      password: u.password ? "set" : "MISSING",
      pooled: /-pooler\./.test(u.hostname),
    };
  } catch {
    return null;
  }
}

function tcpProbe(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (result) => {
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(TIMEOUT_MS);
    socket.once("connect", () => done("open"));
    socket.once("timeout", () => done(`no answer within ${TIMEOUT_MS}ms`));
    socket.once("error", (e) => done(e.code ?? e.message));
    socket.connect(Number(port), host);
  });
}

const chosen = CANDIDATES.find((name) => process.env[name]);
console.log("db-preflight: the Prisma CLI will use " + (chosen ?? "NOTHING — no database URL is set"));

for (const name of CANDIDATES) {
  const raw = process.env[name];
  if (!raw) {
    console.log(`  ${name.padEnd(26)} not set`);
    continue;
  }
  const d = describe(raw);
  if (!d) {
    console.log(`  ${name.padEnd(26)} SET BUT UNPARSEABLE — not a valid URL`);
    continue;
  }
  const mark = name === chosen ? "→" : " ";
  console.log(
    `${mark} ${name.padEnd(26)} ${d.host}:${d.port}/${d.database}` +
      ` (user ${d.user}, password ${d.password}, ${d.pooled ? "pooled" : "direct"})`,
  );

  let ip;
  try {
    ip = (await lookup(d.host)).address;
    console.log(`  ${" ".repeat(26)}dns  → ${ip}`);
  } catch (e) {
    console.log(`  ${" ".repeat(26)}dns  ✗ ${e.code ?? e.message} — the host does not resolve; the endpoint is probably gone or the URL is wrong`);
    continue;
  }
  const tcp = await tcpProbe(d.host, d.port);
  console.log(
    `  ${" ".repeat(26)}tcp  ${tcp === "open" ? "✓ open (proves only that a proxy answered)" : `✗ ${tcp} — nothing is listening; the endpoint is gone or firewalled`}`,
  );
  if (tcp !== "open") continue;

  const pad = " ".repeat(28);

  // Attempt as written first — pg reads sslmode from the URL, which is what
  // Prisma will do too. Only if the server demands encryption the URL did not
  // ask for do we retry with TLS, so the report matches real behaviour rather
  // than a connection we talked into working.
  const attempt = async (ssl) => {
    const client = new pg.Client({
      connectionString: raw,
      connectionTimeoutMillis: TIMEOUT_MS,
      ...(ssl ? { ssl } : {}),
    });
    try {
      await client.connect();
      await client.query("select 1");
      return null;
    } catch (e) {
      return e;
    } finally {
      await client.end().catch(() => {});
    }
  };

  let err = await attempt(null);
  let retried = false;
  if (err && /SSL|encryption/i.test(err.message)) {
    retried = true;
    err = await attempt({ rejectUnauthorized: false });
  }

  if (!err) {
    console.log(`${pad}psql ✓ connected and queried${retried ? " (needed TLS — add sslmode=require to the URL)" : ""}`);
  } else {
    // The server's own words are the diagnosis: "password authentication
    // failed", "database does not exist", a proxy's "couldn't connect to the
    // compute node", a TLS error, or a timeout.
    console.log(`${pad}psql ✗${err.code ? ` [${err.code}]` : ""} ${err.message}`);
  }
}
