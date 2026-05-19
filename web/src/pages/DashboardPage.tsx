import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, GitBranch, Plus, Scale, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createTransaction, loadDashboard } from "@/api";
import { EmptyHint, PageHeader, Panel, StatusDot, formatCNY, netTone } from "@/components/axiom/primitives";
import type { DashboardPayload, TimelinePoint } from "@/types";
import { cn } from "@/lib/utils";

type FormState = { kind: "income" | "expense"; amount: string; note: string };

function runwayTone(months: number | null, netPosition: number, floor: number): "positive" | "warning" | "danger" {
  if (months === null) return "positive"; // cash-flow positive
  // months below 3 = danger, 3-6 = warning, otherwise OK
  if (months <= 3) return "danger";
  if (months <= 6) return "warning";
  // also red if we're already below floor
  if (netPosition <= floor) return "danger";
  return "positive";
}

function formatRunway(months: number | null): string {
  if (months === null) return "∞";
  if (months >= 99) return "99+";
  return `${months.toFixed(1)}`;
}

function Sparkline({ points }: { points: TimelinePoint[] }) {
  const width = 720;
  const height = 90;
  const pad = { top: 8, right: 4, bottom: 8, left: 4 };
  if (!points.length) {
    return <div className="h-[90px] w-full" />;
  }
  const values = points.map((p) => p.net);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const xOf = (i: number) => pad.left + ((width - pad.left - pad.right) * i) / Math.max(points.length - 1, 1);
  const yOf = (v: number) => pad.top + (height - pad.top - pad.bottom) * (1 - (v - min) / range);
  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(p.net).toFixed(1)}`)
    .join(" ");
  const lastNet = values[values.length - 1];
  const firstNet = values[0];
  const tone = lastNet >= firstNet ? "var(--positive)" : "var(--danger)";
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[90px] w-full" preserveAspectRatio="none" aria-label="30-day net">
      <path d={path} fill="none" stroke={tone} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "positive" | "warning" | "danger";
}) {
  const valueClass = {
    neutral: "text-foreground",
    positive: "text-[var(--positive)]",
    warning: "text-[var(--warning)]",
    danger: "text-[var(--danger)]",
  }[tone];
  return (
    <div className="space-y-1.5">
      <p className="ax-eyebrow">{label}</p>
      <p className={cn("ax-kpi text-[26px] font-semibold leading-none", valueClass)}>{value}</p>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function DashboardPage({
  navigate,
  onStatus,
}: {
  navigate: (href: string) => void;
  onStatus: (status: string) => void;
}) {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ kind: "expense", amount: "", note: "" });
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    try {
      onStatus("Sync");
      const payload = await loadDashboard();
      setData(payload);
      onStatus("Live");
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : "Dashboard fetch failed";
      setError(message);
      onStatus("Sync failed");
    }
  }, [onStatus]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const submitTx = async () => {
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Amount must be > 0");
      return;
    }
    setSubmitting(true);
    try {
      await createTransaction({ kind: form.kind, amount, note: form.note.trim() });
      toast.success(`${form.kind === "income" ? "Income" : "Expense"} recorded · ${formatCNY(amount)} CNY`);
      setQuickOpen(false);
      setForm({ kind: "expense", amount: "", note: "" });
      void refresh();
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : "Failed to record transaction");
    } finally {
      setSubmitting(false);
    }
  };

  const cap = data?.capital;
  const baseline = data?.baseline;

  const runwayToneValue = useMemo(() => {
    if (!cap) return "neutral" as const;
    return runwayTone(cap.runway_months, cap.net_position, cap.floor);
  }, [cap]);

  return (
    <div>
      <PageHeader
        eyebrow="Command Deck"
        title="Capital snapshot"
        description="Net position, monthly flow, and distance to the absolute floor. Every action below feeds the next decision."
        actions={
          <Button
            onClick={() => setQuickOpen(true)}
            className="h-9 rounded-lg bg-foreground text-background hover:bg-foreground/90"
          >
            <Plus className="size-4" />
            Log entry
          </Button>
        }
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-4 py-3 text-[13px] text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {/* Hero capital block */}
      <Panel
        title="Net position"
        subtitle={
          baseline
            ? `Baseline ${formatCNY(baseline.starting_position, { signed: true })} CNY · since ${baseline.baseline_date}`
            : undefined
        }
        actions={
          <span
            className={cn(
              "ax-status",
              runwayToneValue === "positive"
                ? "ax-status-positive"
                : runwayToneValue === "warning"
                ? "ax-status-warning"
                : "ax-status-danger"
            )}
          >
            {cap
              ? runwayToneValue === "positive"
                ? "Cash-flow stable"
                : runwayToneValue === "warning"
                ? "Watch burn"
                : "Floor risk"
              : "Loading"}
          </span>
        }
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Net position"
            value={cap ? `${formatCNY(cap.net_position, { signed: true })}` : "—"}
            hint="Baseline + Σ(income) − Σ(expense)"
            tone={cap ? netTone(cap.net_position) : "neutral"}
          />
          <Stat
            label="Monthly net (30d)"
            value={cap ? `${formatCNY(cap.monthly_net, { signed: true })}` : "—"}
            hint={cap ? `+${formatCNY(cap.monthly_in)} / −${formatCNY(cap.monthly_out)}` : undefined}
            tone={cap ? netTone(cap.monthly_net) : "neutral"}
          />
          <Stat
            label="Runway to floor"
            value={cap ? `${formatRunway(cap.runway_months)} mo` : "—"}
            hint={cap ? `Floor ${formatCNY(cap.floor, { signed: true })} CNY` : undefined}
            tone={runwayToneValue}
          />
          <Stat
            label="Headroom"
            value={cap ? `${formatCNY(cap.net_position - cap.floor)} CNY` : "—"}
            hint="Distance to absolute danger line"
            tone={cap && cap.net_position - cap.floor < 20000 ? "danger" : "neutral"}
          />
        </div>
        <div className="mt-6 border-t border-border pt-4">
          {data ? <Sparkline points={data.timeline} /> : <div className="h-[90px]" />}
          <p className="mt-1 text-[11px] text-muted-foreground">30-day rolling net position. Last point is today.</p>
        </div>
      </Panel>

      {/* Projects + Decisions side by side */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel
          title="Active projects"
          subtitle={
            data ? `${data.projects.active_count} active / ${data.projects.all_count} total` : "Loading projects…"
          }
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/projects")}
              className="h-7 rounded-md text-[12px] text-muted-foreground hover:text-foreground"
            >
              Open arena
              <ArrowRight className="size-3.5" />
            </Button>
          }
        >
          {data && data.projects.active.length ? (
            <ul className="divide-y divide-border">
              {data.projects.active.slice(0, 5).map((project) => {
                const riskTone =
                  project.risk_level === "extreme"
                    ? "danger"
                    : project.risk_level === "high"
                    ? "warning"
                    : project.risk_level === "low"
                    ? "positive"
                    : "info";
                return (
                  <li key={project.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <GitBranch className="size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{project.name}</p>
                      {project.thesis ? (
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">{project.thesis}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusDot tone={riskTone} />
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {project.risk_level}
                      </span>
                      <span className="ax-kpi text-[12px] tabular text-foreground">
                        ROI {project.roi_projection.toFixed(1)}x
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyHint title="No active projects" hint="Open the arena to add one." />
          )}
        </Panel>

        <Panel
          title="Open decisions"
          subtitle={
            data
              ? `${data.decisions.open_count} open / ${data.decisions.all_count} logged`
              : "Loading decisions…"
          }
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/decisions")}
              className="h-7 rounded-md text-[12px] text-muted-foreground hover:text-foreground"
            >
              Open log
              <ArrowRight className="size-3.5" />
            </Button>
          }
        >
          {data && data.decisions.open.length ? (
            <ul className="divide-y divide-border">
              {data.decisions.open.slice(0, 5).map((decision) => (
                <li key={decision.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <Scale className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[13px] font-medium">{decision.context}</p>
                    {decision.options.length ? (
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {decision.options.length} option{decision.options.length === 1 ? "" : "s"} · {decision.options.slice(0, 2).join(" · ")}
                      </p>
                    ) : null}
                  </div>
                  <span className="ax-status ax-status-warning shrink-0">Open</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint title="No open decisions" hint="Log one when you face a non-obvious choice." />
          )}
        </Panel>
      </div>

      {/* Recent transactions */}
      <Panel
        className="mt-6"
        title="Recent transactions"
        subtitle="Last 8 ledger entries. Open the Ledger view for the full history."
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/ledger")}
            className="h-7 rounded-md text-[12px] text-muted-foreground hover:text-foreground"
          >
            Open ledger
            <ArrowRight className="size-3.5" />
          </Button>
        }
        contentClassName="px-0 py-0"
      >
        {data && data.recent_tx.length ? (
          <ul className="divide-y divide-border">
            {data.recent_tx.map((tx) => {
              const Icon = tx.kind === "income" ? ArrowUpRight : ArrowDownRight;
              const valueClass = tx.kind === "income" ? "text-[var(--positive)]" : "text-foreground";
              return (
                <li key={tx.id} className="flex items-center gap-3 px-5 py-3">
                  <Icon className={cn("size-4 shrink-0", tx.kind === "income" ? "text-[var(--positive)]" : "text-muted-foreground")} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{tx.note || (tx.kind === "income" ? "Income" : "Expense")}</p>
                    <p className="text-[11px] text-muted-foreground">{tx.occurred_at} · {tx.category || tx.kind}</p>
                  </div>
                  <span className={cn("ax-kpi text-[13px] font-medium tabular", valueClass)}>
                    {tx.kind === "income" ? "+" : "−"}
                    {formatCNY(tx.amount)} CNY
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="px-5 py-6">
            <EmptyHint title="No transactions yet" hint="Log income or expense above to start the curve." />
          </div>
        )}
      </Panel>

      {/* Quick-log dialog */}
      <Dialog open={quickOpen} onOpenChange={setQuickOpen}>
        <DialogContent className="rounded-xl border-border bg-card">
          <DialogHeader>
            <DialogTitle className="text-base">Log a transaction</DialogTitle>
            <DialogDescription className="text-[12px] text-muted-foreground">
              One line. This updates the runway calculation instantly.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-2">
              {(["expense", "income"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setForm((s) => ({ ...s, kind }))}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-[13px] transition-colors",
                    form.kind === kind
                      ? "border-foreground/70 bg-foreground/5 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                    {kind === "expense" ? "Outflow" : "Inflow"}
                  </span>
                  {kind === "expense" ? "Expense" : "Income"}
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount" className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Amount (CNY)
              </Label>
              <Input
                id="amount"
                inputMode="decimal"
                placeholder="e.g. 250"
                value={form.amount}
                onChange={(e) => setForm((s) => ({ ...s, amount: e.target.value }))}
                className="h-9 rounded-md"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note" className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Note
              </Label>
              <Input
                id="note"
                placeholder="What for?"
                value={form.note}
                onChange={(e) => setForm((s) => ({ ...s, note: e.target.value }))}
                className="h-9 rounded-md"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setQuickOpen(false)} disabled={submitting} className="h-9 rounded-md">
              Cancel
            </Button>
            <Button
              onClick={submitTx}
              disabled={submitting || !form.amount.trim()}
              className="h-9 rounded-md bg-foreground text-background hover:bg-foreground/90"
            >
              {submitting ? "Logging…" : "Log"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {cap && cap.net_position <= cap.floor ? (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-4 py-3 text-[13px]">
          <ShieldAlert className="mt-0.5 size-4 text-[var(--danger)]" />
          <div>
            <p className="font-medium text-[var(--danger)]">Below absolute floor</p>
            <p className="mt-0.5 text-muted-foreground">
              Net position has crossed the configured floor of {formatCNY(cap.floor, { signed: true })} CNY. Halt commits
              that increase burn until inflow recovers.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
