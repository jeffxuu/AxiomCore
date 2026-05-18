import { useEffect, useMemo, useState } from "react";
import { Gauge, KeyRound, Loader2, RefreshCcw, Save, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { formatApiError } from "@/api";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AxiomHero } from "@/components/axiom/AxiomHero";
import { cn } from "@/lib/utils";

type AiModel = {
  id: string;
  name: string;
  provider: string;
};

type ProbeModel = {
  id: string;
  name: string;
};

type AiAnalyzeResponse = {
  ok: true;
  reply: string;
  model: string;
  provider: string;
  date: string;
  writtenTo?: string | null;
};

type ModelsPayload = { ok: true; models: AiModel[] };
type ProbePayload = { ok: true; models: ProbeModel[]; total: number };

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
    // Browser storage can be disabled; the current session still works.
  }
}

async function apiFetch<T>(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const payload = (await response.json().catch(() => ({}))) as { detail?: unknown; error?: unknown };
    if (!response.ok) {
      throw new Error(formatApiError(payload, `HTTP ${response.status}`));
    }
    return payload as T;
  } catch (exc) {
    if (exc instanceof DOMException && exc.name === "AbortError") {
      throw new Error("请求超时，请重试");
    }
    if (exc instanceof Error) throw exc;
    throw new Error("请求失败");
  } finally {
    window.clearTimeout(timer);
  }
}

function providerLabel(provider: string): string {
  if (provider === "siliconflow") return "硅基流动";
  if (provider === "openai") return "OpenAI";
  return provider;
}

