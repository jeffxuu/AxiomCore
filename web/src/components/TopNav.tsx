import { Archive, BookOpen, CalendarDays, ChevronDown, Gauge, LogOut, Moon, Sparkles, Sun, Target } from "lucide-react";
import type { MouseEvent } from "react";
import { useBrand } from "@/lib/brandConfig";
import { IconButton } from "./IconButton";

const primaryItems = [
  { href: "/app", label: "今日", Icon: Gauge },
  { href: "/daily", label: "记录", Icon: CalendarDays },
  { href: "/files", label: "文档", Icon: Archive },
  { href: "/ai", label: "AI", Icon: Sparkles },
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
    <header className="top-nav">
      <a className="brand-lockup" href="/app" onClick={(event) => routeClick(event, "/app", navigate)}>
        <span className="brand-mark">OS</span>
        <span>
          <strong>{brand.brandName}</strong>
          <small>{brand.tagline}</small>
        </span>
      </a>

      <nav className="desktop-nav" aria-label="主导航">
        {primaryItems.map(({ href, label, Icon }) => (
          <a key={href} href={href} className={isActive(path, href) ? "active" : ""} onClick={(event) => routeClick(event, href, navigate)}>
            <Icon size={16} />
            {label}
          </a>
        ))}
        <details className={`more-menu${["/more", "/profile", "/plan-90"].includes(path) ? " active" : ""}`}>
          <summary>
            <ChevronDown size={16} />
            更多
          </summary>
          <div className="more-popover">
            <button type="button" onClick={() => navigate("/profile")}>
              <BookOpen size={15} />
              个人档案
            </button>
            <button type="button" onClick={() => navigate("/plan-90")}>
              <Target size={15} />
              90 天计划
            </button>
            <button type="button" onClick={() => navigate("/more")}>
              <Sparkles size={15} />
              更多入口
            </button>
          </div>
        </details>
      </nav>

      <div className="nav-actions">
        <span className="sync-pill"><i />{status}</span>
        <IconButton label="切换主题" variant="secondary" onClick={onToggleTheme}>
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </IconButton>
        <form method="post" action="/api/logout">
          <IconButton label="退出登录" variant="secondary" type="submit">
            <LogOut size={17} />
          </IconButton>
        </form>
      </div>
    </header>
  );
}
