import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatApiError } from "@/api";
import { EmptyHint, PageHeader, Panel } from "@/components/axiom/primitives";

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

async function apiFetch<T>(url: string, options: RequestInit = {}, timeoutMs = 90000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const payload = (await response.json().catch(() => ({}))) as { detail?: unknown; error?: unknown };
    if (!response.ok) throw new Error(formatApiError(payload, `HTTP ${response.status}`));
    return payload as T;
  } catch (exc) {
    if (exc instanceof DOMException && exc.name === "AbortError") throw new Error("Request timed out");
    if (exc instanceof Error) throw exc;
    throw new Error("Request failed");
  } finally {
    window.clearTimeout(timer);
  }
}

export function OraclePage({ onStatus }: { onStatus: (status: string) => void }) {
  const [models, setModels] = useState<AiModel[]>([]);
  const [model, setModel] = useState(() => ls("lf-model") || "Pro/deepseek-ai/DeepSeek-V3.2");
  const [prompt, setPrompt] = useState(
    "Given the snapshot, name the top three actions for the next 7 days, and one thing I should stop doing immediately."
  );
  const [apiKey, setApiKey] = useState(() => ls("lf-api-key"));
  const [generating, setGenerating] = useState(false);
  const [reply, setReply] = useState<AiResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<ModelsPayload>("/api/ai/models", {}, 15000)
      .then((p) => setModels(p.models || []))
      .catch(() => undefined);
  }, []);

  const run = async () => {
    setGenerating(true);
    setError("");
    onStatus("Sync");
    try {
      const payload: Record<string, unknown> = { prompt, model };
      if (apiKey.trim()) payload.api_key_override = apiKey.trim();
      const response = await apiFetch<AiResponse>("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }, 120000);
      setReply(response);
      lsSet("lf-model", model);
      if (apiKey.trim()) lsSet("lf-api-key", apiKey.trim());
      onStatus("Live");
      toast.success("Brief generated");
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : "Failed";
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
        eyebrow="Knowledge"
        title="Oracle"
        description="Hand the live snapshot (capital, projects, decisions, recent transactions) to a model and ask for a brief."
        actions={
          <Button
            onClick={run}
            disabled={generating || !prompt.trim()}
            className="h-9 rounded-lg bg-foreground text-background hover:bg-foreground/90"
          >
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {generating ? "Analyzing…" : "Run brief"}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Panel title="Prompt" subtitle="Plain English. The server prepends the live snapshot.">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Question</Label>
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

        <Panel title="Model" subtitle="Picked once, remembered locally.">
          <div className="space-y-3">
            <select
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
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">API key (optional)</Label>
              <Input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-…"
                className="h-9 rounded-md"
              />
              <p className="text-[11px] text-muted-foreground">Stored only in this browser. Overrides server env key.</p>
            </div>
          </div>
        </Panel>
      </div>

      <Panel className="mt-6" title="Output" subtitle={reply ? `${reply.model} · ${reply.provider}` : "Run a brief to see the response here."}>
        {reply ? (
          <ScrollArea className="max-h-[60vh] pr-3">
            <pre className="whitespace-pre-wrap text-[13px] leading-6 text-foreground">{reply.reply}</pre>
          </ScrollArea>
        ) : (
          <EmptyHint title="No output yet" />
        )}
      </Panel>
    </div>
  );
}
