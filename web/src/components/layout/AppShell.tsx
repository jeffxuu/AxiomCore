import { useState, type ReactNode } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useBrand } from "@/lib/brandConfig";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";

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
  const [open, setOpen] = useState(false);

  if (isLogin) {
    return (
      <TooltipProvider delayDuration={150}>
        <div className="min-h-screen w-full bg-background text-foreground">
          <main className="mx-auto flex min-h-screen max-w-md items-center justify-center px-4 py-10">
            {children}
          </main>
          <Toaster position="top-right" theme="dark" />
        </div>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-border md:flex">
          <Sidebar path={path} navigate={navigate} status={status} />
        </aside>

        {/* Mobile sidebar overlay */}
        {open ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-64 border-r border-border bg-[var(--sidebar)] shadow-xl">
              <div className="flex h-14 items-center justify-between px-4">
                <span className="text-sm font-semibold tracking-tight">{brand.brandName}</span>
                <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close menu">
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
                  status={status}
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
              aria-label="Open menu"
            >
              <Menu className="size-4" />
            </Button>
            <div className="flex items-center gap-2 md:hidden">
              <span className="text-sm font-semibold tracking-tight">{brand.brandName}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span
                className={cn(
                  "ax-status",
                  /fail|error/i.test(status)
                    ? "ax-status-danger"
                    : /sync|loading|saving/i.test(status)
                    ? "ax-status-warning"
                    : "ax-status-positive"
                )}
              >
                {status}
              </span>
              <form method="post" action="/api/logout" className="hidden sm:block">
                <Button variant="ghost" size="icon-sm" type="submit" aria-label="Sign out">
                  <LogOut className="size-4" />
                </Button>
              </form>
            </div>
          </header>
          <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
            <div className="mx-auto w-full max-w-[1240px]">{children}</div>
          </main>
        </div>

        <Toaster position="top-right" theme="dark" />
      </div>
    </TooltipProvider>
  );
}
