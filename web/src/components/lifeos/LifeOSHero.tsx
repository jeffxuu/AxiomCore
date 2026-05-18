import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function LifeOSHero({
  eyebrow,
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("relative overflow-hidden border-border/80 bg-[linear-gradient(135deg,var(--card),color-mix(in_oklch,var(--muted)_72%,white))] shadow-sm", className)}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-[radial-gradient(circle_at_30%_0%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_62%)]" />
      <CardContent className="relative flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="min-w-0 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {Icon ? (
              <span className="flex size-8 items-center justify-center rounded-full bg-background/80 text-foreground ring-1 ring-border">
                <Icon className="size-4" />
              </span>
            ) : null}
            {eyebrow}
          </div>
          <div className="space-y-2">
            <h1 className="text-balance text-2xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
          </div>
          {children}
        </div>
        {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
