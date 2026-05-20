import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function InsightCard({
  title,
  subtitle,
  badge,
  alert,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  badge?: ReactNode;
  alert?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "ax-card relative overflow-hidden",
        alert ? "ring-1" : null,
        className,
      )}
      style={
        alert
          ? {
              borderColor: "var(--ax-danger)",
              boxShadow: "0 0 0 1px color-mix(in srgb, var(--ax-danger) 18%, transparent)",
            }
          : undefined
      }
    >
      <header
        className="flex items-start justify-between gap-3 border-b px-6 py-[18px]"
        style={{ borderColor: "var(--ax-border)" }}
      >
        <div className="min-w-0">
          <h2
            className={cn("ax-h-title")}
            style={alert ? { color: "var(--ax-danger)" } : undefined}
          >
            {title}
          </h2>
          {subtitle ? <p className="ax-h-sub">{subtitle}</p> : null}
        </div>
        {badge ? <div className="shrink-0">{badge}</div> : null}
      </header>
      <div className="px-6 py-[18px]">{children}</div>
    </section>
  );
}

export function EmptyCanvas({ label }: { label: string }) {
  return (
    <div
      className="flex h-full min-h-[260px] items-center justify-center rounded-md border border-dashed"
      style={{ borderColor: "var(--ax-border-strong)", background: "var(--ax-canvas)" }}
    >
      <p
        className="font-sans text-[11px] tracking-tight"
        style={{ color: "var(--ax-muted)" }}
      >
        {label}
      </p>
    </div>
  );
}
