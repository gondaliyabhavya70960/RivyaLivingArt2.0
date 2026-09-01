import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("Content-Security-Policy enforcement (Prompt 08)", () => {
  it("enforces Content-Security-Policy with media-src, connect-src, and worker-src", async () => {
    const headersConfig = await nextConfig.headers?.();
    const globalEntry = headersConfig?.find((entry) => entry.source === "/:path*");
    expect(globalEntry).toBeDefined();

    const headers = globalEntry?.headers ?? [];
    const csp = headers.find((h) => h.key === "Content-Security-Policy");
    const reportOnly = headers.find((h) => h.key === "Content-Security-Policy-Report-Only");

    expect(reportOnly).toBeUndefined();
    expect(csp).toBeDefined();

    const val = csp?.value ?? "";
    expect(val).toContain("media-src 'self' blob: data: https://*.public.blob.vercel-storage.com https://res.cloudinary.com");
    expect(val).toContain("https://*.public.blob.vercel-storage.com");
    expect(val).toContain("https://blob.vercel-storage.com");
    expect(val).toContain("worker-src 'self' blob:");
    expect(val).toContain("frame-ancestors 'self'");
    expect(val).toContain("object-src 'none'");
    expect(val).toContain("form-action 'self'");
  });
});
