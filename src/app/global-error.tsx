"use client";

import { useEffect } from "react";

import { BRAND, porcelainAlpha } from "@/lib/brand-colors";

/**
 * Root-level error boundary. Replaces the entire root layout when it fails,
 * so nothing can be assumed — no Tailwind, no fonts, no providers. Inline
 * styles only, with a system serif fallback echoing the display face.
 */

const styles = {
  body: {
    margin: 0,
    minHeight: "100svh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BRAND.navyMidnight,
    color: BRAND.ivory,
    fontFamily:
      "Georgia, 'Times New Roman', 'Iowan Old Style', 'Palatino Linotype', serif",
    textAlign: "center" as const,
    padding: "2rem 1.25rem",
  },
  eyebrow: {
    margin: 0,
    fontSize: "0.8125rem",
    letterSpacing: "0.18em",
    textTransform: "lowercase" as const,
    // Gold on navy (A2 rule 3) — the v7 azure eyebrow reads off-brand now.
    color: BRAND.gold,
  },
  heading: {
    margin: "1rem auto 0",
    maxWidth: "36rem",
    fontSize: "clamp(2rem, 5vw, 3.5rem)",
    fontWeight: 500,
    lineHeight: 1.05,
    letterSpacing: "-0.015em",
  },
  copy: {
    margin: "1.25rem auto 0",
    maxWidth: "26rem",
    fontSize: "1rem",
    lineHeight: 1.65,
    color: porcelainAlpha(0.65),
  },
  rule: {
    margin: "2rem auto 0",
    width: "7rem",
    height: "1px",
    background: `linear-gradient(90deg, transparent, ${BRAND.gold} 30%, ${BRAND.gold} 70%, transparent)`,
  },
  button: {
    marginTop: "2rem",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "3rem",
    padding: "0 2rem",
    borderRadius: "9999px",
    border: `1px solid ${porcelainAlpha(0.3)}`,
    backgroundColor: "transparent",
    color: BRAND.ivory,
    fontFamily: "inherit",
    fontSize: "0.9375rem",
    letterSpacing: "0.02em",
    cursor: "pointer",
  },
} as const;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={styles.body}>
        <div>
          <p style={styles.eyebrow}>Rivya Living Art</p>
          <h1 style={styles.heading}>Something cracked in the cure.</h1>
          <p style={styles.copy}>
            Our apologies — an unexpected error interrupted the site. Trying
            again usually sets it right.
          </p>
          <div aria-hidden style={styles.rule} />
          <button type="button" style={styles.button} onClick={reset}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
