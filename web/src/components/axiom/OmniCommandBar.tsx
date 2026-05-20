import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Boxes, ChevronDown, Cpu, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { loadOracleConfig, parseCommand, type CommandParseResponse } from "@/api";
import { useI18n, useT } from "@/lib/i18nConfig";
import { cn } from "@/lib/utils";
import {
  detectVendor,
  parseAllModelsAndProviders,
} from "@/lib/modelGrouping";

const MODEL_STORAGE_KEY = "axiom.omni.parse_model";
const PROVIDER_STORAGE_KEY = "axiom.omni.parse_provider";

function readStored(key: string): string {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

/**
 * OmniCommandBar — top-level Core Command Console.
 *
 * One free-text prompt routed through the server-side 4SAPI parser. The model
 * returns a strict envelope (target_table, domain_tag, payload, vault_markdown)
 * which the backend dispatches to the right sink. The operator can pick which
 * 4SAPI inference engine handles each submission via the two-tier cascade —
 * choose provider (Anthropic / OpenAI / Google / DeepSeek / Other), then a
 * specific engine inside that provider.
 */
export function OmniCommandBar({ onIngested }: { onIngested: (result: CommandParseResponse) => void }) {
  const t = useT();
  const { lang } = useI18n();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<string>(() => readStored(PROVIDER_STORAGE_KEY));
  const [selectedModel, setSelectedModel] = useState<string>(() => readStored(MODEL_STORAGE_KEY));

  const { dynamicProviders, bucketMap } = useMemo(
    () => parseAllModelsAndProviders(models, lang === "en"),
    [models, lang],
  );
  const engineOptions = selectedProvider ? bucketMap.get(selectedProvider) || [] : [];

  const hydrate = useCallback(async () => {
    try {
      const cfg = await loadOracleConfig();
      const pool = cfg.models && cfg.models.length ? cfg.models : cfg.model_name ? [cfg.model_name] : [];
      setModels(pool);
      setDefaultModel(cfg.model_name || "");

      const { dynamicProviders: providersLocal, bucketMap: bucketsLocal } =
        parseAllModelsAndProviders(pool, lang === "en");

      const storedProvider = readStored(PROVIDER_STORAGE_KEY);
      const storedModel = readStored(MODEL_STORAGE_KEY);
      const fallbackModel = cfg.model_name || pool[0] || "";
      const candidateModel = storedModel && pool.includes(storedModel) ? storedModel : fallbackModel;
      const inferredProvider = candidateModel ? detectVendor(candidateModel) : "";

      const nextProvider =
        (storedProvider && bucketsLocal.has(storedProvider) ? storedProvider : "") ||
        (bucketsLocal.has(inferredProvider) ? inferredProvider : "") ||
        providersLocal[0]?.key ||
        "";
      setSelectedProvider(nextProvider);

      const bucket = nextProvider ? bucketsLocal.get(nextProvider) || [] : [];
      const nextModel = bucket.includes(candidateModel) ? candidateModel : bucket[0] || "";
      setSelectedModel(nextModel);
    } catch {
      /* Oracle not configured yet — silent. */
    }
  }, [lang]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    try {
      if (selectedProvider) {
        window.localStorage.setItem(PROVIDER_STORAGE_KEY, selectedProvider);
      } else {
        window.localStorage.removeItem(PROVIDER_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [selectedProvider]);

  useEffect(() => {
    try {
      if (selectedModel) {
        window.localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
      } else {
        window.localStorage.removeItem(MODEL_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [selectedModel]);

  // Snap the provider into the dynamic list whenever the pool changes (e.g.
  // after the Oracle key flips from a single-vendor key to the 4SAPI all-model
  // key). Without this, a stored vendor that no longer exists deadlocks the
  // engine select on a blank.
  useEffect(() => {
    if (dynamicProviders.length === 0) return;
    if (!selectedProvider || !bucketMap.has(selectedProvider)) {
      setSelectedProvider(dynamicProviders[0].key);
    }
  }, [dynamicProviders, bucketMap, selectedProvider]);

  // Snap selectedModel into the active bucket. Empty string is preferred here
  // (vs OraclePage) because the engine <select> exposes an explicit "use
  // default model" option, so the empty state is meaningful.
  useEffect(() => {
    if (!selectedProvider) {
      if (selectedModel) setSelectedModel("");
      return;
    }
    const bucket = bucketMap.get(selectedProvider) || [];
    if (bucket.length === 0) {
      if (selectedModel) setSelectedModel("");
      return;
    }
    if (selectedModel && !bucket.includes(selectedModel)) {
      setSelectedModel(bucket[0]);
    }
    // selectedModel intentionally excluded — see OraclePage.tsx for the same
    // rationale.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvider, bucketMap]);

  const onProviderChange = (next: string) => {
    setSelectedProvider(next);
  };

  const submit = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const result = await parseCommand(value, selectedModel || null);
      toast.success(result.summary || t("omni.success"));
      setText("");
      onIngested(result);
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : t("omni.toast.fail");
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  const providerSelectDisabled = busy;
  const engineSelectDisabled = busy || !selectedProvider || engineOptions.length === 0;

  return (
    <section
      className={cn(
        "ax-card relative mb-6 overflow-hidden rounded-2xl",
        "border border-border bg-gradient-to-br from-card to-card/60 backdrop-blur",
        "shadow-[0_30px_80px_-40px_rgba(15,23,42,0.55)]",
      )}
    >
      <header className="flex items-start gap-3 border-b border-border/50 px-5 pt-4 pb-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {t("omni.console.eyebrow")}
          </p>
          <h2 className="mt-0.5 text-[15px] font-semibold tracking-tight text-foreground">
            {t("omni.console.title")}
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{t("omni.console.subtitle")}</p>
        </div>
      </header>

      <div className="flex items-center gap-3 px-5 py-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={t("omni.placeholder")}
          disabled={busy}
          aria-label={t("omni.placeholder")}
          className={cn(
            "h-10 flex-1 border-none bg-transparent text-[14px] tracking-tight outline-none",
            "placeholder:text-muted-foreground/80 focus-visible:ring-0",
            "disabled:opacity-60",
          )}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || !text.trim()}
          aria-label={t("omni.send")}
          className={cn(
            "flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-4 text-[12px] font-medium transition-colors",
            "bg-foreground text-background hover:bg-foreground/90",
            "disabled:cursor-not-allowed disabled:bg-foreground/40",
          )}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          {busy ? t("omni.streaming") : t("omni.send")}
        </button>
      </div>

      {/* Streaming progress strip */}
      <div
        className={cn(
          "h-[2px] w-full overflow-hidden bg-transparent",
          busy ? "opacity-100" : "opacity-0",
        )}
        aria-hidden
      >
        <div className={cn("h-full w-1/3 rounded-full bg-foreground/70", busy ? "ax-omni-stream" : "")} />
      </div>

      {/* Two-tier cascading selector — two independent dropdowns side-by-side.
          Left: vendor (static 4 providers). Right: engines under the chosen vendor. */}
      <div
        role="group"
        aria-label={t("omni.console.cascade.aria")}
        className="grid grid-cols-1 gap-2 border-t border-border/60 px-5 py-3 sm:grid-cols-2 sm:gap-3"
      >
        <div className="space-y-1.5">
          <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <Boxes className="size-3 text-muted-foreground/80" />
            {t("omni.console.provider")}
          </span>
          <span className="relative block">
            <select
              aria-label={t("omni.console.provider")}
              value={selectedProvider}
              disabled={providerSelectDisabled || dynamicProviders.length === 0}
              onChange={(e) => onProviderChange(e.target.value)}
              className={cn(
                "h-9 w-full appearance-none truncate rounded-md border border-border bg-background pl-3 pr-8 text-[12px]",
                "font-medium text-foreground transition-colors",
                "hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/30",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {dynamicProviders.length === 0 ? (
                <option value="">{t("omni.console.provider.placeholder")}</option>
              ) : null}
              {!selectedProvider && dynamicProviders.length > 0 ? (
                <option value="">{t("omni.console.provider.placeholder")}</option>
              ) : null}
              {dynamicProviders.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          </span>
        </div>

        <div className="space-y-1.5">
          <span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
            <Cpu className="size-3 text-muted-foreground/80" />
            {t("omni.console.model")}
          </span>
          <span className="relative block">
            <select
              aria-label={t("omni.console.model")}
              value={selectedModel}
              disabled={engineSelectDisabled}
              onChange={(e) => setSelectedModel(e.target.value)}
              className={cn(
                "h-9 w-full appearance-none truncate rounded-md border border-border bg-background pl-3 pr-8 text-[12px]",
                "font-medium text-foreground transition-colors",
                "hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/30",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {!selectedProvider ? (
                <option value="">{t("omni.console.engine.locked")}</option>
              ) : engineOptions.length === 0 ? (
                <option value="">{t("omni.console.engine.empty")}</option>
              ) : (
                <>
                  <option value="">
                    {defaultModel
                      ? `${t("omni.console.model.default")} (${defaultModel})`
                      : t("omni.console.engine.placeholder")}
                  </option>
                  {engineOptions.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </>
              )}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          </span>
        </div>
      </div>

      <footer className="border-t border-border/60 px-5 py-2.5">
        <p className="text-[11px] leading-5 text-muted-foreground">{t("omni.hint")}</p>
      </footer>
    </section>
  );
}