export function AiPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [mode, setMode] = useState<"daily" | "weekly">("daily");
  const [analyzeDate, setAnalyzeDate] = useState(today);
  const [prompt, setPrompt] = useState("请生成结构化复盘：今日亮点、需要调整、明日最重要一件事，控制在 500 字以内。");
  const [models, setModels] = useState<AiModel[]>([]);
  const [selectedModel, setSelectedModel] = useState(() => ls("lf-model") || "Pro/deepseek-ai/DeepSeek-V3.2");
  const [keyProvider, setKeyProvider] = useState<"openai" | "siliconflow" | "custom">(() => {
    const stored = ls("lf-api-provider");
    return stored === "siliconflow" || stored === "custom" ? stored : "openai";
  });
  const [keyInput, setKeyInput] = useState("");
  const [customUrl, setCustomUrl] = useState(() => ls("lf-api-base-url"));
  const [proxyEnabled, setProxyEnabled] = useState(() => Boolean(ls("lf-api-base-url")));
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState("");
  const [probeModels, setProbeModels] = useState<ProbeModel[]>([]);
  const [probeModel, setProbeModel] = useState("");
  const [speedTesting, setSpeedTesting] = useState(false);
  const [speedResult, setSpeedResult] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<AiAnalyzeResponse | null>(null);
  const [aiError, setAiError] = useState("");
  const [writeDialogOpen, setWriteDialogOpen] = useState(false);
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    apiFetch<ModelsPayload>("/api/ai/models")
      .then((payload) => setModels(payload.models || []))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (mode === "daily") {
      setPrompt("请生成结构化复盘：今日亮点、需要调整、明日最重要一件事，控制在 500 字以内。");
    } else {
      setPrompt("请基于本周记录生成周复盘：进展、风险、下周优先级，重点关注求职现金流和健康连续性。");
    }
  }, [mode]);

  const selectedModelMeta = useMemo(() => models.find((model) => model.id === selectedModel), [models, selectedModel]);

  const probeKey = async () => {
    if (!keyInput.trim()) return;
    setProbing(true);
    setProbeError("");
    setProbeModels([]);
    try {
      const payload = await apiFetch<ProbePayload>("/api/ai/probe-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: keyProvider,
          api_key: keyInput.trim(),
          base_url: keyProvider === "custom" || proxyEnabled ? customUrl : undefined,
        }),
      }, 25000);
      if (!payload.models.length) throw new Error("未返回可用模型，请检查 Key。");
      setProbeModels(payload.models);
      setProbeModel(payload.models[0]?.id || "");
      toast.success("Key 验证通过", { description: `返回 ${payload.total} 个模型` });
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : "验证失败";
      setProbeError(message);
      toast.error("Key 验证失败", { description: message });
    } finally {
      setProbing(false);
    }
  };

  const confirmKey = () => {
    lsSet("lf-api-key", keyInput.trim());
    lsSet("lf-api-provider", keyProvider);
    lsSet("lf-api-base-url", proxyEnabled || keyProvider === "custom" ? customUrl : "");
    lsSet("lf-model", probeModel);
    setSelectedModel(probeModel);
    toast.success("AI 配置已保存", { description: probeModel });
  };

  const testSpeed = async () => {
    setSpeedTesting(true);
    setSpeedResult("");
    const started = performance.now();
    try {
      await apiFetch<ModelsPayload>("/api/ai/models", {}, 15000);
      const elapsed = Math.round(performance.now() - started);
      setSpeedResult(`${elapsed} ms`);
      toast.success("测速完成", { description: `${elapsed} ms` });
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : "测速失败";
      setSpeedResult(message);
      toast.error("测速失败", { description: message });
    } finally {
      setSpeedTesting(false);
    }
  };

  const buildPayload = (writeToMd = false): Record<string, unknown> => {
    const payload: Record<string, unknown> = {
      prompt,
      date: analyzeDate,
      model: selectedModel,
    };
    const key = ls("lf-api-key");
    const baseUrl = ls("lf-api-base-url");
    if (key) payload.api_key_override = key;
    if (baseUrl) payload.base_url_override = baseUrl;
    if (writeToMd) {
      payload.write_to_md = true;
      payload.md_confirmed = true;
    }
    return payload;
  };

  const generate = async () => {
    setGenerating(true);
    setAiError("");
    setResult(null);
    try {
      const response = await apiFetch<AiAnalyzeResponse>("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      }, 120000);
      setResult(response);
      toast.success("AI 总结已生成", { description: response.model });
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : "AI 生成失败";
      setAiError(message);
      toast.error("AI 生成失败", { description: message });
    } finally {
      setGenerating(false);
    }
  };

  const writeToMarkdown = async () => {
    setWriting(true);
    try {
      const response = await apiFetch<AiAnalyzeResponse>("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(true)),
      }, 120000);
      toast.success(response.writtenTo ? "已写入 Markdown" : "写入请求完成", {
        description: response.writtenTo || "后端未返回写入路径",
      });
      setWriteDialogOpen(false);
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : "写入失败";
      toast.error("写入失败", { description: message });
    } finally {
      setWriting(false);
    }
  };

  return (
    <div className="space-y-5">
      <AxiomHero
        eyebrow="AI Review"
        title="AI 复盘"
        description="把今日或本周记录整理成可行动的总结。主流程只保留生成总结，高级配置默认收起。"
        icon={Sparkles}
        action={(
          <Button onClick={generate} disabled={generating}>
            {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
            {generating ? "生成中" : "生成总结"}
          </Button>
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{mode === "daily" ? "今日总结" : "本周总结"}</Badge>
          <Badge variant="outline">{selectedModelMeta ? providerLabel(selectedModelMeta.provider) : "当前模型"}</Badge>
        </div>
      </AxiomHero>

      <Card>
        <CardHeader>
          <CardTitle>复盘输入</CardTitle>
          <CardDescription>日期和分析要求保持在主流程中，生成按钮固定在 Hero。</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Tabs value={mode} onValueChange={(value) => setMode(value === "weekly" ? "weekly" : "daily")}>
            <TabsList className="grid w-full grid-cols-2 sm:w-72">
              <TabsTrigger value="daily">今日总结</TabsTrigger>
              <TabsTrigger value="weekly">本周总结</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
            <div className="space-y-2">
              <Label htmlFor="ai-date">日期</Label>
              <Input id="ai-date" type="date" value={analyzeDate} onChange={(event) => setAnalyzeDate(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-prompt">分析要求</Label>
              <Textarea id="ai-prompt" className="min-h-32 resize-y" value={prompt} onChange={(event) => setPrompt(event.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            <span>当前模型</span>
            <strong className="font-medium text-foreground">{selectedModel}</strong>
            <span>可在高级设置中调整</span>
          </div>

          {aiError ? (
            <Alert variant="destructive">
              <AlertTitle>生成失败</AlertTitle>
              <AlertDescription>{aiError}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>结果</CardTitle>
          <CardDescription>生成后可以确认写入每日 Markdown。</CardDescription>
          <CardAction>
            <Button variant="outline" onClick={() => setWriteDialogOpen(true)} disabled={!result || writing}>
              <Save className="size-4" />
              写入 Markdown
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {result ? (
            <ScrollArea className="max-h-[420px] rounded-xl border bg-muted/30">
              <div className="space-y-4 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{providerLabel(result.provider)}</Badge>
                  <span>{result.model}</span>
                  <span>{result.date}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">{result.reply}</p>
              </div>
            </ScrollArea>
          ) : (
            <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
              点击“生成总结”后，结果会显示在这里。
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>高级设置</CardTitle>
          <CardDescription>低频配置默认折叠，避免打断生成总结的主流程。</CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible>
            <AccordionItem value="advanced" className="border-none">
              <AccordionTrigger className="rounded-xl border bg-muted/40 px-4 py-3 hover:no-underline">
                <span className="flex items-center gap-2">
                  <Gauge className="size-4" />
                  高级设置
                </span>
              </AccordionTrigger>
              <AccordionContent className="pt-5">
                <div className="space-y-6">
                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-medium">模型</h3>
                        <p className="text-sm text-muted-foreground">选择默认生成模型。</p>
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="ghost" size="sm">说明</Button>
                        </PopoverTrigger>
                        <PopoverContent className="text-sm text-muted-foreground">
                          前端只保存模型选择和临时 Key；后端 API 和认证逻辑保持不变。
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {models.map((model) => (
                        <button
                          className={cn(
                            "rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted",
                            selectedModel === model.id && "border-slate-950 bg-slate-50 dark:border-white dark:bg-slate-900"
                          )}
                          key={model.id}
                          type="button"
                          onClick={() => {
                            setSelectedModel(model.id);
                            lsSet("lf-model", model.id);
                            toast.success("模型已切换", { description: model.name });
                          }}
                        >
                          <span className="block text-sm font-medium">{model.name}</span>
                          <small className="text-xs text-muted-foreground">{providerLabel(model.provider)}</small>
                        </button>
                      ))}
                    </div>
                  </section>

                  <Separator />

                  <section className="space-y-4">
                    <div>
                      <h3 className="font-medium">API Key</h3>
                      <p className="text-sm text-muted-foreground">验证通过后只保存到当前浏览器 localStorage。</p>
                    </div>
                    <Tabs value={keyProvider} onValueChange={(value) => setKeyProvider(value === "siliconflow" || value === "custom" ? value : "openai")}>
                      <TabsList className="grid w-full grid-cols-3 sm:w-[360px]">
                        <TabsTrigger value="openai">OpenAI</TabsTrigger>
                        <TabsTrigger value="siliconflow">硅基流动</TabsTrigger>
                        <TabsTrigger value="custom">自定义</TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                      <Input type="password" autoComplete="off" placeholder={keyProvider === "openai" ? "sk-proj-..." : "sk-..."} value={keyInput} onChange={(event) => setKeyInput(event.target.value)} />
                      <Button variant="outline" onClick={probeKey} disabled={probing || !keyInput.trim()}>
                        {probing ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
                        {probing ? "验证中" : "验证 Key"}
                      </Button>
                    </div>
                    {probeError ? (
                      <Alert variant="destructive">
                        <AlertTitle>验证失败</AlertTitle>
                        <AlertDescription>{probeError}</AlertDescription>
                      </Alert>
                    ) : null}
                    {probeModels.length ? (
                      <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
                        <div className="grid gap-2 sm:grid-cols-2">
                          {probeModels.map((model) => (
                            <button
                              className={cn("rounded-lg border bg-card px-3 py-2 text-left text-sm", probeModel === model.id && "border-slate-950 bg-slate-50 dark:border-white dark:bg-slate-900")}
                              key={model.id}
                              type="button"
                              onClick={() => setProbeModel(model.id)}
                            >
                              {model.id}
                            </button>
                          ))}
                        </div>
                        <Button variant="secondary" onClick={confirmKey} disabled={!probeModel}>确认使用</Button>
                      </div>
                    ) : null}
                  </section>

                  <Separator />

                  <section className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="font-medium">代理节点与测速</h3>
                        <p className="text-sm text-muted-foreground">只配置前端传入的 Base URL，不改变后端、Nginx 或 mihomo。</p>
                      </div>
                      <Switch checked={proxyEnabled} onCheckedChange={(checked) => {
                        setProxyEnabled(checked);
                        if (checked) setKeyProvider("custom");
                      }} aria-label="启用自定义代理 Base URL" />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                      <Input disabled={!proxyEnabled && keyProvider !== "custom"} placeholder="Base URL，如 https://openrouter.ai/api/v1" value={customUrl} onChange={(event) => setCustomUrl(event.target.value)} />
                      <Button variant="outline" onClick={testSpeed} disabled={speedTesting}>
                        {speedTesting ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
                        测速
                      </Button>
                    </div>
                    {speedResult ? <p className="text-sm text-muted-foreground">最近测速：{speedResult}</p> : null}
                  </section>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <Dialog open={writeDialogOpen} onOpenChange={setWriteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>写入 Markdown？</DialogTitle>
            <DialogDescription>会把本次 AI 总结追加写入每日记录。写入前请确认结果内容可接受。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">取消</Button>
            </DialogClose>
            <Button variant="outline" onClick={writeToMarkdown} disabled={writing || !result}>
              {writing ? <RefreshCcw className="size-4 animate-spin" /> : <Save className="size-4" />}
              {writing ? "写入中" : "确认写入"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
