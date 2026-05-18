import { Archive, CalendarDays, Gauge, MoreHorizontal, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/app", label: "今日", Icon: Gauge },
  { href: "/daily", label: "记录", Icon: CalendarDays },
  { href: "/files", label: "文档", Icon: Archive },
  { href: "/ai", label: "AI", Icon: Sparkles },
  { href: "/more", label: "更多", Icon: MoreHorizontal },
] as const;

function isActive(path: string, href: string): boolean {
  if (href === "/app") return path === "/" || path === "/app";
  if (href === "/files") return path === "/files" || path === "/library";
  if (href === "/more") return path === "/more";
  return path.startsWith(href);
}

export function BottomNav({ path, navigate }: { path: string; navigate: (href: string) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/92 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 backdrop-blur-xl md:hidden" aria-label="主导航">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {tabs.map(({ href, label, Icon }) => {
          const active = isActive(path, href);
          return (
            <button
              key={href}
              type="button"
              className={cn(
                "flex h-12 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium text-muted-foreground transition-colors",
                active && "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
              )}
              onClick={() => navigate(href)}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="size-4" strokeWidth={active ? 2.4 : 1.9} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
