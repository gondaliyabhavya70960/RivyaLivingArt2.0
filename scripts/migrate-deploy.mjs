#!/usr/bin/env node
/**
 * `prisma migrate deploy`, run again when — and only when — the database was
 * simply not reachable.
 *
 * WHY THE BUILD NEEDS THIS. `npm run build` is `migrate deploy && bootstrap &&
 * next build`, and Vercel runs that build for PREVIEW deployments as well as
 * production, against the SAME database. So the number of processes competing
 * for a migration connection is twice the number of pushes, and Prisma
 * Postgres caps the `prisma_migration` role deliberately low. On 2026-09-15
 * three migrations pushed inside twenty minutes produced
 * `FATAL: too many connections for role "prisma_migration"` and killed a build
 * outright — no defect in the schema, the migration or the code, just cadence.
 * The same shape arrives as an advisory-lock timeout when two builds reach the
 * lock together, which `prisma.config.ts` makes likely on purpose by pointing
 * migrations at the unpooled url.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. It does not retry a migration that ran and
 * failed. `scripts/lib/migrate-retry.mjs` holds that judgement and explains it;
 * the short version is that Prisma records such a failure and refuses every
 * later deploy until a human runs `migrate resolve`, so looping would only bury
 * the error that person has to read. An unrecognised failure is likewise
 * treated as real. Retry is for "the door was locked", never for "the room was
 * on fire".
 *
 * It is a drop-in for the command it wraps: same stdout, same stderr, and the
 * child's exit code is this script's exit code, so `&&` in the build still
 * means what it meant.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { classifyMigrateFailure } from "./lib/migrate-retry.mjs";

/**
 * Resolve the CLI by path rather than trusting PATH. `npm run` puts
 * node_modules/.bin on PATH and a bare `prisma` worked for as long as the
 * build script called it directly — but this wrapper is also the thing an
 * operator runs by hand to reproduce a deploy failure, and `node
 * scripts/migrate-deploy.mjs` from a plain shell resolved nothing at all. It
 * failed with an empty log, which is the one outcome a diagnostic tool may not
 * produce.
 */
const LOCAL_BIN = fileURLToPath(new URL("../node_modules/.bin/prisma", import.meta.url));
const PRISMA = existsSync(LOCAL_BIN) ? LOCAL_BIN : "prisma";

/** One immediate go, then three more. Waits are seconds of a build, against a
 *  failure that otherwise costs the whole build. */
const BACKOFF_MS = [5_000, 20_000, 45_000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Runs the command, echoing its output live while keeping a copy to read. */
function runMigrateDeploy() {
  return new Promise((resolve) => {
    const child = spawn(PRISMA, ["migrate", "deploy"], {
      stdio: ["inherit", "pipe", "pipe"],
      env: process.env,
    });

    let output = "";
    const tee = (stream, sink) => {
      stream.setEncoding("utf8");
      stream.on("data", (chunk) => {
        output += chunk;
        sink.write(chunk);
      });
    };
    tee(child.stdout, process.stdout);
    tee(child.stderr, process.stderr);

    child.on("error", (err) => {
      // Echoed, not just captured: a spawn failure produces no child output,
      // so this line is the entire diagnosis.
      const note = `failed to start ${PRISMA}: ${err.message}`;
      process.stderr.write(`${note}\n`);
      resolve({ code: 1, output: `${output}\n${note}` });
    });
    child.on("close", (code) => resolve({ code: code ?? 1, output }));
  });
}

for (let attempt = 0; ; attempt += 1) {
  const { code, output } = await runMigrateDeploy();
  if (code === 0) {
    if (attempt > 0) console.log(`migrate-deploy: succeeded on attempt ${attempt + 1}`);
    process.exit(0);
  }

  const { retry, reason } = classifyMigrateFailure(output);
  const waitMs = BACKOFF_MS[attempt];

  if (!retry) {
    console.error(`\nmigrate-deploy: not retrying — ${reason}`);
    process.exit(code);
  }
  if (waitMs === undefined) {
    console.error(
      `\nmigrate-deploy: giving up after ${attempt + 1} attempts — ${reason}, ` +
        "and it stayed that way. Check the database is up and not out of connections.",
    );
    process.exit(code);
  }

  console.error(
    `\nmigrate-deploy: attempt ${attempt + 1} failed because ${reason}. ` +
      `Retrying in ${waitMs / 1000}s.`,
  );
  await sleep(waitMs);
}
