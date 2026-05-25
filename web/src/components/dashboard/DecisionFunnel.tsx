import { useMemo } from "react";
import { domainIndex, domainName } from "@/lib/domainLabels";
import { useT } from "@/lib/i18nConfig";
import type { Decision, Transaction } from "@/types";

const POSITIVE_HINTS = ["✓", "成功", "达成", "win", "won", "positive", "good", "exceeded", "yes", "shipped"];
const NEGATIVE_HINTS = ["✗", "失败", "未达成", "lost", "loss", "negative", "bad", "missed", "no", "fail"];

function classifyOutcome(text: string): "positive" | "negative" | "neutral" {
  if (!text) return "neutral";
  const lower = text.toLowerCase();
  if (POSITIVE_HINTS.some((tok) => lower.includes(tok.toLowerCase()))) return "positive";
  if (NEGATIVE_HINTS.some((tok) => lower.includes(tok.toLowerCase()))) return "negative";
  return "neutral";
}

export function DecisionFunnel({
  decisions,
  transactions,
}: {
  decisions: Decision[];
  transactions: Transaction[];
}) {
  const t = useT();
  const stats = useMemo(() => {
    // Observations = recorded events (each transaction is one observation).
    const observations = transactions.length;
    const total = decisions.length;
    const reviewed = decisions.filter((d) => d.status === "reviewed");
    const wins = reviewed.filter((d) => classifyOutcome(d.reviewed_outcome) === "positive").length;
    const losses = reviewed.filter((d) => classifyOutcome(d.reviewed_outcome) === "negative").length;
    const reviewRate = observations === 0 ? null : total / observations;
    const winRate = reviewed.length === 0 ? null : wins / reviewed.length;

    // Best / worst domain by win rate among reviewed.
    const byDomain = new Map<string, { reviewed: number; wins: number }>();
    for (const d of reviewed) {
      if (!d.domain_tag) continue;
      const slot = byDomain.get(d.domain_tag) ?? { reviewed: 0, wins: 0 };
      slot.reviewed += 1;
      if (classifyOutcome(d.reviewed_outcome) === "positive") slot.wins += 1;
      byDomain.set(d.domain_tag, slot);
    }
    const ranked = [...byDomain.entries()]
      .filter(([, s]) => s.reviewed >= 1)
      .map(([id, s]) => ({ id, rate: s.wins / s.reviewed, reviewed: s.reviewed }));
    ranked.sort((a, b) => b.rate - a.rate);
    const best = ranked[0] ?? null;
    const worst = ranked.length >= 2 ? ranked[ranked.length - 1] : null;
    return { observations, total, reviewed: reviewed.length, wins, losses, reviewRate, winRate, best, worst };
  }, [decisions, transactions]);

  const winPct = stats.winRate === null ? null : Math.round(stats.winRate * 100);
  const revPct = stats.reviewRate === null ? null : Math.round(stats.reviewRate * 100);

  // Funnel paths.
  return (
    <div className="ax-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="ax-h-title">{t("dashboard.funnel.title")}</div>
          <div className="ax-h-sub">{t("dashboard.funnel.subtitle")}</div>
        </div>
        {winPct !== null ? (
          <span
            className="ax-chip"
            style={{ color: winPct >= 60 ? "var(--ax-positive)" : winPct >= 40 ? "var(--ax-warning)" : "var(--ax-danger)" }}
          >
            <span
              className="ax-chip-dot"
              style={{ background: winPct >= 60 ? "var(--ax-positive)" : winPct >= 40 ? "var(--ax-warning)" : "var(--ax-danger)" }}
            />
            {winPct}%
          </span>
        ) : null}
      </div>

      <svg viewBox="0 0 360 230" className="mt-3 w-full" style={{ height: 210 }}>
        {/* Stage 1: OBSERVATIONS */}
        <path d="M20,20 L340,20 L300,80 L60,80 Z" fill="var(--ax-hover)" stroke="var(--ax-border-strong)" strokeWidth={1} />
        <text x={180} y={48} className="ax-axis-text" textAnchor="middle" fill="var(--ax-muted)">
          {t("dashboard.funnel.observations")}
        </text>
        <text x={180} y={68} className="ax-axis-text" textAnchor="middle" fill="var(--ax-text)" fontWeight={700} fontSize={13}>
          {stats.observations}
        </text>

        {/* Stage 2: DECISIONS */}
        <path d="M60,86 L300,86 L260,146 L100,146 Z" fill="var(--ax-canvas, var(--ax-hover))" stroke="var(--ax-border-strong)" strokeWidth={1} />
        <text x={180} y={114} className="ax-axis-text" textAnchor="middle" fill="var(--ax-muted)">
          {t("dashboard.funnel.decisions")}
        </text>
        <text x={180} y={134} className="ax-axis-text" textAnchor="middle" fill="var(--ax-text)" fontWeight={700} fontSize={13}>
          {stats.total}
        </text>

        {/* Stage 3: WINS */}
        <path d="M100,152 L260,152 L220,212 L140,212 Z" fill="var(--ax-positive-soft)" stroke="var(--ax-positive)" strokeWidth={1} />
        <text x={180} y={180} className="ax-axis-text" textAnchor="middle" fill="var(--ax-positive)">
          {t("dashboard.funnel.wins")}
        </text>
        <text x={180} y={200} className="ax-axis-text" textAnchor="middle" fill="var(--ax-text)" fontWeight={700} fontSize={13}>
          {stats.wins}
        </text>

        {/* Side stats — conversion rates */}
        <text x={8} y={60} className="ax-axis-text" fill="var(--ax-muted)">
          {revPct !== null ? `${revPct}%` : "—"}
        </text>
        <text x={8} y={128} className="ax-axis-text" fill="var(--ax-muted)">
          {winPct !== null ? `${winPct}%` : "—"}
        </text>
      </svg>

      <div className="mt-3 flex items-baseline justify-between border-t border-[var(--ax-border)] pt-3">
        <div>
          <div className="ax-section-title">{t("dashboard.funnel.rate")}</div>
          <div className="ax-kpi text-[34px] font-semibold" style={{ color: winPct === null ? "var(--ax-muted)" : winPct >= 60 ? "var(--ax-positive)" : winPct >= 40 ? "var(--ax-warning)" : "var(--ax-danger)" }}>
            {winPct === null ? "—" : `${winPct}%`}
          </div>
          <div className="ax-kpi text-[10.5px]" style={{ color: "var(--ax-muted)" }}>
            {t("dashboard.funnel.rolling", { wins: stats.wins, reviewed: stats.reviewed })}
          </div>
        </div>
        <div className="text-right">
          <div className="ax-section-title">{t("dashboard.funnel.best")}</div>
          <div className="ax-kpi text-[13px]" style={{ color: "var(--ax-text)" }}>
            {stats.best
              ? `${domainIndex(stats.best.id)} ${domainName(stats.best.id, t)} · ${Math.round(stats.best.rate * 100)}%`
              : "—"}
          </div>
          <div className="ax-section-title mt-2">{t("dashboard.funnel.worst")}</div>
          <div className="ax-kpi text-[13px]" style={{ color: "var(--ax-danger)" }}>
            {stats.worst
              ? `${domainIndex(stats.worst.id)} ${domainName(stats.worst.id, t)} · ${Math.round(stats.worst.rate * 100)}%`
              : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
