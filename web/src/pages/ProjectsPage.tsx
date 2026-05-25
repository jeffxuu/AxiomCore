import { useCallback, useEffect, useMemo, useState } from "react";
import { GitBranch, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createProject, deleteProject, loadProjects, updateProject, type ProjectInput } from "@/api";
import { DomainBadge, DomainSelect, EmptyHint, PageHeader, Panel, StatusDot, formatCNY } from "@/components/axiom/primitives";
import { useT } from "@/lib/i18nConfig";
import type { Project, ProjectStatus, RiskLevel } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<ProjectStatus, "info" | "warning" | "danger" | "positive"> = {
  active: "info",
  paused: "warning",
  killed: "danger",
  shipped: "positive",
};
const STATUS_OPTIONS: ProjectStatus[] = ["active", "paused", "shipped", "killed"];
const RISK_OPTIONS: RiskLevel[] = ["low", "medium", "high", "extreme"];
const MICRO_LABEL = "text-[10px] font-semibold uppercase tracking-wider opacity-75";

const EMPTY_FORM: ProjectInput = {
  name: "",
  status: "active",
  thesis: "",
  roi_projection: 0,
  risk_level: "medium",
  kill_criteria: "",
  capital_committed: 0,
  capital_spent: 0,
  domain_tag: "",
};

function riskTone(level: RiskLevel): "positive" | "info" | "warning" | "danger" {
  return level === "extreme" ? "danger" : level === "high" ? "warning" : level === "low" ? "positive" : "info";
}

function metricToneClass(tone: "neutral" | "positive" | "danger" = "neutral"): string {
  if (tone === "positive") return "text-[#0D9488] dark:text-[#14B8A6]";
  if (tone === "danger") return "text-[#E11D48] dark:text-[#F43F5E]";
  return "text-foreground";
}

function MetricCell({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "neutral" | "positive" | "danger";
}) {
  return (
    <div className="ax-card px-6 py-4.5">
      <p className={cn(MICRO_LABEL, "text-muted-foreground")}>{label}</p>
      <p className={cn("mt-1 font-mono text-3xl font-light tracking-tighter tabular", metricToneClass(tone))}>
        {value}
      </p>
      <p className="mt-1 text-xs font-normal text-muted-foreground">{sub}</p>
    </div>
  );
}

function KpiLine({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "positive" | "danger";
}) {
  return (
    <div>
      <p className={cn(MICRO_LABEL, "text-muted-foreground")}>{label}</p>
      <p className={cn("font-mono text-3xl font-light tracking-tighter tabular md:text-[22px]", metricToneClass(tone))}>
        {value}
      </p>
    </div>
  );
}

