import { Archive, CalendarDays, Gauge, MoreHorizontal, Sparkles } from "lucide-react";

const TABS = [
  { href: "/app",   label: "今日",  Icon: Gauge },
  { href: "/daily", label: "记录",  Icon: CalendarDays },
  { href: "/files", label: "文档",  Icon: Archive },
  { href: "/ai",    label: "AI",   Icon: Sparkles },
  { href: "/more",  label: "更多",  Icon: MoreHorizontal },
] as const;

function isActive(path: string, href: string): boolean {
  if (href === "/app") return path === "/" || path === "/app";
  if (href === "/files") return path === "/files" || path === "/library";
  if (href === "/more") return path === "/more" || path === "/profile" || path === "/plan-90";
  return path.startsWith(href);
}

export function BottomNav({
  path,
  navigate,
}: {
  path: string;
  navigate: (href: string) => void;
}) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {TABS.map(({ href, label, Icon }) => (
        <button
          key={href}
          className={`bnav-item${isActive(path, href) ? " active" : ""}`}
          onClick={() => navigate(href)}
          aria-current={isActive(path, href) ? "page" : undefined}
        >
          <Icon size={22} strokeWidth={isActive(path, href) ? 2.2 : 1.8} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
