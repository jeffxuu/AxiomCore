import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { loadBaseline, loadDecisions, loadProjects, loadTransactions, type CommandParseResponse } from "@/api";
import { OmniCommandBar } from "@/components/axiom/OmniCommandBar";
import { InsightCard } from "@/components/analytics/InsightCard";
import { RiskRoiMatrix } from "@/components/analytics/RiskRoiMatrix";
import { RunwayVelocityChart } from "@/components/analytics/RunwayVelocityChart";
import { CapitalAllocationTree } from "@/components/analytics/CapitalAllocationTree";
import { DecisionFunnel } from "@/components/analytics/DecisionFunnel";
import { DomainContributionWaterfall } from "@/components/analytics/DomainContributionWaterfall";
import { useT } from "@/lib/i18nConfig";
import type { Baseline, Decision, Project, Transaction } from "@/types";

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

  const onIngested = useCallback(
    (_result: CommandParseResponse) => {
      void refresh();
    },
    [refresh],
  );

  return (
    <div className="space-y-7">
      <OmniCommandBar onIngested={onIngested} />

      <section className="grid grid-cols-1 gap-7 lg:grid-cols-[repeat(20,minmax(0,1fr))]">
        <div className="space-y-7 lg:col-span-13">
          <InsightCard
            title={t("insights.runway.title")}
            subtitle={t("insights.runway.subtitle")}
            className="min-h-[520px]"
          >
            <RunwayVelocityChart baseline={baseline} transactions={transactions} />
          </InsightCard>

          <InsightCard
            title={t("insights.matrix.title")}
            subtitle={t("insights.matrix.subtitle")}
            className="min-h-[520px]"
          >
            <RiskRoiMatrix projects={projects} />
          </InsightCard>
        </div>

        <aside className="space-y-7 lg:col-span-7">
          <InsightCard
            title={t("insights.waterfall.title")}
            subtitle={t("insights.waterfall.subtitle")}
            className="lg:sticky lg:top-0"
          >
            <DomainContributionWaterfall
              transactions={transactions}
              decisions={decisions}
              projects={projects}
            />
          </InsightCard>

          <InsightCard
            title={t("insights.funnel.title")}
            subtitle={t("insights.funnel.subtitle")}
          >
            <DecisionFunnel decisions={decisions} />
          </InsightCard>

          <InsightCard
            title={t("insights.allocation.title")}
            subtitle={t("insights.allocation.subtitle")}
          >
            <CapitalAllocationTree projects={projects} />
          </InsightCard>
        </aside>
      </section>
    </div>
  );
}
