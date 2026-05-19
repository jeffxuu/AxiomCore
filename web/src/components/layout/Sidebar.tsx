import {
  BookOpen,
  GitBranch,
  LayoutDashboard,
  Receipt,
  Scale,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useBrand } from "@/lib/brandConfig";
import { useT } from "@/lib/i18nConfig";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  labelKey: string;
  hintKey: string;
  Icon: LucideIcon;
};

const SECTIONS: { titleKey: string; items: NavItem[] }[] = [
  {
    titleKey: "nav.section.sandbox",
    items: [
      { href: "/app", labelKey: "nav.dashboard", hintKey: "nav.dashboard.hint", Icon: LayoutDashboard },
      { href: "/projects", labelKey: "nav.projects", hintKey: "nav.projects.hint", Icon: GitBranch },
      { href: "/decisions", labelKey: "nav.decisions", hintKey: "nav.decisions.hint", Icon: Scale },
      { href: "/ledger", labelKey: "nav.ledger", hintKey: "nav.ledger.hint", Icon: Receipt },
    ],
  },
  {
    titleKey: "nav.section.knowledge",
    items: [
      { href: "/vault", labelKey: "nav.vault", hintKey: "nav.vault.hint", Icon: BookOpen },
      { href: "/oracle", labelKey: "nav.oracle", hintKey: "nav.oracle.hint", Icon: Sparkles },
    ],
  },
  {
    titleKey: "nav.section.system",
    items: [{ href: "/settings", labelKey: "nav.settings", hintKey: "", Icon: Settings }],
  },
];

function isActive(path: string, href: string): boolean {
  if (href === "/app") return path === "/" || path === "/app";
  if (href === "/vault") return path === "/vault" || path === "/files" || path === "/library";
  if (href === "/oracle") return path === "/oracle" || path === "/ai";
  if (href === "/settings") return path === "/settings" || path === "/more";
  return path.startsWith(href);
}

export function Sidebar({
  path,
  navigate,
  hideHeader,
}: {
  path: string;
  navigate: (href: string) => void;
  hideHeader?: boolean;
}) {
  const brand = useBrand();
  const t = useT();
  return (
    <div className="flex h-full w-full flex-col bg-[var(--sidebar)] text-[var(--sidebar-foreground)]">
      {hideHeader ? null : (
        <button
          type="button"
          className="flex h-14 items-center gap-2.5 border-b border-[var(--sidebar-border)] px-4 text-left"
          onClick={() => navigate("/app")}
        >
          <span className="flex size-7 items-center justify-center rounded-md border border-[var(--sidebar-border)] bg-[var(--sidebar-accent)] text-[11px] font-semibold tracking-tight text-foreground">
            A
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-tight text-foreground">{brand.brandName}</span>
            <span className="block truncate text-[11px] text-muted-foreground">{t("brand.tagline")}</span>
          </span>
        </button>
      )}

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5" aria-label="Primary">
        {SECTIONS.map((section) => (
          <div key={section.titleKey} className="space-y-1.5">
            <p className="px-2 ax-eyebrow">{t(section.titleKey)}</p>
            <ul className="space-y-0.5">
              {section.items.map(({ href, labelKey, hintKey, Icon }) => {
                const active = isActive(path, href);
                return (
                  <li key={href}>
                    <button
                      type="button"
                      onClick={() => navigate(href)}
                      className={cn(
                        "group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors",
                        active
                          ? "bg-[var(--sidebar-accent)] text-foreground"
                          : "text-muted-foreground hover:bg-[var(--sidebar-accent)]/70 hover:text-foreground"
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                        )}
                        strokeWidth={1.8}
                      />
                      <span className="min-w-0 flex-1 truncate">{t(labelKey)}</span>
                      {hintKey ? (
                        <span className="hidden truncate text-[11px] text-muted-foreground/80 group-hover:text-muted-foreground lg:inline">
                          {t(hintKey)}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[var(--sidebar-border)] px-4 py-3 text-[11px] text-muted-foreground">
        <span>{t("footer.version")}</span>
      </div>
    </div>
  );
}
