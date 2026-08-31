"use client";

import { createContext, useContext, type ReactNode } from "react";

import { SITE } from "@/lib/constants";

/**
 * Supplies the studio-configured WhatsApp number (Site Settings, ENG-001) to
 * client components that build wa.me links, without prop-drilling through the
 * shop grid / dialogs. The server public layout resolves the number once via
 * getSiteSettings() and passes it here; client CTAs read it with useWaNumber().
 * Falls back to the SITE constant when no provider is mounted (isolated tests).
 * Server components/pages don't use this — they read getSiteSettings() directly.
 */
const WaNumberContext = createContext<string>(SITE.whatsappNumber);

export function WaNumberProvider({
  number,
  children,
}: {
  number: string;
  children: ReactNode;
}) {
  return (
    <WaNumberContext.Provider value={number}>
      {children}
    </WaNumberContext.Provider>
  );
}

/** The active studio WhatsApp number for building wa.me contact links. */
export function useWaNumber(): string {
  return useContext(WaNumberContext);
}
