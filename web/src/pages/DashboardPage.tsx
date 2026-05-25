import { useCallback, useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import {
  loadDashboard,
  loadDecisions,
  loadProjects,
  loadTransactions,
  type CommandParseResponse,
} from "@/api";
import { OmniCommandBar } from "@/components/axiom/OmniCommandBar";
import { KpiStrip } from "@/components/dashboard/KpiStrip";
import { RunwayHorizon } from "@/components/dashboard/RunwayHorizon";
import { RiskRoiMatrix } from "@/components/dashboard/RiskRoiMatrix";
import { DomainAudit } from "@/components/dashboard/DomainAudit";
import { DecisionFunnel } from "@/components/dashboard/DecisionFunnel";
import { CapitalMECE } from "@/components/dashboard/CapitalMECE";
import { CashflowPulse } from "@/components/dashboard/CashflowPulse";
import { DecisionLedger } from "@/components/dashboard/DecisionLedger";
import { PrinciplesAudit } from "@/components/dashboard/PrinciplesAudit";
import { useT } from "@/lib/i18nConfig";
import type {
  DashboardPayload,
  Decision,
  Project,
  Transaction,
} from "@/types";

function fmtCNY(value: number, signed?: boolean): string {
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function DashboardPage({
  navigate: _navigate,
  onStatus,
}: {
  navigate: (href: string) => void;
  onStatus: (status: string) => void;
}) {
  const t = useT();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    try {
      onStatus("Sync");
      const [dash, txResp, projResp, decResp] = await Promise.all([
        loadDashboard(),
        loadTransactions(200).catch(() => ({ ok: true as const, transactions: [] as Transaction[] })),
        loadProjects().catch(() => ({ ok: true as const, projects: [] as Project[] })),
        loadDecisions().catch(() => ({ ok: true as const, decisions: [] as Decision[] })),
      ]);
      setData(dash);
      setTransactions(txResp.transactions);
      setProjects(projResp.projects);
      setDecisions(decResp.decisions);
      onStatus("Live");
    } catch (exc) {
      const message = exc instanceof Error ? exc.message : t("dashboard.fetch.fail");
      setError(message);
      onStatus("Sync failed");
    }
  }, [onStatus, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onIngested = useCallback(
    (_result: CommandParseResponse) => {
      void refresh();
    },
    [refresh],
  );

  const cap = data?.capital ?? null;
  const baseline = data?.baseline ?? null;
  const activeProjects = projects.filter((p) => p.status === "active");

  return (
    <div className="space-y-5">
      {/* ─── A. OMNI INGESTION HEADER ─── */}
      <OmniCommandBar onIngested={onIngested} />

      {error ? (
        <div
          className="rounded-lg border px-4 py-3 text-[13px]"
          style={{
            borderColor: "color-mix(in srgb, var(--ax-danger) 40%, transparent)",
            background: "color-mix(in srgb, var(--ax-danger) 5%, transparent)",
            color: "var(--ax-danger)",
          }}
        >
          {error}
        </div>
      ) : null}

      {/* ─── B. KPI STRIP (4 hero metrics) ─── */}
      <KpiStrip capital={cap} timeline={data?.timeline ?? []} decisions={decisions} />

      {/* ─── C + D : Asymmetric work grid (13/7) ─── */}
      <section
        className="grid gap-4"
        style={{ gridTemplateColumns: "repeat(20, minmax(0, 1fr))" }}
      >
        {/* LEFT main column (13/20 = 65%) */}
        <div className="min-w-0 space-y-4 [grid-column:span_13/span_13]">
          <RunwayHorizon baseline={baseline} transactions={transactions} capital={cap} />
          <RiskRoiMatrix projects={activeProjects} />
          <CashflowPulse timeline={data?.timeline ?? []} />
        </div>

        {/* RIGHT audit column (7/20 = 35%) */}
        <div className="min-w-0 space-y-4 [grid-column:span_7/span_7]">
          <DomainAudit transactions={transactions} decisions={decisions} projects={projects} />
          <DecisionFunnel decisions={decisions} transactions={transactions} />
          <CapitalMECE projects={projects} capital={cap} />
        </div>
      </section>

      {/* ─── E. BOTTOM ACTIVITY  (decision log + principle audit) ─── */}
      <section className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DecisionLedger decisions={decisions} />
        </div>
        <div>
          <PrinciplesAudit />
        </div>
      </section>

      {cap && cap.net_position <= cap.floor ? (
        <div
          className="flex items-start gap-3 rounded-lg border px-4 py-3 text-[13px]"
          style={{
            borderColor: "color-mix(in srgb, var(--ax-danger) 40%, transparent)",
            background: "color-mix(in srgb, var(--ax-danger) 5%, transparent)",
          }}
        >
          <ShieldAlert className="mt-0.5 size-4" style={{ color: "var(--ax-danger)" }} />
          <div>
            <p className="font-medium" style={{ color: "var(--ax-danger)" }}>{t("dashboard.floor.title")}</p>
            <p className="mt-0.5" style={{ color: "var(--ax-muted)" }}>
              {t("dashboard.floor.desc", { x: fmtCNY(cap.floor, true) })}
            </p>
          </div>
        </div>
      ) : null}

      {/* ─── F. FOOTER  (system telemetry) ─── */}
      <footer
        className="flex flex-wrap items-center justify-between gap-3 pb-1 pt-2 text-[10.5px]"
        style={{ color: "var(--ax-muted)" }}
      >
        <div className="flex flex-wrap items-center gap-4">
          <span className="ax-kpi">Axiom Core 3.0 · sovereign-mode</span>
          <span aria-hidden>·</span>
          <span>SQLite 4 tables · ledger / projects / decisions / capital_tx</span>
          <span aria-hidden>·</span>
          <span>4SAPI gateway · multi-vendor</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="ax-chip-dot" style={{ background: "var(--ax-positive)" }} />
            All systems nominal
          </span>
          <span className="ax-kpi">build {new Date().toISOString().slice(0, 10)}</span>
        </div>
      </footer>
    </div>
  );
}
