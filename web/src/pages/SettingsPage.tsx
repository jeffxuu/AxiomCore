import { ArrowRight, ExternalLink, KeyRound, LogOut, Receipt, Server, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader, Panel } from "@/components/axiom/primitives";
import { useBrand } from "@/lib/brandConfig";

export function SettingsPage({ navigate }: { navigate: (href: string) => void }) {
  const brand = useBrand();
  const rows: { Icon: typeof KeyRound; title: string; hint: string; action: () => void; label: string }[] = [
    { Icon: KeyRound, title: "AI key & model", hint: "Configure Oracle credentials in the Oracle view.", action: () => navigate("/oracle"), label: "Open Oracle" },
    { Icon: Receipt, title: "Baseline & ledger", hint: "Edit starting position and review every transaction.", action: () => navigate("/ledger"), label: "Open Ledger" },
    { Icon: ShieldCheck, title: "Security playbook", hint: "Sensitive-data rules for this public repo.", action: () => navigate("/vault?doc=security"), label: "Read doc" },
    { Icon: Server, title: "Deployment notes", hint: "Operator-facing deploy + rollback playbook.", action: () => navigate("/vault?doc=deployment"), label: "Read doc" },
  ];

  return (
    <div>
      <PageHeader eyebrow="System" title="Settings" description={`Low-frequency switches for ${brand.brandName}. The dashboard stays clean.`} />

      <Panel contentClassName="px-0 py-0">
        <ul className="divide-y divide-border">
          {rows.map(({ Icon, title, hint, action, label }) => (
            <li key={title} className="flex items-center gap-4 px-5 py-3.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-[var(--accent)] text-muted-foreground">
                <Icon className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{title}</p>
                <p className="text-[12px] text-muted-foreground">{hint}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={action} className="h-8 rounded-md text-[12px]">
                {label}
                <ArrowRight className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel className="mt-6" title="Account">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[var(--danger)]">
              <LogOut className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium">Sign out</p>
              <p className="text-[12px] text-muted-foreground">Returns you to the login screen.</p>
            </div>
          </div>
          <form method="post" action="/api/logout">
            <Button type="submit" variant="ghost" className="h-8 rounded-md text-[12px] text-[var(--danger)] hover:text-[var(--danger)]">
              Sign out
              <ExternalLink className="size-3.5" />
            </Button>
          </form>
        </div>
      </Panel>
    </div>
  );
}
