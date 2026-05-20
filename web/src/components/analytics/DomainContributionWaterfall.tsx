import { useMemo } from "react";
import { useT } from "@/lib/i18nConfig";
import type { Decision, Project, Transaction } from "@/types";
import { useDomains } from "@/components/axiom/primitives";
import { EmptyCanvas } from "./InsightCard";

const WINDOW_DAYS = 30;
const DEFAULT_DOMAINS = [
  { id: "01", label: "Health · 健康" },
  { id: "02", label: "Cashflow · 现金流" },
  { id: "03", label: "Career · 职业" },
  { id: "04", label: "Skills · 技能" },
  { id: "05", label: "Projects · 项目" },
  { id: "06", label: "Cognition · 认知" },
  { id: "07", label: "Relationships" },
  { id: "08", label: "Decisions · 决策" },
  { id: "09", label: "Principles · 原则" },
];

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
    const list = (domains.length ? domains : DEFAULT_DOMAINS).slice(0, 9);
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

  return (
    <div className="space-y-2">
      <ul className="space-y-2">
        {bars.arr.map((bar) => {
          const pct = bars.max > 0 ? (bar.count / bars.max) * 100 : 0;
          return (
            <li key={bar.id} className="grid grid-cols-[36px_1fr_34px] items-center gap-2">
              <span className="font-mono text-[10px] font-normal tabular text-[#64748B] dark:text-[#94A3B8]">
                {bar.id}
              </span>
              <div className="min-w-0">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="truncate text-xs font-normal text-[#0F172A] dark:text-[#F8FAFC]">
                    {bar.label}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-[#1E293B]">
                  <div
                    className="h-full rounded-full bg-[#1E3A8A]/70 dark:bg-[#3B82F6]/70"
                    style={{ width: `${Math.max(bar.count > 0 ? 7 : 0, pct)}%` }}
                  />
                </div>
              </div>
              <span className="text-right font-mono text-xs font-light tracking-tighter tabular text-[#0F172A] dark:text-[#F8FAFC]">
                {bar.count}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="pt-2 font-sans text-[11px] font-normal tracking-tight text-[#64748B] dark:text-[#94A3B8]">
        {bars.total === 0
          ? t("insights.waterfall.silent")
          : t("insights.waterfall.foot", { total: bars.total, window: WINDOW_DAYS })}
      </p>
    </div>
  );
}
