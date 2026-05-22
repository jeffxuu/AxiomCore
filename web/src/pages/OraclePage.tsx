import { useCallback, useEffect, useMemo, useState } from "react";
import { Boxes, CalendarClock, KeyRound, Loader2, PlayCircle, RefreshCw, Save, Sparkles, Telescope, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { MarkdownView } from "@/components/axiom/MarkdownView";
import { EmptyHint, PageHeader, Panel, StatusDot } from "@/components/axiom/primitives";
import {
  deleteOracleReport,
  generateOracleBrief,
  loadOracleAuto,
  loadOracleConfig,
  loadOracleReports,
  saveOracleAuto,
  saveOracleConfig,
  verifyOracleKey,
  type OracleAutoConfig,
  type OracleConfig,
  type OracleReport,
} from "@/api";
import { useI18n, useT } from "@/lib/i18nConfig";
import { cn } from "@/lib/utils";
import {
  detectVendor,
  parseAllModelsAndProviders,
} from "@/lib/modelGrouping";

const ORACLE_PROVIDER_STORAGE_KEY = "axiom.oracle.provider";

function formatReportTimestamp(value: string, lang: "en" | "zh"): string {
  if (!value) return "";
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  const locale = lang === "zh" ? "zh-CN" : "en-GB";
  return date.toLocaleString(locale, { hour12: false });
}

function readStoredProvider(): string {
  try {
    return window.localStorage.getItem(ORACLE_PROVIDER_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

const DEFAULT_ORACLE_CONFIG: OracleConfig = {
  ok: true,
  api_key_masked: "",
  api_key_set: false,
  model_name: "",
  models: [],
  base_url: "",
  schedule: "",
};

const DEFAULT_ORACLE_AUTO: OracleAutoConfig = {
  ok: true,
  auto_daily: false,
  auto_weekly: false,
};

function safeText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeModelPool(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const models: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const model = item.trim();
    if (!model || seen.has(model)) continue;
    seen.add(model);
    models.push(model);
  }
  return models;
}

function normalizeOracleConfig(
  input: Partial<OracleConfig> | null | undefined,
  fallback: OracleConfig | null = null,
): OracleConfig {
  const base = fallback ?? DEFAULT_ORACLE_CONFIG;
  return {
    ok: true,
    api_key_masked: safeText(input?.api_key_masked, base.api_key_masked),
    api_key_set:
      typeof input?.api_key_set === "boolean"
        ? input.api_key_set
        : base.api_key_set,
    model_name: safeText(input?.model_name, base.model_name),
    models: normalizeModelPool(input?.models).length
      ? normalizeModelPool(input?.models)
      : normalizeModelPool(base.models),
    base_url: safeText(input?.base_url, base.base_url),
    schedule: safeText(input?.schedule, base.schedule),
  };
}

function normalizeOracleAuto(
  input: Partial<OracleAutoConfig> | null | undefined,
  fallback: OracleAutoConfig | null = null,
): OracleAutoConfig {
  const base = fallback ?? DEFAULT_ORACLE_AUTO;
  return {
    ok: true,
    auto_daily:
      typeof input?.auto_daily === "boolean"
        ? input.auto_daily
        : base.auto_daily,
    auto_weekly:
      typeof input?.auto_weekly === "boolean"
        ? input.auto_weekly
        : base.auto_weekly,
    daily_cron: safeText(input?.daily_cron, base.daily_cron ?? ""),
    weekly_cron: safeText(input?.weekly_cron, base.weekly_cron ?? ""),
  };
}

function normalizeOracleReport(input: Partial<OracleReport> | null | undefined): OracleReport | null {
  const id = safeText(input?.id).trim();
  if (!id) return null;
  return {
    id,
    kind: safeText(input?.kind, "manual"),
    content: safeText(input?.content),
    created_at: safeText(input?.created_at),
  };
}

function normalizeReports(input: unknown): OracleReport[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => normalizeOracleReport(item as Partial<OracleReport>))
    .filter((item): item is OracleReport => Boolean(item));
}

export function OraclePage({ onStatus }: { onStatus: (status: string) => void }) {
  const t = useT();
  const { lang } = useI18n();

  const [config, setConfig] = useState<OracleConfig | null>(null);
  const [auto, setAuto] = useState<OracleAutoConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);

  const [apiKeyInput, setApiKeyInput] = useState("");
  const [keyDirty, setKeyDirty] = useState(false);

  const [models, setModels] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string>(() => readStoredProvider());
  const [verifying, setVerifying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingAuto, setSavingAuto] = useState(false);

  const { dynamicProviders, bucketMap } = useMemo(
    () => parseAllModelsAndProviders(models, lang === "en"),
    [models, lang],
  );
  const engineOptions = selectedProvider ? bucketMap.get(selectedProvider) || [] : [];

  const [reports, setReports] = useState<OracleReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [generatingKind, setGeneratingKind] = useState<null | "manual" | "weekly">(null);

  const maskedFromServer = config?.api_key_masked || "";
  const inputDisplaysMask = !keyDirty && maskedFromServer;
  const apiKeyForUI = inputDisplaysMask ? maskedFromServer : apiKeyInput;

  const setShellStatus = useCallback(
    (next: string) => {
      try {
        if (typeof onStatus === "function") onStatus(next);
      } catch {
        /* The page must never break the outer shell status channel. */
      }
    },
    [onStatus],
  );

  const loadAll = useCallback(async () => {
    setConfigLoading(true);
    try {
      const [rawConfig, rawAuto] = await Promise.all([loadOracleConfig(), loadOracleAuto()]);
      const nextConfig = normalizeOracleConfig(rawConfig);
      const nextAuto = normalizeOracleAuto(rawAuto);
      setConfig(nextConfig);
      setAuto(nextAuto);
      const configModels = nextConfig.models ?? [];
      const pool = configModels.length ? configModels : nextConfig.model_name ? [nextConfig.model_name] : [];
      if (pool.length) setModels(pool);
      const initialModel = nextConfig.model_name || pool[0] || "";
      if (initialModel) {
        setSelectedModel(initialModel);
        const inferred = detectVendor(initialModel);
        const stored = readStoredProvider();
        const next = stored || inferred || "";
        if (next) setSelectedProvider(next);
      }
      setApiKeyInput("");
      setKeyDirty(false);
    } catch (exc) {
      setConfig((prev) => prev ?? DEFAULT_ORACLE_CONFIG);
      setAuto((prev) => prev ?? DEFAULT_ORACLE_AUTO);
      const message = exc instanceof Error ? exc.message : "";
      if (message) toast.error(message);
    } finally {
      setConfigLoading(false);
    }
  }, []);

  const loadReportsOnce = useCallback(async () => {
    setReportsLoading(true);
    try {
      const payload = await loadOracleReports(50);
      const nextReports = normalizeReports(payload?.reports);
      setReports(nextReports);
      setSelectedReportId((prev) =>
        prev && nextReports.some((report) => report.id === prev)
          ? prev
          : nextReports[0]?.id ?? null,
      );
    } catch (exc) {
      setReports([]);
      setSelectedReportId(null);
      const message = exc instanceof Error ? exc.message : "";
      if (message) toast.error(message);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    loadReportsOnce();
  }, [loadAll, loadReportsOnce]);

  useEffect(() => {
    try {
      if (selectedProvider) {
        window.localStorage.setItem(ORACLE_PROVIDER_STORAGE_KEY, selectedProvider);
      } else {
        window.localStorage.removeItem(ORACLE_PROVIDER_STORAGE_KEY);
      }
    } catch {
      /* ignore */
    }
  }, [selectedProvider]);

  // Snap the provider into the dynamic list. If the stored / inferred vendor
  // isn't represented in the current pool (e.g. the key flipped from a single-
  // vendor account to the 4SAPI multi-vendor key), default to the first bucket.
  useEffect(() => {
    if (dynamicProviders.length === 0) return;
    if (!selectedProvider || !bucketMap.has(selectedProvider)) {
      setSelectedProvider(dynamicProviders[0].key);
    }
  }, [dynamicProviders, bucketMap, selectedProvider]);

  // Snap the model into the active bucket. Without this the controlled select
  // deadlocks on a stale id and renders blank.
  useEffect(() => {
    const bucket = selectedProvider ? bucketMap.get(selectedProvider) || [] : [];
    if (bucket.length === 0) {
      if (selectedModel) setSelectedModel("");
      return;
    }
    if (!bucket.includes(selectedModel)) {
      setSelectedModel(bucket[0]);
    }
    // selectedModel intentionally excluded — re-running on every user pick
    // would clobber the just-selected value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvider, bucketMap]);

  const handleProviderChange = (next: string) => {
    setSelectedProvider(next);
  };

  const verify = async () => {
    // When the user hasn't typed a new key (or only sees the masked stub), we
    // intentionally send an empty string; the server hydrates the plaintext
    // key from system_settings, so users can re-verify in one click.
    const raw = keyDirty ? apiKeyInput.trim() : "";
    const candidate = raw.includes("***") ? "" : raw;
    if (!candidate && !config?.api_key_set) {
      toast.error(t("oracle.control.key.invalid"));
      return;
    }
    setVerifying(true);
    setShellStatus("Sync");
    try {
      const payload = await verifyOracleKey(candidate);
      const fetched = payload.models || [];
      setModels(fetched);
      if (fetched.length) {
        const { dynamicProviders: providersLocal, bucketMap: bucketsLocal } =
          parseAllModelsAndProviders(fetched, lang === "en");
        const inferred = detectVendor(selectedModel || fetched[0]);
        const nextProvider =
          (selectedProvider && bucketsLocal.has(selectedProvider) ? selectedProvider : "") ||
          (bucketsLocal.has(inferred) ? inferred : "") ||
          providersLocal[0]?.key ||
          "";
        setSelectedProvider(nextProvider);
        const bucket = nextProvider ? bucketsLocal.get(nextProvider) || [] : [];
        const keep = bucket.includes(selectedModel) ? selectedModel : bucket[0] || "";
        setSelectedModel(keep);
      }
      setShellStatus("Live");
      toast.success(t("oracle.control.verified", { count: payload.total }));
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : t("oracle.toast.failed");
      setShellStatus("Sync failed");
      toast.error(message);
    } finally {
      setVerifying(false);
    }
  };

  const save = async () => {
    const modelName = selectedModel.trim();
    if (!modelName) {
      toast.error(t("oracle.control.engine.required"));
      return;
    }
    setSaving(true);
    setShellStatus("Sync");
    try {
      const body: { api_key?: string; model_name: string } = { model_name: modelName };
      if (keyDirty && apiKeyInput.trim() && !apiKeyInput.includes("***")) {
        body.api_key = apiKeyInput.trim();
      }
      const payload = await saveOracleConfig(body);
      const savedModel = safeText(payload?.model_name, modelName);
      setSelectedModel(savedModel);
      setModels((prev) => normalizeModelPool([savedModel, ...prev]));
      setConfig((prev) => {
        const base = normalizeOracleConfig(prev);
        const mergedModels = normalizeModelPool([savedModel, ...models, ...(base.models ?? [])]);
        return normalizeOracleConfig(
          {
            ...base,
            api_key_masked: safeText(payload?.api_key_masked, base.api_key_masked),
            api_key_set:
              typeof payload?.api_key_set === "boolean"
                ? payload.api_key_set
                : base.api_key_set,
            model_name: savedModel,
            models: mergedModels,
          },
          base,
        );
      });
      setApiKeyInput("");
      setKeyDirty(false);
      setShellStatus("Live");
      toast.success(t("oracle.control.saved"));
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : t("oracle.toast.failed");
      setShellStatus("Sync failed");
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const updateAuto = async (patch: { auto_daily?: boolean; auto_weekly?: boolean }) => {
    setSavingAuto(true);
    const prev = normalizeOracleAuto(auto);
    const optimistic = normalizeOracleAuto({ ...prev, ...patch }, prev);
    setAuto(optimistic);
    try {
      const payload = await saveOracleAuto(patch);
      setAuto(normalizeOracleAuto(payload, optimistic));
      toast.success(t("oracle.auto.saved"));
    } catch (exc) {
      setAuto(prev);
      const message = exc instanceof Error ? exc.message : t("oracle.toast.failed");
      toast.error(message);
    } finally {
      setSavingAuto(false);
    }
  };

  const trigger = async (kind: "manual" | "weekly") => {
    if (!config?.api_key_set || !selectedModel) {
      toast.error(t("oracle.control.engine.required"));
      return;
    }
    setGeneratingKind(kind);
    setShellStatus("Sync");
    try {
      const payload = await generateOracleBrief(kind);
      const report = normalizeOracleReport(payload?.report);
      if (!report) throw new Error(t("oracle.toast.failed"));
      setReports((prev) => [report, ...normalizeReports(prev)]);
      setSelectedReportId(report.id);
      setShellStatus("Live");
      toast.success(t("oracle.toast.generated"));
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : t("oracle.toast.failed");
      setShellStatus("Sync failed");
      toast.error(message);
    } finally {
      setGeneratingKind(null);
    }
  };

  const activeReport = useMemo(
    () => reports.find((r) => r.id === selectedReportId) || null,
    [reports, selectedReportId]
  );

  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);

  const removeReport = async (report: OracleReport) => {
    const reportId = report?.id;
    if (!reportId) return;
    if (!window.confirm(t("oracle.confirm.delete"))) return;
    setDeletingReportId(reportId);
    // Optimistic UI: drop the row immediately, then reconcile on failure.
    const prevReports = normalizeReports(reports);
    const prevSelected = selectedReportId;
    const nextReports = prevReports.filter((r) => r.id !== reportId);
    setReports(nextReports);
    if (prevSelected === reportId) {
      setSelectedReportId(nextReports[0]?.id ?? null);
    }
    try {
      await deleteOracleReport(reportId);
      toast.success(t("oracle.toast.deleted"));
    } catch (exc) {
      setReports(prevReports);
      setSelectedReportId(prevSelected);
      const message = exc instanceof Error ? exc.message : t("oracle.toast.deleteFail");
      toast.error(message);
    } finally {
      setDeletingReportId(null);
    }
  };

  const hasFreshKey = keyDirty && apiKeyInput.trim().length > 0 && !apiKeyInput.includes("***");
  const canVerify = !verifying && (hasFreshKey || !!config?.api_key_set);
  const canSave = !!selectedModel && !saving && !verifying;
  const canTrigger = generatingKind === null && !!config?.api_key_set && !!selectedModel;

  const statusLabel = config?.api_key_set
    ? t("oracle.status.set", { key: maskedFromServer || "***", model: config.model_name || "—" })
    : t("oracle.status.unset");

  return (
    <div className="w-full min-w-0">
      <PageHeader
        eyebrow={t("oracle.eyebrow")}
        title={t("oracle.title")}
        description={t("oracle.desc")}
        actions={
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <StatusDot tone={config?.api_key_set ? "positive" : "warning"} />
            <span>{statusLabel}</span>
          </div>
        }
      />

      <Panel
        title={t("oracle.control.title")}
        subtitle={t("oracle.control.subtitle")}
      >
        <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
          {/* Credentials column */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                <KeyRound className="size-3" />
                {t("oracle.control.apikey")}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="password"
                  autoComplete="new-password"
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

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                  <Boxes className="size-3" />
                  {t("oracle.control.provider")}
                </Label>
                <select
                  aria-label={t("oracle.control.provider")}
                  value={selectedProvider}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  disabled={configLoading || dynamicProviders.length === 0}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-[13px] disabled:opacity-50"
                >
                  {dynamicProviders.length === 0 ? (
                    <option value="">{t("oracle.control.provider.placeholder")}</option>
                  ) : null}
                  {!selectedProvider && dynamicProviders.length > 0 ? (
                    <option value="">{t("oracle.control.provider.placeholder")}</option>
                  ) : null}
                  {dynamicProviders.map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.label}
                    </option>
                  ))}
                </select>
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
                  disabled={configLoading || !selectedProvider || engineOptions.length === 0}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-[13px] disabled:opacity-50"
                >
                  {!selectedProvider ? (
                    <option value="">{t("oracle.control.engine.locked")}</option>
                  ) : engineOptions.length === 0 ? (
                    <option value="">{t("oracle.control.engine.placeholder")}</option>
                  ) : (
                    <>
                      {selectedModel && !engineOptions.includes(selectedModel) ? (
                        <option value={selectedModel}>{selectedModel}</option>
                      ) : null}
                      {!selectedModel ? (
                        <option value="">{t("oracle.control.engine.placeholder")}</option>
                      ) : null}
                      {engineOptions.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>
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

          {/* Execution + automation column */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button
                onClick={() => trigger("manual")}
                disabled={!canTrigger}
                className="h-11 w-full rounded-md bg-foreground text-[13px] font-medium text-background hover:bg-foreground/90"
              >
                {generatingKind === "manual" ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
                {generatingKind === "manual" ? t("oracle.execution.triggering") : t("oracle.execution.trigger")}
              </Button>
              <Button
                variant="outline"
                onClick={() => trigger("weekly")}
                disabled={!canTrigger}
                className="h-11 w-full rounded-md text-[13px] font-medium"
              >
                {generatingKind === "weekly" ? <Loader2 className="size-4 animate-spin" /> : <PlayCircle className="size-4" />}
                {generatingKind === "weekly" ? t("oracle.execution.weekly.triggering") : t("oracle.execution.weekly")}
              </Button>
            </div>

            <div className="space-y-2.5 rounded-md border border-border/70 bg-muted/20 px-3.5 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
                    <CalendarClock className="size-3.5 text-muted-foreground" />
                    {t("oracle.auto.daily.title")}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                    {t("oracle.auto.daily.hint")}
                  </p>
                </div>
                <Switch
                  checked={!!auto?.auto_daily}
                  disabled={!auto || savingAuto}
                  onCheckedChange={(next) => updateAuto({ auto_daily: next })}
                  aria-label={t("oracle.auto.daily.title")}
                />
              </div>
              <div className="border-t border-border/60" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
                    <CalendarClock className="size-3.5 text-muted-foreground" />
                    {t("oracle.auto.weekly.title")}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-5 text-muted-foreground">
                    {t("oracle.auto.weekly.hint")}
                  </p>
                </div>
                <Switch
                  checked={!!auto?.auto_weekly}
                  disabled={!auto || savingAuto}
                  onCheckedChange={(next) => updateAuto({ auto_weekly: next })}
                  aria-label={t("oracle.auto.weekly.title")}
                />
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-md border border-border/70 bg-card px-3 py-2 text-[11px] leading-5 text-muted-foreground">
              <Telescope className="mt-0.5 size-3.5 shrink-0 text-[var(--positive)]" />
              <div>
                <p className="font-medium text-foreground">{t("oracle.behavior.title")}</p>
                <p>{t("oracle.behavior.detail")}</p>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
        <Panel
          title={t("oracle.reports.title")}
          subtitle={t("oracle.reports.subtitle")}
          contentClassName="p-0"
        >
          {reportsLoading ? (
            <div className="flex items-center justify-center px-5 py-10 text-[12px] text-muted-foreground">
              <Loader2 className="mr-2 size-3 animate-spin" />
              {t("oracle.reports.loading")}
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
                      : r.kind === "weekly"
                        ? t("oracle.reports.kind.weekly")
                        : r.kind === "manual"
                          ? t("oracle.reports.kind.manual")
                          : r.kind;
                  const badgeLabel =
                    r.kind === "daily"
                      ? t("oracle.reports.badge.daily")
                      : r.kind === "weekly"
                        ? t("oracle.reports.badge.weekly")
                        : r.kind === "manual"
                          ? t("oracle.reports.badge.manual")
                          : r.kind;
                  const removing = deletingReportId === r.id;
                  return (
                    <li
                      key={r.id}
                      className={cn(
                        "group relative flex items-stretch transition-colors",
                        active ? "bg-muted/60" : "hover:bg-muted/30"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedReportId(r.id)}
                        className="block flex-1 px-4 py-3 text-left"
                      >
                        <div className="flex items-center justify-between gap-2 pr-7">
                          <span className="text-[12px] font-medium text-foreground">{kindLabel}</span>
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {badgeLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">{formatReportTimestamp(r.created_at, lang)}</p>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void removeReport(r);
                        }}
                        disabled={removing}
                        aria-label={t("oracle.reports.delete")}
                        title={t("oracle.reports.delete")}
                        className={cn(
                          "absolute right-2 top-1/2 -translate-y-1/2 flex size-7 items-center justify-center rounded-md",
                          "text-muted-foreground/70 transition-all",
                          "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
                          "hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]",
                          "disabled:opacity-50 disabled:cursor-not-allowed"
                        )}
                      >
                        {removing ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
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
          subtitle={activeReport ? formatReportTimestamp(activeReport.created_at, lang) : t("oracle.report.empty")}
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
