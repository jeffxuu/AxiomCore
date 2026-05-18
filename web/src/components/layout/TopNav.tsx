import { Archive, BookOpen, CalendarDays, Gauge, LogOut, Moon, Sparkles, Sun, Target } from "lucide-react";
import type { MouseEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useBrand } from "@/lib/brandConfig";
import { cn } from "@/lib/utils";

const primaryItems = [
  { href: "/app", label: "今日", Icon: Gauge },
  { href: "/daily", label: "记录", Icon: CalendarDays },
  { href: "/files", label: "文档", Icon: Archive },
  { href: "/ai", label: "AI", Icon: Sparkles },
] as const;

const secondaryItems = [
  { href: "/profile", label: "个人档案", Icon: BookOpen },
  { href: "/plan-90", label: "90 天计划", Icon: Target },
  { href: "/more", label: "更多入口", Icon: Sparkles },
] as const;

function isActive(path: string, href: string): boolean {
  if (href === "/app") return path === "/" || path === "/app";
  if (href === "/files") return path === "/files" || path === "/library";
  return path.startsWith(href);
}

function routeClick(event: MouseEvent<HTMLAnchorElement>, href: string, navigate: (href: string) => void) {
  event.preventDefault();
  navigate(href);
}

export function TopNav({
  path,
  status,
  theme,
  navigate,
  onToggleTheme,
}: {
  path: string;
  status: string;
  theme: "light" | "dark";
  navigate: (href: string) => void;
  onToggleTheme: () => void;
}) {
  const brand = useBrand();
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/86 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1180px] items-center gap-3 px-4 sm:px-6">
        <a className="flex min-w-0 items-center gap-3" href="/app" onClick={(event) => routeClick(event, "/app", navigate)}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-[11px] font-semibold tracking-[0.18em] text-white shadow-sm dark:bg-white dark:text-slate-950">
            OS
          </span>
          <span className="min-w-0">
            <strong className="block truncate text-sm font-semibold tracking-tight">{brand.brandName}</strong>
            <small className="hidden truncate text-xs text-muted-foreground sm:block">{brand.tagline}</small>
          </span>
        </a>

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="主导航">
          {primaryItems.map(({ href, label, Icon }) => (
            <a
              key={href}
              href={href}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isActive(path, href) && "bg-slate-950 text-white hover:bg-slate-900 hover:text-white dark:bg-white dark:text-slate-950"
              )}
              onClick={(event) => routeClick(event, href, navigate)}
            >
              <Icon className="size-4" />
              {label}
            </a>
          ))}
          {secondaryItems.map(({ href, label, Icon }) => (
            <a
              key={href}
              href={href}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                isActive(path, href) && "bg-slate-950 text-white hover:bg-slate-900 hover:text-white dark:bg-white dark:text-slate-950"
              )}
              onClick={(event) => routeClick(event, href, navigate)}
            >
              <Icon className="size-4" />
              {label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Badge variant="outline" className="hidden h-8 gap-1.5 rounded-full border-border/80 bg-background px-3 text-muted-foreground sm:inline-flex">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            {status}
          </Badge>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="icon-sm" onClick={onToggleTheme} aria-label="切换主题">
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>切换主题</TooltipContent>
          </Tooltip>
          <form method="post" action="/api/logout">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon-sm" type="submit" aria-label="退出登录">
                  <LogOut className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>退出登录</TooltipContent>
            </Tooltip>
          </form>
        </div>
      </div>
    </header>
  );
}
