import { useState, type KeyboardEvent } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { parseCommand, type CommandParseResponse } from "@/api";
import { useT } from "@/lib/i18nConfig";
import { cn } from "@/lib/utils";

/**
 * OmniCommandBar — single-line natural-language ingestion surface.
 *
 * Replaces the legacy multi-field modal forms (transaction, decision, project,
 * vault) with one free-text prompt routed through the server-side 4SAPI parser.
 * The model returns a strict envelope (target_table, domain_tag, payload,
 * vault_markdown) which the backend dispatches to the right sink. We simply
 * surface the model's one-line summary and tell the parent to refresh.
 */
export function OmniCommandBar({ onIngested }: { onIngested: (result: CommandParseResponse) => void }) {
  const t = useT();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      const result = await parseCommand(value);
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

  return (
    <section
      className={cn(
        "ax-card relative mb-6 overflow-hidden rounded-xl",
        "border border-border bg-card/80 backdrop-blur",
        "shadow-[0_24px_60px_-30px_rgba(15,23,42,0.45)]",
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-md",
            "bg-foreground/5 text-foreground transition-colors",
          )}
        >
          <Sparkles className="size-4" />
        </span>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          placeholder={t("omni.placeholder")}
          disabled={busy}
          aria-label={t("omni.placeholder")}
          className={cn(
            "h-9 flex-1 border-none bg-transparent text-[14px] tracking-tight outline-none",
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
            "flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-[12px] font-medium transition-colors",
            "bg-foreground text-background hover:bg-foreground/90",
            "disabled:cursor-not-allowed disabled:bg-foreground/40",
          )}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
          {busy ? t("omni.sending") : t("omni.send")}
        </button>
      </div>

      {/* Streaming progress strip — visible only while parsing */}
      <div
        className={cn(
          "h-[2px] w-full overflow-hidden bg-transparent",
          busy ? "opacity-100" : "opacity-0",
        )}
        aria-hidden
      >
        <div
          className={cn(
            "h-full w-1/3 rounded-full bg-foreground/70",
            busy ? "ax-omni-stream" : "",
          )}
        />
      </div>
      <p className="border-t border-border/60 px-4 py-2 text-[11px] text-muted-foreground">
        {t("omni.hint")}
      </p>
    </section>
  );
}
