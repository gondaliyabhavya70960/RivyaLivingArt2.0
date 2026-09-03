import { describe, expect, it } from "vitest";

import { describeDemoHost } from "@/lib/demo/guard";

describe("describeDemoHost", () => {
  it("allows a local Postgres and reports non-production", () => {
    const info = describeDemoHost(
      "postgresql://postgres@127.0.0.1:5432/rivya_g",
      {},
    );
    expect(info.host).toBe("127.0.0.1/rivya_g");
    expect(info.allowed).toBe(true);
    expect(info.production).toBe(false);
  });

  it("allows localhost by name too", () => {
    const info = describeDemoHost(
      "postgresql://postgres@localhost:5432/anything",
      {},
    );
    expect(info.allowed).toBe(true);
  });

  it("allows a database named for CI regardless of host", () => {
    const info = describeDemoHost(
      "postgresql://user@db.example.com:5432/rivya_ci",
      {},
    );
    expect(info.allowed).toBe(true);
    expect(info.production).toBe(false);
  });

  it("refuses a hosted database by default and reports production", () => {
    const info = describeDemoHost(
      "postgresql://user@ep-cool-name.us-east-1.aws.neon.tech:5432/production",
      {},
    );
    expect(info.allowed).toBe(false);
    expect(info.production).toBe(true);
  });

  it("refuses an unset connection string", () => {
    const info = describeDemoHost(undefined, {});
    expect(info.host).toBe("(unset)");
    expect(info.allowed).toBe(false);
    expect(info.production).toBe(true);
  });

  it("honours DEMO_DB_ALLOW for a host the pattern cannot anticipate", () => {
    const url = "postgresql://user@db.example.com:5432/sandbox";
    expect(describeDemoHost(url, {}).allowed).toBe(false);
    const allowed = describeDemoHost(url, {
      DEMO_DB_ALLOW: "db.example.com/sandbox",
    });
    expect(allowed.allowed).toBe(true);
    expect(allowed.production).toBe(false);
  });

  it("still refuses production even on an allow-listed host", () => {
    const info = describeDemoHost(
      "postgresql://postgres@127.0.0.1:5432/rivya_g",
      {
        VERCEL_ENV: "production",
      },
    );
    expect(info.allowed).toBe(true);
    expect(info.production).toBe(true);
  });

  it("treats NODE_ENV=production the same as VERCEL_ENV", () => {
    const info = describeDemoHost(
      "postgresql://postgres@127.0.0.1:5432/rivya_g",
      {
        NODE_ENV: "production",
      },
    );
    expect(info.production).toBe(true);
  });
});