export function ProjectsPage({ onStatus }: { onStatus: (status: string) => void }) {
  const t = useT();
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState<Project | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ProjectInput>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      onStatus("Sync");
      const { projects: list } = await loadProjects();
      setProjects(list);
      onStatus("Live");
    } catch (exc) {
      onStatus("Sync failed");
      toast.error(exc instanceof Error ? exc.message : t("projects.toast.loadFail"));
    }
  }, [onStatus, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const metrics = useMemo(() => {
    const live = projects.filter((p) => p.status !== "killed");
    const active = projects.filter((p) => p.status === "active");
    const committed = live.reduce((acc, p) => acc + Math.max(0, p.capital_committed), 0);
    const spent = live.reduce((acc, p) => acc + Math.max(0, p.capital_spent), 0);
    const avgRoi = live.length
      ? live.reduce((acc, p) => acc + Math.max(0, p.roi_projection), 0) / live.length
      : 0;
    return { live: live.length, active: active.length, committed, spent, avgRoi };
  }, [projects]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditing(p);
    setForm({
      name: p.name,
      status: p.status,
      thesis: p.thesis,
      roi_projection: p.roi_projection,
      risk_level: p.risk_level,
      kill_criteria: p.kill_criteria,
      capital_committed: p.capital_committed,
      capital_spent: p.capital_spent,
      domain_tag: p.domain_tag,
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error(t("projects.form.name.required"));
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await updateProject(editing.id, form);
        toast.success(t("projects.toast.updated"));
      } else {
        await createProject(form);
        toast.success(t("projects.toast.created"));
      }
      setOpen(false);
      void refresh();
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : t("projects.toast.saveFail"));
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (p: Project) => {
    if (!window.confirm(t("projects.confirm.delete", { name: p.name }))) return;
    try {
      await deleteProject(p.id);
      toast.success(t("projects.toast.deleted"));
      void refresh();
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : t("projects.toast.deleteFail"));
    }
  };

  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow={t("projects.eyebrow")}
        title={t("projects.title")}
        description={t("projects.desc")}
        actions={
          <Button onClick={openNew} className="h-9 rounded-lg bg-foreground text-background hover:bg-foreground/90">
            <Plus className="size-4" />
            {t("projects.action.new")}
          </Button>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCell label={t("projects.metrics.active")} value={String(metrics.active)} sub={t("projects.metrics.live", { count: metrics.live })} />
        <MetricCell label={t("projects.metrics.roi")} value={`${metrics.avgRoi.toFixed(1)}x`} sub={t("projects.metrics.mean")} tone="positive" />
        <MetricCell label={t("projects.metrics.committed")} value={formatCNY(metrics.committed, { compact: true })} sub={t("projects.metrics.allocated")} />
        <MetricCell label={t("projects.metrics.spent")} value={formatCNY(metrics.spent, { compact: true })} sub={t("projects.metrics.consumed")} tone={metrics.spent > metrics.committed ? "danger" : "neutral"} />
      </section>

      <Panel contentClassName="px-0 py-0">
        {projects.length === 0 ? (
          <div className="px-6 py-4.5">
            <EmptyHint title={t("projects.empty.title")} hint={t("projects.empty.hint")} />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {projects.map((p) => {
              const statusTone = STATUS_TONE[p.status];
              const starBet = p.roi_projection >= 5 && (p.risk_level === "low" || p.risk_level === "medium");
              return (
                <li
                  key={p.id}
                  id={`project-${p.id}`}
                  className="grid grid-cols-1 gap-5 scroll-mt-24 px-6 py-4.5 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <GitBranch className="size-3.5 text-muted-foreground" />
                      <span className="max-w-full truncate text-[12.5px] font-medium text-foreground">{p.name}</span>
                      <span className="font-mono text-xs font-normal tabular text-muted-foreground">#{p.id.slice(0, 8)}</span>
                      <span
                        className={cn(
                          "rounded-sm border px-1.5 py-0.5 text-xs font-normal",
                          statusTone === "positive"
                            ? "border-[var(--positive)]/25 text-[var(--positive)]"
                            : statusTone === "warning"
                            ? "border-[var(--warning)]/25 text-[var(--warning)]"
                            : statusTone === "danger"
                            ? "border-[var(--danger)]/25 text-[var(--danger)]"
                            : "border-[var(--info)]/25 text-[var(--info)]",
                        )}
                      >
                        {t(`projects.status.${p.status}`)}
                      </span>
                      {starBet ? (
                        <span className={cn(MICRO_LABEL, "rounded-sm bg-[#0D9488]/8 px-1.5 py-0.5 text-[#0D9488] dark:bg-[#14B8A6]/14 dark:text-[#14B8A6]")}>
                          {t("projects.badge.star")}
                        </span>
                      ) : null}
                      {p.domain_tag ? <DomainBadge tag={p.domain_tag} /> : null}
                    </div>
                    {p.thesis ? <p className="mt-2 line-clamp-2 text-[12.5px] font-normal leading-5 text-muted-foreground">{p.thesis}</p> : null}
                    {p.kill_criteria ? (
                      <p className="mt-2 text-xs font-normal text-muted-foreground">
                        <span className={cn(MICRO_LABEL, "mr-2 text-foreground")}>{t("projects.kill")}</span>
                        {p.kill_criteria}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <StatusDot tone={riskTone(p.risk_level)} />
                        <span className={MICRO_LABEL}>
                          {t("projects.risk.suffix", { level: t(`risk.${p.risk_level}`) })}
                        </span>
                      </span>
                      <span className={cn(MICRO_LABEL, "rounded-sm bg-muted/50 px-1.5 py-0.5 text-muted-foreground")}>{t("projects.badge.open")}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 md:grid-cols-1 md:gap-2">
                    <KpiLine label={t("projects.kpi.return")} value={`${p.roi_projection.toFixed(1)}x`} tone="positive" />
                    <KpiLine
                      label={t("projects.kpi.capital")}
                      value={`${formatCNY(p.capital_spent, { compact: true })} / ${formatCNY(p.capital_committed, { compact: true })}`}
                    />
                  </div>

                  <div className="flex items-center gap-1 md:justify-end">
                    <Button variant="ghost" size="icon-sm" onClick={() => openEdit(p)} aria-label={t("common.edit")}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => remove(p)}
                      aria-label={t("common.delete")}
                      className="text-muted-foreground hover:text-[var(--danger)]"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg rounded-xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-base">{editing ? t("projects.form.title.edit") : t("projects.form.title.new")}</DialogTitle>
            <DialogDescription className="text-[12px] text-muted-foreground">
              {t("projects.form.desc")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("projects.form.name")}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                placeholder={t("projects.form.name.ph")}
                className="h-9 rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("projects.form.thesis")}</Label>
              <Textarea
                value={form.thesis ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, thesis: e.target.value }))}
                placeholder={t("projects.form.thesis.ph")}
                className="min-h-20 rounded-md text-[13px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("projects.form.status")}</Label>
                <select
                  aria-label={t("projects.form.status")}
                  value={form.status}
                  onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as ProjectStatus }))}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-[13px]"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {t(`projects.status.${s}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("projects.form.risk")}</Label>
                <select
                  aria-label={t("projects.form.risk")}
                  value={form.risk_level}
                  onChange={(e) => setForm((s) => ({ ...s, risk_level: e.target.value as RiskLevel }))}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-[13px]"
                >
                  {RISK_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {t(`risk.${r}`)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("projects.form.roi")}</Label>
                <Input
                  inputMode="decimal"
                  value={String(form.roi_projection ?? 0)}
                  onChange={(e) => setForm((s) => ({ ...s, roi_projection: Number(e.target.value) || 0 }))}
                  className="h-9 rounded-md"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("projects.form.committed")}</Label>
                <Input
                  inputMode="decimal"
                  value={String(form.capital_committed ?? 0)}
                  onChange={(e) => setForm((s) => ({ ...s, capital_committed: Number(e.target.value) || 0 }))}
                  className="h-9 rounded-md"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">{t("projects.form.kill")}</Label>
              <Textarea
                value={form.kill_criteria ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, kill_criteria: e.target.value }))}
                placeholder={t("projects.form.kill.ph")}
                className="min-h-16 rounded-md text-[13px]"
              />
            </div>
            <DomainSelect
              value={form.domain_tag ?? ""}
              onChange={(next) => setForm((s) => ({ ...s, domain_tag: next }))}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting} className="h-9 rounded-md">
              {t("common.cancel")}
            </Button>
            <Button
              onClick={submit}
              disabled={submitting || !form.name.trim()}
              className="h-9 rounded-md bg-foreground text-background hover:bg-foreground/90"
            >
              {submitting ? t("common.saving") : editing ? t("common.save") : t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
