import { useMemo } from "react";
import { useT } from "@/lib/i18nConfig";
import type { Decision } from "@/types";
import { EmptyCanvas } from "./InsightCard";

const VIEW_W = 600;
const VIEW_H = 400;
const PAD_X = 32;
const PAD_TOP = 80;
const PAD_BOTTOM = 56;
const FUNNEL_HEIGHT = VIEW_H - PAD_TOP - PAD_BOTTOM;
const FUNNEL_BANDS = 3;
const POSITIVE_HINTS = ["✓", "成功", "达成", "win", "won", "positive", "good", "exceeded", "yes", "shipped"];
const NEGATIVE_HINTS = ["✗", "失败", "未达成", "lost", "loss", "negative", "bad", "missed", "no", "fail"];

function classifyOutcome(text: string): "positive" | "negative" | "neutral" {
  if (!text) return "neutral";
  const normalized = text.toLowerCase();
  if (POSITIVE_HINTS.some((tok) => normalized.includes(tok.toLowerCase()))) return "positive";
  if (NEGATIVE_HINTS.some((tok) => normalized.includes(tok.toLowerCase()))) return "negative";
  return "neutral";
}

export function DecisionFunnel({ decisions }: { decisions: Decision[] }) {
  const t = useT();

  const stats = useMemo(() => {
    const total = decisions.length;
    const open = decisions.filter((d) => d.status === "open").length;
    const committed = decisions.filter((d) => d.status === "committed").length;
    const reviewed = decisions.filter((d) => d.status === "reviewed");
    const positives = reviewed.filter((d) => classifyOutcome(d.reviewed_outcome) === "positive").length;
    const negatives = reviewed.filter((d) => classifyOutcome(d.reviewed_outcome) === "negative").length;
    const successRate = reviewed.length > 0 ? positives / reviewed.length : null;
    return {
      total,
      open,
      committed,
      reviewed: reviewed.length,
      positives,
      negatives,
      successRate,
    };
  }, [decisions]);

  if (stats.total === 0) {
    return <EmptyCanvas label={t("insights.funnel.empty")} />;
  }

  const max = Math.max(stats.open + stats.committed + stats.reviewed, 1);
  const widths = [
    Math.max(72, (stats.open + stats.committed + stats.reviewed) / max * (VIEW_W - PAD_X * 2)),
    Math.max(56, (stats.committed + stats.reviewed) / max * (VIEW_W - PAD_X * 2)),
    Math.max(40, stats.reviewed / max * (VIEW_W - PAD_X * 2)),
  ];

  const bandHeight = FUNNEL_HEIGHT / FUNNEL_BANDS;
  const bands = [0, 1, 2].map((i) => {
    const yTop = PAD_TOP + bandHeight * i;
    const yBottom = yTop + bandHeight;
    const wTop = widths[i];
    const wBottom = widths[i + 1] ?? widths[i] * 0.78;
    const xMid = VIEW_W / 2;
    return {
      path: `M ${(xMid - wTop / 2).toFixed(2)} ${yTop.toFixed(2)} L ${(xMid + wTop / 2).toFixed(2)} ${yTop.toFixed(2)} L ${(xMid + wBottom / 2).toFixed(2)} ${yBottom.toFixed(2)} L ${(xMid - wBottom / 2).toFixed(2)} ${yBottom.toFixed(2)} Z`,
      yMid: (yTop + yBottom) / 2,
    };
  });

  const successPct = stats.successRate === null ? null : Math.round(stats.successRate * 100);

  return (
    <div className="relative w-full">
      <div className="relative w-full" style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}>
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          role="img"
          aria-label={t("insights.funnel.title")}
          className="absolute inset-0 h-full w-full"
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            <linearGradient id="dfn-band-0" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0F172A" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#1E293B" stopOpacity={0.9} />
            </linearGradient>
            <linearGradient id="dfn-band-0-dark" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#1E293B" stopOpacity={1} />
              <stop offset="100%" stopColor="#334155" stopOpacity={1} />
            </linearGradient>
            <linearGradient id="dfn-band-1" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#1E40AF" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#1D4ED8" stopOpacity={0.92} />
            </linearGradient>
            <linearGradient id="dfn-band-1-dark" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#1D4ED8" stopOpacity={0.95} />
              <stop offset="100%" stopColor="#2563EB" stopOpacity={1} />
            </linearGradient>
            <linearGradient id="dfn-band-2" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0D9488" stopOpacity={0.92} />
              <stop offset="100%" stopColor="#0F766E" stopOpacity={1} />
            </linearGradient>
            <linearGradient id="dfn-band-2-dark" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#14B8A6" stopOpacity={1} />
              <stop offset="100%" stopColor="#0D9488" stopOpacity={1} />
            </linearGradient>
          </defs>

          {bands.map((b, i) => (
            <g key={i}>
              <path d={b.path} fill={`url(#dfn-band-${i})`} className="dark:hidden" />
              <path d={b.path} fill={`url(#dfn-band-${i}-dark)`} className="hidden dark:block" />
            </g>
          ))}
        </svg>

        <div className="pointer-events-none absolute inset-0 font-sans tracking-tight">
          {[
            { label: t("insights.funnel.stage.open"), count: stats.open, total: stats.total },
            { label: t("insights.funnel.stage.committed"), count: stats.committed, total: stats.total },
            { label: t("insights.funnel.stage.reviewed"), count: stats.reviewed, total: stats.total },
          ].map((row, i) => {
            const yPct = (bands[i].yMid / VIEW_H) * 100;
            return (
              <div
                key={row.label}
                className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-white"
                style={{ top: `${yPct}%` }}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/75">{row.label}</p>
                <p className="mt-0.5 font-mono text-[22px] font-light tracking-tighter tabular text-white">{row.count}</p>
              </div>
            );
          })}

          {successPct !== null ? (
            <div
              className="absolute left-1/2 -translate-x-1/2 text-center"
              style={{ top: `${(PAD_TOP / 2 / VIEW_H) * 100 + 4}%` }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] opacity-75 dark:text-[#94A3B8]">
                {t("insights.funnel.successRate")}
              </p>
              <p
                className={`mt-0.5 font-mono text-3xl font-light tracking-tighter tabular ${
                  successPct >= 60
                    ? "text-[#0D9488] dark:text-[#14B8A6]"
                    : successPct >= 40
                    ? "text-[#D97706] dark:text-[#F59E0B]"
                    : "text-[#E11D48] dark:text-[#F43F5E]"
                }`}
              >
                {successPct}%
              </p>
            </div>
          ) : (
            <div
              className="absolute left-1/2 -translate-x-1/2 text-center"
              style={{ top: `${(PAD_TOP / 2 / VIEW_H) * 100 + 4}%` }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] opacity-75 dark:text-[#94A3B8]">
                {t("insights.funnel.successRate")}
              </p>
              <p className="mt-0.5 font-sans text-[14px] font-light text-[#94A3B8] dark:text-[#64748B]">
                {t("insights.funnel.successRate.pending")}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-3 font-sans text-[11px] tracking-tight">
        <FootBox label={t("insights.funnel.foot.positive")} value={stats.positives} tone="positive" />
        <FootBox label={t("insights.funnel.foot.negative")} value={stats.negatives} tone="danger" />
        <FootBox label={t("insights.funnel.foot.total")} value={stats.total} tone="neutral" />
      </div>
    </div>
  );
}

function FootBox({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "positive" | "danger" | "neutral";
}) {
  const toneText =
    tone === "danger"
      ? "text-[#E11D48] dark:text-[#F43F5E]"
      : tone === "positive"
      ? "text-[#0D9488] dark:text-[#14B8A6]"
      : "text-[#0F172A] dark:text-[#F8FAFC]";
  return (
    <div className="rounded-md border px-6 py-4.5" style={{ borderColor: "var(--ax-border)", background: "var(--ax-canvas)" }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B] opacity-75 dark:text-[#94A3B8]">{label}</p>
      <p className={`mt-1 font-mono text-[22px] font-light tracking-tighter tabular ${toneText}`}>{value}</p>
    </div>
  );
}
