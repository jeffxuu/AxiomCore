// Two-tier model classifier for the 4SAPI aggregated gateway.
//
// `groupModels(models)` partitions a flat list of engine identifiers into
// five canonical provider buckets. Each bucket keeps engines deduplicated
// and ordered case-insensitively so downstream selectors render a stable
// list.

export type ProviderId = "anthropic" | "openai" | "google" | "deepseek" | "other";

export const PROVIDER_ORDER: ProviderId[] = [
  "anthropic",
  "openai",
  "google",
  "deepseek",
  "other",
];

export type ProviderGroups = Record<ProviderId, string[]>;

const ANTHROPIC_RE = /claude/i;
const OPENAI_RE = /(^|[\-/])(gpt-?\d|o\d|chatgpt|openai)/i;
const GOOGLE_RE = /(gemini|google|palm|bison|gecko)/i;
const DEEPSEEK_RE = /deepseek/i;

export function detectProvider(model: string): ProviderId {
  const id = (model ?? "").trim();
  if (!id) return "other";
  if (ANTHROPIC_RE.test(id)) return "anthropic";
  if (OPENAI_RE.test(id)) return "openai";
  if (GOOGLE_RE.test(id)) return "google";
  if (DEEPSEEK_RE.test(id)) return "deepseek";
  return "other";
}

export function groupModels(models: string[]): ProviderGroups {
  const buckets: ProviderGroups = {
    anthropic: [],
    openai: [],
    google: [],
    deepseek: [],
    other: [],
  };
  const seen = new Set<string>();
  for (const raw of models || []) {
    if (typeof raw !== "string") continue;
    const m = raw.trim();
    if (!m || seen.has(m)) continue;
    seen.add(m);
    buckets[detectProvider(m)].push(m);
  }
  for (const key of PROVIDER_ORDER) {
    buckets[key].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }
  return buckets;
}

export function providersWithEngines(groups: ProviderGroups): ProviderId[] {
  return PROVIDER_ORDER.filter((p) => groups[p].length > 0);
}
