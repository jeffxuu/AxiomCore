import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, KeyRound, Loader2, PlayCircle, RefreshCw, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownView } from "@/components/axiom/MarkdownView";
import { EmptyHint, PageHeader, Panel, StatusDot } from "@/components/axiom/primitives";
import { formatApiError } from "@/api";
import { useT } from "@/lib/i18nConfig";
import { cn } from "@/lib/utils";

type OracleConfig = {
  ok: true;
  api_key_masked: string;
  api_key_set: boolean;
  model_name: string;
  base_url: string;
  schedule: string;
};

type VerifyResponse = { ok: true; models: string[]; total: number };
type SaveResponse = { ok: true; api_key_masked: string; api_key_set: boolean; model_name: string };
type OracleReport = { id: string; kind: string; content: string; created_at: string };
type ReportsPayload = { ok: true; reports: OracleReport[] };
type GeneratePayload = { ok: true; report: OracleReport };

async function jsonRequest<T>(url: string, init: RequestInit = {}, timeoutMs = 90_000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
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

function formatReportTimestamp(value: string): string {
  if (!value) return "";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function OraclePage({ onStatus }: { onStatus: (status: string) => void }) {
  const t = useT();

  const [config, setConfig] = useState<OracleConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [keyDirty, setKeyDirty] = useState(false);

  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);

  const [reports, setReports] = useState<OracleReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const maskedFromServer = config?.api_key_masked || "";
  const inputDisplaysMask = !keyDirty && maskedFromServer;
  const apiKeyForUI = inputDisplaysMask ? maskedFromServer : apiKeyInput;

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const payload = await jsonRequest<OracleConfig>("/api/oracle/config", {}, 15_000);
      setConfig(payload);
      if (payload.model_name) {
        setSelectedModel(payload.model_name);
        setModels((prev) => (prev.length === 0 ? [payload.model_name] : prev));
      }
      setApiKeyInput("");
      setKeyDirty(false);
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : "Load failed";
      toast.error(message);
    } finally {
      setConfigLoading(false);
    }
  }, []);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const payload = await jsonRequest<ReportsPayload>("/api/oracle/reports?limit=50", {}, 15_000);
      setReports(payload.reports || []);
      setSelectedReportId((prev) => prev || payload.reports?.[0]?.id || null);
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : "Load failed";
      toast.error(message);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
    loadReports();
  }, [loadConfig, loadReports]);

  const verify = async () => {
    const candidate = keyDirty ? apiKeyInput.trim() : "";
    if (!candidate || candidate.includes("***")) {
      toast.error(t("oracle.control.apikey.hint"));
      return;
    }
    setVerifying(true);
    onStatus("Sync");
    try {
      const payload = await jsonRequest<VerifyResponse>(
        "/api/oracle/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: candidate }),
        },
        30_000
      );
      setModels(payload.models || []);
      if (payload.models?.length) {
        const next = payload.models.includes(selectedModel) ? selectedModel : payload.models[0];
        setSelectedModel(next);
      }
      onStatus("Live");
      toast.success(t("oracle.control.verified", { count: payload.total }));
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : "Verification failed";
      onStatus("Sync failed");
      toast.error(message);
    } finally {
      setVerifying(false);
    }
  };

  const save = async () => {
    if (!selectedModel) {
      toast.error(t("oracle.control.engine.placeholder"));
      return;
    }
    setSaving(true);
    onStatus("Sync");
    try {
      const body: Record<string, string> = { model_name: selectedModel };
      if (keyDirty && apiKeyInput.trim() && !apiKeyInput.includes("***")) {
        body.api_key = apiKeyInput.trim();
      }
      const payload = await jsonRequest<SaveResponse>(
        "/api/oracle/config",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
        15_000
      );
      setConfig((prev) =>
        prev
          ? { ...prev, api_key_masked: payload.api_key_masked, api_key_set: payload.api_key_set, model_name: payload.model_name }
          : null
      );
      setApiKeyInput("");
      setKeyDirty(false);
      onStatus("Live");
      toast.success(t("oracle.control.saved"));
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : "Save failed";
      onStatus("Sync failed");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const trigger = async () => {
    if (!config?.api_key_set || !selectedModel) {
      toast.error(t("oracle.control.engine.placeholder"));
      return;
    }
    setGenerating(true);
    onStatus("Sync");
    try {
      const payload = await jsonRequest<GeneratePayload>(
        "/api/oracle/generate_now",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) },
        120_000
      );
      setReports((prev) => [payload.report, ...prev]);
      setSelectedReportId(payload.report.id);
      onStatus("Live");
      toast.success(t("oracle.toast.generated"));
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : "Failed";
      onStatus("Sync failed");
      toast.error(message);
    } finally {
      setGenerating(false);
    }
  };

  const activeReport = useMemo(
    () => reports.find((r) => r.id === selectedReportId) || null,
    [reports, selectedReportId]
  );

  const canVerify = keyDirty && apiKeyInput.trim().length > 0 && !apiKeyInput.includes("***") && !verifying;
  const canSave = !!selectedModel && !saving && !verifying;
  const canTrigger = !generating && !!config?.api_key_set && !!selectedModel;

  return (
    <div>
      <PageHeader
        eyebrow={t("oracle.eyebrow")}
        title={t("oracle.title")}
        description={t("oracle.desc")}
        actions={
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <StatusDot tone={config?.api_key_set ? "positive" : "warning"} />
            <span>
              {config?.api_key_set ? `${maskedFromServer || "***"} · ${config.model_name || "—"}` : t("oracle.control.engine.placeholder")}
            </span>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Panel title={t("oracle.control.title")} subtitle={t("oracle.control.subtitle")}>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                <KeyRound className="size-3" />
                {t("oracle.control.apikey")}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={apiKeyForUI}
                  onChange={(e) => {
                    setApiKeyInput(e.target.value);
                    setKeyDirty(true);
                  }}
                  onFocus={() => {
                    if (inputDisplaysMask) {
                      setApiKeyInput("");
                      setKeyDirty(true);
                    }
                  }}
                  placeholder={t("oracle.control.apikey.placeholder")}
                  className="h-9 flex-1 rounded-md font-mono text-[12px]"
                  disabled={configLoading}
                />
                <Button
                  variant="outline"
                  className="h-9 shrink-0 rounded-md"
                  onClick={verify}
                  disabled={!canVerify}
                >
                  {verifying ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                  {verifying ? t("oracle.control.verifying") : t("oracle.control.verify")}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">{t("oracle.control.apikey.hint")}</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                <Sparkles className="size-3" />
                {t("oracle.control.engine")}
              </Label>
              <select
                aria-label={t("oracle.control.engine")}
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                disabled={configLoading || (models.length === 0 && !selectedModel)}
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-[13px] disabled:opacity-50"
              >
                {!selectedModel && models.length === 0 ? (
                  <option value="">{t("oracle.control.engine.placeholder")}</option>
                ) : null}
                {selectedModel && !models.includes(selectedModel) ? (
                  <option value={selectedModel}>{selectedModel}</option>
                ) : null}
                {models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end">
              <Button
                className="h-9 rounded-md bg-foreground text-background hover:bg-foreground/90"
                onClick={save}
                disabled={!canSave}
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {saving ? t("oracle.control.saving") : t("oracle.control.save")}
              </Button>
            </div>
          </div>
        </Panel>

        <Panel title={t("oracle.execution.title")} subtitle={t("oracle.execution.subtitle")}>
          <div className="flex h-full flex-col justify-between gap-5">
            <div>
              <Button
                onClick={trigger}
                disabled={!canTrigger}
                className="h-11 w-full rounded-md bg-foreground text-base font-medium text-background hover:bg-foreground/90"
              >
                {generating ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
                {generating ? t("oracle.execution.triggering") : t("oracle.execution.trigger")}
              </Button>
              <p className="mt-3 text-center text-[12px] leading-5 text-muted-foreground">
                {t("oracle.execution.schedule")}
              </p>
            </div>
            <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2.5 text-[11px] leading-5 text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3 text-[var(--positive)]" />
                <span className="font-medium text-foreground">APScheduler · Asia/Shanghai</span>
              </div>
              <div className="mt-0.5 ml-[18px]">Cron 23:30 · auto audit & daily brief</div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <Panel
          title={t("oracle.reports.title")}
          subtitle={t("oracle.reports.subtitle")}
          contentClassName="p-0"
        >
          {reportsLoading ? (
            <div className="flex items-center justify-center px-5 py-10 text-[12px] text-muted-foreground">
              <Loader2 className="mr-2 size-3 animate-spin" /> Loading…
            </div>
          ) : reports.length === 0 ? (
            <div className="px-5 py-6">
              <EmptyHint title={t("oracle.reports.empty")} />
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <ul className="divide-y divide-border">
                {reports.map((r) => {
                  const active = r.id === selectedReportId;
                  const kindLabel =
                    r.kind === "daily"
                      ? t("oracle.reports.kind.daily")
                      : r.kind === "manual"
                        ? t("oracle.reports.kind.manual")
                        : r.kind;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedReportId(r.id)}
                        className={cn(
                          "block w-full px-4 py-3 text-left transition-colors",
                          active ? "bg-muted/60" : "hover:bg-muted/30"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] font-medium text-foreground">{kindLabel}</span>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {r.kind === "daily" ? "AUTO" : "MANUAL"}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">{formatReportTimestamp(r.created_at)}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </ScrollArea>
          )}
        </Panel>

        <Panel
          title={t("oracle.output")}
          subtitle={activeReport ? formatReportTimestamp(activeReport.created_at) : t("oracle.report.empty")}
        >
          {activeReport ? (
            <ScrollArea className="max-h-[70vh] pr-3">
              <MarkdownView content={activeReport.content} className="border-0 bg-transparent p-0 shadow-none sm:p-0" />
            </ScrollArea>
          ) : (
            <EmptyHint title={t("oracle.report.empty")} />
          )}
        </Panel>
      </div>
    </div>
  );
}
