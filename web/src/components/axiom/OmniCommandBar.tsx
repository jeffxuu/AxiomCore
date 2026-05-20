import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Boxes, ChevronDown, Cpu, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { loadOracleConfig, parseCommand, type CommandParseResponse } from "@/api";
import { useT } from "@/lib/i18nConfig";
import { cn } from "@/lib/utils";
import {
  detectProvider,
  groupModels,
  PROVIDER_ORDER,
  type ProviderId,
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

function readStoredProvider(): ProviderId | "" {
  const value = readStored(PROVIDER_STORAGE_KEY);
  return (PROVIDER_ORDER as string[]).includes(value) ? (value as ProviderId) : "";
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
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>("");
  const [selectedProvider, setSelectedProvider] = useState<ProviderId | "">(() => readStoredProvider());
  const [selectedModel, setSelectedModel] = useState<string>(() => readStored(MODEL_STORAGE_KEY));

  const groups = useMemo(() => groupModels(models), [models]);
  const engineOptions = selectedProvider ? groups[selectedProvider] : [];

  const hydrate = useCallback(async () => {
    try {
      const cfg = await loadOracleConfig();
      const pool = cfg.models && cfg.models.length ? cfg.models : cfg.model_name ? [cfg.model_name] : [];
      setModels(pool);
      setDefaultModel(cfg.model_name || "");

      const groupsLocal = groupModels(pool);

      const storedProvider = readStoredProvider();
      const storedModel = readStored(MODEL_STORAGE_KEY);
      const fallbackModel = cfg.model_name || pool[0] || "";
      const candidateModel = storedModel && pool.includes(storedModel) ? storedModel : fallbackModel;
      const inferredProvider = candidateModel ? detectProvider(candidateModel) : "";

      let nextProvider: ProviderId | "" = "";
      if (storedProvider) {
        nextProvider = storedProvider;
      } else if (inferredProvider) {
        nextProvider = inferredProvider as ProviderId;
      } else {
        nextProvider = PROVIDER_ORDER[0];
      }
      setSelectedProvider(nextProvider);

      const bucket = nextProvider ? groupsLocal[nextProvider] : [];
      const nextModel = bucket.includes(candidateModel) ? candidateModel : bucket[0] || "";
      setSelectedModel(nextModel);
    } catch {
      /* Oracle not configured yet — silent. */
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    try {
      if (selectedProvider) window.localStorage.setItem(PROVIDER_STORAGE_KEY, selectedProvider);
    } catch {
      /* ignore */
    }
  }, [selectedProvider]);

  useEffect(() => {
    try {
      if (selectedModel) window.localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
    } catch {
      /* ignore */
    }
  }, [selectedModel]);

  const onProviderChange = (next: ProviderId | "") => {
    setSelectedProvider(next);
    if (!next) {
      setSelectedModel("");
      return;
    }
    const bucket = groups[next] || [];
    if (!bucket.includes(selectedModel)) {
      setSelectedModel(bucket[0] || "");
    }
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

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-5 py-2.5">
        <p className="min-w-0 flex-1 text-[11px] leading-5 text-muted-foreground">{t("omni.hint")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="group relative flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Boxes className="size-3 text-muted-foreground/80" />
            <span className="uppercase tracking-wider">{t("omni.console.provider")}</span>
            <span className="relative inline-flex items-center">
              <select
                aria-label={t("omni.console.provider")}
                value={selectedProvider}
                disabled={providerSelectDisabled}
                onChange={(e) => onProviderChange(e.target.value as ProviderId | "")}
                className={cn(
                  "h-7 max-w-[160px] appearance-none truncate rounded-md border border-border bg-background pl-2 pr-6 text-[11px]",
                  "font-medium text-foreground transition-colors",
                  "hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/30",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                {!selectedProvider ? (
                  <option value="">{t("omni.console.provider.empty")}</option>
                ) : null}
                {PROVIDER_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {t(`provider.${p}`)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 size-3 text-muted-foreground" />
            </span>
          </label>

          <label className="group relative flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Cpu className="size-3 text-muted-foreground/80" />
            <span className="uppercase tracking-wider">{t("omni.console.model")}</span>
            <span className="relative inline-flex items-center">
              <select
                aria-label={t("omni.console.model")}
                value={selectedModel}
                disabled={engineSelectDisabled}
                onChange={(e) => setSelectedModel(e.target.value)}
                className={cn(
                  "h-7 max-w-[200px] appearance-none truncate rounded-md border border-border bg-background pl-2 pr-6 text-[11px]",
                  "font-medium text-foreground transition-colors",
                  "hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/30",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                {!selectedProvider ? (
                  <option value="">{t("omni.console.model.empty")}</option>
                ) : engineOptions.length === 0 ? (
                  <option value="">{t("omni.console.engine.empty")}</option>
                ) : (
                  <>
                    <option value="">
                      {defaultModel
                        ? `${t("omni.console.model.default")} (${defaultModel})`
                        : t("omni.console.model.default")}
                    </option>
                    {engineOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </>
                )}
              </select>
              <ChevronDown className="pointer-events-none absolute right-1.5 size-3 text-muted-foreground" />
            </span>
          </label>
        </div>
      </footer>
    </section>
  );
}
