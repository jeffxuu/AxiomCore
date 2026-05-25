import { useMemo, useState } from "react";
import { domainLabel } from "@/lib/domainLabels";
import { useT } from "@/lib/i18nConfig";
import { cn } from "@/lib/utils";
import type { Decision } from "@/types";

const POSITIVE_HINTS = ["✓", "成功", "达成", "win", "won", "positive", "good", "exceeded", "yes", "shipped"];
const NEGATIVE_HINTS = ["✗", "失败", "未达成", "lost", "loss", "negative", "bad", "missed", "no", "fail"];

function classifyOutcome(text: string): "positive" | "negative" | "neutral" {
  if (!text) return "neutral";
  const lower = text.toLowerCase();
  if (POSITIVE_HINTS.some((tok) => lower.includes(tok.toLowerCase()))) return "positive";
  if (NEGATIVE_HINTS.some((tok) => lower.includes(tok.toLowerCase()))) return "negative";
  return "neutral";
}

const DOMAIN_COLOR: Record<string, string> = {
  "01": "var(--ax-positive)",
  "02": "#5B7AA8",
  "03": "var(--ax-text-soft)",
  "04": "var(--ax-text-soft)",
  "05": "var(--ax-warning)",
  "06": "var(--ax-text-soft)",
  "07": "var(--ax-muted)",
  "08": "var(--ax-text-soft)",
  "09": "var(--ax-text-soft)",
};

type Bucket = "all" | "open" | "reviewed";

export function DecisionLedger({ decisions }: { decisions: Decision[] }) {
  const t = useT();
  const [bucket, setBucket] = useState<Bucket>("all");

  const rows = useMemo(() => {
    let filtered = decisions;
    if (bucket === "open") filtered = decisions.filter((d) => d.status === "open" || d.status === "committed");
    else if (bucket === "reviewed") filtered = decisions.filter((d) => d.status === "reviewed");
    return filtered.slice(0, 6);
  }, [decisions, bucket]);

  return (
    <div className="ax-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="ax-h-title">{t("dashboard.ledger.title")}</div>
          <div className="ax-h-sub">
            {t("dashboard.ledger.subtitle")}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(["all", "open", "reviewed"] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBucket(b)}
              className={cn("ax-btn-ghost", bucket === b && "active")}
            >
              {t(`dashboard.ledger.filter.${b}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
      <table className="min-w-[640px] w-full text-[12px]">
        <thead>
          <tr className="border-b border-[var(--ax-border)] text-left" style={{ color: "var(--ax-muted)" }}>
            <th className="py-2 font-medium">ID</th>
            <th className="py-2 font-medium">{t("dashboard.ledger.column.decision")}</th>
            <th className="py-2 font-medium">{t("dashboard.ledger.column.domain")}</th>
            <th className="py-2 text-right font-medium">{t("dashboard.ledger.column.options")}</th>
            <th className="py-2 text-right font-medium">{t("dashboard.ledger.column.outcome")}</th>
            <th className="py-2 text-right font-medium">{t("dashboard.ledger.column.state")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6} className="py-6 text-center text-[12px]" style={{ color: "var(--ax-muted)" }}>
                {t("dashboard.ledger.empty")}
              </td>
            </tr>
          ) : (
            rows.map((d) => {
              const outcomeKind = d.status === "reviewed" ? classifyOutcome(d.reviewed_outcome) : "neutral";
              const stateLabel =
                d.status === "reviewed"
                  ? outcomeKind === "positive"
                    ? t("dashboard.ledger.state.shipped")
                    : outcomeKind === "negative"
                    ? t("dashboard.ledger.state.loss")
                    : t("dashboard.ledger.state.reviewed")
                  : d.status === "committed"
                  ? t("dashboard.ledger.state.committed")
                  : t("dashboard.ledger.state.open");
              const stateColor =
                d.status === "reviewed"
                  ? outcomeKind === "positive"
                    ? "var(--ax-positive)"
                    : outcomeKind === "negative"
                    ? "var(--ax-danger)"
                    : "var(--ax-text-soft)"
                  : d.status === "committed"
                  ? "var(--ax-warning)"
                  : "var(--ax-muted)";
              const domainColor = DOMAIN_COLOR[d.domain_tag] ?? "var(--ax-text-soft)";
              const resolvedDomainLabel = d.domain_tag ? domainLabel(d.domain_tag, t, d.domain_tag) : "—";
              const shortId = d.id.length > 6 ? d.id.slice(-6) : d.id;
              return (
                <tr key={d.id} className="border-b border-[var(--ax-border)] last:border-b-0">
                  <td className="ax-kpi py-2.5 text-[11px]" style={{ color: "var(--ax-muted)" }}>
                    #{shortId}
                  </td>
                  <td className="max-w-[320px] truncate py-2.5 pr-3" style={{ color: "var(--ax-text)" }}>
                    {d.context || d.choice || "—"}
                  </td>
                  <td className="py-2.5">
                    {d.domain_tag ? (
                      <span className="ax-chip">
                        <span className="ax-chip-dot" style={{ background: domainColor }} />
                        {resolvedDomainLabel}
                      </span>
                    ) : (
                      <span className="text-[11px]" style={{ color: "var(--ax-muted)" }}>—</span>
                    )}
                  </td>
                  <td className="ax-kpi py-2.5 text-right text-[11.5px]" style={{ color: "var(--ax-text-soft)" }}>
                    {d.options.length || "—"}
                  </td>
                  <td className="py-2.5 text-right">
                    {d.status === "reviewed" ? (
                      <span
                        className="ax-chip"
                        style={{
                          color:
                            outcomeKind === "positive"
                              ? "var(--ax-positive)"
                              : outcomeKind === "negative"
                              ? "var(--ax-danger)"
                              : "var(--ax-text-soft)",
                        }}
                      >
                        {outcomeKind === "positive" ? "✓" : outcomeKind === "negative" ? "✗" : "—"}
                      </span>
                    ) : (
                      <span className="text-[11px]" style={{ color: "var(--ax-muted)" }}>—</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="ax-chip" style={{ color: stateColor }}>
                      <span className="ax-chip-dot" style={{ background: stateColor }} />
                      {stateLabel}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
