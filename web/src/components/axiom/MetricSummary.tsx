import { Briefcase, CheckCircle2, CircleDollarSign, Dumbbell, Languages, Moon } from "lucide-react";
import type { Dashboard, AxiomDay } from "@/types";
import { MetricTile } from "./MetricTile";

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

export function MetricSummary({ dashboard, day }: { dashboard: Dashboard; day: AxiomDay }) {
  const cashflow = num(dashboard.metrics.income30d) - num(dashboard.metrics.expense30d);

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <div className="lg:col-span-2">
        <MetricTile
          featured
          icon={Briefcase}
          label="今日投递"
          value={`${fmt(day.entry.job_applications)} 份`}
          detail={`近 7 天 ${fmt(dashboard.metrics.jobs7d)} 份 · 面试 ${fmt(day.entry.interviews)} 次`}
          tone="slate"
        />
      </div>
      <div className="lg:col-span-2">
        <MetricTile
          featured
          icon={CheckCircle2}
          label="任务完成率"
          value={pct(dashboard.today.rate)}
          detail={`${dashboard.today.done}/${dashboard.today.total} 个今日任务完成`}
          tone="emerald"
        />
      </div>
      <MetricTile icon={Languages} label="英语" value={`${fmt(day.entry.english_minutes)} min`} detail={`7 天 ${fmt(dashboard.metrics.english7d)} min`} tone="blue" />
      <MetricTile icon={Dumbbell} label="运动" value={`${fmt(day.entry.exercise_minutes)} min`} detail={`7 天 ${fmt(dashboard.metrics.exercise7d)} min`} tone="emerald" />
      <MetricTile icon={Moon} label="睡眠" value={`${fmt(day.entry.sleep_hours, 1)} h`} detail={`7 天均值 ${fmt(dashboard.metrics.avgSleep7d, 1)} h`} tone="slate" />
      <MetricTile icon={CircleDollarSign} label="现金流" value={`${fmt(cashflow)} 元`} detail="30 天收入 - 支出" tone={cashflow >= 0 ? "emerald" : "rose"} />
    </section>
  );
}
