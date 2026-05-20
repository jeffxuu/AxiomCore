// Two-tier model classifier for the 4SAPI aggregated gateway.
//
// Defensive: a static 4-vendor dictionary + lowercase fuzzy `includes`
// matching, so any model string returned by /api/oracle/verify lands in the
// right bucket regardless of casing, punctuation, or vendor prefixes.

export type ProviderId = "openai" | "anthropic" | "google" | "deepseek";

export const PROVIDER_ORDER: ProviderId[] = [
  "openai",
  "anthropic",
  "google",
  "deepseek",
];

export type ProviderGroups = Record<ProviderId, string[]>;

export function getModelsByProvider(
  rawModels: readonly string[] | null | undefined,
  providerKey: ProviderId,
): string[] {
  if (!rawModels || rawModels.length === 0) return [];
  return rawModels.filter((model) => {
    if (typeof model !== "string") return false;
    const m = model.toLowerCase();
    switch (providerKey) {
      case "openai":
        return (
          (m.includes("gpt-") ||
            m.startsWith("gpt") ||
            m.startsWith("o1-") ||
            m.startsWith("o3-") ||
            m.startsWith("o4-") ||
            m.includes("chatgpt")) &&
          !m.includes("claude") &&
          !m.includes("gemini") &&
          !m.includes("deepseek")
        );
      case "anthropic":
        return m.includes("claude");
      case "google":
        return m.includes("gemini");
      case "deepseek":
        return m.includes("deepseek");
      default:
        return false;
    }
  });
}

export function detectProvider(model: string): ProviderId | "" {
  const m = (model ?? "").toLowerCase().trim();
  if (!m) return "";
  if (m.includes("claude")) return "anthropic";
  if (m.includes("gemini")) return "google";
  if (m.includes("deepseek")) return "deepseek";
  if (
    m.includes("gpt-") ||
    m.startsWith("gpt") ||
    m.startsWith("o1-") ||
    m.startsWith("o3-") ||
    m.startsWith("o4-") ||
    m.includes("chatgpt")
  ) {
    return "openai";
  }
  return "";
}

export function groupModels(models: readonly string[] | null | undefined): ProviderGroups {
  const buckets: ProviderGroups = {
    openai: [],
    anthropic: [],
    google: [],
    deepseek: [],
  };
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const raw of models || []) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    cleaned.push(trimmed);
  }
  for (const key of PROVIDER_ORDER) {
    const arr = getModelsByProvider(cleaned, key);
    arr.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    buckets[key] = arr;
  }
  return buckets;
}
