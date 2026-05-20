import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, GitBranch, Scale, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadDashboard, type CommandParseResponse } from "@/api";
import { OmniCommandBar } from "@/components/axiom/OmniCommandBar";
import { EmptyHint, PageHeader, Panel, StatusDot, formatCNY, netTone } from "@/components/axiom/primitives";
import { useT } from "@/lib/i18nConfig";
import type { DashboardPayload, TimelinePoint } from "@/types";
import { cn } from "@/lib/utils";

function runwayTone(months: number | null, netPosition: number, floor: number): "positive" | "warning" | "danger" {
  if (months === null) return "positive";
  if (months <= 3) return "danger";
  if (months <= 6) return "warning";
  if (netPosition <= floor) return "danger";
  return "positive";
}

function Sparkline({ points }: { points: TimelinePoint[] }) {
  const width = 720;
  const height = 90;
  const pad = { top: 8, right: 4, bottom: 8, left: 4 };
  if (!points.length) return <div className="h-[90px] w-full" />;
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
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[90px] w-full" preserveAspectRatio="none" aria-label="net">
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
  const t = useT();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      onStatus("Sync");
      const payload = await loadDashboard();
      setData(payload);
      onStatus("Live");
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : t("dashboard.fetch.fail");
      setError(message);
      onStatus("Sync failed");
    }
  }, [onStatus, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onIngested = useCallback(
    (_result: CommandParseResponse) => {
      void refresh();
    },
    [refresh],
  );

  const cap = data?.capital;
  const baseline = data?.baseline;

  const runwayToneValue = useMemo(() => {
    if (!cap) return "neutral" as const;
    return runwayTone(cap.runway_months, cap.net_position, cap.floor);
  }, [cap]);

  return (
    <div>
      <PageHeader
        eyebrow={t("dashboard.eyebrow")}
        title={t("dashboard.title")}
        description={t("dashboard.desc")}
      />

      <OmniCommandBar onIngested={onIngested} />

      {error ? (
        <div className="mb-4 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-4 py-3 text-[13px] text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      <Panel
        title={t("dashboard.net.title")}
        subtitle={
          baseline
            ? t("dashboard.net.baseline", {
                x: formatCNY(baseline.starting_position, { signed: true }),
                date: baseline.baseline_date,
              })
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
                ? t("dashboard.status.stable")
                : runwayToneValue === "warning"
                ? t("dashboard.status.watch")
                : t("dashboard.status.risk")
              : t("dashboard.status.loading")}
          </span>
        }
      >
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label={t("dashboard.net.title")}
            value={cap ? `${formatCNY(cap.net_position, { signed: true })}` : "—"}
            hint={t("dashboard.net.formula")}
            tone={cap ? netTone(cap.net_position) : "neutral"}
          />
          <Stat
            label={t("dashboard.flow.title")}
            value={cap ? `${formatCNY(cap.monthly_net, { signed: true })}` : "—"}
            hint={
              cap
                ? t("dashboard.flow.split", { inflow: formatCNY(cap.monthly_in), outflow: formatCNY(cap.monthly_out) })
                : undefined
            }
            tone={cap ? netTone(cap.monthly_net) : "neutral"}
          />
          <Stat
            label={t("dashboard.runway.title")}
            value={
              cap
                ? cap.runway_months === null
                  ? t("dashboard.runway.unlimited")
                  : t("dashboard.runway.unit", { x: cap.runway_months.toFixed(1) })
                : "—"
            }
            hint={cap ? t("dashboard.runway.floor", { x: formatCNY(cap.floor, { signed: true }) }) : undefined}
            tone={runwayToneValue}
          />
          <Stat
            label={t("dashboard.headroom.title")}
            value={cap ? `${formatCNY(cap.net_position - cap.floor)} CNY` : "—"}
            hint={t("dashboard.headroom.hint")}
            tone={cap && cap.net_position - cap.floor < 20000 ? "danger" : "neutral"}
          />
        </div>
        <div className="mt-6 border-t border-border pt-4">
          {data ? <Sparkline points={data.timeline} /> : <div className="h-[90px]" />}
          <p className="mt-1 text-[11px] text-muted-foreground">{t("dashboard.spark.hint")}</p>
        </div>
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel
          title={t("dashboard.projects.title")}
          subtitle={
            data
              ? t("dashboard.projects.subtitle", { active: data.projects.active_count, total: data.projects.all_count })
              : t("dashboard.projects.loading")
          }
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/projects")}
              className="h-7 rounded-md text-[12px] text-muted-foreground hover:text-foreground"
            >
              {t("dashboard.projects.open")}
              <ArrowRight className="size-3.5" />
            </Button>
          }
        >
          {data && data.projects.active.length ? (
            <ul className="divide-y divide-border">
              {data.projects.active.slice(0, 5).map((project) => {
                const tone =
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
                      <StatusDot tone={tone} />
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {t(`risk.${project.risk_level}`)}
                      </span>
                      <span className="ax-kpi text-[12px] tabular text-foreground">
                        {t("projects.roi", { x: project.roi_projection.toFixed(1) })}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyHint title={t("dashboard.projects.empty.title")} hint={t("dashboard.projects.empty.hint")} />
          )}
        </Panel>

        <Panel
          title={t("dashboard.decisions.title")}
          subtitle={
            data
              ? t("dashboard.decisions.subtitle", { open: data.decisions.open_count, total: data.decisions.all_count })
              : t("dashboard.decisions.loading")
          }
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/decisions")}
              className="h-7 rounded-md text-[12px] text-muted-foreground hover:text-foreground"
            >
              {t("dashboard.decisions.open")}
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
                        {t(decision.options.length === 1 ? "dashboard.decisions.optsOne" : "dashboard.decisions.optsMany", {
                          n: decision.options.length,
                          preview: decision.options.slice(0, 2).join(" · "),
                        })}
                      </p>
                    ) : null}
                  </div>
                  <span className="ax-status ax-status-warning shrink-0">{t("decisions.bucket.open")}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint title={t("dashboard.decisions.empty.title")} hint={t("dashboard.decisions.empty.hint")} />
          )}
        </Panel>
      </div>

      <Panel
        className="mt-6"
        title={t("dashboard.tx.title")}
        subtitle={t("dashboard.tx.subtitle")}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/ledger")}
            className="h-7 rounded-md text-[12px] text-muted-foreground hover:text-foreground"
          >
            {t("dashboard.tx.open")}
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
                    <p className="truncate text-[13px] font-medium">
                      {tx.note || (tx.kind === "income" ? t("dashboard.quick.income") : t("dashboard.quick.expense"))}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {tx.occurred_at} · {tx.category || (tx.kind === "income" ? t("dashboard.quick.income") : t("dashboard.quick.expense"))}
                    </p>
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
            <EmptyHint title={t("dashboard.tx.empty.title")} hint={t("dashboard.tx.empty.hint")} />
          </div>
        )}
      </Panel>

      {cap && cap.net_position <= cap.floor ? (
        <div className="mt-6 flex items-start gap-3 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-4 py-3 text-[13px]">
          <ShieldAlert className="mt-0.5 size-4 text-[var(--danger)]" />
          <div>
            <p className="font-medium text-[var(--danger)]">{t("dashboard.floor.title")}</p>
            <p className="mt-0.5 text-muted-foreground">
              {t("dashboard.floor.desc", { x: formatCNY(cap.floor, { signed: true }) })}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
