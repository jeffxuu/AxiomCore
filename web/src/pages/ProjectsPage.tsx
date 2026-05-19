import { useCallback, useEffect, useState } from "react";
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
import { EmptyHint, PageHeader, Panel, StatusDot, formatCNY } from "@/components/axiom/primitives";
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

const EMPTY_FORM: ProjectInput = {
  name: "",
  status: "active",
  thesis: "",
  roi_projection: 0,
  risk_level: "medium",
  kill_criteria: "",
  capital_committed: 0,
  capital_spent: 0,
};

function riskTone(level: RiskLevel): "positive" | "info" | "warning" | "danger" {
  return level === "extreme" ? "danger" : level === "high" ? "warning" : level === "low" ? "positive" : "info";
}

export function ProjectsPage({ onStatus }: { onStatus: (status: string) => void }) {
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
      toast.error(exc instanceof Error ? exc.message : "Failed to load projects");
    }
  }, [onStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
    });
    setOpen(true);
  };

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await updateProject(editing.id, form);
        toast.success("Project updated");
      } else {
        await createProject(form);
        toast.success("Project added");
      }
      setOpen(false);
      void refresh();
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (p: Project) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await deleteProject(p.id);
      toast.success("Project deleted");
      void refresh();
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : "Delete failed");
    }
  };

  return (
    <div>
      <PageHeader
        eyebrow="Sandbox"
        title="Project arena"
        description="The commercial bets currently in flight. Each row carries its thesis, ROI target, risk level and kill criteria."
        actions={
          <Button onClick={openNew} className="h-9 rounded-lg bg-foreground text-background hover:bg-foreground/90">
            <Plus className="size-4" />
            New project
          </Button>
        }
      />

      <Panel contentClassName="px-0 py-0">
        {projects.length === 0 ? (
          <div className="p-6">
            <EmptyHint title="No projects yet" hint="Open “New project” to record your first bet." />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {projects.map((p) => (
              <li key={p.id} className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-[1fr_auto] md:items-start">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <GitBranch className="size-4 text-muted-foreground" />
                    <span className="text-[14px] font-semibold">{p.name}</span>
                    <span
                      className={cn(
                        "ax-status",
                        STATUS_TONE[p.status] === "positive"
                          ? "ax-status-positive"
                          : STATUS_TONE[p.status] === "warning"
                          ? "ax-status-warning"
                          : STATUS_TONE[p.status] === "danger"
                          ? "ax-status-danger"
                          : "ax-status-info"
                      )}
                    >
                      {p.status}
                    </span>
                  </div>
                  {p.thesis ? <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{p.thesis}</p> : null}
                  {p.kill_criteria ? (
                    <p className="mt-1 text-[12px] text-muted-foreground">
                      <span className="text-foreground">Kill if:</span> {p.kill_criteria}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[12px]">
                    <span className="flex items-center gap-1.5">
                      <StatusDot tone={riskTone(p.risk_level)} />
                      <span className="text-muted-foreground uppercase tracking-wider">{p.risk_level} risk</span>
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <span className="ax-kpi tabular text-foreground">ROI target {p.roi_projection.toFixed(1)}x</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="ax-kpi tabular text-muted-foreground">
                      Spent {formatCNY(p.capital_spent)} / {formatCNY(p.capital_committed)} CNY
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(p)} aria-label="Edit">
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(p)}
                    aria-label="Delete"
                    className="text-muted-foreground hover:text-[var(--danger)]"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg rounded-xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-base">{editing ? "Edit project" : "New project"}</DialogTitle>
            <DialogDescription className="text-[12px] text-muted-foreground">
              Name and thesis are mandatory in the operator's head; the form only checks name.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                placeholder="e.g. Cross-border supply chain dropship"
                className="h-9 rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Thesis</Label>
              <Textarea
                value={form.thesis ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, thesis: e.target.value }))}
                placeholder="Why this should work."
                className="min-h-20 rounded-md text-[13px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</Label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((s) => ({ ...s, status: e.target.value as ProjectStatus }))}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-[13px]"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Risk</Label>
                <select
                  value={form.risk_level}
                  onChange={(e) => setForm((s) => ({ ...s, risk_level: e.target.value as RiskLevel }))}
                  className="h-9 w-full rounded-md border border-border bg-background px-2 text-[13px]"
                >
                  {RISK_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">ROI target (x)</Label>
                <Input
                  inputMode="decimal"
                  value={String(form.roi_projection ?? 0)}
                  onChange={(e) => setForm((s) => ({ ...s, roi_projection: Number(e.target.value) || 0 }))}
                  className="h-9 rounded-md"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Committed (CNY)</Label>
                <Input
                  inputMode="decimal"
                  value={String(form.capital_committed ?? 0)}
                  onChange={(e) => setForm((s) => ({ ...s, capital_committed: Number(e.target.value) || 0 }))}
                  className="h-9 rounded-md"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] uppercase tracking-wider text-muted-foreground">Kill criteria</Label>
              <Textarea
                value={form.kill_criteria ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, kill_criteria: e.target.value }))}
                placeholder="What signal, if observed, kills this project?"
                className="min-h-16 rounded-md text-[13px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting} className="h-9 rounded-md">
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={submitting || !form.name.trim()}
              className="h-9 rounded-md bg-foreground text-background hover:bg-foreground/90"
            >
              {submitting ? "Saving…" : editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
