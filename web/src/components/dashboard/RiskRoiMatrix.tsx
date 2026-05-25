import { useMemo, useState } from "react";
import { ChartMethodLink } from "@/components/dashboard/ChartMethodLink";
import { useT } from "@/lib/i18nConfig";
import type { Project, RiskLevel } from "@/types";

const VIEW_W = 720;
const VIEW_H = 420;
const PLOT_X0 = 60;
const PLOT_X1 = 700;
const PLOT_Y0 = 30;
const PLOT_Y1 = 360;
const X_MID = 380;
const Y_MID = 195;
const ROI_CAP = 10;

const RISK_ORDER: RiskLevel[] = ["low", "medium", "high", "extreme"];

function xForRisk(level: RiskLevel): number {
  const idx = RISK_ORDER.indexOf(level);
  const slot = (PLOT_X1 - PLOT_X0) / RISK_ORDER.length;
  return PLOT_X0 + slot * idx + slot / 2;
}

function yForRoi(roi: number): number {
  const bounded = Math.max(0, Math.min(ROI_CAP, roi));
  return PLOT_Y0 + (PLOT_Y1 - PLOT_Y0) * (1 - bounded / ROI_CAP);
}

function radiusFor(capital: number): number {
  const base = Math.sqrt(Math.max(0, capital)) * 0.22;
  return Math.max(20, Math.min(62, base));
}

function jitter(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return ((h & 0xff) / 255 - 0.5) * 30;
}

function quadrant(level: RiskLevel, roi: number): "ideal" | "hero" | "chore" | "trap" {
  const lowRisk = level === "low" || level === "medium";
  const highRoi = roi >= 5;
  if (lowRisk && highRoi) return "ideal";
  if (!lowRisk && highRoi) return "hero";
  if (lowRisk && !highRoi) return "chore";
  return "trap";
}

const QUAD_COLOR: Record<"ideal" | "hero" | "chore" | "trap", string> = {
  ideal: "var(--ax-positive)",
  hero: "var(--ax-warning)",
  chore: "var(--ax-muted)",
  trap: "var(--ax-danger)",
};

const QUAD_HEX_LIGHT: Record<"ideal" | "hero" | "chore" | "trap", string> = {
  ideal: "#4D7C5A",
  hero: "#B8853D",
  chore: "#78716C",
  trap: "#9C3F3F",
};

