import { useState, type ReactNode } from "react";
import { Languages, LogOut, Menu, Moon, Sun, X } from "lucide-react";
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

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-border md:flex">
          <Sidebar path={path} navigate={navigate} />
        </aside>

        {/* Mobile sidebar overlay */}
        {open ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-64 border-r border-border bg-[var(--sidebar)] shadow-xl">
              <div className="flex h-14 items-center justify-between px-4">
                <span className="text-sm font-semibold tracking-tight">{brand.brandName}</span>
                <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label={t("shell.menu.close")}>
                  <X className="size-4" />
                </Button>
              </div>
              <div className="h-[calc(100%-3.5rem)]">
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

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-6">
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              onClick={() => setOpen(true)}
              aria-label={t("shell.menu.open")}
            >
              <Menu className="size-4" />
            </Button>
            <div className="flex items-center gap-2 md:hidden">
              <span className="text-sm font-semibold tracking-tight">{brand.brandName}</span>
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <span
                className={cn(
                  "ax-status hidden sm:inline-flex",
                  statusInfo.tone === "danger"
                    ? "ax-status-danger"
                    : statusInfo.tone === "warning"
                    ? "ax-status-warning"
                    : "ax-status-positive"
                )}
              >
                {statusLabel}
              </span>

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

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon-sm" onClick={toggleTheme} aria-label={themeLabel}>
                    {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                  </Button>
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
            </div>
          </header>
          <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto w-full max-w-[1240px]">{children}</div>
          </main>
        </div>

        <Toaster position="top-right" theme={theme} />
      </div>
    </TooltipProvider>
  );
}
