import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { ChevronDown, Cpu, Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { loadOracleConfig, parseCommand, type CommandParseResponse } from "@/api";
import { useT } from "@/lib/i18nConfig";
import { cn } from "@/lib/utils";

const MODEL_STORAGE_KEY = "axiom.omni.parse_model";

/**
 * OmniCommandBar — top-level Core Command Console.
 *
 * One free-text prompt routed through the server-side 4SAPI parser. The model
 * returns a strict envelope (target_table, domain_tag, payload, vault_markdown)
 * which the backend dispatches to the right sink. The operator can pick which
 * 4SAPI inference engine handles each submission via the right-side selector
 * (e.g. Claude for precision, DeepSeek for fast journaling).
 */
export function OmniCommandBar({ onIngested }: { onIngested: (result: CommandParseResponse) => void }) {
  const t = useT();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [defaultModel, setDefaultModel] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    try {
      return window.localStorage.getItem(MODEL_STORAGE_KEY) || "";
    } catch {
      return "";
    }
  });

  const hydrate = useCallback(async () => {
    try {
      const cfg = await loadOracleConfig();
      const pool = cfg.models && cfg.models.length ? cfg.models : cfg.model_name ? [cfg.model_name] : [];
      setModels(pool);
      setDefaultModel(cfg.model_name || "");
      setSelectedModel((prev) => {
        if (prev && pool.includes(prev)) return prev;
        return cfg.model_name || pool[0] || "";
      });
    } catch {
      /* Oracle not configured yet — silent. */
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    try {
      if (selectedModel) window.localStorage.setItem(MODEL_STORAGE_KEY, selectedModel);
    } catch {
      /* ignore */
    }
  }, [selectedModel]);

  const submit = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const result = await parseCommand(value, selectedModel || null);
      toast.success(result.summary || t("omni.toast.ok"));
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

  const selectorDisabled = busy || models.length === 0;

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
          {busy ? t("omni.sending") : t("omni.send")}
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
        <label className="group relative flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Cpu className="size-3 text-muted-foreground/80" />
          <span className="uppercase tracking-wider">{t("omni.console.model")}</span>
          <span className="relative inline-flex items-center">
            <select
              aria-label={t("omni.console.model")}
              value={selectedModel}
              disabled={selectorDisabled}
              onChange={(e) => setSelectedModel(e.target.value)}
              className={cn(
                "h-7 max-w-[180px] appearance-none truncate rounded-md border border-border bg-background pl-2 pr-6 text-[11px]",
                "font-medium text-foreground transition-colors",
                "hover:border-foreground/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-foreground/30",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              {models.length === 0 ? (
                <option value="">{t("omni.console.model.empty")}</option>
              ) : (
                <>
                  <option value="">
                    {defaultModel
                      ? `${t("omni.console.model.default")} (${defaultModel})`
                      : t("omni.console.model.default")}
                  </option>
                  {models.map((m) => (
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
      </footer>
    </section>
  );
}
