import { useMemo, useRef, useState, type MouseEvent } from "react";
import { useT } from "@/lib/i18nConfig";
import { formatCNY } from "@/components/axiom/primitives";
import type { Project, RiskLevel } from "@/types";
import { cn } from "@/lib/utils";

const VIEW_W = 600;
const VIEW_H = 400;
const X_TRACK: Record<RiskLevel, number> = {
  low: 75,
  medium: 225,
  high: 375,
  extreme: 525,
};
const Y_TOP = 40;
const Y_BOTTOM = 360;
const ROI_CAP = 10;

function colorForRisk(level: RiskLevel): string {
  if (level === "low") return "var(--positive)";
  if (level === "medium") return "var(--warning)";
  return "var(--danger)";
}

function yForRoi(roi: number): number {
  const bounded = Math.max(0, Math.min(ROI_CAP, roi));
  return Y_BOTTOM - (bounded / ROI_CAP) * (Y_BOTTOM - Y_TOP);
}

function radiusFor(capital: number): number {
  const base = Math.sqrt(Math.max(0, capital)) * 0.1;
  return Math.max(6, Math.min(24, base));
}

function jitter(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return ((h & 0xff) / 255 - 0.5) * 60;
}

type HoverState = {
  project: Project;
  // SVG-space coordinates, used to position the floating tooltip
  cx: number;
  cy: number;
};

