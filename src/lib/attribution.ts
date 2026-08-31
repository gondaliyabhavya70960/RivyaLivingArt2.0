/**
 * First-touch marketing attribution (MKT-201). Captured once per browser
 * session on the first page load (see WhatsAppTracker) and read at submit
 * time, so the utm_* / referrer / landing that brought a visitor in survives
 * their navigation to a product and the WhatsApp app switch — letting the
 * owner attribute each Inquiry to its campaign. Client-only (sessionStorage).
 */

const KEY = "rr_attribution";
const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

export type Attribution = Record<string, string>;

/**
 * Capture first-touch attribution the first time it's called in a session and
 * persist it; later calls return the stored first-touch value unchanged.
 */
export function captureAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    const stored = sessionStorage.getItem(KEY);
    if (stored) return JSON.parse(stored) as Attribution;

    const params = new URLSearchParams(window.location.search);
    const attr: Attribution = {};
    for (const key of UTM_KEYS) {
      const value = params.get(key);
      if (value) attr[key] = value.slice(0, 200);
    }
    const ref = document.referrer;
    if (ref && !ref.startsWith(window.location.origin)) {
      attr.referrer = ref.slice(0, 300);
    }
    attr.landing = window.location.pathname.slice(0, 200);

    sessionStorage.setItem(KEY, JSON.stringify(attr));
    return attr;
  } catch {
    return {};
  }
}

/** Read the session's first-touch attribution (capturing it if not yet set). */
export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    const stored = sessionStorage.getItem(KEY);
    return stored ? (JSON.parse(stored) as Attribution) : captureAttribution();
  } catch {
    return {};
  }
}
