import { useMemo } from "react";
import type { TimelinePoint } from "@/types";

const VIEW_W = 720;
const VIEW_H = 220;
const PLOT_X0 = 48;
const PLOT_X1 = 700;
const ZERO_Y = 120;
const BAR_TOP = 24;
const BAR_BOT = 200;

function fmtCNY(value: number, opts?: { signed?: boolean }): string {
  const sign = opts?.signed && value > 0 ? "+" : "";
  return `${sign}${Math.round(value).toLocaleString("en-US")}`;
}

function fmtDateShort(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso.length >= 10 ? `${iso.slice(0, 10)}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}/${day}`;
}

export function CashflowPulse({ timeline }: { timeline: TimelinePoint[] }) {
  const data = useMemo(() => {
    const window = timeline.slice(-30);
    const totalIn = window.reduce((acc, p) => acc + (p.in || 0), 0);
    const totalOut = window.reduce((acc, p) => acc + (p.out || 0), 0);
    const netFlow = totalIn - totalOut;

    let biggest = { date: "", flow: 0 };
    let activeDays = 0;
    for (const p of window) {
      const dayFlow = (p.in || 0) - (p.out || 0);
      if (Math.abs(dayFlow) > Math.abs(biggest.flow)) {
        biggest = { date: p.date, flow: dayFlow };
      }
      if ((p.in || 0) > 0 || (p.out || 0) > 0) activeDays += 1;
    }
    const maxBar = window.reduce((acc, p) => Math.max(acc, p.in || 0, p.out || 0), 0);
    return { window, totalIn, totalOut, netFlow, biggest, activeDays, maxBar };
  }, [timeline]);

  const slot = (PLOT_X1 - PLOT_X0) / Math.max(data.window.length, 1);
  const barW = Math.max(8, slot - 4);
  const upH = (v: number) => (data.maxBar === 0 ? 0 : ((ZERO_Y - BAR_TOP) * v) / data.maxBar);
  const downH = (v: number) => (data.maxBar === 0 ? 0 : ((BAR_BOT - ZERO_Y) * v) / data.maxBar);

  return (
    <div className="ax-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="ax-h-title">现金脉搏 · Cashflow Pulse</div>
          <div className="ax-h-sub">
            过去 30 天每日收入 / 支出 ·{" "}
            {data.activeDays > 0
              ? `${data.activeDays} 个活跃日 · 净流 ¥${fmtCNY(data.netFlow, { signed: true })}`
              : "等待首笔流水"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="ax-chip" style={{ color: "var(--ax-positive)" }}>
            <span className="ax-chip-dot" style={{ background: "var(--ax-positive)" }} />
            in
          </span>
          <span className="ax-chip" style={{ color: "var(--ax-danger)" }}>
            <span className="ax-chip-dot" style={{ background: "var(--ax-danger)" }} />
            out
          </span>
        </div>
      </div>

      {data.maxBar === 0 ? (
        <div
          className="mt-6 rounded-md border border-dashed p-10 text-center text-[12px]"
          style={{ borderColor: "var(--ax-border-strong)", color: "var(--ax-muted)" }}
        >
          过去 30 天暂无现金流活动 —— 在统一指挥部录入一笔收入或支出，脉搏即刻跳动。
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-4 gap-3 border-b border-[var(--ax-border)] pb-3">
            <div>
              <div className="ax-section-title">30d 收入</div>
              <div className="ax-kpi mt-0.5 text-[18px] font-semibold" style={{ color: "var(--ax-positive)" }}>
                +¥{fmtCNY(data.totalIn)}
              </div>
            </div>
            <div>
              <div className="ax-section-title">30d 支出</div>
              <div className="ax-kpi mt-0.5 text-[18px] font-semibold" style={{ color: "var(--ax-danger)" }}>
                −¥{fmtCNY(data.totalOut)}
              </div>
            </div>
            <div>
              <div className="ax-section-title">净流</div>
              <div
                className="ax-kpi mt-0.5 text-[18px] font-semibold"
                style={{ color: data.netFlow >= 0 ? "var(--ax-positive)" : "var(--ax-danger)" }}
              >
                ¥{fmtCNY(data.netFlow, { signed: true })}
              </div>
            </div>
            <div>
              <div className="ax-section-title">最大单日</div>
              <div
                className="ax-kpi mt-0.5 text-[14px]"
                style={{ color: "var(--ax-text-soft)" }}
              >
                {data.biggest.date ? `${fmtDateShort(data.biggest.date)} · ¥${fmtCNY(data.biggest.flow, { signed: true })}` : "—"}
              </div>
            </div>
          </div>

          <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="mt-3 w-full" style={{ height: 200 }}>
            {/* Horizontal grid */}
            <line x1={PLOT_X0} y1={BAR_TOP} x2={PLOT_X1} y2={BAR_TOP} className="ax-grid-line-soft" />
            <line x1={PLOT_X0} y1={(BAR_TOP + ZERO_Y) / 2} x2={PLOT_X1} y2={(BAR_TOP + ZERO_Y) / 2} className="ax-grid-line-soft" />
            <line x1={PLOT_X0} y1={ZERO_Y} x2={PLOT_X1} y2={ZERO_Y} className="ax-grid-line" />
            <line x1={PLOT_X0} y1={(ZERO_Y + BAR_BOT) / 2} x2={PLOT_X1} y2={(ZERO_Y + BAR_BOT) / 2} className="ax-grid-line-soft" />
            <line x1={PLOT_X0} y1={BAR_BOT} x2={PLOT_X1} y2={BAR_BOT} className="ax-grid-line-soft" />

            {/* Y-axis labels */}
            <text x={42} y={BAR_TOP + 4} className="ax-axis-text" textAnchor="end">
              +{Math.round(data.maxBar / 1000)}k
            </text>
            <text x={42} y={ZERO_Y + 4} className="ax-axis-text" textAnchor="end">0</text>
            <text x={42} y={BAR_BOT + 4} className="ax-axis-text" textAnchor="end" fill="var(--ax-danger)">
              −{Math.round(data.maxBar / 1000)}k
            </text>

            {/* Bars */}
            {data.window.map((p, i) => {
              const xCenter = PLOT_X0 + slot * (i + 0.5);
              const x = xCenter - barW / 2;
              const inH = upH(p.in || 0);
              const outH = downH(p.out || 0);
              return (
                <g key={p.date || i}>
                  {inH > 0 ? (
                    <rect
                      x={x}
                      y={ZERO_Y - inH}
                      width={barW}
                      height={inH}
                      rx={1.5}
                      fill="var(--ax-positive)"
                      opacity={0.92}
                    />
                  ) : null}
                  {outH > 0 ? (
                    <rect
                      x={x}
                      y={ZERO_Y}
                      width={barW}
                      height={outH}
                      rx={1.5}
                      fill="var(--ax-danger)"
                      opacity={0.92}
                    />
                  ) : null}
                </g>
              );
            })}

            {/* X-axis weekly markers (every ~7 days) */}
            {data.window.map((p, i) => {
              if (i % 7 !== 0 && i !== data.window.length - 1) return null;
              const x = PLOT_X0 + slot * (i + 0.5);
              return (
                <text key={`x-${i}`} x={x} y={BAR_BOT + 14} className="ax-axis-text" textAnchor="middle">
                  {fmtDateShort(p.date)}
                </text>
              );
            })}
          </svg>
        </>
      )}
    </div>
  );
}
