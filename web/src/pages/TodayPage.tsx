import { useMemo, useState } from "react";
import {
  Activity,
  Archive,
  Briefcase,
  CircleDollarSign,
  Dumbbell,
  FileText,
  HeartPulse,
  Languages,
  Save,
  Sparkles,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { exportMarkdown, saveDay } from "@/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { AxiomHero } from "@/components/axiom/AxiomHero";
import { MetricSummary } from "@/components/axiom/MetricSummary";
import { QuickEntryGroup } from "@/components/axiom/QuickEntryGroup";
import { SaveBar } from "@/components/axiom/SaveBar";
import { TaskList } from "@/components/axiom/TaskList";
import type {
  BootstrapPayload,
  Dashboard,
  DocMeta,
  EntryField,
  AxiomDay,
  AxiomTask,
} from "@/types";

function num(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function fmt(value: unknown, digits = 0): string {
  const number = num(value);
  return digits > 0 ? number.toFixed(digits).replace(/\.0+$/, "") : String(Math.round(number));
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function taskSummary(day: AxiomDay): string {
  const undone = day.tasks.filter((task) => !task.done);
  if (!undone.length) return "任务已清空，可以进入复盘。";
  const first = undone[0];
  return `${first.title} · 目标 ${fmt(first.target_value)}${first.unit}`;
}

function docHref(doc: DocMeta): string {
  if (doc.kind === "daily") return `/daily?doc=${encodeURIComponent(doc.id)}`;
  return `/files?doc=${encodeURIComponent(doc.id)}`;
}

function EntryInput({
  label,
  unit,
  value,
  onChange,
  type = "number",
  placeholder,
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (value: string) => void;
  type?: "number" | "text";
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">
        {label}
        {unit ? <span className="ml-1 text-[11px]">({unit})</span> : null}
      </Label>
      <Input type={type} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function EntryTextarea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2 sm:col-span-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Textarea className="min-h-28 resize-y" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function TrendChart({ dashboard }: { dashboard: Dashboard }) {
  const timeline = dashboard.timeline;
  const width = 720;
  const height = 172;
  const pad = { top: 10, right: 16, bottom: 24, left: 24 };
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const xOf = (index: number) => pad.left + (innerWidth * index) / Math.max(timeline.length - 1, 1);
  const series = [
    { key: "rate", label: "完成率", values: timeline.map((point) => point.rate), max: 1, suffix: "%", color: "#0f172a" },
    { key: "jobs", label: "投递", values: timeline.map((point) => point.jobApplications), max: Math.max(1, ...timeline.map((point) => point.jobApplications)), suffix: "份", color: "#2563eb" },
    { key: "english", label: "英语", values: timeline.map((point) => point.englishMinutes), max: Math.max(1, ...timeline.map((point) => point.englishMinutes)), suffix: "min", color: "#d97706" },
    { key: "exercise", label: "运动", values: timeline.map((point) => point.exerciseMinutes), max: Math.max(1, ...timeline.map((point) => point.exerciseMinutes)), suffix: "min", color: "#059669" },
  ];

  if (!timeline.length) return <p className="text-sm text-muted-foreground">暂无趋势数据。</p>;

  return (
    <div className="space-y-3 overflow-hidden">
      <div className="overflow-x-auto">
        <svg className="min-w-[520px]" viewBox={`0 0 ${width} ${height}`} aria-label="30 天趋势">
          {[0, 0.5, 1].map((line) => (
            <line key={line} x1={pad.left} x2={width - pad.right} y1={pad.top + innerHeight * (1 - line)} y2={pad.top + innerHeight * (1 - line)} stroke="currentColor" className="text-border" />
          ))}
          {[0, Math.floor(timeline.length / 2), timeline.length - 1].filter((index) => index < timeline.length).map((index) => (
            <text className="fill-muted-foreground text-[10px]" key={index} x={xOf(index)} y={height - 7} textAnchor="middle">{timeline[index].date.slice(5)}</text>
          ))}
          {series.map((item) => {
            const points = item.values.map((value, index): [number, number] => [
              xOf(index),
              pad.top + innerHeight * (1 - Math.max(0, Math.min(1, value / item.max))),
            ]);
            const path = points.map(([x, y], index) => `${index ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
            const last = points.at(-1);
            return (
              <g key={item.key}>
                <path d={path} fill="none" stroke={item.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                {last ? <circle cx={last[0]} cy={last[1]} r="3" fill={item.color} /> : null}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
        {series.map((item) => {
          const latest = item.values.at(-1) ?? 0;
          const label = item.suffix === "%" ? `${Math.round(latest * 100)}%` : `${Math.round(latest)}${item.suffix}`;
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-1" key={item.key}>
              <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.label} {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function TodayPage({
  bootstrap,
  date,
  docs,
  error,
  loading,
  navigate,
  onDateChange,
  onRefresh,
  onBootstrapChange,
}: {
  bootstrap: BootstrapPayload | null;
  date: string;
  docs: DocMeta[];
  error: string;
  loading: boolean;
  navigate: (href: string) => void;
  onDateChange: (date: string) => void;
  onRefresh: () => void;
  onBootstrapChange: (payload: BootstrapPayload) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("云端数据已同步");

  const day = bootstrap?.day;
  const dashboard = bootstrap?.dashboard;
  const categories = bootstrap?.categories ?? [];

  const quickDocs = useMemo(() => {
    const ids = new Set(["profile", "plan-90", "resume-summary", "health-summary", "credit-summary"]);
    return docs.filter((doc) => ids.has(doc.id)).slice(0, 5);
  }, [docs]);

  const setEntry = (field: EntryField, value: string) => {
    if (!bootstrap) return;
    onBootstrapChange({
      ...bootstrap,
      day: { ...bootstrap.day, entry: { ...bootstrap.day.entry, [field]: value } },
    });
    setSaveMsg("有未保存修改");
  };

  const setTask = (id: string, patch: Partial<AxiomTask>) => {
    if (!bootstrap) return;
    onBootstrapChange({
      ...bootstrap,
      day: {
        ...bootstrap.day,
        tasks: bootstrap.day.tasks.map((task) => task.task_id === id ? { ...task, ...patch } : task),
      },
    });
    setSaveMsg("有未保存修改");
  };

  const save = async () => {
    if (!day || !bootstrap) return;
    setSaving(true);
    setSaveMsg("保存中...");
    try {
      const result = await saveDay(day);
      onBootstrapChange({ categories: bootstrap.categories, day: result.day, dashboard: result.dashboard });
      setSaveMsg(`已保存到 ${result.markdownPath}`);
      toast.success("今日记录已保存", { description: result.markdownPath });
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : "保存失败";
      setSaveMsg(message);
      toast.error("保存失败", { description: message });
    } finally {
      setSaving(false);
    }
  };

  const exportDay = async () => {
    setSaveMsg("正在导出 Markdown...");
    try {
      const result = await exportMarkdown(date);
      setSaveMsg(`已导出 ${result.markdownPath}`);
      toast.success("Markdown 已导出", { description: result.markdownPath });
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : "导出失败";
      setSaveMsg(message);
      toast.error("导出失败", { description: message });
    }
  };

  if (loading || !bootstrap || !day || !dashboard) {
    return (
      <div className="space-y-5">
        <SaveBar date={date} status="同步中..." saving={false} onDateChange={onDateChange} onRefresh={onRefresh} onSave={() => undefined} />
        {error ? (
          <Alert variant="destructive">
            <AlertTitle>同步失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Card>
          <CardContent className="space-y-4 p-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const v = (field: EntryField) => String(day.entry[field] ?? "");

  return (
    <div className="space-y-5">
      <SaveBar date={date} status={saveMsg} saving={saving} onDateChange={onDateChange} onRefresh={onRefresh} onSave={save} />

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>同步失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <main className="flex flex-col gap-5">
          <AxiomHero
            eyebrow="Today OS"
            title="今日行动"
            description={`${taskSummary(day)} 先录入关键数据，再处理任务，最后沉淀为复盘。`}
            icon={Sparkles}
            action={(
              <>
                <Button variant="outline" onClick={() => navigate("/ai")}>
                  <Sparkles className="size-4" />
                  AI 总结
                </Button>
                <Button variant="secondary" onClick={exportDay}>
                  <FileText className="size-4" />
                  导出
                </Button>
              </>
            )}
          />

          <div className="order-3 lg:order-2">
            <MetricSummary dashboard={dashboard} day={day} />
          </div>

          <Card className="order-2 lg:order-3">
            <CardHeader>
              <CardTitle>快速录入</CardTitle>
              <CardDescription>把今日关键数据压到一个稳定、低摩擦的输入区。</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" defaultValue={["job", "health", "finance", "note"]}>
                <QuickEntryGroup icon={Briefcase} title="求职" value="job" badge={`投递 ${fmt(day.entry.job_applications)} · 面试 ${fmt(day.entry.interviews)}`}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <EntryInput label="简历投递" unit="份" value={v("job_applications")} onChange={(value) => setEntry("job_applications", value)} />
                    <EntryInput label="面试沟通" unit="次" value={v("interviews")} onChange={(value) => setEntry("interviews", value)} />
                  </div>
                </QuickEntryGroup>

                <QuickEntryGroup icon={HeartPulse} title="健康" value="health" badge={`睡眠 ${fmt(day.entry.sleep_hours, 1)}h · 运动 ${fmt(day.entry.exercise_minutes)}min`}>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <EntryInput label="英语学习" unit="分钟" value={v("english_minutes")} onChange={(value) => setEntry("english_minutes", value)} />
                    <EntryInput label="运动训练" unit="分钟" value={v("exercise_minutes")} onChange={(value) => setEntry("exercise_minutes", value)} />
                    <EntryInput label="睡眠" unit="小时" value={v("sleep_hours")} onChange={(value) => setEntry("sleep_hours", value)} />
                  </div>
                </QuickEntryGroup>

                <QuickEntryGroup icon={CircleDollarSign} title="财务" value="finance" badge={`支出 ${fmt(day.entry.expense)} 元`}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <EntryInput label="今日支出" unit="元" value={v("expense")} onChange={(value) => setEntry("expense", value)} />
                    <EntryInput label="今日收入" unit="元" value={v("income")} onChange={(value) => setEntry("income", value)} />
                  </div>
                </QuickEntryGroup>

                <QuickEntryGroup icon={Activity} title="笔记" value="note">
                  <div className="grid gap-3">
                    <EntryTextarea label="今日笔记" value={v("notes")} placeholder="一句话写清今天发生了什么、明天最重要的一件事。" onChange={(value) => setEntry("notes", value)} />
                  </div>
                </QuickEntryGroup>

                <QuickEntryGroup icon={UtensilsCrossed} title="饮食详情" value="diet">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <EntryInput label="早餐" type="text" value={v("breakfast")} placeholder="鸡蛋、牛奶..." onChange={(value) => setEntry("breakfast", value)} />
                    <EntryInput label="午餐" type="text" value={v("lunch")} placeholder="米饭、鸡胸..." onChange={(value) => setEntry("lunch", value)} />
                    <EntryInput label="晚餐" type="text" value={v("dinner")} placeholder="轻食、鱼肉..." onChange={(value) => setEntry("dinner", value)} />
                    <EntryInput label="加餐" type="text" value={v("snacks")} placeholder="坚果、酸奶..." onChange={(value) => setEntry("snacks", value)} />
                    <EntryTextarea label="饮食总结" value={v("diet_summary")} placeholder="今天总体吃得怎么样？" onChange={(value) => setEntry("diet_summary", value)} />
                  </div>
                </QuickEntryGroup>

                <QuickEntryGroup icon={Dumbbell} title="身体状态" value="body" badge="体重、心情、精力">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <EntryInput label="体重" unit="kg" value={v("weight_kg")} onChange={(value) => setEntry("weight_kg", value)} />
                    <EntryInput label="心情" unit="/10" value={v("mood")} onChange={(value) => setEntry("mood", value)} />
                    <EntryInput label="精力" unit="/10" value={v("energy")} onChange={(value) => setEntry("energy", value)} />
                  </div>
                </QuickEntryGroup>
              </Accordion>
            </CardContent>
          </Card>

          <Card className="order-4">
            <CardHeader>
              <CardTitle>今日任务</CardTitle>
              <CardDescription>保持任务列表紧凑，优先看推进和完成率。</CardDescription>
              <CardAction>
                <Badge variant="secondary">{pct(dashboard.today.rate)}</Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <TaskList categories={categories} day={day} onPatch={setTask} />
            </CardContent>
          </Card>
        </main>

        <aside className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>复盘入口</CardTitle>
              <CardDescription>生成总结或沉淀 Markdown。</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2">
              <Button variant="outline" onClick={() => navigate("/ai")}>
                <Sparkles className="size-4" />
                进入 AI 复盘
              </Button>
              <Button variant="secondary" onClick={exportDay}>
                <FileText className="size-4" />
                导出今日 Markdown
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>30 天趋势</CardTitle>
              <CardDescription>默认收起，避免抢占今日操作空间。</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                <AccordionItem value="trend" className="border-none">
                  <AccordionTrigger className="rounded-lg bg-muted/60 px-3 py-3 hover:no-underline">
                    <span className="flex items-center gap-2">
                      <TrendingUp className="size-4" />
                      查看趋势摘要
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4">
                    <TrendChart dashboard={dashboard} />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          <Card className="bg-card/70">
            <CardHeader>
              <CardTitle>文档快捷入口</CardTitle>
              <CardDescription>低频入口弱化在侧栏。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickDocs.map((doc, index) => (
                <div key={doc.id}>
                  <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted" type="button" onClick={() => navigate(docHref(doc))}>
                    <Archive className="size-4 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{doc.title}</span>
                  </button>
                  {index < quickDocs.length - 1 ? <Separator /> : null}
                </div>
              ))}
              {!quickDocs.length ? <p className="text-sm text-muted-foreground">暂无快捷文档。</p> : null}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
