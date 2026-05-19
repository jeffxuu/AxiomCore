import { useEffect, useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatApiError } from "@/api";
import { EmptyHint, PageHeader, Panel } from "@/components/axiom/primitives";
import { useT } from "@/lib/i18nConfig";

type AiModel = { id: string; name: string; provider: string };
type ModelsPayload = { ok: true; models: AiModel[] };
type AiResponse = { ok: true; reply: string; model: string; provider: string };

function ls(key: string): string {
  try {
    return localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}
function lsSet(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

async function apiFetch<T>(url: string, options: RequestInit = {}, timeoutMs = 90000, timeoutMessage = "Request timed out"): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const payload = (await response.json().catch(() => ({}))) as { detail?: unknown; error?: unknown };
    if (!response.ok) throw new Error(formatApiError(payload, `HTTP ${response.status}`));
    return payload as T;
  } catch (exc) {
    if (exc instanceof DOMException && exc.name === "AbortError") throw new Error(timeoutMessage);
    if (exc instanceof Error) throw exc;
    throw new Error("Request failed");
  } finally {
    window.clearTimeout(timer);
  }
}

export function OraclePage({ onStatus }: { onStatus: (status: string) => void }) {
  const t = useT();
  const defaultPrompt = useMemo(() => t("oracle.prompt.default"), [t]);
  const [models, setModels] = useState<AiModel[]>([]);
  const [model, setModel] = useState(() => ls("lf-model") || "Pro/deepseek-ai/DeepSeek-V3.2");
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [apiKey, setApiKey] = useState(() => ls("lf-api-key"));
  const [generating, setGenerating] = useState(false);
  const [reply, setReply] = useState<AiResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<ModelsPayload>("/api/ai/models", {}, 15000, t("oracle.toast.timeout"))
      .then((p) => setModels(p.models || []))
      .catch(() => undefined);
  }, [t]);

  const run = async () => {
    setGenerating(true);
    setError("");
    onStatus("Sync");
    try {
      const payload: Record<string, unknown> = { prompt, model };
      if (apiKey.trim()) payload.api_key_override = apiKey.trim();
      const response = await apiFetch<AiResponse>(
        "/api/ai-analyze",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
        120000,
        t("oracle.toast.timeout")
      );
      setReply(response);
      lsSet("lf-model", model);
      if (apiKey.trim()) lsSet("lf-api-key", apiKey.trim());
      onStatus("Live");
      toast.success(t("oracle.toast.ok"));
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : t("oracle.toast.failed");
      setError(message);
      onStatus("Sync failed");
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow={t("oracle.eyebrow")}
        title={t("oracle.title")}
        description={t("oracle.desc")}
        actions={
          <Button
            onClick={run}
            disabled={generating || !prompt.trim()}
            className="h-9 rounded-lg bg-foreground text-background hover:bg-foreground/90"
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {generating ? t("oracle.running") : t("oracle.run")}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Panel title={t("oracle.prompt")} subtitle={t("oracle.prompt.desc")}>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {t("oracle.prompt.question")}
              </Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="min-h-28 rounded-md text-[13px] leading-6"
              />
            </div>
            {error ? (
              <div className="rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-3 py-2 text-[12px] text-[var(--danger)]">
                {error}
              </div>
            ) : null}
          </div>
        </Panel>

        <Panel title={t("oracle.model")} subtitle={t("oracle.model.desc")}>
          <div className="space-y-3">
            <select
              aria-label={t("oracle.model")}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="h-9 w-full rounded-md border border-border bg-background px-2 text-[13px]"
            >
              {models.length === 0 ? (
                <option value={model}>{model}</option>
              ) : (
                models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {m.provider}
                  </option>
                ))
              )}
            </select>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("oracle.apikey")}</Label>
              <Input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-…"
                className="h-9 rounded-md"
              />
              <p className="text-[11px] text-muted-foreground">{t("oracle.apikey.hint")}</p>
            </div>
          </div>
        </Panel>
      </div>

      <Panel
        className="mt-6"
        title={t("oracle.output")}
        subtitle={reply ? `${reply.model} · ${reply.provider}` : t("oracle.output.empty")}
      >
        {reply ? (
          <ScrollArea className="max-h-[60vh] pr-3">
            <pre className="whitespace-pre-wrap text-[13px] leading-6 text-foreground">{reply.reply}</pre>
          </ScrollArea>
        ) : (
          <EmptyHint title={t("oracle.empty.title")} />
        )}
      </Panel>
    </div>
  );
}
