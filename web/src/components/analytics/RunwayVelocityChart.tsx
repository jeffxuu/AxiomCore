import { useMemo } from "react";
import { useT } from "@/lib/i18nConfig";
import { formatCNY } from "@/components/axiom/primitives";
import type { Baseline, Transaction } from "@/types";
import { EmptyCanvas } from "./InsightCard";

const VIEW_W = 600;
const VIEW_H = 400;
const PAD_LEFT = 64;
const PAD_RIGHT = 24;
const PAD_TOP = 28;
const PAD_BOTTOM = 52;
const FLOOR_VALUE = -100_000;
const FORECAST_DAYS = 60;
const HISTORY_DAYS = 90;

type Point = { date: string; net: number };

function parseDate(value: string): Date {
  if (!value) return new Date(NaN);
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const isoLike = value.length >= 10 ? value.slice(0, 10) : value;
  return new Date(`${isoLike}T00:00:00`);
}

function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildHistorical(baseline: Baseline | null, txs: Transaction[]): Point[] {
  if (!baseline) return [];
  const start = parseDate(baseline.baseline_date);
  if (Number.isNaN(start.getTime())) return [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dayDiff = Math.floor((today.getTime() - start.getTime()) / 86_400_000);
  const window = Math.min(HISTORY_DAYS, Math.max(dayDiff + 1, 1));
  const firstDay = new Date(today);
  firstDay.setDate(firstDay.getDate() - (window - 1));

  // Net position at midnight of firstDay = baseline + sum(tx) before firstDay.
  const txsByDay = new Map<string, number>();
  let beforeWindowDelta = 0;
  for (const tx of txs) {
    const occurred = parseDate(tx.occurred_at);
    if (Number.isNaN(occurred.getTime())) continue;
    occurred.setHours(0, 0, 0, 0);
    const signed = tx.kind === "income" ? tx.amount : -tx.amount;
    if (occurred < firstDay) {
      beforeWindowDelta += signed;
    } else if (occurred <= today) {
      const key = fmtDate(occurred);
      txsByDay.set(key, (txsByDay.get(key) ?? 0) + signed);
    }
  }

  let net = baseline.starting_position + beforeWindowDelta;
  const points: Point[] = [];
  for (let i = 0; i < window; i += 1) {
    const day = new Date(firstDay);
    day.setDate(firstDay.getDate() + i);
    const key = fmtDate(day);
    net += txsByDay.get(key) ?? 0;
    points.push({ date: key, net });
  }
  return points;
}

function estimateDailyBurn(history: Point[]): number {
  if (history.length < 2) return 0;
  const tail = history.slice(-Math.min(30, history.length));
  const first = tail[0];
  const last = tail[tail.length - 1];
  const days = Math.max(1, tail.length - 1);
  return (last.net - first.net) / days;
}

function buildForecast(history: Point[]): Point[] {
  if (history.length === 0) return [];
  const burn = estimateDailyBurn(history);
  const last = history[history.length - 1];
  const lastDate = parseDate(last.date);
  const forecast: Point[] = [];
  let net = last.net;
  for (let i = 1; i <= FORECAST_DAYS; i += 1) {
    net += burn;
    const day = new Date(lastDate);
    day.setDate(lastDate.getDate() + i);
    forecast.push({ date: fmtDate(day), net });
  }
  return forecast;
}

function daysToFloor(history: Point[]): number | null {
  if (history.length === 0) return null;
  const burn = estimateDailyBurn(history);
  const last = history[history.length - 1].net;
  if (burn >= 0 || last <= FLOOR_VALUE) {
    return last <= FLOOR_VALUE ? 0 : null;
  }
  const distance = last - FLOOR_VALUE;
  return Math.max(0, Math.floor(distance / -burn));
}

type Mapped = { x: number; y: number; net: number; date: string };

function mapPoints(points: Point[], allMin: number, allMax: number, total: number, offset: number): Mapped[] {
  const trackW = VIEW_W - PAD_LEFT - PAD_RIGHT;
  const trackH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  const range = allMax - allMin || 1;
  return points.map((p, idx) => {
    const t = total <= 1 ? 0 : (offset + idx) / (total - 1);
    return {
      x: PAD_LEFT + trackW * t,
      y: PAD_TOP + trackH * (1 - (p.net - allMin) / range),
      net: p.net,
      date: p.date,
    };
  });
}

export function RunwayVelocityChart({
  baseline,
  transactions,
}: {
  baseline: Baseline | null;
  transactions: Transaction[];
}) {
  const t = useT();
  const data = useMemo(() => {
    const history = buildHistorical(baseline, transactions);
    if (!history.length) return null;
    const forecast = buildForecast(history);
    const all = [...history, ...forecast];
    const nets = all.map((p) => p.net);
    const min = Math.min(...nets, FLOOR_VALUE * 1.05);
    const max = Math.max(...nets, 0);
    const total = all.length;
    const histMapped = mapPoints(history, min, max, total, 0);
    const forecastMapped = mapPoints(forecast, min, max, total, history.length);
    const floorY =
      PAD_TOP + (VIEW_H - PAD_TOP - PAD_BOTTOM) * (1 - (FLOOR_VALUE - min) / (max - min || 1));
    const zeroY = PAD_TOP + (VIEW_H - PAD_TOP - PAD_BOTTOM) * (1 - (0 - min) / (max - min || 1));
    const survivalDays = daysToFloor(history);
    const lastHist = history[history.length - 1];
    return { history, forecast, histMapped, forecastMapped, floorY, zeroY, min, max, survivalDays, lastHist };
  }, [baseline, transactions]);

  if (!data) {
    return <EmptyCanvas label={t("insights.runway.empty")} />;
  }

  const histPath = data.histMapped.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  const histAreaPath = [
    histPath,
    `L ${data.histMapped[data.histMapped.length - 1].x.toFixed(2)} ${(VIEW_H - PAD_BOTTOM).toFixed(2)}`,
    `L ${data.histMapped[0].x.toFixed(2)} ${(VIEW_H - PAD_BOTTOM).toFixed(2)} Z`,
  ].join(" ");
  const forecastPath = data.forecastMapped.length
    ? `M ${data.histMapped[data.histMapped.length - 1].x.toFixed(2)} ${data.histMapped[data.histMapped.length - 1].y.toFixed(2)} ` +
      data.forecastMapped.map((p) => `L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ")
    : "";

  const todayPct = ((data.histMapped[data.histMapped.length - 1].x) / VIEW_W) * 100;
  const survivalLabel =
    data.survivalDays === null
      ? t("insights.runway.survival.infinite")
      : data.survivalDays === 0
      ? t("insights.runway.survival.breached")
      : t("insights.runway.survival.days", { n: data.survivalDays });

  return (
    <div className="relative w-full">
      <div className="relative w-full" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          role="img"
          aria-label={t("insights.runway.title")}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="rvc-area-light" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0D9488" stopOpacity={0.32} />
              <stop offset="100%" stopColor="#0D9488" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="rvc-area-dark" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#14B8A6" stopOpacity={0.38} />
              <stop offset="100%" stopColor="#14B8A6" stopOpacity={0.02} />
            </linearGradient>
          </defs>

          {/* Grid */}
          <line
            x1={PAD_LEFT}
            x2={VIEW_W - PAD_RIGHT}
            y1={data.zeroY}
            y2={data.zeroY}
            className="stroke-[#94A3B8] dark:stroke-[#334155]"
            strokeWidth={0.5}
            strokeDasharray="2 4"
          />

          <line
            x1={PAD_LEFT}
            y1={PAD_TOP}
            x2={PAD_LEFT}
            y2={VIEW_H - PAD_BOTTOM}
            className="stroke-[#94A3B8] dark:stroke-[#334155]"
            strokeWidth={1}
          />
          <line
            x1={PAD_LEFT}
            y1={VIEW_H - PAD_BOTTOM}
            x2={VIEW_W - PAD_RIGHT}
            y2={VIEW_H - PAD_BOTTOM}
            className="stroke-[#94A3B8] dark:stroke-[#334155]"
            strokeWidth={1}
          />

          {/* Floor line */}
          <line
            x1={PAD_LEFT}
            y1={data.floorY}
            x2={VIEW_W - PAD_RIGHT}
            y2={data.floorY}
            stroke="#E11D48"
            strokeOpacity={0.7}
            strokeDasharray="6 4"
            strokeWidth={1.25}
            className="dark:hidden"
          />
          <line
            x1={PAD_LEFT}
            y1={data.floorY}
            x2={VIEW_W - PAD_RIGHT}
            y2={data.floorY}
            stroke="#F43F5E"
            strokeOpacity={0.8}
            strokeDasharray="6 4"
            strokeWidth={1.25}
            className="hidden dark:block"
          />

          {/* Filled history area */}
          <path d={histAreaPath} className="fill-[url(#rvc-area-light)] dark:hidden" />
          <path d={histAreaPath} className="hidden dark:block" fill="url(#rvc-area-dark)" />

          {/* Historical line */}
          <path
            d={histPath}
            fill="none"
            stroke="#0D9488"
            strokeWidth={1.8}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="dark:hidden"
          />
          <path
            d={histPath}
            fill="none"
            stroke="#14B8A6"
            strokeWidth={1.8}
            strokeLinejoin="round"
            strokeLinecap="round"
            className="hidden dark:block"
          />

          {/* Forecast — dashed */}
          {forecastPath ? (
            <>
              <path
                d={forecastPath}
                fill="none"
                stroke="#0F172A"
                strokeOpacity={0.5}
                strokeWidth={1.4}
                strokeDasharray="4 4"
                className="dark:hidden"
              />
              <path
                d={forecastPath}
                fill="none"
                stroke="#F8FAFC"
                strokeOpacity={0.45}
                strokeWidth={1.4}
                strokeDasharray="4 4"
                className="hidden dark:block"
              />
            </>
          ) : null}

          {/* Last actual dot */}
          <circle
            cx={data.histMapped[data.histMapped.length - 1].x}
            cy={data.histMapped[data.histMapped.length - 1].y}
            r={3.5}
            fill="#0D9488"
            className="dark:hidden"
          />
          <circle
            cx={data.histMapped[data.histMapped.length - 1].x}
            cy={data.histMapped[data.histMapped.length - 1].y}
            r={3.5}
            fill="#14B8A6"
            className="hidden dark:block"
          />
        </svg>

        {/* HTML overlay */}
        <div className="pointer-events-none absolute inset-0 font-sans text-[11px] tracking-tight">
          {[data.max, (data.max + data.min) / 2, data.min].map((value, idx) => {
            const yPct = (((PAD_TOP + (VIEW_H - PAD_TOP - PAD_BOTTOM) * idx * 0.5) / VIEW_H) * 100);
            return (
              <span
                key={idx}
                className="absolute -translate-y-1/2 pr-2 text-right tabular text-[#64748B] dark:text-[#94A3B8]"
                style={{ left: 0, top: `${yPct}%`, width: `${(PAD_LEFT - 4) / VIEW_W * 100}%` }}
              >
                {formatCNY(Math.round(value), { compact: true })}
              </span>
            );
          })}

          <span
            className="absolute rounded-md bg-[#E11D48]/8 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#E11D48] dark:bg-[#F43F5E]/15 dark:text-[#F43F5E]"
            style={{ right: `${(PAD_RIGHT / VIEW_W) * 100 + 1}%`, top: `${(data.floorY / VIEW_H) * 100}%`, transform: "translateY(-130%)" }}
          >
            {t("insights.runway.floor")} {formatCNY(FLOOR_VALUE, { compact: true })}
          </span>

          <span
            className="absolute -translate-x-1/2 rounded-sm bg-[#0F172A]/8 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#334155] dark:bg-[#F8FAFC]/12 dark:text-[#CBD5E1]"
            style={{ left: `${todayPct}%`, top: `${((VIEW_H - PAD_BOTTOM + 6) / VIEW_H) * 100}%` }}
          >
            {t("insights.runway.today")}
          </span>

          <span
            className="absolute -translate-x-1/2 text-[11px] font-medium text-[#0F172A] dark:text-[#F8FAFC]"
            style={{ left: "50%", bottom: 0 }}
          >
            {t("insights.runway.axisX")}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KPIBox
          label={t("insights.runway.kpi.net")}
          value={data.lastHist ? formatCNY(Math.round(data.lastHist.net), { signed: true }) : "—"}
          tone={data.lastHist && data.lastHist.net < 0 ? "danger" : "positive"}
        />
        <KPIBox
          label={t("insights.runway.kpi.velocity")}
          value={`${formatCNY(Math.round(estimateDailyBurn(data.history) * 30), { signed: true })} / mo`}
          tone={estimateDailyBurn(data.history) < 0 ? "danger" : "positive"}
        />
        <KPIBox
          label={t("insights.runway.kpi.survival")}
          value={survivalLabel}
          tone={data.survivalDays === 0 || (data.survivalDays !== null && data.survivalDays < 60) ? "danger" : "neutral"}
        />
      </div>
    </div>
  );
}

function KPIBox({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "positive" | "danger" | "neutral";
}) {
  const toneClass =
    tone === "danger"
      ? "text-[#E11D48] dark:text-[#F43F5E]"
      : tone === "positive"
      ? "text-[#0D9488] dark:text-[#14B8A6]"
      : "text-[#0F172A] dark:text-[#F8FAFC]";
  return (
    <div className="rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 dark:border-[#1E293B] dark:bg-[#0B1220]">
      <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748B] dark:text-[#94A3B8]">
        {label}
      </p>
      <p className={`ax-kpi mt-1 font-sans text-[15px] font-semibold tracking-tight ${toneClass}`}>{value}</p>
    </div>
  );
}
