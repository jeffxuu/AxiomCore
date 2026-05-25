// Dynamic vendor ingestion engine for the 4SAPI aggregated gateway.
//
// 4SAPI's "all-model" key can return models from dozens of vendors
// (OpenAI, Anthropic, Google, DeepSeek, Qwen, Llama, Kimi, Mistral, Yi,
// Hunyuan, Ernie, GLM…) and the strings often carry an extra `gpt-` proxy
// shell. We do NOT hardcode the vendor list. Instead we keyword-sniff every
// raw model id, fall back to slicing on `-`, and let the bucket map drive
// the UI cascade.

export interface Provider {
  key: string;
  label: string;
}

// Curated bilingual labels for the vendors we know about. Anything not in
// this table is rendered with the vendor key title-cased.
export const PROVIDER_LABEL_MAP: Record<string, { zh: string; en: string }> = {
  openai: { zh: "OpenAI ( ChatGPT )", en: "OpenAI ( ChatGPT )" },
  anthropic: { zh: "Anthropic ( Claude )", en: "Anthropic ( Claude )" },
  google: { zh: "Google ( Gemini )", en: "Google ( Gemini )" },
  deepseek: { zh: "DeepSeek ( 深度求索 )", en: "DeepSeek" },
  alibaba: { zh: "Alibaba ( 通义千问 )", en: "Alibaba ( Qwen )" },
  tencent: { zh: "Tencent ( 腾讯混元 )", en: "Tencent ( Hunyuan )" },
  baidu: { zh: "Baidu ( 文心一言 )", en: "Baidu ( Ernie )" },
  meta: { zh: "Meta ( Llama )", en: "Meta ( Llama )" },
  moonshot: { zh: "Moonshot AI ( Kimi )", en: "Moonshot ( Kimi )" },
  mistral: { zh: "Mistral AI", en: "Mistral AI" },
  yi: { zh: "01.AI ( 零一万物 )", en: "01.AI ( Yi )" },
  zhipu: { zh: "智谱 AI ( GLM )", en: "Zhipu AI" },
  xai: { zh: "xAI ( Grok )", en: "xAI ( Grok )" },
  cohere: { zh: "Cohere", en: "Cohere" },
  perplexity: { zh: "Perplexity", en: "Perplexity" },
};

// Preferred ordering when several known vendors show up. Anything outside
// this list (including the dynamic slice-fallback vendors) is appended
// alphabetically.
const VENDOR_PRIORITY: string[] = [
  "openai",
  "anthropic",
  "google",
  "deepseek",
  "alibaba",
  "meta",
  "moonshot",
  "mistral",
  "yi",
  "zhipu",
  "baidu",
  "tencent",
  "xai",
  "cohere",
  "perplexity",
];

// Core single-string detector. Pure / deterministic so it doubles as the
// "what vendor does THIS id belong to" probe used by stored-state hydration.
export function detectVendor(model: string): string {
  const raw = (model ?? "").trim();
  if (!raw) return "";
  const m = raw.toLowerCase();

  // A. Keyword-precision interception (immune to nested `gpt-` proxy shells).
  if (m.includes("claude") || m.includes("anthropic")) return "anthropic";
  if (m.includes("gemini") || m.includes("google")) return "google";
  if (m.includes("deepseek")) return "deepseek";
  if (m.includes("qwen") || m.includes("qianwen")) return "alibaba";
  if (m.includes("llama")) return "meta";
  if (m.includes("kimi") || m.includes("moonshot")) return "moonshot";
  if (m.includes("mistral") || m.includes("mixtral") || m.includes("codestral")) return "mistral";
  if (m.includes("yi-") || m.startsWith("yi-") || m.includes("01-ai") || m.includes("01ai")) return "yi";
  if (m.includes("ernie") || m.includes("baidu") || m.includes("wenxin")) return "baidu";
  if (m.includes("hunyuan") || m.includes("tencent")) return "tencent";
  if (m.includes("glm") || m.includes("zhipu") || m.includes("chatglm")) return "zhipu";
  if (m.includes("grok") || m.includes("xai")) return "xai";
  if (m.includes("command-r") || m.includes("cohere")) return "cohere";
  if (m.includes("sonar") || m.includes("perplexity")) return "perplexity";
  if (m.includes("gpt-") || m.startsWith("gpt") || m.startsWith("o1-") || m.startsWith("o3-") || m.startsWith("o4-") || m.includes("chatgpt")) {
    return "openai";
  }

  // B. Slice fallback: 4SAPI proxy IDs often look like `gpt-<vendor>-<model>`.
  // Strip the leading `gpt-` shell, then take the first remaining segment.
  const parts = raw.split("-").filter(Boolean);
  if (parts.length >= 3 && parts[0].toLowerCase() === "gpt") {
    return parts[1].toLowerCase();
  }
  if (parts.length > 0) {
    return parts[0].toLowerCase();
  }
  return "other";
}

function vendorLabel(key: string, isEn: boolean): string {
  const entry = PROVIDER_LABEL_MAP[key];
  if (entry) return isEn ? entry.en : entry.zh;
  if (!key) return isEn ? "Other" : "其他";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function sortVendorKeys(keys: string[]): string[] {
  const known: string[] = [];
  const unknown: string[] = [];
  for (const key of keys) {
    if (VENDOR_PRIORITY.includes(key)) known.push(key);
    else unknown.push(key);
  }
  known.sort((a, b) => VENDOR_PRIORITY.indexOf(a) - VENDOR_PRIORITY.indexOf(b));
  unknown.sort((a, b) => a.localeCompare(b));
  return [...known, ...unknown];
}

/**
 * Scan a raw model pool, bucket every entry to its detected vendor, and
 * emit the data shape the two-tier cascade needs.
 *
 * Returns:
 *   - dynamicProviders: ordered Provider[] for the LEFT select.
 *   - bucketMap:        vendorKey -> string[] of models for the RIGHT select.
 */
export function parseAllModelsAndProviders(
  rawModels: readonly string[] | null | undefined,
  isEn: boolean,
): { dynamicProviders: Provider[]; bucketMap: Map<string, string[]> } {
  const bucketMap = new Map<string, string[]>();
  const seen = new Set<string>();

  for (const raw of rawModels || []) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);

    const vendor = detectVendor(trimmed) || "other";
    if (!bucketMap.has(vendor)) bucketMap.set(vendor, []);
    bucketMap.get(vendor)!.push(trimmed);
  }

  for (const [, list] of bucketMap) {
    list.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }

  const orderedKeys = sortVendorKeys(Array.from(bucketMap.keys()));
  const dynamicProviders: Provider[] = orderedKeys.map((key) => ({
    key,
    label: vendorLabel(key, isEn),
  }));

  return { dynamicProviders, bucketMap };
}
