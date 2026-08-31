"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Client half of the S-06 form-token flow: fetches the server-signed
 * mount timestamp once when the form appears and hands it back at submit.
 * If the mount fetch failed (network blip), getToken retries once at
 * submit — that fresh token then fails the server's min-fill check exactly
 * once, and the visitor's retry succeeds because the token has aged.
 * Fire-and-forget: analytics-grade robustness, never throws into the form.
 */
/** Refetch when the cached token is older than this — well inside the
 *  server's 6h ceiling, so a long-suspended tab can never hold a token
 *  that fails forever (re-audit R-001). Staleness is measured from the
 *  CLIENT clock at fetch time (not the token's server epoch), so a
 *  skewed device clock can neither hide staleness nor force refetch
 *  loops (md-sweep delta finding). */
const REFRESH_AFTER_MS = 60 * 60 * 1000;

export function useFormToken(): () => Promise<string> {
  const tokenRef = useRef("");
  const fetchedAtRef = useRef(0);

  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch("/api/form-token", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { token?: string };
        if (data.token) {
          tokenRef.current = data.token;
          fetchedAtRef.current = Date.now();
        }
      }
    } catch {
      // Retried at submit time by getToken.
    }
  }, []);

  useEffect(() => {
    void fetchToken();
  }, [fetchToken]);

  return useCallback(async () => {
    const stale = Date.now() - fetchedAtRef.current > REFRESH_AFTER_MS;
    if (!tokenRef.current || stale) await fetchToken();
    return tokenRef.current;
  }, [fetchToken]);
}
