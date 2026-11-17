import { createContext, useContext, type ReactNode } from "react";

import type { Platform } from "./types";

const PlatformContext = createContext<Platform | null>(null);

export function PlatformProvider({ platform, children }: { platform: Platform; children: ReactNode }) {
  return <PlatformContext.Provider value={platform}>{children}</PlatformContext.Provider>;
}

/** The platform the app is running on (desktop, web, or the example preview). */
export function usePlatform(): Platform {
  const p = useContext(PlatformContext);
  if (!p) throw new Error("usePlatform must be used inside <PlatformProvider>");
  return p;
}
