import { useMemo, useRef, useState, type MouseEvent } from "react";
import { useT } from "@/lib/i18nConfig";
import { formatCNY } from "@/components/axiom/primitives";
import type { Project, RiskLevel } from "@/types";
import { cn } from "@/lib/utils";
import { EmptyCanvas } from "./InsightCard";

const VIEW_W = 600;
const VIEW_H = 400;
const PAD_LEFT = 56;
const PAD_RIGHT = 24;
const PAD_TOP = 28;
const PAD_BOTTOM = 56;
const ROI_CAP = 10;

const RISK_ORDER: RiskLevel[] = ["low", "medium", "high", "extreme"];

function xForRisk(level: RiskLevel): number {
  const idx = RISK_ORDER.indexOf(level);
  const trackW = VIEW_W - PAD_LEFT - PAD_RIGHT;
  const slot = trackW / RISK_ORDER.length;
  return PAD_LEFT + slot * idx + slot / 2;
}

function yForRoi(roi: number): number {
  const bounded = Math.max(0, Math.min(ROI_CAP, roi));
  const trackH = VIEW_H - PAD_TOP - PAD_BOTTOM;
  return PAD_TOP + trackH * (1 - bounded / ROI_CAP);
}

function radiusFor(capital: number): number {
  const base = Math.sqrt(Math.max(0, capital)) * 0.1;
  return Math.max(6, Math.min(24, base));
}

function jitter(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return ((h & 0xff) / 255 - 0.5) * 40;
}

type HoverState = { project: Project; cx: number; cy: number };

