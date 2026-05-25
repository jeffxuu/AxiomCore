// Static principles audit panel — backend lacks a `principles` table.
// Once /api/principles ships, replace `PRINCIPLES` with a fetched payload.
import { useT } from "@/lib/i18nConfig";

type Principle = {
  id: string;
  textKey: string;
  trigger: string | null;
  tone: "neutral" | "warning";
};

const PRINCIPLES: Principle[] = [
  { id: "#01", textKey: "dashboard.principles.01", trigger: "3 ✓", tone: "neutral" },
  { id: "#03", textKey: "dashboard.principles.03", trigger: null, tone: "warning" },
  { id: "#05", textKey: "dashboard.principles.05", trigger: "8 ✓", tone: "neutral" },
  { id: "#07", textKey: "dashboard.principles.07", trigger: "1 ✓", tone: "neutral" },
  { id: "#09", textKey: "dashboard.principles.09", trigger: "4 / 4 ✓", tone: "neutral" },
  { id: "#11", textKey: "dashboard.principles.11", trigger: "0 ✓", tone: "neutral" },
];

function nextSundayISO(): string {
  const today = new Date();
  const day = today.getDay(); // 0=Sun..6=Sat
  const delta = day === 0 ? 7 : 7 - day;
  const next = new Date(today);
  next.setDate(today.getDate() + delta);
  return next.toISOString().slice(0, 10);
}

export function PrinciplesAudit() {
  const t = useT();
  return (
    <div className="ax-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="ax-h-title">{t("dashboard.principles.title")}</div>
          <div className="ax-h-sub">{t("dashboard.principles.subtitle")}</div>
        </div>
        <span className="ax-chip" style={{ color: "var(--ax-positive)" }}>
          <span className="ax-chip-dot" style={{ background: "var(--ax-positive)" }} />
          {t("dashboard.principles.zero")}
        </span>
      </div>

      <div className="mt-3 space-y-2.5">
        {PRINCIPLES.map((p) => (
          <div key={p.id} className="flex items-center justify-between text-[11.5px]">
            <span className="flex items-center gap-2">
              <span className="ax-kpi" style={{ color: "var(--ax-muted)" }}>{p.id}</span>
              <span style={{ color: "var(--ax-text-soft)" }}>{t(p.textKey)}</span>
            </span>
            <span
              className="ax-kpi"
              style={{ color: p.tone === "warning" ? "var(--ax-warning)" : "var(--ax-text-soft)" }}
            >
              {p.trigger ?? `⚠ ${t("dashboard.principles.03trigger")}`}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-[var(--ax-border)] pt-3">
        <div className="ax-section-title mb-1.5">{t("dashboard.principles.next")}</div>
        <div className="text-[12px]" style={{ color: "var(--ax-text-soft)" }}>
          <span className="ax-kpi">{nextSundayISO()}</span> · {t("dashboard.principles.nextDetail")}
        </div>
        <p className="mt-2 text-[10.5px]" style={{ color: "var(--ax-muted)" }}>
          {t("dashboard.principles.static")}
        </p>
      </div>
    </div>
  );
}
