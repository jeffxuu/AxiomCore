import { ArrowRight, ExternalLink, KeyRound, LogOut, Receipt, Server, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/axiom/primitives";
import { useBrand } from "@/lib/brandConfig";
import { useT } from "@/lib/i18nConfig";

export function SettingsPage({ navigate }: { navigate: (href: string) => void }) {
  const t = useT();
  const brand = useBrand();
  const rows: { Icon: typeof KeyRound; titleKey: string; hintKey: string; action: () => void; labelKey: string }[] = [
    { Icon: KeyRound, titleKey: "settings.rows.aiKey.title", hintKey: "settings.rows.aiKey.hint", action: () => navigate("/oracle"), labelKey: "settings.rows.aiKey.action" },
    { Icon: Receipt, titleKey: "settings.rows.ledger.title", hintKey: "settings.rows.ledger.hint", action: () => navigate("/ledger"), labelKey: "settings.rows.ledger.action" },
    { Icon: ShieldCheck, titleKey: "settings.rows.security.title", hintKey: "settings.rows.security.hint", action: () => navigate("/vault?doc=security"), labelKey: "settings.rows.security.action" },
    { Icon: Server, titleKey: "settings.rows.deploy.title", hintKey: "settings.rows.deploy.hint", action: () => navigate("/vault?doc=deployment"), labelKey: "settings.rows.deploy.action" },
  ];

  return (
    <div>
      <PageHeader
        eyebrow={t("settings.eyebrow")}
        title={t("settings.title")}
        description={t("settings.desc", { brand: brand.brandName })}
      />

      <Panel contentClassName="px-0 py-0">
        <ul className="divide-y divide-border">
          {rows.map(({ Icon, titleKey, hintKey, action, labelKey }) => (
            <li key={titleKey} className="flex items-center gap-4 px-5 py-3.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-[var(--accent)] text-muted-foreground">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{t(titleKey)}</p>
                <p className="text-[12px] text-muted-foreground">{t(hintKey)}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={action} className="h-8 rounded-md text-[12px]">
                {t(labelKey)}
                <ArrowRight className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="mt-6" title={t("settings.account.title")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[var(--danger)]">
              <LogOut className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium">{t("settings.account.signout.title")}</p>
              <p className="text-[12px] text-muted-foreground">{t("settings.account.signout.hint")}</p>
            </div>
          </div>
          <form method="post" action="/api/logout">
            <Button type="submit" variant="ghost" className="h-8 rounded-md text-[12px] text-[var(--danger)] hover:text-[var(--danger)]">
              {t("settings.account.signout.action")}
              <ExternalLink className="size-3.5" />
            </Button>
          </form>
        </div>
      </Panel>
    </div>
  );
}