export function RiskRoiMatrix({ projects }: { projects: Project[] }) {
  const t = useT();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  const bubbles = useMemo(() => {
    return projects.map((p) => ({
      project: p,
      cx: xForRisk(p.risk_level) + jitter(p.id),
      cy: yForRoi(p.roi_projection),
      r: radiusFor(p.capital_committed),
    }));
  }, [projects]);

  const tooltip = useMemo(() => {
    if (!hover) return null;
    return {
      leftPct: (hover.cx / VIEW_W) * 100,
      topPct: (hover.cy / VIEW_H) * 100,
    };
  }, [hover]);

  const handleClick = (project: Project) => {
    const target = document.getElementById(`project-${project.id}`);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      window.history.pushState({}, "", "/projects");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  if (projects.length === 0) {
    return <EmptyCanvas label={t("insights.matrix.empty")} />;
  }

  const xMid = (PAD_LEFT + (VIEW_W - PAD_RIGHT)) / 2;
  const yMid = (PAD_TOP + (VIEW_H - PAD_BOTTOM)) / 2;

  return (
    <div className="relative w-full">
      <div className="relative w-full" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          role="img"
          aria-label={t("insights.matrix.title")}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid meet"
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <pattern id="rrm-grid" width="60" height="40" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 40" fill="none" className="stroke-[#E2E8F0] dark:stroke-[#1E293B]" strokeWidth={0.5} />
            </pattern>
            <radialGradient id="rrm-low-light" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#A7F3D0" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#0F766E" stopOpacity={0.8} />
            </radialGradient>
            <radialGradient id="rrm-medium-light" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FDE68A" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#B45309" stopOpacity={0.78} />
            </radialGradient>
            <radialGradient id="rrm-high-light" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FDA4AF" stopOpacity={0.88} />
              <stop offset="100%" stopColor="#BE123C" stopOpacity={0.76} />
            </radialGradient>
            <radialGradient id="rrm-extreme-light" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FBCFE8" stopOpacity={0.82} />
              <stop offset="100%" stopColor="#9D174D" stopOpacity={0.72} />
            </radialGradient>
            <radialGradient id="rrm-low-dark" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#5EEAD4" stopOpacity={0.9} />
              <stop offset="100%" stopColor="#0F766E" stopOpacity={0.74} />
            </radialGradient>
            <radialGradient id="rrm-medium-dark" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FCD34D" stopOpacity={0.84} />
              <stop offset="100%" stopColor="#B45309" stopOpacity={0.72} />
            </radialGradient>
            <radialGradient id="rrm-high-dark" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#FB7185" stopOpacity={0.84} />
              <stop offset="100%" stopColor="#BE123C" stopOpacity={0.72} />
            </radialGradient>
            <radialGradient id="rrm-extreme-dark" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#F9A8D4" stopOpacity={0.78} />
              <stop offset="100%" stopColor="#9D174D" stopOpacity={0.68} />
            </radialGradient>
          </defs>
          <rect
            x={PAD_LEFT}
            y={PAD_TOP}
            width={VIEW_W - PAD_LEFT - PAD_RIGHT}
            height={VIEW_H - PAD_TOP - PAD_BOTTOM}
            fill="url(#rrm-grid)"
          />

          <line
            x1={xMid}
            y1={PAD_TOP}
            x2={xMid}
            y2={VIEW_H - PAD_BOTTOM}
            className="stroke-[#94A3B8] dark:stroke-[#334155]"
            strokeDasharray="3 4"
            strokeWidth={0.75}
          />
          <line
            x1={PAD_LEFT}
            y1={yMid}
            x2={VIEW_W - PAD_RIGHT}
            y2={yMid}
            className="stroke-[#94A3B8] dark:stroke-[#334155]"
            strokeDasharray="3 4"
            strokeWidth={0.75}
          />

          <line
            x1={PAD_LEFT}
            y1={VIEW_H - PAD_BOTTOM}
            x2={VIEW_W - PAD_RIGHT}
            y2={VIEW_H - PAD_BOTTOM}
            className="stroke-[#94A3B8] dark:stroke-[#334155]"
            strokeWidth={0.75}
          />
          <line
            x1={PAD_LEFT}
            y1={PAD_TOP}
            x2={PAD_LEFT}
            y2={VIEW_H - PAD_BOTTOM}
            className="stroke-[#94A3B8] dark:stroke-[#334155]"
            strokeWidth={0.75}
          />

          {bubbles.map(({ project, cx, cy, r }) => {
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
                  className="dark:hidden"
                  fill={`url(#rrm-${project.risk_level}-light)`}
                  fillOpacity={0.35}
                  stroke="none"
                />
                <circle
                  cx={cx}
                  cy={cy}
                  r={r}
                  className="hidden dark:block"
                  fill={`url(#rrm-${project.risk_level}-dark)`}
                  fillOpacity={0.35}
                  stroke="none"
                />
              </g>
            );
          })}
        </svg>

        {/* HTML overlay — y-axis labels */}
        <div className="pointer-events-none absolute inset-0 font-sans text-[11px] tracking-tight">
          {[0, 2.5, 5, 7.5, 10].map((value) => {
            const topPct = (yForRoi(value) / VIEW_H) * 100;
            return (
              <span
                key={value}
                className="absolute -translate-y-1/2 text-right tabular text-[#64748B] dark:text-[#94A3B8]"
                style={{ left: 0, top: `${topPct}%`, width: `${(PAD_LEFT - 8) / VIEW_W * 100}%` }}
              >
                {value}x
              </span>
            );
          })}

          {/* X-axis labels (risk track) */}
          {RISK_ORDER.map((level) => {
            const leftPct = (xForRisk(level) / VIEW_W) * 100;
            return (
              <span
                key={level}
                className="absolute -translate-x-1/2 text-[10px] font-semibold uppercase tracking-wider text-[#64748B] opacity-75 dark:text-[#94A3B8]"
                style={{ left: `${leftPct}%`, top: `${((VIEW_H - PAD_BOTTOM + 12) / VIEW_H) * 100}%` }}
              >
                {t(`risk.${level}`)}
              </span>
            );
          })}

          {/* Axis titles */}
          <span
            className="absolute -translate-x-1/2 text-[11px] font-medium text-[#0F172A] dark:text-[#F8FAFC]"
            style={{ left: "50%", bottom: 0 }}
          >
            {t("insights.matrix.axisX")}
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
            {t("insights.matrix.axisY")}
          </span>

          {/* Quadrant tags */}
          <span
            className="absolute -translate-x-1/2 rounded-sm bg-[#0D9488]/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#0D9488] opacity-75 dark:bg-[#14B8A6]/14 dark:text-[#14B8A6]"
            style={{ left: `${((PAD_LEFT + xMid) / 2 / VIEW_W) * 100}%`, top: `${(PAD_TOP - 18) / VIEW_H * 100}%` }}
          >
            {t("insights.matrix.q.star")}
          </span>
          <span
            className="absolute -translate-x-1/2 rounded-sm bg-[#D97706]/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#D97706] opacity-75 dark:bg-[#F59E0B]/14 dark:text-[#F59E0B]"
            style={{ left: `${((xMid + (VIEW_W - PAD_RIGHT)) / 2 / VIEW_W) * 100}%`, top: `${(PAD_TOP - 18) / VIEW_H * 100}%` }}
          >
            {t("insights.matrix.q.speculative")}
          </span>
          <span
            className="absolute -translate-x-1/2 rounded-sm bg-[#0F172A]/6 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#475569] opacity-75 dark:bg-[#F8FAFC]/10 dark:text-[#94A3B8]"
            style={{
              left: `${((PAD_LEFT + xMid) / 2 / VIEW_W) * 100}%`,
              top: `${((VIEW_H - PAD_BOTTOM + 32) / VIEW_H) * 100}%`,
            }}
          >
            {t("insights.matrix.q.defensive")}
          </span>
          <span
            className="absolute -translate-x-1/2 rounded-sm bg-[#E11D48]/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#E11D48] opacity-75 dark:bg-[#F43F5E]/14 dark:text-[#F43F5E]"
            style={{
              left: `${((xMid + (VIEW_W - PAD_RIGHT)) / 2 / VIEW_W) * 100}%`,
              top: `${((VIEW_H - PAD_BOTTOM + 32) / VIEW_H) * 100}%`,
            }}
          >
            {t("insights.matrix.q.drains")}
          </span>
        </div>

        {hover && tooltip ? (
          <div
            className={cn(
              "pointer-events-none absolute z-20 min-w-[200px] max-w-[280px] rounded-[2px] border px-3 py-2 shadow-none backdrop-blur-md",
              "border-[var(--ax-border-strong)] bg-[var(--ax-card)]/95"
            )}
            style={{
              left: `${tooltip.leftPct}%`,
              top: `${tooltip.topPct}%`,
              transform: "translate(-50%, calc(-100% - 16px))",
            }}
          >
            <p className="font-sans text-[12.5px] font-medium tracking-tight text-[#0F172A] dark:text-[#F8FAFC]">
              {hover.project.name}
            </p>
            {hover.project.thesis ? (
              <p className="mt-1 line-clamp-3 font-sans text-[11px] leading-snug tracking-tight text-[#64748B] dark:text-[#94A3B8]">
                {hover.project.thesis}
              </p>
            ) : null}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-[11px] font-normal tracking-tight">
              <span className="text-[#64748B] dark:text-[#94A3B8]">
                <span className="text-[#0F172A] dark:text-[#F8FAFC]">{t("insights.matrix.tooltip.roi")}:</span>{" "}
                <span className="ax-kpi text-[#0F172A] dark:text-[#F8FAFC]">{hover.project.roi_projection.toFixed(1)}x</span>
              </span>
              <span className="text-[#64748B] dark:text-[#94A3B8]">
                <span className="text-[#0F172A] dark:text-[#F8FAFC]">{t("insights.matrix.tooltip.committed")}:</span>{" "}
                <span className="ax-kpi text-[#0F172A] dark:text-[#F8FAFC]">
                  {formatCNY(hover.project.capital_spent)} / {formatCNY(hover.project.capital_committed)}
                </span>
              </span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
