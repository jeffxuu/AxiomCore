import { useMemo } from "react";
import { useT } from "@/lib/i18nConfig";
import { formatCNY } from "@/components/axiom/primitives";
import type { Project, RiskLevel } from "@/types";
import { EmptyCanvas } from "./InsightCard";

const ORDER: RiskLevel[] = ["low", "medium", "high", "extreme"];
const DANGER_THRESHOLD = 0.4;

const TRACK_COLORS: Record<RiskLevel, { fg: string; ring: string }> = {
  low: { fg: "#0D9488", ring: "#0D9488" },
  medium: { fg: "#D97706", ring: "#D97706" },
  high: { fg: "#E11D48", ring: "#E11D48" },
  extreme: { fg: "#9F1239", ring: "#9F1239" },
};
const TRACK_COLORS_DARK: Record<RiskLevel, { fg: string; ring: string }> = {
  low: { fg: "#14B8A6", ring: "#14B8A6" },
  medium: { fg: "#F59E0B", ring: "#F59E0B" },
  high: { fg: "#F43F5E", ring: "#F43F5E" },
  extreme: { fg: "#FB7185", ring: "#FB7185" },
};

const RADIUS = 78;
const STROKE = 14;
const CIRC = 2 * Math.PI * RADIUS;

export function RiskExposureRadar({ projects }: { projects: Project[] }) {
  const t = useT();

  const stats = useMemo(() => {
    const live = projects.filter((p) => p.status !== "killed");
    const total = live.reduce((acc, p) => acc + Math.max(0, p.capital_committed), 0);
    const byLevel = ORDER.map((level) => {
      const sum = live
        .filter((p) => p.risk_level === level)
        .reduce((acc, p) => acc + Math.max(0, p.capital_committed), 0);
      return { level, sum, ratio: total > 0 ? sum / total : 0 };
    });
    const dangerShare =
      total > 0
        ? byLevel.filter((b) => b.level === "high" || b.level === "extreme").reduce((acc, b) => acc + b.ratio, 0)
        : 0;
    return { byLevel, total, dangerShare, alert: dangerShare > DANGER_THRESHOLD };
  }, [projects]);

  if (stats.total === 0) {
    return <EmptyCanvas label={t("insights.exposure.empty")} />;
  }

  const dangerPct = Math.round(stats.dangerShare * 100);
  const ringValue = Math.min(1, stats.dangerShare / DANGER_THRESHOLD); // 1 = exactly at threshold
  const dashOffset = CIRC * (1 - Math.min(1, stats.dangerShare));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[200px_1fr]">
      <div className="relative mx-auto flex h-[200px] w-[200px] items-center justify-center">
        <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
          <circle
            cx={100}
            cy={100}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-[#E2E8F0] dark:stroke-[#1E293B]"
          />
          <circle
            cx={100}
            cy={100}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            stroke={stats.alert ? "#E11D48" : "#0D9488"}
            strokeDasharray={`${CIRC} ${CIRC}`}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 100 100)"
            className="dark:hidden"
          />
          <circle
            cx={100}
            cy={100}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            stroke={stats.alert ? "#F43F5E" : "#14B8A6"}
            strokeDasharray={`${CIRC} ${CIRC}`}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 100 100)"
            className="hidden dark:block"
          />
        </svg>
        <div className="relative text-center">
          <p
            className={`ax-kpi text-[28px] font-semibold leading-none tabular ${
              stats.alert
                ? "text-[#E11D48] dark:text-[#F43F5E]"
                : "text-[#0D9488] dark:text-[#14B8A6]"
            }`}
          >
            {dangerPct}%
          </p>
          <p className="mt-1 font-sans text-[10px] font-semibold uppercase tracking-[0.16em] text-[#64748B] dark:text-[#94A3B8]">
            {t("insights.exposure.threshold")}
          </p>
          <p className="font-sans text-[10px] tabular text-[#64748B] dark:text-[#94A3B8]">
            ≤ {Math.round(DANGER_THRESHOLD * 100)}%
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {stats.byLevel.map(({ level, sum, ratio }) => {
          const lightColor = TRACK_COLORS[level];
          const darkColor = TRACK_COLORS_DARK[level];
          return (
            <div key={level}>
              <div className="flex items-center justify-between gap-2 font-sans text-[11.5px] tracking-tight">
                <span className="flex items-center gap-1.5 font-semibold uppercase tracking-[0.14em] text-[#0F172A] dark:text-[#F8FAFC]">
                  <span
                    className="inline-block size-2 rounded-full"
                    style={{ background: lightColor.ring }}
                    aria-hidden
                  />
                  <span className="dark:hidden">{t(`risk.${level}`)}</span>
                  <span
                    className="hidden dark:inline-flex"
                    style={{ filter: `drop-shadow(0 0 0 ${darkColor.ring})` }}
                  >
                    {t(`risk.${level}`)}
                  </span>
                </span>
                <span className="ax-kpi tabular text-[#64748B] dark:text-[#94A3B8]">
                  {formatCNY(sum)} CNY ·{" "}
                  <span className="text-[#0F172A] dark:text-[#F8FAFC]">{Math.round(ratio * 100)}%</span>
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[#E2E8F0] dark:bg-[#1E293B]">
                <div
                  className="h-full rounded-full transition-all dark:hidden"
                  style={{ width: `${Math.max(0.5, ratio * 100)}%`, background: lightColor.fg }}
                  aria-hidden
                />
                <div
                  className="hidden h-full rounded-full dark:block"
                  style={{ width: `${Math.max(0.5, ratio * 100)}%`, background: darkColor.fg }}
                  aria-hidden
                />
              </div>
            </div>
          );
        })}
        {stats.alert ? (
          <div
            className="mt-3 rounded-md border border-[#E11D48]/40 bg-[#E11D48]/8 px-3 py-2 font-sans text-[11px] leading-snug tracking-tight text-[#E11D48] dark:border-[#F43F5E]/45 dark:bg-[#F43F5E]/12 dark:text-[#F43F5E]"
          >
            <p className="font-semibold uppercase tracking-[0.14em]">{t("insights.exposure.alert.title")}</p>
            <p className="mt-1">{t("insights.exposure.alert.detail", { pct: dangerPct })}</p>
          </div>
        ) : null}
        {ringValue > 0.6 && !stats.alert ? (
          <p className="mt-3 font-sans text-[11px] tracking-tight text-[#D97706] dark:text-[#F59E0B]">
            {t("insights.exposure.watch", { pct: dangerPct })}
          </p>
        ) : null}
      </div>
    </div>
  );
}
