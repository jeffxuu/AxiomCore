import { useMemo } from "react";
import { useDomains } from "@/components/axiom/primitives";
import { DOMAIN_IDS, domainIndex, domainName } from "@/lib/domainLabels";
import { useT } from "@/lib/i18nConfig";
import type { Decision, Project, Transaction } from "@/types";

const WINDOW_DAYS = 30;
const MAX_ACTS = 12;

function withinWindow(ts: string | null | undefined): boolean {
  if (!ts) return false;
  const ms = Date.parse(ts.length >= 10 ? `${ts.slice(0, 10)}T00:00:00` : ts);
  if (Number.isNaN(ms)) return false;
  return Date.now() - ms <= WINDOW_DAYS * 86_400_000;
}

function fillColor(count: number, max: number, total: number): string {
  if (count === 0) return "var(--ax-danger)";
  if (count === max) {
    // Hot but not extreme — warning.
    return count >= total * 0.18 ? "var(--ax-warning)" : "var(--ax-positive)";
  }
  if (count / total >= 0.13) return "var(--ax-ink-2, var(--ax-text-soft))";
  return "var(--ax-ink-3, var(--ax-muted))";
}

export function DomainAudit({
  transactions,
  decisions,
  projects,
}: {
  transactions: Transaction[];
  decisions: Decision[];
  projects: Project[];
}) {
  const t = useT();
  const domains = useDomains();

  const audit = useMemo(() => {
    const list = (domains.length ? domains : DOMAIN_IDS.map((id) => ({ id, label: id })))
      .slice(0, 9)
      .map((domain) => ({ ...domain, label: domainName(domain.id, t, domain.label) }));
    const counts = new Map<string, number>();
    for (const d of list) counts.set(d.id, 0);
    const resolveId = (tag: string) => list.find((domain) => domainIndex(domain.id) === domainIndex(tag))?.id;

    for (const tx of transactions) {
      const id = tx.domain_tag ? resolveId(tx.domain_tag) : undefined;
      if (!id) continue;
      if (withinWindow(tx.occurred_at) || withinWindow(tx.created_at)) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    for (const dec of decisions) {
      const id = dec.domain_tag ? resolveId(dec.domain_tag) : undefined;
      if (!id) continue;
      if (withinWindow(dec.decided_at) || withinWindow(dec.reviewed_at) || withinWindow(dec.created_at)) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    for (const p of projects) {
      const id = p.domain_tag ? resolveId(p.domain_tag) : undefined;
      if (!id) continue;
      if (withinWindow(p.updated_at) || withinWindow(p.started_at)) {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    const rows = list.map((d) => ({ id: d.id, label: d.label, count: counts.get(d.id) ?? 0 }));
    const total = rows.reduce((acc, r) => acc + r.count, 0);
    const max = Math.max(0, ...rows.map((r) => r.count));
    const sorted = [...rows].sort((a, b) => a.count - b.count);
    const missing = sorted[0] ?? null;
    const hot = [...rows].sort((a, b) => b.count - a.count)[0] ?? null;
    // Balance: standard deviation of counts (lower = more balanced).
    const mean = total / Math.max(1, rows.length);
    const variance = rows.reduce((acc, r) => acc + Math.pow(r.count - mean, 2), 0) / Math.max(1, rows.length);
    const stdev = Math.sqrt(variance);
    return { rows, total, max, missing, hot, stdev };
  }, [domains, transactions, decisions, projects, t]);

  return (
    <div className="ax-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="ax-h-title">{t("dashboard.domain.title")}</div>
          <div className="ax-h-sub">{t("dashboard.domain.subtitle", { max: MAX_ACTS })}</div>
        </div>
        <span className="ax-chip ax-kpi">{t("dashboard.domain.window", { count: audit.total })}</span>
      </div>

      <div className="mt-3">
        {audit.rows.map((row) => {
          const pct = Math.min(100, (row.count / MAX_ACTS) * 100);
          const color = fillColor(row.count, audit.max || 1, audit.total || 1);
          return (
            <div key={row.id} className="ax-domain-row">
              <span className="ax-domain-id">{domainIndex(row.id)}</span>
              <span className="ax-domain-name">{row.label}</span>
              <div className="ax-domain-track">
                <div
                  className="ax-domain-fill"
                  style={{
                    width: row.count === 0 ? "8%" : `${Math.max(8, pct)}%`,
                    background: color,
                  }}
                />
              </div>
              <span className="ax-domain-count">{row.count}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[var(--ax-border)] pt-3 text-center">
        <div>
          <div className="ax-section-title">{t("dashboard.domain.missing")}</div>
          <div className="ax-kpi mt-0.5 text-[13px]" style={{ color: "var(--ax-danger)" }}>
            {audit.missing ? `${domainIndex(audit.missing.id)} ${audit.missing.label}` : "—"}
          </div>
        </div>
        <div>
          <div className="ax-section-title">{t("dashboard.domain.hot")}</div>
          <div className="ax-kpi mt-0.5 text-[13px]" style={{ color: "var(--ax-warning)" }}>
            {audit.hot && audit.hot.count > 0
              ? `${domainIndex(audit.hot.id)} ${audit.hot.label}`
              : "—"}
          </div>
        </div>
        <div>
          <div className="ax-section-title">{t("dashboard.domain.balance")}</div>
          <div className="ax-kpi mt-0.5 text-[13px]" style={{ color: "var(--ax-text)" }}>
            {audit.stdev.toFixed(2)}σ
          </div>
        </div>
      </div>
    </div>
  );
}
