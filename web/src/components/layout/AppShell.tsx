import { useMemo, useState, type ReactNode } from "react";
import { ChevronRight, Languages, LogOut, Menu, Moon, Sun, X } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useBrand } from "@/lib/brandConfig";
import { useTheme } from "@/lib/themeConfig";
import { useI18n } from "@/lib/i18nConfig";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";

function statusKey(status: string): { token: string; tone: "positive" | "warning" | "danger" } {
  if (/fail|error|fail/i.test(status)) return { token: "shell.status.fail", tone: "danger" };
  if (/sync|loading|saving/i.test(status)) return { token: "shell.status.sync", tone: "warning" };
  return { token: "shell.status.live", tone: "positive" };
}

type Crumb = { label: string; href?: string };

const PATH_CRUMBS: Record<string, string> = {
  "/": "nav.dashboard",
  "/app": "nav.dashboard",
  "/projects": "nav.projects",
  "/decisions": "nav.decisions",
  "/ledger": "nav.ledger",
  "/insights": "nav.insights",
  "/vault": "nav.vault",
  "/files": "nav.vault",
  "/library": "nav.vault",
  "/oracle": "nav.oracle",
  "/ai": "nav.oracle",
  "/settings": "nav.settings",
  "/more": "nav.settings",
};

export function AppShell({
  children,
  isLogin,
  path,
  status,
  navigate,
}: {
  children: ReactNode;
  isLogin: boolean;
  path: string;
  status: string;
  navigate: (href: string) => void;
}) {
  const brand = useBrand();
  const { theme, toggle: toggleTheme } = useTheme();
  const { lang, toggle: toggleLang, t } = useI18n();
  const [open, setOpen] = useState(false);

  if (isLogin) {
    return (
      <TooltipProvider delayDuration={150}>
        <div className="min-h-screen w-full bg-background text-foreground">
          <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4 py-10">
            {children}
          </main>
          <Toaster position="top-right" theme={theme} />
        </div>
      </TooltipProvider>
    );
  }

  const statusInfo = statusKey(status);
  const statusLabel = t(statusInfo.token);
  const themeLabel = theme === "dark" ? t("shell.theme.toggle.light") : t("shell.theme.toggle.dark");
  const langLabel = t("shell.lang.toggle");

  const crumbs = useMemo<Crumb[]>(() => {
    const trail: Crumb[] = [{ label: t("nav.section.sandbox") }];
    const key = PATH_CRUMBS[path] || PATH_CRUMBS["/"];
    trail.push({ label: t(key) });
    return trail;
  }, [path, t]);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex h-screen w-full overflow-hidden bg-[var(--ax-bg)] text-[var(--ax-text)]">
        {/* ═══════════ LEFT SIDEBAR · 240px ═══════════ */}
        <aside
          className="hidden w-[240px] shrink-0 flex-col border-r md:flex"
          style={{ background: "var(--ax-card)", borderColor: "var(--ax-border)" }}
        >
          <Sidebar path={path} navigate={navigate} />
        </aside>

        {/* Mobile sidebar overlay */}
        {open ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <aside
              className="absolute left-0 top-0 h-full w-[260px] border-r shadow-xl"
              style={{ background: "var(--ax-card)", borderColor: "var(--ax-border)" }}
            >
              <div
                className="flex h-[52px] items-center justify-between border-b px-4"
                style={{ borderColor: "var(--ax-border)" }}
              >
                <span className="text-[13px] font-semibold tracking-tight">{brand.brandName}</span>
                <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label={t("shell.menu.close")}>
                  <X className="size-4" />
                </Button>
              </div>
              <div className="h-[calc(100%-52px)]">
                <Sidebar
                  path={path}
                  navigate={(href) => {
                    setOpen(false);
                    navigate(href);
                  }}
                  hideHeader
                />
              </div>
            </aside>
          </div>
        ) : null}

        {/* ═══════════ MAIN CANVAS ═══════════ */}
        <main className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
          {/* TOP HEADER — breadcrumb + theme toggle */}
          <header
            className="flex h-[52px] shrink-0 items-center justify-between border-b px-4 md:px-6"
            style={{ background: "var(--ax-card)", borderColor: "var(--ax-border)" }}
          >
            <div className="flex min-w-0 items-center gap-2 text-[12px]">
              <Button
                variant="ghost"
                size="icon-sm"
                className="md:hidden"
                onClick={() => setOpen(true)}
                aria-label={t("shell.menu.open")}
              >
                <Menu className="size-4" />
              </Button>
              <span className="hidden truncate ax-muted md:inline">Console</span>
              {crumbs.map((c, i) => (
                <span key={`${c.label}-${i}`} className="flex items-center gap-2">
                  {i > 0 ? (
                    <ChevronRight className="size-3 shrink-0" style={{ color: "var(--ax-muted)" }} />
                  ) : null}
                  <span
                    className={cn(
                      "truncate",
                      i === crumbs.length - 1 ? "font-medium" : "ax-muted",
                    )}
                    style={i === crumbs.length - 1 ? { color: "var(--ax-text)" } : undefined}
                  >
                    {c.label}
                  </span>
                </span>
              ))}
              <span
                className={cn(
                  "ax-chip ml-3 hidden sm:inline-flex",
                )}
              >
                <span
                  className="ax-chip-dot"
                  style={{
                    background:
                      statusInfo.tone === "danger"
                        ? "var(--ax-danger)"
                        : statusInfo.tone === "warning"
                        ? "var(--ax-warning)"
                        : "var(--ax-positive)",
                  }}
                />
                {statusLabel}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={toggleLang}
                    aria-label={langLabel}
                    className="font-mono text-[11px] font-semibold tracking-wider"
                  >
                    <Languages className="size-3.5" />
                    <span className="ml-1">{lang === "en" ? "EN" : "中"}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{langLabel}</TooltipContent>
              </Tooltip>

              {/* Physical Sovereign theme toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    aria-label={themeLabel}
                    className="ax-toggle-shell"
                  >
                    <span className="ax-toggle-knob">
                      {theme === "dark" ? (
                        <Moon className="size-[11px]" strokeWidth={2} />
                      ) : (
                        <Sun className="size-[11px]" strokeWidth={2} />
                      )}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>{themeLabel}</TooltipContent>
              </Tooltip>

              <form method="post" action="/api/logout" className="hidden sm:block">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon-sm" type="submit" aria-label={t("shell.signout")}>
                      <LogOut className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t("shell.signout")}</TooltipContent>
                </Tooltip>
              </form>

              {/* Operator avatar */}
              <span
                className="ax-kpi flex size-8 items-center justify-center rounded-full border text-[11px] font-semibold"
                style={{
                  background: "var(--ax-hover)",
                  color: "var(--ax-text)",
                  borderColor: "var(--ax-border)",
                }}
                aria-hidden
              >
                JX
              </span>
            </div>
          </header>

          {/* SCROLLABLE WORKSPACE */}
          <div
            className="scroll-thin flex-1 overflow-y-auto px-4 py-5 md:px-6"
            style={{ background: "var(--ax-bg)" }}
          >
            <div className="mx-auto w-full max-w-[1440px] space-y-5">{children}</div>
          </div>
        </main>

        <Toaster position="top-right" theme={theme} />
      </div>
    </TooltipProvider>
  );
}