function fmtCNY(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function truncateLabel(value: string, max = 14): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

export function RiskRoiMatrix({ projects, onOpenMethod }: { projects: Project[]; onOpenMethod?: () => void }) {
  const t = useT();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const bubbles = useMemo(() => {
    return projects.map((p) => {
      const q = quadrant(p.risk_level, p.roi_projection);
      return {
        project: p,
        cx: xForRisk(p.risk_level) + jitter(p.id),
        cy: yForRoi(p.roi_projection),
        r: radiusFor(p.capital_committed || 1),
        quad: q,
        color: QUAD_HEX_LIGHT[q],
      };
    });
  }, [projects]);

  // Find the largest (HERO) bubble for tooltip card.
  const featured = useMemo(() => {
    if (!bubbles.length) return null;
    const hero = [...bubbles].sort((a, b) => b.r - a.r)[0];
    return hero;
  }, [bubbles]);
  const selected = bubbles.find((bubble) => bubble.project.id === selectedId) ?? featured;

  return (
    <div className="ax-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="ax-h-title">{t("dashboard.matrix.title")}</div>
          <div className="ax-h-sub">
            {t("dashboard.matrix.subtitle", { count: projects.length })}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3 text-[11px]" style={{ color: "var(--ax-muted)" }}>
          <ChartMethodLink onOpen={onOpenMethod} />
          <span className="flex items-center gap-1.5">
            <span className="ax-chip-dot" style={{ background: "var(--ax-positive)" }} />
            {t("dashboard.matrix.q.ideal")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="ax-chip-dot" style={{ background: "var(--ax-warning)" }} />
            {t("dashboard.matrix.q.hero")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="ax-chip-dot" style={{ background: "var(--ax-muted)" }} />
            {t("dashboard.matrix.q.chore")}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="ax-chip-dot" style={{ background: "var(--ax-danger)" }} />
            {t("dashboard.matrix.q.trap")}
          </span>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed p-10 text-center text-[12px]" style={{ borderColor: "var(--ax-border-strong)", color: "var(--ax-muted)" }}>
          {t("dashboard.matrix.empty")}
        </div>
      ) : (
        <div className="ax-chart-scroll">
        <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} className="ax-chart-canvas mt-3 w-full" style={{ height: 380 }}>
          <defs>
            {(["ideal", "hero", "chore", "trap"] as const).map((q) => (
              <radialGradient key={q} id={`rrm-${q}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={QUAD_HEX_LIGHT[q]} stopOpacity={0.95} />
                <stop offset="80%" stopColor={QUAD_HEX_LIGHT[q]} stopOpacity={0.18} />
                <stop offset="100%" stopColor={QUAD_HEX_LIGHT[q]} stopOpacity={0} />
              </radialGradient>
            ))}
          </defs>

          {/* Axes */}
          <line x1={PLOT_X0} y1={PLOT_Y1} x2={PLOT_X1} y2={PLOT_Y1} stroke="var(--ax-border-strong)" strokeWidth={1} />
          <line x1={PLOT_X0} y1={PLOT_Y0} x2={PLOT_X0} y2={PLOT_Y1} stroke="var(--ax-border-strong)" strokeWidth={1} />

          {/* Quadrant dividers */}
          <line x1={X_MID} y1={PLOT_Y0} x2={X_MID} y2={PLOT_Y1} className="ax-grid-line-soft" />
          <line x1={PLOT_X0} y1={Y_MID} x2={PLOT_X1} y2={Y_MID} className="ax-grid-line-soft" />

          {/* Quadrant titles */}
          <text x={80} y={56} className="ax-quad-label" fontWeight={600}>{t("dashboard.matrix.q.ideal")}</text>
          <text x={80} y={70} className="ax-quad-label">{t("dashboard.matrix.desc.ideal")}</text>
          <text x={680} y={56} className="ax-quad-label" fontWeight={600} textAnchor="end">{t("dashboard.matrix.q.hero")}</text>
          <text x={680} y={70} className="ax-quad-label" textAnchor="end">{t("dashboard.matrix.desc.hero")}</text>
          <text x={80} y={332} className="ax-quad-label">{t("dashboard.matrix.desc.chore")}</text>
          <text x={80} y={346} className="ax-quad-label" fontWeight={600}>{t("dashboard.matrix.q.chore")}</text>
          <text x={680} y={332} className="ax-quad-label" textAnchor="end">{t("dashboard.matrix.desc.trap")}</text>
          <text x={680} y={346} className="ax-quad-label" fontWeight={600} textAnchor="end">{t("dashboard.matrix.q.trap")}</text>

          {/* Axis labels */}
          <text x={PLOT_X0} y={378} className="ax-axis-text">{t("dashboard.matrix.axis.low")}</text>
          <text x={X_MID} y={378} className="ax-axis-text" textAnchor="middle">{t("dashboard.matrix.axis.risk")}</text>
          <text x={PLOT_X1} y={378} className="ax-axis-text" textAnchor="end">{t("dashboard.matrix.axis.high")}</text>

          <g transform={`translate(20, ${Y_MID}) rotate(-90)`}>
            <text x={0} y={0} className="ax-axis-text" textAnchor="middle">{t("dashboard.matrix.axis.roi")}</text>
          </g>
          <text x={48} y={PLOT_Y1} className="ax-axis-text" textAnchor="end">{t("dashboard.matrix.axis.low")}</text>
          <text x={48} y={36} className="ax-axis-text" textAnchor="end">{t("dashboard.matrix.axis.high")}</text>

          {/* Bubbles */}
          {bubbles.map(({ project, cx, cy, r, quad: q, color }) => (
            <g
              key={project.id}
              role="button"
              tabIndex={0}
              aria-label={t("dashboard.matrix.point.aria", { project: project.name })}
              onClick={() => setSelectedId(project.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedId(project.id);
                }
              }}
              className="cursor-pointer outline-none"
            >
              <title>{project.name}</title>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={`url(#rrm-${q})`}
                stroke={color}
                strokeWidth={selected?.project.id === project.id ? 2.5 : q === "hero" ? 1.5 : 1}
              />
              {q === "hero" ? <circle cx={cx} cy={cy} r={4} fill={color} /> : null}
              <text x={cx} y={cy - 6} className="ax-bubble-label" textAnchor="middle">{truncateLabel(project.name)}</text>
              <text x={cx} y={cy + 8} className="ax-bubble-sub" textAnchor="middle">
                ROI {project.roi_projection.toFixed(1)}× · ¥{fmtCNY(project.capital_committed / 1000)}k
              </text>
            </g>
          ))}

          {/* Detail card for the selected project; largest commitment is selected initially. */}
          {selected ? (
            (() => {
              const tw = 132;
              const th = 60;
              const tx = Math.min(PLOT_X1 - tw - 4, Math.max(PLOT_X0 + 4, selected.cx + 30));
              const ty = Math.max(PLOT_Y0 + 4, selected.cy - 60);
              return (
                <g transform={`translate(${tx}, ${ty})`}>
                  <rect width={tw} height={th} rx={6} fill="var(--ax-card)" stroke="var(--ax-border-strong)" strokeWidth={1} />
                  <line x1={0} y1={Math.min(36, th)} x2={Math.min(-30, selected.cx - tx - tw / 2)} y2={Math.min(36, th)} stroke="var(--ax-border-strong)" strokeWidth={1} strokeDasharray="2 2" />
                  <text x={9} y={14} className="ax-axis-text" fill="var(--ax-muted)">{t("dashboard.matrix.tooltip.project")}</text>
                  <text x={9} y={29} className="ax-axis-text" fill="var(--ax-text)" fontWeight={600} fontSize={11}>
                    {truncateLabel(selected.project.name, 18)}
                  </text>
                  <text x={9} y={44} className="ax-axis-text" fill="var(--ax-text-soft)">
                    {t("dashboard.matrix.tooltip.capital", { amount: fmtCNY(selected.project.capital_committed) })}
                  </text>
                  <text x={9} y={55} className="ax-axis-text" fill={selected.color} fontWeight={600}>
                    {t("dashboard.matrix.tooltip.expected", { value: selected.project.roi_projection.toFixed(1) })}
                  </text>
                </g>
              );
            })()
          ) : null}

          {/* Legend bottom */}
          <g transform="translate(60, 400)">
            {bubbles.slice(0, 3).map((b, i) => (
              <g key={b.project.id} transform={`translate(${i * 230}, 0)`}>
                <circle cx={0} cy={0} r={3} fill={b.color} />
                <text x={8} y={3} className="ax-axis-text" fill="var(--ax-text-soft)">
                  {truncateLabel(b.project.name, 18)} · ¥{fmtCNY(b.project.capital_committed / 1000)}k
                </text>
              </g>
            ))}
          </g>
        </svg>
        </div>
      )}
    </div>
  );
}
