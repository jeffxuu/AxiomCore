import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
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
}: {
  children: ReactNode;
  isLogin: boolean;
  path: string;
  status: string;
  theme: "light" | "dark";
  navigate: (href: string) => void;
  onToggleTheme: () => void;
}) {
  return (
    <TooltipProvider delayDuration={180}>
      <div className={cn("min-h-screen bg-background text-foreground", isLogin ? "flex items-center justify-center px-4 py-10" : "pb-24 md:pb-0")}>
        {isLogin ? null : (
          <TopNav
            path={path}
            status={status}
            theme={theme}
            navigate={navigate}
            onToggleTheme={onToggleTheme}
          />
        )}
        <main className={cn("w-full", isLogin ? "mx-auto max-w-md" : "mx-auto max-w-[1180px] px-4 py-5 sm:px-6 md:py-8")}>
          {children}
        </main>
        {isLogin ? null : <BottomNav path={path} navigate={navigate} />}
        <Toaster position="top-right" theme={theme} richColors closeButton />
      </div>
    </TooltipProvider>
  );
}
