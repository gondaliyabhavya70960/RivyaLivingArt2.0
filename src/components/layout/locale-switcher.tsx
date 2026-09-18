"use client";

import { useTransition, type ChangeEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";

import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, localeLabels, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Language switcher for the site header. A native <select> — robust, keyboard
 * accessible and zero-JS-fallback friendly — styled to sit alongside the theme
 * toggle in the header ink. On change it replaces the current route with the
 * same pathname under the chosen locale, so the visitor stays where they are.
 */
export function LocaleSwitcher({
  ghost = false,
  className,
}: {
  /** Chrome variant: borderless at rest, hairline on hover (site header). */
  ghost?: boolean;
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("Language");
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function onChange(event: ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value as Locale;
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  }

  return (
    <label
      className={cn(
        // Scope-resolved ink. This control lives in the footer and the site
        // drawer, both obsidian, and previously read `--header-ink` — a
        // variable nothing sets any more, so it fell back to `ink` and the
        // whole switcher rendered at 1.07:1 on the dark ground.
        "relative inline-flex items-center text-ink in-data-[theme=navy]:text-mineral",
        isPending && "opacity-60",
        className,
      )}
    >
      <Languages
        className="pointer-events-none absolute start-2.5 size-4"
        aria-hidden
      />
      <span className="sr-only">{t("label")}</span>
      <select
        aria-label={t("select")}
        value={locale}
        onChange={onChange}
        disabled={isPending}
        // rounded-sm: v4 squares the switcher — the pill silhouette is
        // reserved for the floating WhatsApp button (design.md § CTA voice).
        // min-h-11: 44px tap target in the fixed mobile chrome (audit L-M2).
        className={cn(
          "min-h-11 cursor-pointer appearance-none rounded-input bg-transparent py-2 ps-8 pe-3 font-body text-14 text-current transition-colors duration-(--dur-fast) ease-(--ease-luxury) hover:bg-current/8 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 motion-reduce:transition-none",
          ghost
            ? "border border-transparent hover:border-current/25"
            : "border border-current/30",
        )}
      >
        {locales.map((code) => (
          /* The option list is painted by the OS, not by this stylesheet, so
             it gets an explicit light pair rather than inheriting a dark
             ground it cannot see. */
          <option
            key={code}
            value={code}
            className="bg-background text-ink"
          >
            {localeLabels[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
