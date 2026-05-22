import { useMemo, useState, type ComponentType, type SVGProps } from "react";
import {
  Activity,
  BarChart3,
  Banknote,
  BookOpen,
  Brain,
  Briefcase,
  CheckSquare,
  Compass,
  GitBranch,
  HeartPulse,
  LayoutDashboard,
  LineChart,
  Search,
  Settings,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import { useBrand } from "@/lib/brandConfig";
import { useT } from "@/lib/i18nConfig";
import { cn } from "@/lib/utils";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;
type NavItem = { href: string; label: string; Icon: IconType };
type DomainItem = { id: string; label: string; Icon: IconType };

function buildConsole(t: (key: string) => string): NavItem[] {
  return [
    { href: "/app", label: t("nav.dashboard"), Icon: LayoutDashboard },
    { href: "/insights", label: t("nav.insights"), Icon: LineChart },
    { href: "/projects", label: t("nav.projects"), Icon: GitBranch },
    { href: "/decisions", label: t("nav.decisions"), Icon: CheckSquare },
    { href: "/ledger", label: t("nav.ledger"), Icon: Banknote },
    { href: "/vault", label: t("nav.vault"), Icon: BookOpen },
    { href: "/oracle", label: t("nav.oracle"), Icon: Sparkles },
    { href: "/settings", label: t("nav.settings"), Icon: Settings },
  ];
}

function buildDomains(): DomainItem[] {
  return [
    { id: "01", label: "Health · 健康",        Icon: HeartPulse },
    { id: "02", label: "Cashflow · 现金流",    Icon: Banknote },
    { id: "03", label: "Career · 职业",        Icon: Briefcase },
    { id: "04", label: "Skills · 技能",        Icon: Wand2 },
    { id: "05", label: "Projects · 项目",      Icon: BarChart3 },
    { id: "06", label: "Cognition · 认知",     Icon: Brain },
    { id: "07", label: "Relationships",        Icon: Users },
    { id: "08", label: "Decisions · 决策",     Icon: Compass },
    { id: "09", label: "Principles · 原则",    Icon: Activity },
  ];
}

function isActive(path: string, href: string): boolean {
  if (href === "/app") return path === "/" || path === "/app";
  if (href === "/insights") return path === "/insights";
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
  const rawT = useT();
  const [filter, setFilter] = useState("");
  const t = (key: string) => {
    try {
      return typeof rawT === "function" ? rawT(key) : key;
    } catch {
      return key;
    }
  };
  const currentPath = path || "/";
  const brandName = brand?.brandName || "Axiom Core";
  const safeNavigate = (href: string) => {
    if (typeof navigate === "function") navigate(href);
  };

  const consoleItems = useMemo(() => buildConsole(t), [rawT]);
  const domainItems = useMemo(() => buildDomains(), []);
  const needle = filter.trim().toLowerCase();
  const filteredConsole = needle
    ? (consoleItems ?? []).filter((item) => (item?.label ?? "").toLowerCase().includes(needle))
    : consoleItems ?? [];
  const filteredDomains = needle
    ? (domainItems ?? []).filter((item) => (item?.label ?? "").toLowerCase().includes(needle) || (item?.id ?? "").includes(needle))
    : domainItems ?? [];

  return (
    <div className="flex h-full w-full flex-col">
      {/* ── Brand ── */}
      {hideHeader ? null : (
        <button
          type="button"
          onClick={() => safeNavigate("/app")}
          className="flex items-center gap-2.5 border-b px-6 py-4.5 text-left"
          style={{ borderColor: "var(--ax-border)" }}
        >
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-md"
            style={{
              background: "linear-gradient(135deg, var(--ax-ink-1), var(--ax-ink-2))",
              color: "var(--ax-bg)",
            }}
          >
            <span className="ax-kpi text-[11px] font-medium tracking-wider">AX</span>
          </span>
          <span className="min-w-0 leading-tight">
            <span
              className="block truncate text-[13px] font-medium tracking-tight"
              style={{ color: "var(--ax-text)" }}
            >
              {brandName}
            </span>
            <span
              className="ax-kpi block truncate text-[9.5px]"
              style={{ color: "var(--ax-muted)" }}
            >
              v3.0 · SOVEREIGN OS
            </span>
          </span>
        </button>
      )}

      {/* ── Search ── */}
      <div className="px-3 pt-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-[13px] -translate-y-1/2"
            style={{ color: "var(--ax-muted)" }}
            strokeWidth={2}
          />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="ax-input pl-8 text-[12px]"
            placeholder="Jump to module…  ⌘K"
            aria-label={t("common.search")}
            autoComplete="off"
          />
        </div>
      </div>

      {/* ── Nav ── */}
      <nav
        className="scroll-thin flex-1 space-y-3 overflow-y-auto px-3 py-3"
        aria-label="Primary"
      >
        <div>
          <p className="ax-section-title px-2 pb-1.5">Console</p>
          <ul className="space-y-0">
            {filteredConsole.map(({ href, label, Icon }) => {
              const active = isActive(currentPath, href);
              return (
                <li key={href}>
                  <button
                    type="button"
                    onClick={() => safeNavigate(href)}
                    className={cn("ax-nav-item w-full text-left", active && "active")}
                  >
                    <Icon className="size-[14px] shrink-0" strokeWidth={1.8} />
                    <span className="min-w-0 flex-1 truncate">{label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <p className="ax-section-title px-2 pb-1.5">Domains · 9 领域</p>
          <ul className="space-y-0">
            {filteredDomains.map(({ id, label }) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => safeNavigate(`/vault?doc=${encodeURIComponent(id)}`)}
                  className="ax-nav-item w-full text-left"
                >
                  <span
                    className="ax-kpi text-[10px]"
                    style={{ color: "var(--ax-muted)" }}
                  >
                    {id}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </nav>

      {/* ── Telemetry footer ── */}
      <div
        className="space-y-1.5 border-t px-6 py-4.5"
        style={{ borderColor: "var(--ax-border)" }}
      >
        <div className="flex items-center justify-between text-[11px]">
          <span className="ax-muted">SQLite Tables</span>
          <span className="ax-kpi" style={{ color: "var(--ax-text)" }}>
            4 · OK
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="ax-muted">4SAPI Pool</span>
          <span
            className="ax-kpi flex items-center gap-1.5"
            style={{ color: "var(--ax-text)" }}
          >
            <span
              className="ax-chip-dot"
              style={{ background: "var(--ax-positive)" }}
            />
            27 / 27
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="ax-muted">Build</span>
          <span className="ax-kpi" style={{ color: "var(--ax-muted)" }}>
            {t("footer.version")}
          </span>
        </div>
      </div>
    </div>
  );
}
