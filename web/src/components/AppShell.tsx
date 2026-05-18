import type { PointerEvent, ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { TopNav } from "./TopNav";

export function AppShell({
  children,
  isLogin,
  path,
  status,
  theme,
  navigate,
  onToggleTheme,
  onPointerMove,
  onPointerLeave,
}: {
  children: ReactNode;
  isLogin: boolean;
  path: string;
  status: string;
  theme: "light" | "dark";
  navigate: (href: string) => void;
  onToggleTheme: () => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerLeave: (event: PointerEvent<HTMLElement>) => void;
}) {
  return (
    <div
      className={`app-shell ${isLogin ? "login-shell" : "has-bottom-nav"}`}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      {isLogin ? null : (
        <TopNav
          path={path}
          status={status}
          theme={theme}
          navigate={navigate}
          onToggleTheme={onToggleTheme}
        />
      )}
      <main className="page-stage">{children}</main>
      {isLogin ? null : <BottomNav path={path} navigate={navigate} />}
    </div>
  );
}
