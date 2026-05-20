import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { loadBaseline, loadDecisions, loadProjects, loadTransactions } from "@/api";
import { PageHeader } from "@/components/axiom/primitives";
import { InsightCard } from "@/components/analytics/InsightCard";
import { RiskRoiMatrix } from "@/components/analytics/RiskRoiMatrix";
import { RunwayVelocityChart } from "@/components/analytics/RunwayVelocityChart";
import { CapitalAllocationTree } from "@/components/analytics/CapitalAllocationTree";
import { DecisionFunnel } from "@/components/analytics/DecisionFunnel";
import { RiskExposureRadar } from "@/components/analytics/RiskExposureRadar";
import { DomainContributionWaterfall } from "@/components/analytics/DomainContributionWaterfall";
import { useT } from "@/lib/i18nConfig";
import type { Baseline, Decision, Project, Transaction } from "@/types";

const DANGER_THRESHOLD = 0.4;

export function InsightsPage({ onStatus }: { onStatus: (status: string) => void }) {
  const t = useT();
  const [projects, setProjects] = useState<Project[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [baseline, setBaseline] = useState<Baseline | null>(null);

  const refresh = useCallback(async () => {
    try {
      onStatus("Sync");
      const [pr, tx, dc, bl] = await Promise.all([
        loadProjects(),
        loadTransactions(500),
        loadDecisions(),
        loadBaseline(),
      ]);
      setProjects(pr.projects);
      setTransactions(tx.transactions);
      setDecisions(dc.decisions);
      setBaseline(bl.baseline);
      onStatus("Live");
    } catch (exc) {
      onStatus("Sync failed");
      toast.error(exc instanceof Error ? exc.message : t("insights.toast.loadFail"));
    }
  }, [onStatus, t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const exposureAlert = useMemo(() => {
    const live = projects.filter((p) => p.status !== "killed");
    const total = live.reduce((acc, p) => acc + Math.max(0, p.capital_committed), 0);
    if (total <= 0) return false;
    const danger = live
      .filter((p) => p.risk_level === "high" || p.risk_level === "extreme")
      .reduce((acc, p) => acc + Math.max(0, p.capital_committed), 0);
    return danger / total > DANGER_THRESHOLD;
  }, [projects]);

  return (
    <div className="min-h-full bg-[#F8FAFC] dark:bg-[#0B1220]">
      <PageHeader
        eyebrow={t("insights.eyebrow")}
        title={t("insights.title")}
        description={t("insights.desc")}
      />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <InsightCard
          title={t("insights.matrix.title")}
          subtitle={t("insights.matrix.subtitle")}
        >
          <RiskRoiMatrix projects={projects} />
        </InsightCard>

        <InsightCard
          title={t("insights.runway.title")}
          subtitle={t("insights.runway.subtitle")}
        >
          <RunwayVelocityChart baseline={baseline} transactions={transactions} />
        </InsightCard>

        <InsightCard
          title={t("insights.allocation.title")}
          subtitle={t("insights.allocation.subtitle")}
        >
          <CapitalAllocationTree projects={projects} />
        </InsightCard>

        <InsightCard
          title={t("insights.funnel.title")}
          subtitle={t("insights.funnel.subtitle")}
        >
          <DecisionFunnel decisions={decisions} />
        </InsightCard>

        <InsightCard
          title={t("insights.exposure.title")}
          subtitle={t("insights.exposure.subtitle")}
          alert={exposureAlert}
        >
          <RiskExposureRadar projects={projects} />
        </InsightCard>

        <InsightCard
          title={t("insights.waterfall.title")}
          subtitle={t("insights.waterfall.subtitle")}
        >
          <DomainContributionWaterfall
            transactions={transactions}
            decisions={decisions}
            projects={projects}
          />
        </InsightCard>
      </div>
    </div>
  );
}
