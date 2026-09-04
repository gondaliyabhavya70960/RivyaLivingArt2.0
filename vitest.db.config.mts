import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Database-backed integration tests (Prompt 07).
 * Runs against real Postgres (in CI or local dev when DATABASE_URL is set).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // The `server-only` marker has no runtime and does not resolve outside
      // Next's bundler; alias it so server modules load under the runner.
      "server-only": path.resolve(__dirname, "tests/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["tests/db/**/*.test.ts"],
    // One file at a time. The suites share one database: demo-seed.test.ts
    // writes and removes 400+ rows (40 of them Media) while media-query's
    // orientation assertion is scoped by prefix but reads the same table,
    // and the two interleaved once (2026-09-04) into a failure neither
    // reproduces alone. Sequential files cost ~10 s and remove the race.
    fileParallelism: false,
    environment: "node",
    testTimeout: 30_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://test@127.0.0.1:5433/test",
      AUTH_SECRET: "vitest-secret-00000000000000000000000000",
      AUTH_TRUST_HOST: "true",
    },
  },
});
