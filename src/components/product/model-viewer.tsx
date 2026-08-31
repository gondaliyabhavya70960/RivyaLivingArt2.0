"use client";

import { useEffect, useState } from "react";

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
}

/**
 * Lazy `<model-viewer>` wrapper. The @google/model-viewer library touches
 * `window` at import time, so it is dynamically imported in an effect and
 * the element renders only once the custom element is registered.
 */
export function ModelViewer({ src, alt }: ModelViewerProps) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    import("@google/model-viewer")
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(() => {
        // 3D is progressive enhancement — leave the loading state up.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-deep-ocean to-sapphire-hi">
        <p className="text-sm tracking-[0.14em] text-mineral/80">
          Loading 3D view…
        </p>
      </div>
    );
  }

  return (
    <model-viewer
      src={src}
      alt={alt}
      camera-controls=""
      auto-rotate=""
      ar=""
      style={{ width: "100%", height: "100%" }}
    />
  );
}
