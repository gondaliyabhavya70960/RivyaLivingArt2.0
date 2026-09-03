"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

/**
 * `<model-viewer>` is a web component — React 19 resolves JSX tags through
 * the react module's JSX namespace, so the intrinsic is declared here,
 * scoped to this file's import graph.
 */
declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        src?: string;
        alt?: string;
        poster?: string;
        /** Boolean custom-element attributes — pass "" for presence. */
        ar?: string;
        "camera-controls"?: string;
        "auto-rotate"?: string;
      };
    }
  }
}

interface ModelViewerProps {
  /** URL of the .glb/.gltf model. */
  src: string;
  alt: string;
  /** A photograph shown while the model itself is still fetching — the
   *  gallery passes its first frame, so a slow .glb download shows the piece
   *  rather than a blank stage. */
  poster?: string;
}

/**
 * Lazy `<model-viewer>` wrapper. The @google/model-viewer library touches
 * `window` at import time, so it is dynamically imported in an effect and the
 * element renders only once the custom element is registered.
 *
 * Three things this used to get wrong, all of them invisible to the gates:
 *
 * - **Auto-rotate ignored reduced motion.** Part 14 disables auto-play motion
 *   under `prefers-reduced-motion: reduce`, "no exceptions", and the global
 *   CSS collapse in globals.css cannot reach a web component that spins its
 *   own WebGL camera. The attribute is now simply absent for those visitors;
 *   `camera-controls` stays, so the model is still theirs to turn by hand.
 * - **Its strings were hardcoded English** in a nine-locale site.
 * - **A failed import left the loading state up forever**, so a network blip
 *   read as a permanently loading viewer. It now says so and offers a retry;
 *   re-running the import is worth a try because the usual cause is one
 *   failed chunk request, and if it fails again the message simply returns.
 *
 * The panel keeps its own compact failure copy rather than the site-wide
 * `ErrorState`: that component is a page-level boundary (eyebrow, statement,
 * reassurance, WhatsApp) and this is one tile inside a gallery that is still
 * showing the photographs the 3D view is an enhancement of.
 */
export function ModelViewer({ src, alt, poster }: ModelViewerProps) {
  const t = useTranslations("Product");
  const prefersReducedMotion = usePrefersReducedMotion();
  const [status, setStatus] = useState<"loading" | "ready" | "failed">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    import("@google/model-viewer")
      .then(() => {
        if (!cancelled) setStatus("ready");
      })
      .catch(() => {
        // 3D is progressive enhancement — say so and let them retry.
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (status !== "ready") {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-gradient-to-br from-deep-ocean to-sapphire-hi p-6 text-center">
        <p className="font-body text-small text-mineral/80">
          {status === "loading"
            ? t("gallery.modelLoading")
            : t("gallery.modelFailed")}
        </p>
        {status === "failed" ? (
          <button
            type="button"
            onClick={() => {
              setStatus("loading");
              setAttempt((n) => n + 1);
            }}
            className="min-h-11 rounded-full border border-mineral/40 px-5 font-mono text-12 tracking-[0.12em] text-mineral uppercase transition-colors duration-(--dur-fast) ease-(--ease-luxury) hover:border-mineral focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-obsidian motion-reduce:transition-none"
          >
            {t("gallery.modelRetry")}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <model-viewer
      src={src}
      alt={alt}
      {...(poster ? { poster } : {})}
      camera-controls=""
      {...(prefersReducedMotion ? {} : { "auto-rotate": "" })}
      ar=""
      style={{ width: "100%", height: "100%" }}
    />
  );
}
