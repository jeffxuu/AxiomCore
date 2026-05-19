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
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  hint?: string;
};

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "Sandbox",
    items: [
      { href: "/app", label: "Dashboard", Icon: LayoutDashboard, hint: "Capital & runway" },
      { href: "/projects", label: "Projects", Icon: GitBranch, hint: "Active arena" },
      { href: "/decisions", label: "Decisions", Icon: Scale, hint: "Audit log" },
      { href: "/ledger", label: "Ledger", Icon: Receipt, hint: "Income & expense" },
    ],
  },
  {
    title: "Knowledge",
    items: [
      { href: "/vault", label: "Vault", Icon: BookOpen, hint: "Docs" },
      { href: "/oracle", label: "Oracle", Icon: Sparkles, hint: "AI brief" },
    ],
  },
  {
    title: "System",
    items: [{ href: "/settings", label: "Settings", Icon: Settings }],
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
  status: _status,
  hideHeader,
}: {
  path: string;
  navigate: (href: string) => void;
  status: string;
  hideHeader?: boolean;
}) {
  const brand = useBrand();
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
            <span className="block truncate text-[11px] text-muted-foreground">{brand.tagline}</span>
          </span>
        </button>
      )}

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5" aria-label="Primary">
        {sections.map((section) => (
          <div key={section.title} className="space-y-1.5">
            <p className="px-2 ax-eyebrow">{section.title}</p>
            <ul className="space-y-0.5">
              {section.items.map(({ href, label, Icon, hint }) => {
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
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                      {hint ? (
                        <span className="hidden truncate text-[11px] text-muted-foreground/80 group-hover:text-muted-foreground lg:inline">
                          {hint}
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
        <span>v4.0 · sandbox</span>
      </div>
    </div>
  );
}
