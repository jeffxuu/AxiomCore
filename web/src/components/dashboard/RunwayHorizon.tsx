import { useMemo } from "react";
import { useT } from "@/lib/i18nConfig";
import type { Baseline, CapitalSnapshot, Transaction } from "@/types";

const FLOOR_VALUE = -100_000;
const VIEW_W = 720;
const VIEW_H = 240;
const PLOT_X0 = 40;
const PLOT_X1 = 710;
const PLOT_Y0 = 20;
const PLOT_Y1 = 200; // 0-line
const FLOOR_Y = 216;
const HISTORY_DAYS = 90;

type Point = { date: string; net: number };

function parseDate(value: string): Date {
  if (!value) return new Date(NaN);
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct;
  const isoLike = value.length >= 10 ? value.slice(0, 10) : value;
  return new Date(`${isoLike}T00:00:00`);
}

function fmtDateShort(d: Date): string {
  const y = String(d.getFullYear()).slice(2);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `'${y}-${m}`;
}

function fmtCNY(value: number, signed?: boolean): string {
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
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

  const byDay = new Map<string, number>();
  let beforeWindow = 0;
  for (const tx of txs) {
    const occurred = parseDate(tx.occurred_at);
    if (Number.isNaN(occurred.getTime())) continue;
    occurred.setHours(0, 0, 0, 0);
    const signed = tx.kind === "income" ? tx.amount : -tx.amount;
    if (occurred < firstDay) beforeWindow += signed;
    else if (occurred <= today) {
      const k = occurred.toISOString().slice(0, 10);
      byDay.set(k, (byDay.get(k) ?? 0) + signed);
    }
  }

  let net = baseline.starting_position + beforeWindow;
  const points: Point[] = [];
  for (let i = 0; i < window; i += 1) {
    const day = new Date(firstDay);
    day.setDate(firstDay.getDate() + i);
    const k = day.toISOString().slice(0, 10);
    net += byDay.get(k) ?? 0;
    points.push({ date: k, net });
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

export function RunwayHorizon({
  baseline,
  transactions,
  capital,
}: {
  baseline: Baseline | null;
  transactions: Transaction[];
  capital: CapitalSnapshot | null;
}) {
  const t = useT();
  const data = useMemo(() => {
    const history = buildHistorical(baseline, transactions);
    if (!history.length) return null;
    const burn = estimateDailyBurn(history);
    const last = history[history.length - 1];
    const lastDate = parseDate(last.date);
    const survivalDays = (() => {
      if (burn >= 0) return null;
      if (last.net <= FLOOR_VALUE) return 0;
      return Math.max(0, Math.floor((last.net - FLOOR_VALUE) / -burn));
    })();
    const projectionDays = survivalDays === null ? 365 * 2 : Math.min(survivalDays, 365 * 3);
    const projection: Point[] = [];
    let p = last.net;
    for (let i = 1; i <= projectionDays; i += 30) {
      p += burn * 30;
      const d = new Date(lastDate);
      d.setDate(lastDate.getDate() + i);
      projection.push({ date: d.toISOString().slice(0, 10), net: p });
      if (burn < 0 && p <= FLOOR_VALUE) break;
    }
    const all = [...history, ...projection];
    const nets = all.map((q) => q.net);
    const maxNet = Math.max(...nets, 0);
    const minNet = Math.min(...nets, FLOOR_VALUE);
    const niceMax = Math.max(maxNet, 200_000); // ensure +200k visible
    const niceMin = Math.min(minNet, FLOOR_VALUE);
    const range = niceMax - niceMin || 1;

    const xOf = (idx: number, total: number) => PLOT_X0 + ((PLOT_X1 - PLOT_X0) * idx) / Math.max(total - 1, 1);
    const yOf = (v: number) => PLOT_Y0 + (PLOT_Y1 - PLOT_Y0 - 0) * (1 - (v - niceMin) / range);
    const total = all.length;
    const histMapped = history.map((p, i) => ({ ...p, x: xOf(i, total), y: yOf(p.net) }));
    const fcMapped = projection.map((p, i) => ({ ...p, x: xOf(history.length + i, total), y: yOf(p.net) }));
    const nowX = histMapped[histMapped.length - 1].x;
    const nowY = histMapped[histMapped.length - 1].y;
    const floorIntersectX = fcMapped.length ? fcMapped[fcMapped.length - 1].x : PLOT_X1;
    const floorIntersectDate = fcMapped.length
      ? parseDate(fcMapped[fcMapped.length - 1].date)
      : null;
    return {
      history,
      projection,
      histMapped,
      fcMapped,
      nowX,
      nowY,
      survivalDays,
      lastNet: last.net,
      niceMax,
      niceMin,
      floorIntersectX,
      floorIntersectDate,
      monthlyBurn: burn * 30,
    };
  }, [baseline, transactions]);

  if (!data) {
    return (
      <div className="ax-card p-5">
        <div className="ax-h-title">{t("dashboard.runwayChart.title")}</div>
        <div className="mt-6 rounded-md border border-dashed p-10 text-center text-[12px]" style={{ borderColor: "var(--ax-border-strong)", color: "var(--ax-muted)" }}>
          {t("dashboard.runwayChart.empty")}
        </div>
      </div>
    );
  }

  const histPath = data.histMapped.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const histArea = `${histPath} L ${data.histMapped[data.histMapped.length - 1].x.toFixed(1)} ${PLOT_Y1} L ${data.histMapped[0].x.toFixed(1)} ${PLOT_Y1} Z`;
  const fcPath = data.fcMapped.length
    ? `M ${data.nowX.toFixed(1)} ${data.nowY.toFixed(1)} ${data.fcMapped.map((p) => `L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")}`
    : "";
  const fcAreaEnd = data.fcMapped.length ? data.fcMapped[data.fcMapped.length - 1].x : data.nowX;
  const fcArea = data.fcMapped.length
    ? `${fcPath} L ${fcAreaEnd.toFixed(1)} ${PLOT_Y1} L ${data.nowX.toFixed(1)} ${PLOT_Y1} Z`
    : "";

  const tone: "positive" | "warning" | "danger" =
    data.survivalDays === null
      ? "positive"
      : data.survivalDays < 90
      ? "danger"
      : data.survivalDays < 180
      ? "warning"
      : "positive";
  const toneVar =
    tone === "positive" ? "var(--ax-positive)" : tone === "warning" ? "var(--ax-warning)" : "var(--ax-danger)";

  const exhaustDateLabel = (() => {
    if (data.survivalDays === null) return t("dashboard.runwayChart.exhaustPositive");
    if (!data.floorIntersectDate) return "—";
    return t("dashboard.runwayChart.exhaustDate", {
      date: data.floorIntersectDate.toISOString().slice(0, 10),
      days: data.survivalDays,
    });
  })();

  // Y-axis labels at 5 levels.
  const range = data.niceMax - data.niceMin || 1;
  const yLevels = [data.niceMax, data.niceMax * 0.75, data.niceMax * 0.5, data.niceMax * 0.25, 0];
  // X-axis labels: 6 evenly spaced from start to end.
  const xLabels = (() => {
    const histStart = parseDate(data.history[0].date);
    const histEnd = parseDate(data.history[data.history.length - 1].date);
    const fcEnd = data.floorIntersectDate ?? histEnd;
    const labels: { x: number; text: string }[] = [];
    for (let i = 0; i < 6; i += 1) {
      const t = i / 5;
      const x = PLOT_X0 + (PLOT_X1 - PLOT_X0) * t;
      // Linear interpolate dates across the total range.
      const totalMs = (fcEnd.getTime() - histStart.getTime());
      const d = new Date(histStart.getTime() + totalMs * t);
      labels.push({ x, text: fmtDateShort(d) });
    }
    return labels;
  })();

  return (
    <div className="ax-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="ax-h-title">{t("dashboard.runwayChart.title")}</div>
          <div className="ax-h-sub">
            {data.survivalDays === null
              ? t("dashboard.runwayChart.subtitle.positive", { floor: fmtCNY(FLOOR_VALUE) })
              : t("dashboard.runwayChart.subtitle.days", { floor: fmtCNY(FLOOR_VALUE), days: data.survivalDays })}
          </div>
        </div>
        <span className="ax-chip" style={{ color: toneVar }}>
          <span className="ax-chip-dot" style={{ background: toneVar }} />
          {t("dashboard.runwayChart.active")}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-6 border-b border-[var(--ax-border)] pb-3">
        <div>
          <div className="ax-section-title">{t("dashboard.runwayChart.cash")}</div>
          <div className="ax-kpi mt-0.5 text-[28px] font-semibold" style={{ color: "var(--ax-text)" }}>
            ¥{fmtCNY(data.lastNet, true)}
          </div>
        </div>
        <div>
          <div className="ax-section-title">{t("dashboard.runwayChart.toFloor")}</div>
          <div className="ax-kpi mt-0.5 text-[28px] font-semibold" style={{ color: toneVar }}>
            {data.survivalDays === null ? "∞" : data.survivalDays}
            <span className="ml-1 text-[14px]" style={{ color: "var(--ax-muted)" }}> {t("dashboard.kpi.days")}</span>
          </div>
        </div>
        <div>
          <div className="ax-section-title">{t("dashboard.runwayChart.monthlyBurn")}</div>
          <div className="ax-kpi mt-0.5 text-[20px] font-semibold" style={{ color: "var(--ax-text-soft)" }}>
            ¥{fmtCNY(Math.abs(Math.round(data.monthlyBurn)))}
          </div>
        </div>
        <div>
          <div className="ax-section-title">{t("dashboard.runwayChart.floor")}</div>
          <div className="ax-kpi mt-0.5 text-[20px] font-semibold" style={{ color: "var(--ax-danger)" }}>
            ¥{fmtCNY(FLOOR_VALUE)}
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="ax-section-title">{t("dashboard.runwayChart.estimate")}</div>
          <div className="ax-kpi mt-0.5 text-[14px]" style={{ color: "var(--ax-text-soft)" }}>
            {t("dashboard.runwayChart.moving")}
          </div>
        </div>
      </div>

      <div className="ax-chart-scroll">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="ax-chart-canvas mt-3 w-full" style={{ height: 220 }}>
        <defs>
          <linearGradient id="runwayPast" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--ax-positive)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--ax-positive)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="runwayFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--ax-warning)" stopOpacity={0.22} />
            <stop offset="100%" stopColor="var(--ax-warning)" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* horizontal grid */}
        {[20, 60, 100, 140].map((y) => (
          <line key={y} x1={PLOT_X0} y1={y} x2={PLOT_X1} y2={y} className="ax-grid-line-soft" />
        ))}
        <line x1={PLOT_X0} y1={PLOT_Y1} x2={PLOT_X1} y2={PLOT_Y1} className="ax-grid-line" />

        {/* Y-axis labels */}
        {yLevels.map((v, i) => {
          const y = PLOT_Y0 + (PLOT_Y1 - PLOT_Y0) * (1 - (v - data.niceMin) / range);
          return (
            <text key={i} x={34} y={y + 4} className="ax-axis-text" textAnchor="end">
              {v >= 1000 ? `+${Math.round(v / 1000)}k` : Math.round(v)}
            </text>
          );
        })}
        <text x={34} y={FLOOR_Y + 4} className="ax-axis-text" textAnchor="end" fill="var(--ax-danger)">
          -100k
        </text>

        {/* Red floor line */}
        <line x1={PLOT_X0} y1={FLOOR_Y} x2={PLOT_X1} y2={FLOOR_Y} stroke="var(--ax-danger)" strokeWidth={1} strokeDasharray="3 4" />
        <text x={PLOT_X1 - 4} y={FLOOR_Y - 4} className="ax-axis-text" fill="var(--ax-danger)" textAnchor="end">
          {t("dashboard.runwayChart.floorLabel", { amount: fmtCNY(FLOOR_VALUE) })}
        </text>

        {/* Past area + line */}
        <path d={histArea} fill="url(#runwayPast)" />
        <path d={histPath} fill="none" stroke="var(--ax-positive)" strokeWidth={1.8} />

        {/* Forecast area + dashed line */}
        {fcArea ? <path d={fcArea} fill="url(#runwayFill)" /> : null}
        {fcPath ? <path d={fcPath} fill="none" stroke="var(--ax-warning)" strokeWidth={1.8} strokeDasharray="4 3" /> : null}

        {/* NOW vertical line + marker + tooltip card */}
        <line x1={data.nowX} y1={PLOT_Y0} x2={data.nowX} y2={PLOT_Y1} stroke="var(--ax-border-strong)" strokeWidth={1} strokeDasharray="2 3" />
        <circle cx={data.nowX} cy={data.nowY} r={5} fill="var(--ax-card)" stroke="var(--ax-text)" strokeWidth={2} />
        {(() => {
          const cx = data.nowX;
          const tooltipW = 148;
          const x = Math.max(PLOT_X0 + 6, Math.min(PLOT_X1 - tooltipW - 6, cx - tooltipW / 2));
          return (
            <g transform={`translate(${x}, ${Math.max(PLOT_Y0 + 4, data.nowY - 50)})`}>
              <rect width={tooltipW} height={34} rx={6} fill="var(--ax-card)" stroke="var(--ax-border-strong)" />
              <text x={10} y={14} className="ax-axis-text" fill="var(--ax-muted)">
                {t("dashboard.runwayChart.now", { date: new Date().toISOString().slice(0, 10) })}
              </text>
              <text x={10} y={28} className="ax-axis-text" fill="var(--ax-text)" fontWeight={600}>
                ¥{fmtCNY(data.lastNet, true)}
              </text>
            </g>
          );
        })()}

        {/* Red line intersection */}
        {data.survivalDays !== null && data.floorIntersectDate ? (
          <>
            <circle cx={data.floorIntersectX} cy={FLOOR_Y} r={4} fill="var(--ax-danger)" />
            <text x={data.floorIntersectX - 4} y={FLOOR_Y + 16} className="ax-axis-text" fill="var(--ax-danger)" textAnchor="end">
              {exhaustDateLabel}
            </text>
          </>
        ) : null}

        {/* X-axis labels */}
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={234} className="ax-axis-text" textAnchor={i === 0 ? "start" : i === xLabels.length - 1 ? "end" : "middle"}>
            {l.text}
          </text>
        ))}
      </svg>
      </div>
    </div>
  );
}
