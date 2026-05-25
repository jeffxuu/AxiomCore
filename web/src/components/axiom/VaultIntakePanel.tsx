import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, SendHorizontal, Sparkles } from "lucide-react";
import { parseCommand, type CommandParseResponse } from "@/api";
import { Panel } from "@/components/axiom/primitives";
import { domainLabel } from "@/lib/domainLabels";
import { useT } from "@/lib/i18nConfig";

const EXAMPLES = ["cashflow", "project", "decision", "knowledge"] as const;

export function VaultIntakePanel({ onArchived }: { onArchived: () => void }) {
  const t = useT();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CommandParseResponse | null>(null);
  const [error, setError] = useState("");

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await parseCommand(value);
      setResult(response);
      setText("");
      onArchived();
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : t("vault.intake.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Panel
        title={t("vault.intake.title")}
        subtitle={t("vault.intake.subtitle")}
        contentClassName="space-y-4"
      >
        <div className="flex items-start gap-3 rounded-lg border border-border bg-[var(--ax-hover)] px-4 py-3">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <p className="text-[12px] leading-5 text-muted-foreground">{t("vault.intake.notice")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setText(t(`vault.intake.example.${example}`))}
              className="rounded-md border border-border bg-background px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-[var(--ax-hover)] hover:text-foreground"
            >
              {t(`vault.intake.example.${example}.label`)}
            </button>
          ))}
        </div>
        <form className="space-y-3" onSubmit={(event) => void submit(event)}>
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            disabled={busy}
            rows={7}
            aria-label={t("vault.intake.placeholder")}
            placeholder={t("vault.intake.placeholder")}
            className="w-full resize-y rounded-lg border border-border bg-background px-3.5 py-3 text-[13px] leading-6 outline-none transition-colors focus:border-[var(--ax-border-strong)] disabled:opacity-60"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-md text-[11px] leading-5 text-muted-foreground">{t("vault.intake.commitNote")}</p>
            <button
              type="submit"
              disabled={busy || !text.trim()}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-foreground px-4 text-[12px] font-medium text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy ? <Loader2 className="size-3.5 animate-spin" /> : <SendHorizontal className="size-3.5" />}
              {busy ? t("vault.intake.submitting") : t("vault.intake.submit")}
            </button>
          </div>
        </form>
        {error ? (
          <div className="rounded-md border border-[var(--ax-danger)]/40 bg-[var(--ax-danger)]/5 px-3 py-2 text-[12px]" style={{ color: "var(--ax-danger)" }}>
            {error}
          </div>
        ) : null}
        {result ? (
          <div className="rounded-lg border border-[var(--ax-positive)]/35 bg-[var(--ax-positive)]/5 px-4 py-3">
            <div className="flex items-center gap-2 text-[12px] font-medium" style={{ color: "var(--ax-positive)" }}>
              <CheckCircle2 className="size-4" />
              {t("vault.intake.saved")}
            </div>
            <p className="mt-2 text-[13px] text-foreground">{result.summary}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[10.5px] text-muted-foreground">
              <span className="rounded border border-border bg-background px-2 py-1">
                {t(`vault.intake.target.${result.target_table}`)}
              </span>
              {result.domain_tag ? (
                <span className="rounded border border-border bg-background px-2 py-1">
                  {domainLabel(result.domain_tag, t, result.domain_tag)}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}
      </Panel>
      <Panel title={t("vault.intake.guide.title")} contentClassName="space-y-4">
        {(["fact", "decision", "reflection"] as const).map((item) => (
          <div key={item}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-foreground">{t(`vault.intake.guide.${item}.title`)}</p>
            <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{t(`vault.intake.guide.${item}.desc`)}</p>
          </div>
        ))}
      </Panel>
    </div>
  );
}