export function RiskRoiMatrix({ projects }: { projects: Project[] }) {
  const t = useT();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  const bubbles = useMemo(() => {
    return projects.map((p) => {
      const cx = X_TRACK[p.risk_level] + jitter(p.id);
      const cy = yForRoi(p.roi_projection);
      return { project: p, cx, cy, r: radiusFor(p.capital_committed) };
    });
  }, [projects]);

  const tooltipScreen = useMemo(() => {
    if (!hover || !svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const left = (hover.cx / VIEW_W) * rect.width;
    const top = (hover.cy / VIEW_H) * rect.height;
    return { left, top };
  }, [hover]);

  const handleClick = (project: Project) => {
    const target = document.getElementById(`project-${project.id}`);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label={t("projects.matrix.title")}
        className="block h-auto w-full"
        onMouseLeave={() => setHover(null)}
      >
        {/* Background fill — subtle quadrant tint */}
        <rect x={0} y={0} width={VIEW_W / 2} height={VIEW_H / 2} fill="var(--positive)" opacity={0.04} />
        <rect x={VIEW_W / 2} y={0} width={VIEW_W / 2} height={VIEW_H / 2} fill="var(--warning)" opacity={0.06} />
        <rect x={0} y={VIEW_H / 2} width={VIEW_W / 2} height={VIEW_H / 2} fill="var(--info)" opacity={0.04} />
        <rect x={VIEW_W / 2} y={VIEW_H / 2} width={VIEW_W / 2} height={VIEW_H / 2} fill="var(--danger)" opacity={0.05} />

        {/* Quadrant dividers */}
        <line
          x1={VIEW_W / 2}
          y1={Y_TOP - 10}
          x2={VIEW_W / 2}
          y2={Y_BOTTOM + 10}
          stroke="currentColor"
          strokeOpacity={0.18}
          strokeDasharray="4 4"
          strokeWidth={1}
        />
        <line
          x1={20}
          y1={(Y_TOP + Y_BOTTOM) / 2}
          x2={VIEW_W - 20}
          y2={(Y_TOP + Y_BOTTOM) / 2}
          stroke="currentColor"
          strokeOpacity={0.18}
          strokeDasharray="4 4"
          strokeWidth={1}
        />

        {/* Axes */}
        <line x1={20} y1={Y_BOTTOM} x2={VIEW_W - 20} y2={Y_BOTTOM} stroke="currentColor" strokeOpacity={0.35} strokeWidth={1} />
        <line x1={20} y1={Y_TOP - 10} x2={20} y2={Y_BOTTOM + 10} stroke="currentColor" strokeOpacity={0.35} strokeWidth={1} />

        {/* Y axis tick marks (0, 2.5, 5, 7.5, 10) */}
        {[0, 2.5, 5, 7.5, 10].map((v) => (
          <g key={v}>
            <line x1={16} y1={yForRoi(v)} x2={24} y2={yForRoi(v)} stroke="currentColor" strokeOpacity={0.4} />
            <text x={12} y={yForRoi(v) + 3} textAnchor="end" fontSize={9} fill="currentColor" fillOpacity={0.55}>
              {v}x
            </text>
          </g>
        ))}

        {/* X axis labels (risk levels) */}
        {(Object.keys(X_TRACK) as RiskLevel[]).map((level) => (
          <text
            key={level}
            x={X_TRACK[level]}
            y={Y_BOTTOM + 18}
            textAnchor="middle"
            fontSize={10}
            fill="currentColor"
            fillOpacity={0.7}
            style={{ textTransform: "uppercase", letterSpacing: 1 }}
          >
            {t(`risk.${level}`)}
          </text>
        ))}

        {/* Quadrant labels */}
        <text x={VIEW_W / 4} y={Y_TOP - 18} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.45}>
          {t("projects.matrix.quadrant.q1")}
        </text>
        <text x={(VIEW_W * 3) / 4} y={Y_TOP - 18} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.45}>
          {t("projects.matrix.quadrant.q2")}
        </text>
        <text x={VIEW_W / 4} y={Y_BOTTOM + 36} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.45}>
          {t("projects.matrix.quadrant.q3")}
        </text>
        <text x={(VIEW_W * 3) / 4} y={Y_BOTTOM + 36} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.45}>
          {t("projects.matrix.quadrant.q4")}
        </text>

        {/* Axis titles */}
        <text
          x={-VIEW_H / 2}
          y={14}
          transform="rotate(-90)"
          textAnchor="middle"
          fontSize={10}
          fill="currentColor"
          fillOpacity={0.6}
        >
          {t("projects.matrix.axisY")}
        </text>
        <text x={VIEW_W / 2} y={VIEW_H - 6} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.6}>
          {t("projects.matrix.axisX")}
        </text>

        {/* Bubbles */}
        {bubbles.map(({ project, cx, cy, r }) => {
          const fill = colorForRisk(project.risk_level);
          const stroke = project.status === "killed" ? "var(--danger)" : "currentColor";
          const opacity = project.status === "killed" ? 0.25 : project.status === "paused" ? 0.55 : 0.85;
          return (
            <g
              key={project.id}
              onMouseEnter={(event: MouseEvent<SVGGElement>) => {
                event.stopPropagation();
                setHover({ project, cx, cy });
              }}
              onClick={() => handleClick(project)}
              style={{ cursor: "pointer" }}
            >
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={fill}
                fillOpacity={opacity}
                stroke={stroke}
                strokeOpacity={0.5}
                strokeWidth={1}
              />
              <text
                x={cx}
                y={cy + r + 11}
                textAnchor="middle"
                fontSize={9}
                fill="currentColor"
                fillOpacity={0.7}
                style={{ pointerEvents: "none" }}
              >
                {project.name.length > 14 ? `${project.name.slice(0, 13)}…` : project.name}
              </text>
            </g>
          );
        })}
      </svg>

      {projects.length === 0 ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="rounded-md border border-dashed border-border bg-card/70 px-3 py-1.5 text-[11px] text-muted-foreground backdrop-blur">
            {t("projects.matrix.empty")}
          </span>
        </div>
      ) : null}

      {hover && tooltipScreen ? (
        <div
          className={cn(
            "pointer-events-none absolute z-20 min-w-[180px] max-w-[260px] rounded-md border border-border bg-card/95",
            "px-3 py-2 text-[11px] leading-5 shadow-lg backdrop-blur"
          )}
          style={{
            left: `${tooltipScreen.left}px`,
            top: `${tooltipScreen.top}px`,
            transform: "translate(-50%, calc(-100% - 14px))",
          }}
        >
          <p className="text-[12px] font-semibold text-foreground">{hover.project.name}</p>
          {hover.project.thesis ? (
            <p className="mt-1 line-clamp-3 text-muted-foreground">{hover.project.thesis}</p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
            <span>
              <span className="text-foreground">{t("projects.matrix.tooltip.roi")}:</span>{" "}
              {hover.project.roi_projection.toFixed(1)}x
            </span>
            <span>
              <span className="text-foreground">{t("projects.matrix.tooltip.spent")}:</span>{" "}
              {formatCNY(hover.project.capital_spent)} /{" "}
              {formatCNY(hover.project.capital_committed)} CNY
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
