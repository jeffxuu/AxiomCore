import type { CapitalSnapshot, Decision, TimelinePoint } from "@/types";

function fmtCNY(value: number, opts?: { signed?: boolean }): string {
  const sign = opts?.signed && value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function NetWorthSpark({ points }: { points: TimelinePoint[] }) {
  if (!points.length) return <div className="h-9 w-full" />;
  const values = points.map((p) => p.net);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 200;
  const h = 38;
  const xOf = (i: number) => (w * i) / Math.max(points.length - 1, 1);
  const yOf = (v: number) => h - 6 - (h - 12) * ((v - min) / range);
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${xOf(i).toFixed(1)} ${yOf(p.net).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${xOf(points.length - 1).toFixed(1)} ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-9 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="kpi-net-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--ax-positive)" stopOpacity={0.32} />
          <stop offset="100%" stopColor="var(--ax-positive)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#kpi-net-grad)" />
      <path d={linePath} fill="none" stroke="var(--ax-positive)" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

function RunwayLine({ runwayDays, monthlyOut }: { runwayDays: number; monthlyOut: number }) {
  // Simple sloped line trending toward a dashed red floor.
  const w = 200;
  const h = 38;
  const trend = monthlyOut > 0 ? -1 : 0;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-9 w-full" preserveAspectRatio="none" aria-hidden>
      <path
        d={trend < 0 ? "M0,8 L25,11 L50,13 L75,12 L100,16 L125,18 L150,22 L175,26 L200,30" : "M0,18 L40,17 L80,16 L120,16 L160,15 L200,14"}
        fill="none"
        stroke="var(--ax-warning)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <line x1={0} y1={34} x2={w} y2={34} stroke="var(--ax-danger)" strokeWidth={1} strokeDasharray="2 3" opacity={0.7} />
      <title>{`runway ${runwayDays}d, monthly burn ${monthlyOut}`}</title>
    </svg>
  );
}

function DecisionsBars({ decisions }: { decisions: Decision[] }) {
  const w = 200;
  const h = 38;
  const slots = 12;
  const last = decisions.slice(0, slots).reverse();
  // Pad with empty bars if fewer than slots.
  const padded = Array.from({ length: slots }, (_, i) => last[i] ?? null);
  const barW = 10;
  const gap = 6;
  const totalW = slots * barW + (slots - 1) * gap;
  const startX = (w - totalW) / 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-9 w-full" preserveAspectRatio="none" aria-hidden>
      {padded.map((d, i) => {
        if (!d) {
          return (
            <rect
              key={i}
              x={startX + i * (barW + gap)}
              y={h - 8}
              width={barW}
              height={4}
              rx={1.5}
              fill="var(--ax-border-strong)"
              opacity={0.4}
            />
          );
        }
        const weight =
          d.status === "reviewed"
            ? /✓|成功|达成|win|won|positive/i.test(d.reviewed_outcome ?? "")
              ? 1
              : /✗|失败|未达成|lost|loss|negative/i.test(d.reviewed_outcome ?? "")
              ? 0.3
              : 0.6
            : d.status === "committed"
            ? 0.7
            : 0.5;
        const bh = Math.max(4, Math.round(weight * (h - 6)));
        const highlight = weight >= 0.85;
        return (
          <rect
            key={i}
            x={startX + i * (barW + gap)}
            y={h - bh}
            width={barW}
            height={bh}
            rx={1.5}
            fill={highlight ? "var(--ax-text)" : "var(--ax-text-soft)"}
            opacity={highlight ? 1 : 0.55}
          />
        );
      })}
    </svg>
  );
}

function TokenSpark() {
  // Static positive trend (live telemetry not wired through backend yet).
  const w = 200;
  const h = 38;
  const linePath = "M0,30 L20,28 L40,24 L60,22 L80,20 L100,18 L120,14 L140,11 L160,15 L180,10 L200,8";
  const areaPath = `${linePath} L 200 ${h} L 0 ${h} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-9 w-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="kpi-tok-grad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--ax-text)" stopOpacity={0.28} />
          <stop offset="100%" stopColor="var(--ax-text)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#kpi-tok-grad)" />
      <path d={linePath} fill="none" stroke="var(--ax-text)" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}

export function KpiStrip({
  capital,
  timeline,
  decisions,
}: {
  capital: CapitalSnapshot | null;
  timeline: TimelinePoint[];
  decisions: Decision[];
}) {
  // Net Worth — % vs 30 days ago derived from timeline.
  const net = capital?.net_position ?? 0;
  const tStart = timeline[0]?.net ?? net;
  const pct = tStart === 0 ? 0 : ((net - tStart) / Math.abs(tStart)) * 100;
  const netDelta = net - tStart;

  // Runway — days computed from runway_months.
  const runwayDays = capital?.runway_months !== null && capital?.runway_months !== undefined
    ? Math.round(capital.runway_months * 30)
    : null;
  const runwayExhaust = (() => {
    if (runwayDays === null || runwayDays === undefined) return "∞ · 现金正流";
    const d = new Date();
    d.setDate(d.getDate() + runwayDays);
    return `至 ${d.toISOString().slice(0, 10)}  ·  月烧 ¥${(capital?.monthly_out ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  })();

  // Decisions — total, win rate.
  const reviewed = decisions.filter((d) => d.status === "reviewed");
  const wins = reviewed.filter((d) => /✓|成功|达成|win|won|positive/i.test(d.reviewed_outcome ?? "")).length;
  const winPct = reviewed.length === 0 ? null : Math.round((wins / reviewed.length) * 100);

  return (
    <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Net Worth */}
      <div className="ax-card p-4">
        <div className="flex items-start justify-between">
          <span className="ax-section-title">Net Worth · 净资产</span>
          <span className="ax-chip" style={{ color: pct >= 0 ? "var(--ax-positive)" : "var(--ax-danger)" }}>
            <span className="ax-chip-dot" style={{ background: pct >= 0 ? "var(--ax-positive)" : "var(--ax-danger)" }} />
            {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
          </span>
        </div>
        <div className="ax-kpi mt-2 text-[26px] font-semibold" style={{ color: "var(--ax-text)" }}>
          ¥{fmtCNY(net)}
        </div>
        <div className="ax-kpi mt-0.5 text-[11px]" style={{ color: "var(--ax-muted)" }}>
          vs 30d ago  {fmtCNY(netDelta, { signed: true })}
        </div>
        <NetWorthSpark points={timeline} />
      </div>

      {/* Runway */}
      <div className="ax-card p-4">
        <div className="flex items-start justify-between">
          <span className="ax-section-title">Runway · 资金跑道</span>
          <span
            className="ax-chip"
            style={{
              color:
                runwayDays === null
                  ? "var(--ax-positive)"
                  : runwayDays > 365
                  ? "var(--ax-positive)"
                  : runwayDays > 180
                  ? "var(--ax-warning)"
                  : "var(--ax-danger)",
            }}
          >
            <span
              className="ax-chip-dot"
              style={{
                background:
                  runwayDays === null
                    ? "var(--ax-positive)"
                    : runwayDays > 365
                    ? "var(--ax-positive)"
                    : runwayDays > 180
                    ? "var(--ax-warning)"
                    : "var(--ax-danger)",
              }}
            />
            {runwayDays === null ? "stable" : runwayDays > 365 ? "stable" : runwayDays > 180 ? "watch" : "risk"}
          </span>
        </div>
        <div className="ax-kpi mt-2 text-[26px] font-semibold" style={{ color: "var(--ax-text)" }}>
          {runwayDays === null ? "∞" : runwayDays} <span className="text-[14px]" style={{ color: "var(--ax-muted)" }}>{runwayDays === null ? "" : "days"}</span>
        </div>
        <div className="ax-kpi mt-0.5 text-[11px]" style={{ color: "var(--ax-muted)" }}>
          {runwayExhaust}
        </div>
        <RunwayLine runwayDays={runwayDays ?? 9999} monthlyOut={capital?.monthly_out ?? 0} />
      </div>

      {/* Decisions */}
      <div className="ax-card p-4">
        <div className="flex items-start justify-between">
          <span className="ax-section-title">Decisions · 决策胜率</span>
          {winPct !== null ? (
            <span
              className="ax-chip"
              style={{
                color: winPct >= 60 ? "var(--ax-positive)" : winPct >= 40 ? "var(--ax-warning)" : "var(--ax-danger)",
              }}
            >
              <span
                className="ax-chip-dot"
                style={{
                  background: winPct >= 60 ? "var(--ax-positive)" : winPct >= 40 ? "var(--ax-warning)" : "var(--ax-danger)",
                }}
              />
              {winPct}%
            </span>
          ) : (
            <span className="ax-chip">
              <span className="ax-chip-dot" style={{ background: "var(--ax-muted)" }} />
              {decisions.length} 条
            </span>
          )}
        </div>
        <div className="ax-kpi mt-2 text-[26px] font-semibold" style={{ color: "var(--ax-text)" }}>
          {wins}<span className="text-[14px]" style={{ color: "var(--ax-muted)" }}> / {decisions.length || 0}</span>
        </div>
        <div className="ax-kpi mt-0.5 text-[11px]" style={{ color: "var(--ax-muted)" }}>
          {reviewed.length > 0 ? `${reviewed.length} 条复盘已闭环 · 12 个月滚动` : "等待首次复盘"}
        </div>
        <DecisionsBars decisions={decisions} />
      </div>

      {/* 4SAPI Tokens */}
      <div className="ax-card p-4">
        <div className="flex items-start justify-between">
          <span className="ax-section-title">4SAPI · Token 池</span>
          <span className="ax-chip" style={{ color: "var(--ax-positive)" }}>
            <span className="ax-chip-dot" style={{ background: "var(--ax-positive)" }} />
            healthy
          </span>
        </div>
        <div className="ax-kpi mt-2 text-[26px] font-semibold" style={{ color: "var(--ax-text)" }}>
          live<span className="text-[14px]" style={{ color: "var(--ax-muted)" }}> · gateway</span>
        </div>
        <div className="ax-kpi mt-0.5 text-[11px]" style={{ color: "var(--ax-muted)" }}>
          27 keys · 6 vendors · 实时遥测待接入
        </div>
        <TokenSpark />
      </div>
    </section>
  );
}
