import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  loadDashboard,
  loadDecisions,
  loadProjects,
  loadTransactions,
  type CommandParseResponse,
} from "@/api";
import { OmniCommandBar } from "@/components/axiom/OmniCommandBar";
import {
  EmptyHint,
  PageHeader,
  Panel,
  StatusDot,
  formatCNY,
  netTone,
} from "@/components/axiom/primitives";
import { InsightCard } from "@/components/analytics/InsightCard";
import { RiskRoiMatrix } from "@/components/analytics/RiskRoiMatrix";
import { DecisionFunnel } from "@/components/analytics/DecisionFunnel";
import { RunwayVelocityChart } from "@/components/analytics/RunwayVelocityChart";
import { CapitalAllocationTree } from "@/components/analytics/CapitalAllocationTree";
import { DomainContributionWaterfall } from "@/components/analytics/DomainContributionWaterfall";
import { RiskExposureRadar } from "@/components/analytics/RiskExposureRadar";
import { useT } from "@/lib/i18nConfig";
import type {
  DashboardPayload,
  Decision,
  Project,
  Transaction,
  TimelinePoint,
} from "@/types";
import { cn } from "@/lib/utils";

const POSITIVE_HINTS = ["✓", "成功", "达成", "win", "won", "positive", "good", "exceeded", "yes", "shipped"];
const NEGATIVE_HINTS = ["✗", "失败", "未达成", "lost", "loss", "negative", "bad", "missed", "no", "fail"];

function classifyOutcome(text: string): "positive" | "negative" | "neutral" {
  if (!text) return "neutral";
  const normalized = text.toLowerCase();
  if (POSITIVE_HINTS.some((tok) => normalized.includes(tok.toLowerCase()))) return "positive";
  if (NEGATIVE_HINTS.some((tok) => normalized.includes(tok.toLowerCase()))) return "negative";
  return "neutral";
}

function runwayTone(months: number | null, netPosition: number, floor: number): "positive" | "warning" | "danger" {
  if (months === null) return "positive";
  if (months <= 3) return "danger";
  if (months <= 6) return "warning";
  if (netPosition <= floor) return "danger";
  return "positive";
}

function Sparkline({
  points,
  tone,
  fillId,
}: {
  points: TimelinePoint[];
  tone: "positive" | "danger" | "neutral";
  fillId: string;
}) {
  const width = 200;
  const height = 40;
  const pad = { top: 4, right: 2, bottom: 4, left: 2 };
  if (!points.length) return <div className="h-10 w-full" />;
  const values = points.map((p) => p.net);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const xOf = (i: number) => pad.left + ((width - pad.left - pad.right) * i) / Math.max(points.length - 1, 1);
  const yOf = (v: number) => pad.top + (height - pad.top - pad.bottom) * (1 - (v - min) / range);
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(p.net).toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${xOf(points.length - 1).toFixed(1)} ${height} L ${xOf(0).toFixed(1)} ${height} Z`;
  const color =
    tone === "positive"
      ? "var(--ax-positive)"
      : tone === "danger"
      ? "var(--ax-danger)"
      : "var(--ax-text)";
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${fillId})`} stroke="none" />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function KpiCard({
  label,
  value,
  hint,
  badge,
  tone,
  spark,
}: {
  label: string;
  value: string;
  hint?: string;
  badge?: { text: string; tone: "positive" | "warning" | "danger" | "neutral" };
  tone?: "positive" | "danger" | "neutral";
  spark?: React.ReactNode;
}) {
  const valueClass = {
    positive: "text-[var(--positive)]",
    danger: "text-[var(--danger)]",
    neutral: "text-foreground",
  }[tone ?? "neutral"];
  const badgeColor = badge
    ? {
        positive: "var(--positive)",
        warning: "var(--warning)",
        danger: "var(--danger)",
        neutral: "var(--ax-muted)",
      }[badge.tone]
    : null;
  return (
    <div className="ax-card p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="ax-eyebrow">{label}</p>
        {badge ? (
          <span
            className="ax-chip"
            style={{ color: badgeColor ?? undefined }}
          >
            <span className="ax-chip-dot" style={{ background: badgeColor ?? undefined }} />
            {badge.text}
          </span>
        ) : null}
      </div>
      <p className={cn("ax-kpi mt-2 text-[26px] font-semibold leading-none tabular", valueClass)}>{value}</p>
      {hint ? <p className="ax-kpi mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
      {spark ? <div className="mt-2">{spark}</div> : null}
    </div>
  );
}

function DecisionsBars({ buckets }: { buckets: number[] }) {
  // Render the last N decisions as small vertical bars (status-coloured).
  // buckets[i] is in [0..1] — the bar height ratio.
  const width = 200;
  const height = 40;
  const barWidth = 10;
  const gap = 6;
  const slot = barWidth + gap;
  const startX = (width - (buckets.length * slot - gap)) / 2;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden>
      {buckets.map((b, i) => {
        const h = Math.max(4, Math.round(b * (height - 4)));
        const x = startX + i * slot;
        const y = height - h;
        const highlight = b >= 0.85;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={h}
            rx={1.4}
            fill={highlight ? "var(--ax-text)" : "var(--ax-accent-soft, var(--ax-muted))"}
            opacity={highlight ? 1 : 0.55}
          />
        );
      })}
    </svg>
  );
}

