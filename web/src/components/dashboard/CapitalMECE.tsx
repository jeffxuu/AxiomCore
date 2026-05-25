import { useMemo } from "react";
import { useT } from "@/lib/i18nConfig";
import type { CapitalSnapshot, Project } from "@/types";

function fmtCNY(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

const SLICE_COLORS = [
  "var(--ax-warning)",
  "var(--ax-positive)",
  "#5B7AA8",
  "var(--ax-text-soft)",
  "var(--ax-border-strong)",
  "var(--ax-muted)",
];

export function CapitalMECE({
  projects,
  capital,
}: {
  projects: Project[];
  capital: CapitalSnapshot | null;
}) {
  const t = useT();
  const slices = useMemo(() => {
    const active = projects.filter((p) => p.status === "active" && p.capital_committed > 0);
    const sorted = [...active].sort((a, b) => b.capital_committed - a.capital_committed);
    const committedSum = sorted.reduce((acc, p) => acc + p.capital_committed, 0);

    // Sunk = killed projects' committed capital.
    const sunk = projects
      .filter((p) => p.status === "killed")
      .reduce((acc, p) => acc + p.capital_committed, 0);

    // Reserve = net position minus active commitments minus sunk (clamped >= 0).
    const net = capital?.net_position ?? 0;
    const reserve = Math.max(0, net - committedSum);

    const grand = committedSum + sunk + reserve;
    if (grand <= 0) return { rows: [], grand: 0 };

    const rows = sorted.map((p, i) => ({
      key: p.id,
      label: p.name,
      tag: p.risk_level === "low"
        ? t("dashboard.allocation.tag.ideal")
        : p.risk_level === "medium"
        ? t("dashboard.allocation.tag.hedged")
        : p.risk_level === "high"
        ? t("dashboard.allocation.tag.hero")
        : t("dashboard.allocation.tag.speculative"),
      capital: p.capital_committed,
      pct: (p.capital_committed / grand) * 100,
      color: SLICE_COLORS[Math.min(i, SLICE_COLORS.length - 3)],
    }));
    if (reserve > 0) {
      rows.push({
        key: "_reserve",
        label: t("dashboard.allocation.reserve"),
        tag: t("dashboard.allocation.tag.hedged"),
        capital: reserve,
        pct: (reserve / grand) * 100,
        color: "var(--ax-text-soft)",
      });
    }
    if (sunk > 0) {
      rows.push({
        key: "_sunk",
        label: t("dashboard.allocation.sunk"),
        tag: t("dashboard.allocation.tag.speculative"),
        capital: sunk,
        pct: (sunk / grand) * 100,
        color: "var(--ax-border-strong)",
      });
    }
    return { rows, grand };
  }, [projects, capital, t]);

  return (
    <div className="ax-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="ax-h-title">{t("dashboard.allocation.title")}</div>
          <div className="ax-h-sub">{t("dashboard.allocation.subtitle", { amount: fmtCNY(slices.grand) })}</div>
        </div>
        <span className="ax-chip ax-kpi">Σ = 100%</span>
      </div>

      {slices.rows.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed p-10 text-center text-[12px]" style={{ borderColor: "var(--ax-border-strong)", color: "var(--ax-muted)" }}>
          {t("dashboard.allocation.empty")}
        </div>
      ) : (
        <>
          {/* Stacked horizontal bar */}
          <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full" style={{ background: "var(--ax-hover)" }}>
            {slices.rows.map((row) => (
              <div key={row.key} style={{ width: `${row.pct}%`, background: row.color }} />
            ))}
          </div>

          <div className="mt-3 space-y-2 text-[11.5px]">
            {slices.rows.map((row) => (
              <div key={row.key} className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="ax-chip-dot" style={{ background: row.color }} />
                  <span className="truncate" style={{ color: "var(--ax-text-soft)" }}>
                    <span style={{ color: "var(--ax-muted)" }}>{row.tag} · </span>
                    {row.label}
                  </span>
                </span>
                <span className="ax-kpi shrink-0" style={{ color: "var(--ax-text)" }}>
                  {row.pct.toFixed(0)}% · ¥{fmtCNY(row.capital)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
