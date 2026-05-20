import { useMemo } from "react";
import { useT } from "@/lib/i18nConfig";
import { formatCNY } from "@/components/axiom/primitives";
import type { Project } from "@/types";
import { EmptyCanvas } from "./InsightCard";

export function CapitalAllocationTree({ projects }: { projects: Project[] }) {
  const t = useT();

  const rows = useMemo(() => {
    const visible = projects
      .filter((p) => p.status !== "killed")
      .filter((p) => p.capital_committed > 0 || p.capital_spent > 0)
      .sort((a, b) => b.capital_committed - a.capital_committed)
      .slice(0, 10);
    const maxCommitted = visible.reduce((acc, p) => Math.max(acc, p.capital_committed, p.capital_spent), 0) || 1;
    return visible.map((project) => {
      const spentRatio = project.capital_committed > 0 ? project.capital_spent / project.capital_committed : 0;
      const committedPct = (project.capital_committed / maxCommitted) * 100;
      const spentPct = (project.capital_spent / maxCommitted) * 100;
      const overrun = project.capital_spent > project.capital_committed;
      const tone = overrun ? "danger" : spentRatio > 0.8 ? "warning" : "positive";
      return { project, committedPct, spentPct, spentRatio, tone, overrun };
    });
  }, [projects]);

  if (!rows.length) {
    return <EmptyCanvas label={t("insights.allocation.empty")} />;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748B] dark:text-[#94A3B8]">
        <span>{t("insights.allocation.column.project")}</span>
        <span>{t("insights.allocation.column.usage")}</span>
      </div>
      <ul className="space-y-2.5">
        {rows.map(({ project, committedPct, spentPct, spentRatio, tone, overrun }) => {
          const fillColor =
            tone === "danger"
              ? "bg-[#E11D48] dark:bg-[#F43F5E]"
              : tone === "warning"
              ? "bg-[#D97706] dark:bg-[#F59E0B]"
              : "bg-[#0D9488] dark:bg-[#14B8A6]";
          const widthSpent = Math.min(100, spentPct);
          return (
            <li key={project.id}>
              <div className="flex items-center justify-between gap-3 font-sans text-[12px] tracking-tight">
                <span className="min-w-0 flex-1 truncate font-medium text-[#0F172A] dark:text-[#F8FAFC]">
                  {project.name}
                </span>
                <span className="ax-kpi shrink-0 text-[11px] tabular text-[#64748B] dark:text-[#94A3B8]">
                  {(spentRatio * 100).toFixed(0)}%
                </span>
              </div>
              <div className="relative mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-[#1E293B]">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-[#94A3B8]/60 dark:bg-[#334155]/80"
                  style={{ width: `${committedPct}%` }}
                  aria-hidden
                />
                <div
                  className={`absolute inset-y-0 left-0 rounded-full ${fillColor}`}
                  style={{ width: `${widthSpent}%` }}
                  aria-hidden
                />
              </div>
              <p className="mt-1 font-sans text-[10.5px] tracking-tight text-[#64748B] dark:text-[#94A3B8]">
                <span className="ax-kpi text-[#0F172A] dark:text-[#F8FAFC]">{formatCNY(project.capital_spent)}</span>{" "}
                /{" "}
                <span className="ax-kpi">{formatCNY(project.capital_committed)} CNY</span>
                {overrun ? (
                  <span className="ml-2 rounded-sm bg-[#E11D48]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#E11D48] dark:bg-[#F43F5E]/14 dark:text-[#F43F5E]">
                    {t("insights.allocation.overrun")}
                  </span>
                ) : null}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
