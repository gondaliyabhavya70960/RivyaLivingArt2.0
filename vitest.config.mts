import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Unit-test runner (first test infrastructure in the repo). Scope: pure
 * server-side lib functions — naming, search vocabulary, localization,
 * WhatsApp links, the form-token spam gate. Node environment, no DOM; the
 * env block feeds src/lib/env.ts's validation with harmless dummies so
 * modules that import it (form-token) load under test.
 */
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    // scripts/ is in scope for the build tooling that has its own judgement to
    // pin — `migrate-retry` decides whether a failed deploy is worth rerunning.
    // The .tsx pattern arrived with the Kanban primitives (PR-2): presentational
    // components are tested via SSR static markup + happy-dom, which is the
    // same no-browser philosophy, one file type later.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.mjs"],
    environment: "node",
    env: {
      DATABASE_URL: "postgresql://test@127.0.0.1:5433/test",
      AUTH_SECRET: "vitest-secret-00000000000000000000000000",
      AUTH_TRUST_HOST: "true",
    },
  },
});