function DecisionRow({ decision }: { decision: Decision }) {
  const stateTone =
    decision.status === "reviewed"
      ? classifyOutcome(decision.reviewed_outcome) === "positive"
        ? "positive"
        : classifyOutcome(decision.reviewed_outcome) === "negative"
        ? "danger"
        : "neutral"
      : decision.status === "committed"
      ? "warning"
      : "neutral";
  const stateLabel =
    decision.status === "reviewed"
      ? classifyOutcome(decision.reviewed_outcome) === "positive"
        ? "WIN"
        : classifyOutcome(decision.reviewed_outcome) === "negative"
        ? "LOSS"
        : "REVIEWED"
      : decision.status === "committed"
      ? "COMMITTED"
      : "OPEN";
  const stateColor =
    stateTone === "positive"
      ? "var(--positive)"
      : stateTone === "warning"
      ? "var(--warning)"
      : stateTone === "danger"
      ? "var(--danger)"
      : "var(--ax-muted)";
  const shortId = decision.id.length > 6 ? decision.id.slice(-6) : decision.id;
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="ax-kpi py-2.5 pl-5 pr-3 text-[11px] tabular text-muted-foreground">#{shortId}</td>
      <td className="max-w-[320px] truncate py-2.5 pr-3 text-[12.5px] text-foreground">{decision.context || "—"}</td>
      <td className="py-2.5 pr-3">
        {decision.domain_tag ? (
          <span className="ax-chip">
            <span className="ax-chip-dot" style={{ background: "var(--ax-muted)" }} />
            {decision.domain_tag}
          </span>
        ) : (
          <span className="text-[11px] text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-2.5 pr-3 text-right text-[11.5px] text-muted-foreground">
        {decision.options.length ? `${decision.options.length} 选项` : "—"}
      </td>
      <td className="py-2.5 pr-5 text-right">
        <span className="ax-chip" style={{ color: stateColor }}>
          <span className="ax-chip-dot" style={{ background: stateColor }} />
          {stateLabel}
        </span>
      </td>
    </tr>
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      onStatus("Sync");
      const [dash, txResp, projResp, decResp] = await Promise.all([
        loadDashboard(),
        loadTransactions(200).catch(() => ({ ok: true as const, transactions: [] as Transaction[] })),
        loadProjects().catch(() => ({ ok: true as const, projects: [] as Project[] })),
        loadDecisions().catch(() => ({ ok: true as const, decisions: [] as Decision[] })),
      ]);
      setData(dash);
      setTransactions(txResp.transactions);
      setProjects(projResp.projects);
      setDecisions(decResp.decisions);
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
  const baseline = data?.baseline ?? null;

  const runwayToneValue = useMemo(() => {
    if (!cap) return "neutral" as const;
    return runwayTone(cap.runway_months, cap.net_position, cap.floor);
  }, [cap]);

  // Decisions win-rate (reviewed → positive ratio)
  const winStats = useMemo(() => {
    const reviewed = decisions.filter((d) => d.status === "reviewed");
    const positives = reviewed.filter((d) => classifyOutcome(d.reviewed_outcome) === "positive").length;
    const rate = reviewed.length === 0 ? null : positives / reviewed.length;
    return {
      reviewed: reviewed.length,
      total: decisions.length,
      positives,
      rate,
    };
  }, [decisions]);

  // Sparkline buckets for the decisions KPI: last 12 decisions' status weight.
  const decisionBars = useMemo(() => {
    const last = decisions.slice(0, 12).reverse();
    return last.map((d) => {
      if (d.status === "reviewed") {
        const cls = classifyOutcome(d.reviewed_outcome);
        return cls === "positive" ? 1 : cls === "negative" ? 0.25 : 0.55;
      }
      if (d.status === "committed") return 0.7;
      return 0.4;
    });
  }, [decisions]);

  const runwayDaysLabel = useMemo(() => {
    if (!cap || cap.runway_months === null) return "∞";
    return `${Math.round(cap.runway_months * 30)}d`;
  }, [cap]);

  const headroom = useMemo(() => {
    if (!cap) return 0;
    return cap.net_position - cap.floor;
  }, [cap]);

  // Recent decisions for the bottom table (max 6 rows).
  const recentDecisions = useMemo(() => decisions.slice(0, 6), [decisions]);

  return (
    <div>
      <OmniCommandBar onIngested={onIngested} />

      <PageHeader
        eyebrow={t("dashboard.eyebrow")}
        title={t("dashboard.title")}
        description={t("dashboard.desc")}
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/5 px-4 py-3 text-[13px] text-[var(--danger)]">
          {error}
        </div>
      ) : null}

      {/* ─── KPI strip (4 hero metrics) ─── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label={t("dashboard.net.title")}
          value={cap ? formatCNY(cap.net_position, { signed: true }) : "—"}
          hint={
            cap
              ? `vs floor ${formatCNY(cap.net_position - cap.floor, { signed: true })}`
              : undefined
          }
          tone={cap ? netTone(cap.net_position) : "neutral"}
          badge={
            cap
              ? {
                  text: cap.monthly_net >= 0 ? `+${formatCNY(cap.monthly_net)}/mo` : `${formatCNY(cap.monthly_net)}/mo`,
                  tone: cap.monthly_net >= 0 ? "positive" : "danger",
                }
              : undefined
          }
          spark={
            data ? (
              <Sparkline
                points={data.timeline}
                tone={cap ? netTone(cap.net_position) : "neutral"}
                fillId="kpi-net-fill"
              />
            ) : null
          }
        />
        <KpiCard
          label={t("dashboard.runway.title")}
          value={
            cap
              ? cap.runway_months === null
                ? "∞"
                : t("dashboard.runway.unit", { x: cap.runway_months.toFixed(1) })
              : "—"
          }
          hint={
            cap
              ? `${runwayDaysLabel} · floor ${formatCNY(cap.floor, { signed: true })}`
              : undefined
          }
          tone={runwayToneValue === "positive" ? "positive" : runwayToneValue === "danger" ? "danger" : "neutral"}
          badge={
            cap
              ? {
                  text:
                    runwayToneValue === "positive"
                      ? t("dashboard.status.stable")
                      : runwayToneValue === "warning"
                      ? t("dashboard.status.watch")
                      : t("dashboard.status.risk"),
                  tone:
                    runwayToneValue === "positive"
                      ? "positive"
                      : runwayToneValue === "warning"
                      ? "warning"
                      : "danger",
                }
              : undefined
          }
          spark={
            data ? (
              <Sparkline
                points={data.timeline}
                tone={runwayToneValue === "positive" ? "positive" : runwayToneValue === "danger" ? "danger" : "neutral"}
                fillId="kpi-runway-fill"
              />
            ) : null
          }
        />
        <KpiCard
          label="Decisions · 决策胜率"
          value={
            winStats.rate === null
              ? `${winStats.total}`
              : `${winStats.positives}/${winStats.reviewed}`
          }
          hint={
            winStats.rate === null
              ? `${winStats.total} 条 · 待复盘`
              : `${Math.round(winStats.rate * 100)}% · 12M rolling`
          }
          tone={
            winStats.rate === null
              ? "neutral"
              : winStats.rate >= 0.6
              ? "positive"
              : winStats.rate >= 0.4
              ? "neutral"
              : "danger"
          }
          badge={
            winStats.rate !== null
              ? {
                  text: `${Math.round(winStats.rate * 100)}%`,
                  tone: winStats.rate >= 0.6 ? "positive" : winStats.rate >= 0.4 ? "neutral" : "danger",
                }
              : undefined
          }
          spark={decisionBars.length > 0 ? <DecisionsBars buckets={decisionBars} /> : null}
        />
        <KpiCard
          label="Safety headroom · 安全余量"
          value={cap ? `${formatCNY(headroom)}` : "—"}
          hint={
            cap
              ? `floor ${formatCNY(cap.floor, { signed: true })} · ${transactions.length} tx tracked`
              : undefined
          }
          tone={cap && headroom < 20000 ? "danger" : cap && headroom < 60000 ? "neutral" : "positive"}
          badge={
            cap
              ? {
                  text:
                    headroom < 20000
                      ? "critical"
                      : headroom < 60000
                      ? "watch"
                      : "healthy",
                  tone: headroom < 20000 ? "danger" : headroom < 60000 ? "warning" : "positive",
                }
              : undefined
          }
          spark={
            data ? (
              <Sparkline
                points={data.timeline}
                tone={headroom < 20000 ? "danger" : headroom < 60000 ? "neutral" : "positive"}
                fillId="kpi-headroom-fill"
              />
            ) : null
          }
        />
      </section>

      {/* ─── C1 + D1 : Runway Horizon (65%) + Domain Audit (35%) ─── */}
      <section
        className="mt-6 grid gap-4"
        style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}
      >
        <div className="min-w-0 [grid-column:span_13/span_13]">
          <InsightCard
            title={t("insights.runway.title")}
            subtitle={t("insights.runway.subtitle")}
            badge={
              cap ? (
                <span
                  className={cn(
                    "ax-chip",
                    runwayToneValue === "positive"
                      ? "ax-status-positive"
                      : runwayToneValue === "warning"
                      ? "ax-status-warning"
                      : "ax-status-danger",
                  )}
                >
                  <span
                    className="ax-chip-dot"
                    style={{
                      background:
                        runwayToneValue === "positive"
                          ? "var(--positive)"
                          : runwayToneValue === "warning"
                          ? "var(--warning)"
                          : "var(--danger)",
                    }}
                  />
                  {runwayToneValue === "positive"
                    ? t("dashboard.status.stable")
                    : runwayToneValue === "warning"
                    ? t("dashboard.status.watch")
                    : t("dashboard.status.risk")}
                </span>
              ) : null
            }
          >
            <RunwayVelocityChart baseline={baseline} transactions={transactions} />
          </InsightCard>
        </div>
        <div className="min-w-0 [grid-column:span_7/span_7]">
          <InsightCard
            title={t("insights.waterfall.title")}
            subtitle={t("insights.waterfall.subtitle")}
            badge={<span className="ax-chip ax-kpi">30d</span>}
          >
            <DomainContributionWaterfall
              transactions={transactions}
              decisions={decisions}
              projects={projects}
            />
          </InsightCard>
        </div>
      </section>

      {/* ─── C2 + D2 : Risk×ROI Matrix (65%) + Decision Funnel (35%) ─── */}
      <section
        className="mt-6 grid gap-4"
        style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}
      >
        <div className="min-w-0 [grid-column:span_13/span_13]">
          <InsightCard
            title={t("insights.matrix.title")}
            subtitle={t("insights.matrix.subtitle")}
            badge={<span className="ax-chip ax-kpi">{projects.filter((p) => p.status === "active").length} 在跑</span>}
          >
            <RiskRoiMatrix projects={projects.filter((p) => p.status === "active")} />
          </InsightCard>
        </div>
        <div className="min-w-0 [grid-column:span_7/span_7]">
          <InsightCard
            title={t("insights.funnel.title")}
            subtitle={t("insights.funnel.subtitle")}
            badge={
              winStats.rate !== null ? (
                <span
                  className="ax-chip"
                  style={{
                    color:
                      winStats.rate >= 0.6
                        ? "var(--positive)"
                        : winStats.rate >= 0.4
                        ? "var(--warning)"
                        : "var(--danger)",
                  }}
                >
                  <span
                    className="ax-chip-dot"
                    style={{
                      background:
                        winStats.rate >= 0.6
                          ? "var(--positive)"
                          : winStats.rate >= 0.4
                          ? "var(--warning)"
                          : "var(--danger)",
                    }}
                  />
                  {Math.round(winStats.rate * 100)}%
                </span>
              ) : null
            }
          >
            <DecisionFunnel decisions={decisions} />
          </InsightCard>
        </div>
      </section>

      {/* ─── D3 + Risk Radar : MECE Capital (50%) + Exposure (50%) ─── */}
      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <InsightCard
          title={t("insights.allocation.title")}
          subtitle={t("insights.allocation.subtitle")}
          badge={<span className="ax-chip ax-kpi">Σ {projects.filter((p) => p.status === "active").length}</span>}
        >
          <CapitalAllocationTree projects={projects} />
        </InsightCard>
        <InsightCard
          title={t("insights.exposure.title")}
          subtitle={t("insights.exposure.subtitle")}
        >
          <RiskExposureRadar projects={projects} />
        </InsightCard>
      </section>

      {/* ─── E. Recent decisions table ─── */}
      <Panel
        className="mt-6"
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
        contentClassName="px-0 py-0"
      >
        {recentDecisions.length > 0 ? (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pl-5 pr-3 font-medium">ID</th>
                <th className="py-2 pr-3 font-medium">Decision</th>
                <th className="py-2 pr-3 font-medium">Domain</th>
                <th className="py-2 pr-3 text-right font-medium">Options</th>
                <th className="py-2 pr-5 text-right font-medium">State</th>
              </tr>
            </thead>
            <tbody>
              {recentDecisions.map((d) => (
                <DecisionRow key={d.id} decision={d} />
              ))}
            </tbody>
          </table>
        ) : (
          <div className="px-5 py-6">
            <EmptyHint title={t("dashboard.decisions.empty.title")} hint={t("dashboard.decisions.empty.hint")} />
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

      {/* ─── F. Footer telemetry ─── */}
      <footer
        className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-[10.5px]"
        style={{ color: "var(--ax-muted)" }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="ax-kpi">Axiom Core 3.0 · sovereign-mode</span>
          <span aria-hidden>·</span>
          <span>SQLite 4 tables · ledger / projects / decisions / capital_tx</span>
          <span aria-hidden>·</span>
          <span>4SAPI gateway · multi-vendor</span>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot tone="positive" />
          <span>All systems nominal</span>
        </div>
      </footer>
    </div>
  );
}
