/**
 * Locale definitions for the public site's multi-language support.
 *
 * Scope: India's core plus the largest resin-art export markets. English is the
 * default (no URL prefix under `localePrefix: "as-needed"`); the rest are
 * URL-prefixed (`/hi`, `/ar`, …) so each language is independently indexable
 * with its own hreflang (better than a cookie-only approach for reaching each
 * market). Arabic is right-to-left.
 *
 * This module is plain data with no next-intl runtime import, so it is safe to
 * use anywhere (middleware, server, client, RSC).
 */
export const locales = [
  "en", // English (default)
  "hi", // Hindi
  "gu", // Gujarati
  "ar", // Arabic (RTL)
  "es", // Spanish
  "de", // German
  "fr", // French
  "zh", // Chinese (Simplified)
  "ja", // Japanese
] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

/** Right-to-left locales — drives <html dir> and layout mirroring. */
export const rtlLocales: readonly Locale[] = ["ar"];

/** Text direction for a locale; defaults to ltr for anything unknown. */
export function getDir(locale: string): "rtl" | "ltr" {
  return (rtlLocales as readonly string[]).includes(locale) ? "rtl" : "ltr";
}

/**
 * Narrow an arbitrary runtime locale string (e.g. `useLocale()`) to a
 * supported `Locale`, or undefined — used when posting the visitor's locale
 * to server actions so unknown values degrade to the English default.
 */
export function asWaLocale(locale: string): Locale | undefined {
  return (locales as readonly string[]).includes(locale)
    ? (locale as Locale)
    : undefined;
}

/** Native-name labels for the language switcher. */
export const localeLabels: Record<Locale, string> = {
  en: "English",
  hi: "हिन्दी",
  gu: "ગુજરાતી",
  ar: "العربية",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
  zh: "中文",
  ja: "日本語",
};
