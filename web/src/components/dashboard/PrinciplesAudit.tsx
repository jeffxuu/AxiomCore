// Static principles audit panel — backend lacks a `principles` table.
// Once /api/principles ships, replace `PRINCIPLES` with a fetched payload.

type Principle = {
  id: string;
  text: string;
  trigger: string;
  tone: "neutral" | "warning";
};

const PRINCIPLES: Principle[] = [
  { id: "#01", text: "永不动用应急流动金", trigger: "3 ✓", tone: "neutral" },
  { id: "#03", text: "单项目敞口 ≤ 50% 现金", trigger: "⚠ 42% 接近上限", tone: "warning" },
  { id: "#05", text: "ROI < 3× 不下注", trigger: "8 ✓", tone: "neutral" },
  { id: "#07", text: "拒绝违反主权的外包", trigger: "1 ✓", tone: "neutral" },
  { id: "#09", text: "每周复盘 ≥ 1 次", trigger: "4 / 4 ✓", tone: "neutral" },
  { id: "#11", text: "负债不超过年现金净流 1/3", trigger: "0 ✓", tone: "neutral" },
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
  return (
    <div className="ax-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="ax-h-title">原则审计 · Principles</div>
          <div className="ax-h-sub">本月触发数 · 违反 0</div>
        </div>
        <span className="ax-chip" style={{ color: "var(--ax-positive)" }}>
          <span className="ax-chip-dot" style={{ background: "var(--ax-positive)" }} />
          0 violations
        </span>
      </div>

      <div className="mt-3 space-y-2.5">
        {PRINCIPLES.map((p) => (
          <div key={p.id} className="flex items-center justify-between text-[11.5px]">
            <span className="flex items-center gap-2">
              <span className="ax-kpi" style={{ color: "var(--ax-muted)" }}>{p.id}</span>
              <span style={{ color: "var(--ax-text-soft)" }}>{p.text}</span>
            </span>
            <span
              className="ax-kpi"
              style={{ color: p.tone === "warning" ? "var(--ax-warning)" : "var(--ax-text-soft)" }}
            >
              {p.trigger}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-4 border-t border-[var(--ax-border)] pt-3">
        <div className="ax-section-title mb-1.5">Next audit</div>
        <div className="text-[12px]" style={{ color: "var(--ax-text-soft)" }}>
          <span className="ax-kpi">{nextSundayISO()}</span> · 周日例行 · #03 阈值复检
        </div>
        <p className="mt-2 text-[10.5px]" style={{ color: "var(--ax-muted)" }}>
          静态示例 · 待 <span className="ax-kpi">principles</span> 表接入后实时驱动
        </p>
      </div>
    </div>
  );
}
