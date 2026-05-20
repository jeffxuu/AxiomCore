import { useMemo } from "react";
import { useT } from "@/lib/i18nConfig";
import type { Decision, Project, Transaction } from "@/types";
import { useDomains } from "@/components/axiom/primitives";
import { EmptyCanvas } from "./InsightCard";

const WINDOW_DAYS = 30;
const VIEW_W = 600;
const VIEW_H = 400;
const PAD_LEFT = 48;
const PAD_RIGHT = 24;
const PAD_TOP = 30;
const PAD_BOTTOM = 60;

function withinWindow(occurred: string | null | undefined): boolean {
  if (!occurred) return false;
  const ts = Date.parse(occurred.length >= 10 ? `${occurred.slice(0, 10)}T00:00:00` : occurred);
  if (Number.isNaN(ts)) return false;
  const now = Date.now();
  return now - ts <= WINDOW_DAYS * 86_400_000;
}

export function DomainContributionWaterfall({
  transactions,
  decisions,
  projects,
}: {
  transactions: Transaction[];
  decisions: Decision[];
  projects: Project[];
}) {
  const t = useT();
  const domains = useDomains();

  const bars = useMemo(() => {
    const list = domains.length ? domains : [];
    const counts = new Map<string, number>();
    for (const d of list) counts.set(d.id, 0);

    for (const tx of transactions) {
      if (!tx.domain_tag || !counts.has(tx.domain_tag)) continue;
      const within = withinWindow(tx.occurred_at) || withinWindow(tx.created_at);
      if (within) counts.set(tx.domain_tag, (counts.get(tx.domain_tag) ?? 0) + 1);
    }
    for (const decision of decisions) {
      if (!decision.domain_tag || !counts.has(decision.domain_tag)) continue;
      const within =
        withinWindow(decision.decided_at) || withinWindow(decision.reviewed_at) || withinWindow(decision.created_at);
      if (within) counts.set(decision.domain_tag, (counts.get(decision.domain_tag) ?? 0) + 1);
    }
    for (const project of projects) {
      if (!project.domain_tag || !counts.has(project.domain_tag)) continue;
      const within = withinWindow(project.updated_at) || withinWindow(project.started_at);
      if (within) counts.set(project.domain_tag, (counts.get(project.domain_tag) ?? 0) + 1);
    }
    const arr = list.map((d) => ({ id: d.id, label: d.label, count: counts.get(d.id) ?? 0 }));
    const max = Math.max(1, ...arr.map((b) => b.count));
    return { arr, max, total: arr.reduce((acc, b) => acc + b.count, 0) };
  }, [domains, transactions, decisions, projects]);

  if (!bars.arr.length) {
    return <EmptyCanvas label={t("insights.waterfall.empty")} />;
  }

  if (bars.total === 0) {
    return <EmptyCanvas label={t("insights.waterfall.silent")} />;
  }

  const trackW = VIEW_W - PAD_LEFT - PAD_RIGHT;
  const trackH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const slot = trackW / bars.arr.length;
  const barWidth = Math.max(14, Math.min(48, slot * 0.62));
  const tickSteps = 4;
  const tickValues = Array.from({ length: tickSteps + 1 }, (_, i) => Math.round((bars.max * i) / tickSteps));

  return (
    <div className="relative w-full">
      <div className="relative w-full" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          role="img"
          aria-label={t("insights.waterfall.title")}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {tickValues.map((v, i) => {
            const y = PAD_TOP + trackH * (1 - i / tickSteps);
            return (
              <line
                key={i}
                x1={PAD_LEFT}
                x2={VIEW_W - PAD_RIGHT}
                y1={y}
                y2={y}
                className="stroke-[#E2E8F0] dark:stroke-[#1E293B]"
                strokeWidth={0.5}
                strokeDasharray={i === 0 ? "" : "3 4"}
              />
            );
          })}

          <line
            x1={PAD_LEFT}
            y1={PAD_TOP}
            x2={PAD_LEFT}
            y2={VIEW_H - PAD_BOTTOM}
            className="stroke-[#94A3B8] dark:stroke-[#334155]"
            strokeWidth={1}
          />

          {bars.arr.map((bar, idx) => {
            const ratio = bar.count / bars.max;
            const height = trackH * ratio;
            const cx = PAD_LEFT + slot * idx + slot / 2;
            const x = cx - barWidth / 2;
            const y = PAD_TOP + trackH - height;
            return (
              <g key={bar.id}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(2, height)}
                  rx={2}
                  ry={2}
                  fill="#1E3A8A"
                  className="dark:hidden"
                />
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={Math.max(2, height)}
                  rx={2}
                  ry={2}
                  fill="#3B82F6"
                  className="hidden dark:block"
                />
              </g>
            );
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0 font-sans text-[11px] tracking-tight">
          {tickValues.map((value, i) => {
            const y = PAD_TOP + trackH * (1 - i / tickSteps);
            return (
              <span
                key={i}
                className="absolute -translate-y-1/2 pr-2 text-right tabular text-[#64748B] dark:text-[#94A3B8]"
                style={{ left: 0, top: `${(y / VIEW_H) * 100}%`, width: `${((PAD_LEFT - 4) / VIEW_W) * 100}%` }}
              >
                {value}
              </span>
            );
          })}

          {bars.arr.map((bar, idx) => {
            const cx = PAD_LEFT + slot * idx + slot / 2;
            const cxPct = (cx / VIEW_W) * 100;
            const ratio = bar.count / bars.max;
            const yLabel = (PAD_TOP + trackH * (1 - ratio) - 10) / VIEW_H * 100;
            return (
              <div key={bar.id}>
                <span
                  className="absolute -translate-x-1/2 ax-kpi text-[10.5px] font-semibold tabular text-[#0F172A] dark:text-[#F8FAFC]"
                  style={{ left: `${cxPct}%`, top: `${Math.max(2, yLabel)}%` }}
                >
                  {bar.count}
                </span>
                <span
                  className="absolute origin-top-left whitespace-nowrap text-[10px] font-medium text-[#475569] dark:text-[#94A3B8]"
                  style={{
                    left: `${cxPct}%`,
                    top: `${((VIEW_H - PAD_BOTTOM + 8) / VIEW_H) * 100}%`,
                    transform: "translateX(-50%) rotate(-32deg)",
                    transformOrigin: "left center",
                  }}
                >
                  {bar.label}
                </span>
              </div>
            );
          })}

          <span
            className="absolute -translate-x-1/2 text-[11px] font-medium text-[#0F172A] dark:text-[#F8FAFC]"
            style={{ left: "50%", bottom: 0 }}
          >
            {t("insights.waterfall.axisX")}
          </span>
          <span
            className="absolute origin-top-left text-[11px] font-medium text-[#0F172A] dark:text-[#F8FAFC]"
            style={{
              left: 4,
              top: "50%",
              transform: "translateY(-50%) rotate(-90deg)",
              transformOrigin: "left center",
            }}
          >
            {t("insights.waterfall.axisY")}
          </span>
        </div>
      </div>

      <p className="mt-3 font-sans text-[11px] tracking-tight text-[#64748B] dark:text-[#94A3B8]">
        {t("insights.waterfall.foot", { total: bars.total, window: WINDOW_DAYS })}
      </p>
    </div>
  );
}
