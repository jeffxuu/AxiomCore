import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { loadBrandConfig } from "@/api";
import type { BrandConfigPayload } from "@/types";

// Default values match the constants in lifeos_server.py. If /api/config is
// unreachable (offline, error, pre-build static html) the UI still renders the
// canonical brand instead of falling back to the internal code name.
export const DEFAULT_BRAND: Brand = {
  brandName: "Axiom Core",
  codeName: "LifeOS",
  tagline: "个人决策智能核心",
};

export type Brand = Pick<BrandConfigPayload, "brandName" | "codeName" | "tagline">;

const BrandContext = createContext<Brand>(DEFAULT_BRAND);

export function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<Brand>(DEFAULT_BRAND);

  useEffect(() => {
    let cancelled = false;
    loadBrandConfig()
      .then((payload) => {
        if (cancelled) return;
        setBrand({
          brandName: payload.brandName || DEFAULT_BRAND.brandName,
          codeName: payload.codeName || DEFAULT_BRAND.codeName,
          tagline: payload.tagline || DEFAULT_BRAND.tagline,
        });
      })
      .catch(() => {
        // Defaults already loaded; do nothing. /api/config is public so a
        // network blip should not stall the UI.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => brand, [brand]);
  return <BrandContext.Provider value={value}>{children}</BrandContext.Provider>;
}

export function useBrand(): Brand {
  return useContext(BrandContext);
}
